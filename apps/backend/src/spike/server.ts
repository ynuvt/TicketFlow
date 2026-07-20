import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { globalEventStore } from './eventStore';
import { ReplayRequestPayload, ReplayResponsePayload, OrderStatus } from '../types/events';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*' },
});

app.use(express.json());

io.on('connection', (socket: Socket) => {
  socket.on('station:join', ({ kitchenId, stationId }: { kitchenId: string; stationId: string }) => {
    const room = `kitchen:${kitchenId}`;
    socket.join(room);
  });

  socket.on('order:transition', (data: { kitchenId: string; orderId: string; newStatus: OrderStatus; stationId?: string }) => {
    const event = globalEventStore.appendEvent(
      data.kitchenId,
      data.orderId,
      'ORDER_TRANSITIONED',
      {
        newStatus: data.newStatus,
        stationId: data.stationId,
      }
    );

    const room = `kitchen:${data.kitchenId}`;
    io.to(room).emit('order:transition', event);
  });

  socket.on('order:replayRequest', (payload: ReplayRequestPayload) => {
    const { kitchenId, lastProcessedSequence } = payload;
    const missingEvents = globalEventStore.getEventsAfter(kitchenId, lastProcessedSequence);
    const latestSeq = globalEventStore.getLatestSequence(kitchenId);

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
