import express, { Request, Response, NextFunction } from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { globalEventStore } from './eventStore';
import {
  ReplayRequestPayload,
  ReplayResponsePayload,
  OrderStatus,
  CreateOrderPayload,
  StationId,
  KitchenEvent,
} from '@ticketflow/types';
import { validateStateTransition } from '../domain/stateMachine';
import { orderRepository } from '../repositories/order.repository';
import { userRepository } from '../repositories/user.repository';
import { prisma } from '../lib/prisma';

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
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, x-user-id, x-user-role');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

// Default Kitchen Instance
const DEFAULT_KITCHEN_ID = 'kitchen-main';

// Ensure Default Users exist on boot (Manager, Cook, Receptionist)
userRepository.ensureDefaultUsers();

// Initialize in-memory event store cache from DB on startup
globalEventStore.initialize();

// Helper middleware to check roles/permissions
function authorizeRoles(allowedRoles: ('MANAGER' | 'STAFF' | 'RECEPTIONIST')[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.headers['x-user-role'] as 'MANAGER' | 'STAFF' | 'RECEPTIONIST' | undefined;
    if (!userRole || !allowedRoles.includes(userRole)) {
      res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      return;
    }
    next();
  };
}

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
        stationPrepTimes: user.stationPrepTimes,
      },
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Staff User Management Endpoints (MANAGER only)
app.get('/api/users', authorizeRoles(['MANAGER']), async (req: Request, res: Response) => {
  try {
    const users = await userRepository.getAllUsers();
    res.json({ users });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/users', authorizeRoles(['MANAGER']), async (req: Request, res: Response) => {
  try {
    const newUser = await userRepository.createUser(req.body);
    res.json({ user: newUser });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/users/:id', authorizeRoles(['MANAGER']), async (req: Request, res: Response) => {
  try {
    const userId = (req.params.id as string);
    const updated = await userRepository.updateUser({ id: userId, ...req.body });
    res.json({ user: updated });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/users/:id', authorizeRoles(['MANAGER']), async (req: Request, res: Response) => {
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

app.get('/api/metrics/workload', async (req: Request, res: Response) => {
  const kitchenId = (req.query.kitchenId as string) || DEFAULT_KITCHEN_ID;
  try {
    const metrics = await orderRepository.getKitchenWorkloadMetrics(kitchenId);
    res.json(metrics);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/db/clear', async (req: Request, res: Response) => {
  try {
    await prisma.orderItem.deleteMany({});
    await prisma.orderEvent.deleteMany({});
    await prisma.kitchenMetric.deleteMany({});
    await prisma.order.deleteMany({});
    await prisma.station.deleteMany({});
    await prisma.user.deleteMany({});
    await prisma.kitchen.deleteMany({});

    globalEventStore.clear();
    await userRepository.ensureDefaultUsers();

    io.emit('order:reset', { kitchenId: DEFAULT_KITCHEN_ID });

    res.json({ success: true, message: 'Database and in-memory event store cleared successfully!' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Create Order (MANAGER and RECEPTIONIST only)
app.post('/api/orders', authorizeRoles(['MANAGER', 'RECEPTIONIST']), async (req: Request, res: Response) => {
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

    const clientEvent: KitchenEvent = {
      sequenceNumber: Number(dbResult.event.sequenceNumber),
      eventId: dbResult.event.id,
      kitchenId: dbResult.event.kitchenId,
      orderId: dbResult.event.orderId,
      type: dbResult.event.type as any,
      payload: typeof dbResult.event.payload === 'string' ? JSON.parse(dbResult.event.payload) : dbResult.event.payload,
      timestamp: new Date(dbResult.event.createdAt).getTime(),
    };

    globalEventStore.appendEvent(clientEvent);

    const room = `kitchen:${kitchenId}`;
    io.to(room).emit('order:transition', clientEvent);

    res.status(201).json({ success: true, orderId: dbResult.order.id, event: clientEvent });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Transition Order (Any authenticated role, but with fine-grained rules)
app.post('/api/orders/:id/transition', authorizeRoles(['MANAGER', 'STAFF', 'RECEPTIONIST']), async (req: Request, res: Response) => {
  const orderId = String(req.params.id);
  const { kitchenId = DEFAULT_KITCHEN_ID, currentStatus, newStatus, stationId } = req.body;
  const userRole = req.headers['x-user-role'] as string;
  const userId = req.headers['x-user-id'] as string;

  try {
    if (currentStatus && newStatus) {
      validateStateTransition(currentStatus as OrderStatus, newStatus as OrderStatus);
    }

    // RBAC: STAFF can only transition if they have access to source or target station
    if (userRole === 'STAFF') {
      const dbUser = await prisma.user.findUnique({ where: { id: userId } });
      if (!dbUser) {
        res.status(401).json({ error: 'Unauthorized: User session invalid' });
        return;
      }
      const currentOrder = await prisma.order.findUnique({ where: { id: orderId } });
      const currentStation = currentOrder ? currentOrder.currentStationId : 'prep';

      const hasSourceAccess = dbUser.assignedStations.includes(currentStation);
      const hasTargetAccess = stationId ? dbUser.assignedStations.includes(stationId) : true;

      if (!hasSourceAccess && !hasTargetAccess) {
        res.status(403).json({ error: 'Forbidden: Insufficient privileges for this station' });
        return;
      }
    }

    // RBAC: RECEPTIONIST can only transition from intake to prep
    if (userRole === 'RECEPTIONIST') {
      const currentOrder = await prisma.order.findUnique({ where: { id: orderId } });
      const currentStation = currentOrder ? currentOrder.currentStationId : 'intake';
      if (currentStation !== 'intake' || stationId !== 'prep') {
        res.status(403).json({ error: 'Forbidden: Receptionist can only send orders from Intake to Prep' });
        return;
      }
    }

    const dbResult = await orderRepository.transitionOrder({
      orderId,
      kitchenId,
      targetStatus: newStatus as OrderStatus,
      nextStationId: stationId,
    });

    const clientEvent: KitchenEvent = {
      sequenceNumber: Number(dbResult.event.sequenceNumber),
      eventId: dbResult.event.id,
      kitchenId: dbResult.event.kitchenId,
      orderId: dbResult.event.orderId,
      type: dbResult.event.type as any,
      payload: typeof dbResult.event.payload === 'string' ? JSON.parse(dbResult.event.payload) : dbResult.event.payload,
      timestamp: new Date(dbResult.event.createdAt).getTime(),
    };

    globalEventStore.appendEvent(clientEvent);

    const room = `kitchen:${kitchenId}`;
    io.to(room).emit('order:transition', clientEvent);

    // Process sliding-window waiting list assignment events
    if (dbResult.extraEvents && dbResult.extraEvents.length > 0) {
      for (const extra of dbResult.extraEvents) {
        const extraClientEvent: KitchenEvent = {
          sequenceNumber: Number(extra.event.sequenceNumber),
          eventId: extra.event.id,
          kitchenId: extra.event.kitchenId,
          orderId: extra.event.orderId,
          type: extra.event.type as any,
          payload: typeof extra.event.payload === 'string' ? JSON.parse(extra.event.payload) : extra.event.payload,
          timestamp: new Date(extra.event.createdAt).getTime(),
        };

        globalEventStore.appendEvent(extraClientEvent);
        io.to(room).emit('order:transition', extraClientEvent);
      }
    }

    res.json({ success: true, event: clientEvent });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Socket.IO Event Handlers
io.on('connection', (socket: Socket) => {
  console.log(`[Socket] Client connected: ${socket.id}`);

  socket.on('station:join', ({ kitchenId, stationId, userId, userRole, userAssignedStations }: { 
    kitchenId: string; 
    stationId: string; 
    userId?: string; 
    userRole?: string; 
    userAssignedStations?: string[]; 
  }) => {
    const room = `kitchen:${kitchenId}`;

    // Socket Role Check
    const isAllowed = !userRole || userRole === 'MANAGER' ||
      (userRole === 'RECEPTIONIST' && stationId === 'intake') ||
      (userRole === 'STAFF' && userAssignedStations?.includes(stationId));

    if (!isAllowed) {
      console.warn(`[Socket] Rejected join to ${stationId} for user ${userId} (${userRole})`);
      socket.emit('order:error', { message: 'Unauthorized station access' });
      return;
    }

    socket.join(room);
    console.log(`[Socket] Client ${socket.id} joined ${room} for station ${stationId}`);
  });

  socket.on('order:create', async (data: CreateOrderPayload & { userId?: string; userRole?: string }) => {
    const kitchenId = data.kitchenId || DEFAULT_KITCHEN_ID;
    const { userRole } = data;

    if (userRole && userRole !== 'MANAGER' && userRole !== 'RECEPTIONIST') {
      socket.emit('order:error', { message: 'Forbidden: Insufficient privileges' });
      return;
    }

    try {
      const dbResult = await orderRepository.createOrder({
        kitchenId,
        customerName: data.customerName,
        items: data.items as any,
        priority: data.priority === 'VIP' ? 2 : data.priority === 'HIGH' ? 1 : 0,
        estimatedPrepTime: data.estimatedPrepTime || 10,
        initialStationId: data.stationId || 'intake',
      });

      const clientEvent: KitchenEvent = {
        sequenceNumber: Number(dbResult.event.sequenceNumber),
        eventId: dbResult.event.id,
        kitchenId: dbResult.event.kitchenId,
        orderId: dbResult.event.orderId,
        type: dbResult.event.type as any,
        payload: typeof dbResult.event.payload === 'string' ? JSON.parse(dbResult.event.payload) : dbResult.event.payload,
        timestamp: new Date(dbResult.event.createdAt).getTime(),
      };

      globalEventStore.appendEvent(clientEvent);

      const room = `kitchen:${kitchenId}`;
      io.to(room).emit('order:transition', clientEvent);
    } catch (err: any) {
      console.error('[Socket] Failed to create order in DB:', err.message);
      socket.emit('order:error', { message: err.message });
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
      userId?: string;
      userRole?: string;
    }) => {
      try {
        const { userId, userRole } = data;

        // Perform authorization checks matching the REST API
        if (userRole === 'STAFF' && userId) {
          const dbUser = await prisma.user.findUnique({ where: { id: userId } });
          if (!dbUser) {
            socket.emit('order:error', { message: 'Unauthorized: User not found', orderId: data.orderId });
            return;
          }
          const currentOrder = await prisma.order.findUnique({ where: { id: data.orderId } });
          const currentStation = currentOrder ? currentOrder.currentStationId : 'prep';

          const hasSourceAccess = dbUser.assignedStations.includes(currentStation);
          const hasTargetAccess = data.stationId ? dbUser.assignedStations.includes(data.stationId) : true;

          if (!hasSourceAccess && !hasTargetAccess) {
            socket.emit('order:error', { message: 'Forbidden: Insufficient privileges for this station', orderId: data.orderId });
            return;
          }
        }

        if (userRole === 'RECEPTIONIST') {
          const currentOrder = await prisma.order.findUnique({ where: { id: data.orderId } });
          const currentStation = currentOrder ? currentOrder.currentStationId : 'intake';
          if (currentStation !== 'intake' || data.stationId !== 'prep') {
            socket.emit('order:error', { message: 'Forbidden: Receptionist can only transition from Intake to Prep', orderId: data.orderId });
            return;
          }
        }

        if (data.currentStatus) {
          validateStateTransition(data.currentStatus, data.newStatus);
        }

        const dbResult = await orderRepository.transitionOrder({
          orderId: data.orderId,
          kitchenId: data.kitchenId,
          targetStatus: data.newStatus,
          nextStationId: data.stationId,
        });

        const clientEvent: KitchenEvent = {
          sequenceNumber: Number(dbResult.event.sequenceNumber),
          eventId: dbResult.event.id,
          kitchenId: dbResult.event.kitchenId,
          orderId: dbResult.event.orderId,
          type: dbResult.event.type as any,
          payload: typeof dbResult.event.payload === 'string' ? JSON.parse(dbResult.event.payload) : dbResult.event.payload,
          timestamp: new Date(dbResult.event.createdAt).getTime(),
        };

        globalEventStore.appendEvent(clientEvent);

        const room = `kitchen:${data.kitchenId}`;
        io.to(room).emit('order:transition', clientEvent);

        // Process sliding-window waiting list assignment events
        if (dbResult.extraEvents && dbResult.extraEvents.length > 0) {
          for (const extra of dbResult.extraEvents) {
            const extraClientEvent: KitchenEvent = {
              sequenceNumber: Number(extra.event.sequenceNumber),
              eventId: extra.event.id,
              kitchenId: extra.event.kitchenId,
              orderId: extra.event.orderId,
              type: extra.event.type as any,
              payload: typeof extra.event.payload === 'string' ? JSON.parse(extra.event.payload) : extra.event.payload,
              timestamp: new Date(extra.event.createdAt).getTime(),
            };

            globalEventStore.appendEvent(extraClientEvent);
            io.to(room).emit('order:transition', extraClientEvent);
          }
        }
      } catch (err: any) {
        console.error(`[Socket] Transition rejected for order ${data.orderId}:`, err.message);
        socket.emit('order:error', { message: err.message, orderId: data.orderId });
      }
    }
  );

  socket.on('order:replayRequest', async (payload: ReplayRequestPayload) => {
    const { kitchenId, lastProcessedSequence } = payload;
    let missingEvents = globalEventStore.getEventsAfter(kitchenId, lastProcessedSequence);

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
