import express, { Request, Response } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { globalEventStore } from './eventStore';
import {
  ReplayRequestPayload,
  ReplayResponsePayload,
  OrderStatus,
  CreateOrderPayload,
  StationId,
} from '@ticketflow/types';
import { validateStateTransition } from '../domain/stateMachine';
import { generateUsers } from 'indseed';
import { orderRepository } from '../repositories/order.repository';
import { userRepository } from '../repositories/user.repository';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
  },
});

app.use(express.json());

// Enable CORS manually for fetch API
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Default Kitchen Instance
const DEFAULT_KITCHEN_ID = 'kitchen-main';

// Ensure Default Admin User exists on boot
userRepository.ensureAdminUser();

// Auth Endpoints
app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { username, password } = req.body;
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }

  try {
    const user = await userRepository.findByUsername(username);
    if (!user || user.password !== password) {
      res.status(401).json({ error: 'Invalid username or password' });
      return;
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        assignedStations: user.assignedStations,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Staff User Management Endpoints
app.get('/api/users', async (req: Request, res: Response) => {
  try {
    const users = await userRepository.getAllUsers();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', async (req: Request, res: Response) => {
  try {
    const newUser = await userRepository.createUser(req.body);
    res.json({ user: newUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.params.id as string);
    const updated = await userRepository.updateUser({ id: userId, ...req.body });
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', async (req: Request, res: Response) => {
  try {
    const userId = (req.params.id as string);
    await userRepository.deleteUser(userId);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// REST API Endpoints
app.get('/api/events', (req: Request, res: Response) => {
  const kitchenId = (req.query.kitchenId as string) || DEFAULT_KITCHEN_ID;
  const sinceSeq = parseInt((req.query.since as string) || '0', 10);
  const events = globalEventStore.getEventsAfter(kitchenId, sinceSeq);
  res.json({ kitchenId, events, latestSequence: globalEventStore.getLatestSequence(kitchenId) });
});

app.post('/api/orders', async (req: Request, res: Response) => {
  const data: CreateOrderPayload = req.body;
  const kitchenId = data.kitchenId || DEFAULT_KITCHEN_ID;

  try {
    const dbResult = await orderRepository.createOrder({
      kitchenId,
      customerName: data.customerName,
      items: data.items as any,
      priority: data.priority === 'VIP' ? 2 : data.priority === 'HIGH' ? 1 : 0,
      estimatedPrepTime: data.estimatedPrepTime || 10,
      initialStationId: data.stationId || 'intake',
    });

    const event = globalEventStore.appendEvent(kitchenId, dbResult.order.id, 'ORDER_CREATED', {
      newStatus: 'PLACED',
      stationId: data.stationId || 'intake',
      customerName: data.customerName,
      items: data.items,
      priority: data.priority || 'NORMAL',
      estimatedPrepTime: data.estimatedPrepTime || 10,
    });

    const room = `kitchen:${kitchenId}`;
    io.to(room).emit('order:transition', event);

    res.status(201).json({ success: true, orderId: dbResult.order.id, event });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/orders/:id/transition', async (req: Request, res: Response) => {
  const orderId = String(req.params.id);
  const { kitchenId = DEFAULT_KITCHEN_ID, currentStatus, newStatus, stationId } = req.body;

  try {
    if (currentStatus && newStatus) {
      validateStateTransition(currentStatus as OrderStatus, newStatus as OrderStatus);
    }

    await orderRepository.transitionOrder({
      orderId,
      kitchenId,
      targetStatus: newStatus as OrderStatus,
      nextStationId: stationId,
    });

    const event = globalEventStore.appendEvent(kitchenId, orderId, 'ORDER_TRANSITIONED', {
      previousStatus: currentStatus,
      newStatus,
      stationId,
    });

    const room = `kitchen:${kitchenId}`;
    io.to(room).emit('order:transition', event);

    res.json({ success: true, event });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Socket.IO Event Handlers
io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('station:join', ({ kitchenId, stationId }: { kitchenId: string; stationId: string }) => {
    const room = `kitchen:${kitchenId}`;
    socket.join(room);
    console.log(`[Socket] Client ${socket.id} joined ${room} for station ${stationId}`);
  });

  socket.on('order:create', async (data: CreateOrderPayload) => {
    const kitchenId = data.kitchenId || DEFAULT_KITCHEN_ID;

    try {
      const dbResult = await orderRepository.createOrder({
        kitchenId,
        customerName: data.customerName,
        items: data.items as any,
        priority: data.priority === 'VIP' ? 2 : data.priority === 'HIGH' ? 1 : 0,
        estimatedPrepTime: data.estimatedPrepTime || 10,
        initialStationId: data.stationId || 'intake',
      });

      const event = globalEventStore.appendEvent(kitchenId, dbResult.order.id, 'ORDER_CREATED', {
        newStatus: 'PLACED',
        stationId: data.stationId || 'intake',
        customerName: data.customerName,
        items: data.items,
        priority: data.priority || 'NORMAL',
        estimatedPrepTime: data.estimatedPrepTime || 10,
      });

      const room = `kitchen:${kitchenId}`;
      io.to(room).emit('order:transition', event);
    } catch (err: any) {
      console.error('[Socket] Failed to create order in DB:', err.message);
    }
  });

  socket.on(
    'order:transition',
    async (data: {
      kitchenId: string;
      orderId: string;
      currentStatus?: OrderStatus;
      newStatus: OrderStatus;
      stationId?: StationId;
    }) => {
      try {
        if (data.currentStatus) {
          validateStateTransition(data.currentStatus, data.newStatus);
        }

        await orderRepository.transitionOrder({
          orderId: data.orderId,
          kitchenId: data.kitchenId,
          targetStatus: data.newStatus,
          nextStationId: data.stationId,
        });

        const event = globalEventStore.appendEvent(data.kitchenId, data.orderId, 'ORDER_TRANSITIONED', {
          previousStatus: data.currentStatus,
          newStatus: data.newStatus,
          stationId: data.stationId,
        });

        const room = `kitchen:${data.kitchenId}`;
        io.to(room).emit('order:transition', event);
      } catch (err: any) {
        console.error(`[Socket] Transition rejected for order ${data.orderId}:`, err.message);
        socket.emit('order:error', { message: err.message, orderId: data.orderId });
      }
    }
  );

  socket.on('order:replayRequest', async (payload: ReplayRequestPayload) => {
    const { kitchenId, lastProcessedSequence } = payload;
    let missingEvents = globalEventStore.getEventsAfter(kitchenId, lastProcessedSequence);

    // If memory store has no events (e.g. after server restart), fetch from PostgreSQL DB repository!
    if (missingEvents.length === 0) {
      try {
        const dbEvents = await orderRepository.getEventsAfter(kitchenId, lastProcessedSequence);
        if (dbEvents.length > 0) {
          missingEvents = dbEvents.map((evt: any) => ({
            sequenceNumber: Number(evt.sequenceNumber),
            eventId: evt.id,
            kitchenId: evt.kitchenId,
            orderId: evt.orderId,
            type: evt.type as any,
            payload: typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload,
            timestamp: new Date(evt.createdAt).getTime(),
          }));
        }
      } catch (err: any) {
        console.error('[Socket] Failed to fetch replay events from DB:', err.message);
      }
    }

    const latestSeq = missingEvents.length > 0
      ? missingEvents[missingEvents.length - 1].sequenceNumber
      : globalEventStore.getLatestSequence(kitchenId);

    console.log(
      `[Socket] Replay requested by ${payload.stationId} (Last Seq: ${lastProcessedSequence}, Server Latest: ${latestSeq}, Missing: ${missingEvents.length})`
    );

    const response: ReplayResponsePayload = {
      kitchenId,
      fromSequence: lastProcessedSequence + 1,
      toSequence: latestSeq,
      events: missingEvents,
    };

    socket.emit('order:replayResponse', response);
  });
});

export { httpServer, io };
