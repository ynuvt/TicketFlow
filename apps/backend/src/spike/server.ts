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

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(express.json());

// Enable CORS for REST requests
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
    return;
  }
  next();
});

const DEFAULT_KITCHEN_ID = 'kitchen-main';

// Helper function to seed sample orders
function seedInitialOrders(kitchenId: string) {
  const existingEvents = globalEventStore.getAllEvents(kitchenId);
  if (existingEvents.length > 0) return;

  const users = generateUsers(5);

  const sampleOrders: CreateOrderPayload[] = [
    {
      kitchenId,
      customerName: `${users[0]?.fullName || 'Rahul Sharma'} - Veggie Delight Combo`,
      priority: 'VIP',
      estimatedPrepTime: 10,
      stationId: 'intake',
      items: [
        { id: 'i1', name: 'Paneer Tikka Butter Masala Pizza', quantity: 1, notes: 'Extra cheese burst crust' },
        { id: 'i2', name: 'Spicy Paneer Crispy Burger', quantity: 1, notes: 'Extra mint mayo' },
        { id: 'i3', name: 'Crispy Salted French Fries', quantity: 1 },
      ],
    },
    {
      kitchenId,
      customerName: `${users[1]?.fullName || 'Ananya Patel'} - Chicken Feast Combo`,
      priority: 'HIGH',
      estimatedPrepTime: 12,
      stationId: 'prep',
      items: [
        { id: 'i4', name: 'Chicken Tikka Supreme Pizza', quantity: 1, notes: 'Double chicken tikka, thin crust' },
        { id: 'i5', name: 'Crispy Chicken Zinger Burger', quantity: 1, notes: 'Spicy mayo & lettuce' },
        { id: 'i6', name: 'Garlic Cheese Breadsticks', quantity: 1 },
      ],
    },
    {
      kitchenId,
      customerName: `${users[2]?.fullName || 'Rohan Verma'} - Indo-Italian Combo`,
      priority: 'NORMAL',
      estimatedPrepTime: 14,
      stationId: 'grill',
      items: [
        { id: 'i7', name: 'Chicken Pepperoni Feast Pizza', quantity: 1, notes: 'Extra chicken pepperoni' },
        { id: 'i8', name: 'Classic Veggie Herb Burger', quantity: 1, notes: 'Whole wheat bun' },
        { id: 'i9', name: 'Peri Peri Potato Wedges', quantity: 1 },
      ],
    },
  ];

  sampleOrders.forEach((ordPayload) => {
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const event = globalEventStore.appendEvent(kitchenId, orderId, 'ORDER_CREATED', {
      newStatus: 'PLACED',
      stationId: ordPayload.stationId || 'intake',
      customerName: ordPayload.customerName,
      items: ordPayload.items,
      priority: ordPayload.priority || 'NORMAL',
      estimatedPrepTime: ordPayload.estimatedPrepTime || 10,
    });
    console.log(`[Seed] Created order ${orderId} (Seq #${event.sequenceNumber})`);
  });
}

// Seed kitchen-main on startup
seedInitialOrders(DEFAULT_KITCHEN_ID);

// REST API Endpoints
app.get('/api/events', (req: Request, res: Response) => {
  const kitchenId = (req.query.kitchenId as string) || DEFAULT_KITCHEN_ID;
  const sinceSeq = parseInt((req.query.since as string) || '0', 10);
  const events = globalEventStore.getEventsAfter(kitchenId, sinceSeq);
  res.json({ kitchenId, events, latestSequence: globalEventStore.getLatestSequence(kitchenId) });
});

app.post('/api/orders', (req: Request, res: Response) => {
  const data: CreateOrderPayload = req.body;
  const kitchenId = data.kitchenId || DEFAULT_KITCHEN_ID;
  const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

  const event = globalEventStore.appendEvent(kitchenId, orderId, 'ORDER_CREATED', {
    newStatus: 'PLACED',
    stationId: data.stationId || 'intake',
    customerName: data.customerName,
    items: data.items,
    priority: data.priority || 'NORMAL',
    estimatedPrepTime: data.estimatedPrepTime || 10,
  });

  const room = `kitchen:${kitchenId}`;
  io.to(room).emit('order:transition', event);

  res.status(201).json({ success: true, orderId, event });
});

app.post('/api/orders/:id/transition', (req: Request, res: Response) => {
  const orderId = String(req.params.id);
  const { kitchenId = DEFAULT_KITCHEN_ID, currentStatus, newStatus, stationId } = req.body;

  try {
    if (currentStatus && newStatus) {
      validateStateTransition(currentStatus as OrderStatus, newStatus as OrderStatus);
    }

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

  socket.on('order:create', (data: CreateOrderPayload) => {
    const kitchenId = data.kitchenId || DEFAULT_KITCHEN_ID;
    const orderId = `ord-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;

    const event = globalEventStore.appendEvent(kitchenId, orderId, 'ORDER_CREATED', {
      newStatus: 'PLACED',
      stationId: data.stationId || 'intake',
      customerName: data.customerName,
      items: data.items,
      priority: data.priority || 'NORMAL',
      estimatedPrepTime: data.estimatedPrepTime || 10,
    });

    const room = `kitchen:${kitchenId}`;
    io.to(room).emit('order:transition', event);
  });

  socket.on(
    'order:transition',
    (data: {
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
      } catch (err: any) {
        console.error(`[Socket] Transition rejected for order ${data.orderId}:`, err.message);
        socket.emit('order:error', { message: err.message, orderId: data.orderId });
        return;
      }

      const event = globalEventStore.appendEvent(data.kitchenId, data.orderId, 'ORDER_TRANSITIONED', {
        previousStatus: data.currentStatus,
        newStatus: data.newStatus,
        stationId: data.stationId,
      });

      const room = `kitchen:${data.kitchenId}`;
      io.to(room).emit('order:transition', event);
    }
  );

  socket.on('order:replayRequest', (payload: ReplayRequestPayload) => {
    const { kitchenId, lastProcessedSequence } = payload;
    const missingEvents = globalEventStore.getEventsAfter(kitchenId, lastProcessedSequence);
    const latestSeq = globalEventStore.getLatestSequence(kitchenId);

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
