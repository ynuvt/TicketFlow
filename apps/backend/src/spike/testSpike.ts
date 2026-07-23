import { httpServer } from './server';
import { ReconnectClient } from './client';
import { globalEventStore } from './eventStore';

const PORT = 4001;
const KITCHEN_ID = 'kitchen-main';
const SERVER_URL = `http://localhost:${PORT}`;

async function runSpikeVerification() {
  await new Promise<void>((resolve) => {
    httpServer.listen(PORT, () => {
      resolve();
    });
  });

  const client = new ReconnectClient(SERVER_URL, KITCHEN_ID, 'station-intake');

  // Normal live stream
  client.connect();
  await sleep(300);

  client.socket.emit('order:transition', { kitchenId: KITCHEN_ID, orderId: 'ord-101', newStatus: 'PLACED' });
  client.socket.emit('order:transition', { kitchenId: KITCHEN_ID, orderId: 'ord-102', newStatus: 'PLACED' });

  await sleep(400);

  if (client.lastProcessedSequence !== 2) {
    throw new Error(`Phase 1 Failed: Expected seq 2, got ${client.lastProcessedSequence}`);
  }

  // Disconnect & generate offline events
  client.disconnect();
  await sleep(300);

  globalEventStore.appendEvent({
    sequenceNumber: 3,
    eventId: 'evt-3',
    kitchenId: KITCHEN_ID,
    orderId: 'ord-103',
    type: 'ORDER_TRANSITIONED',
    payload: { newStatus: 'PREPARING', stationId: 'prep' },
    timestamp: Date.now(),
  });
  globalEventStore.appendEvent({
    sequenceNumber: 4,
    eventId: 'evt-4',
    kitchenId: KITCHEN_ID,
    orderId: 'ord-104',
    type: 'ORDER_TRANSITIONED',
    payload: { newStatus: 'PREPARING', stationId: 'prep' },
    timestamp: Date.now(),
  });
  globalEventStore.appendEvent({
    sequenceNumber: 5,
    eventId: 'evt-5',
    kitchenId: KITCHEN_ID,
    orderId: 'ord-105',
    type: 'ORDER_TRANSITIONED',
    payload: { newStatus: 'READY', stationId: 'assembly' },
    timestamp: Date.now(),
  });

  // Reconnect & sync live
  client.connect();
  await sleep(30);
  client.socket.emit('order:transition', { kitchenId: KITCHEN_ID, orderId: 'ord-106', newStatus: 'SERVED' });

  await sleep(800);

  // Inject duplicate
  const duplicateEvt = globalEventStore.getEventsAfter(KITCHEN_ID, 2)[0];
  client.handleIncomingEvent(duplicateEvt);

  await sleep(300);

  const receivedSeqs = client.receivedEvents.map((e) => e.sequenceNumber);
  const isSequenceCorrect = JSON.stringify(receivedSeqs) === JSON.stringify([1, 2, 3, 4, 5, 6]);
  const noDuplicates = new Set(receivedSeqs).size === receivedSeqs.length;
  const isOnline = client.status === 'ONLINE';

  if (isSequenceCorrect && noDuplicates && isOnline) {
    console.log('Spike verification successful: 100% events replayed without duplicates or loss.');
    process.exit(0);
  } else {
    console.error('Spike verification failed.');
    process.exit(1);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

runSpikeVerification().catch((err) => {
  console.error('Fatal error running spike test:', err);
  process.exit(1);
});
