import { KitchenEvent } from '@ticketflow/types';
import { prisma } from '../lib/prisma';

export class InMemoryEventStore {
  private events: Map<string, KitchenEvent[]> = new Map();
  private sequences: Map<string, number> = new Map();

  public async initialize() {
    try {
      const dbEvents = await prisma.orderEvent.findMany({
        orderBy: { sequenceNumber: 'asc' },
      });

      this.events.clear();
      this.sequences.clear();

      for (const evt of dbEvents) {
        const clientEvent: KitchenEvent = {
          sequenceNumber: Number(evt.sequenceNumber),
          eventId: evt.id,
          kitchenId: evt.kitchenId,
          orderId: evt.orderId,
          type: evt.type as any,
          payload: typeof evt.payload === 'string' ? JSON.parse(evt.payload) : evt.payload,
          timestamp: new Date(evt.createdAt).getTime(),
        };

        const kitchenEvents = this.events.get(evt.kitchenId) || [];
        kitchenEvents.push(clientEvent);
        this.events.set(evt.kitchenId, kitchenEvents);
        this.sequences.set(evt.kitchenId, clientEvent.sequenceNumber);
      }
      console.log(`[EventStore] Initialized with ${dbEvents.length} events from database.`);
    } catch (err: any) {
      console.error('[EventStore] Initialization failed:', err.message);
    }
  }

  public appendEvent(event: KitchenEvent): KitchenEvent {
    const kitchenEvents = this.events.get(event.kitchenId) || [];
    // Ensure we do not add duplicate sequences to in-memory store
    if (!kitchenEvents.some((e) => e.sequenceNumber === event.sequenceNumber)) {
      kitchenEvents.push(event);
      this.events.set(event.kitchenId, kitchenEvents);
    }
    this.sequences.set(event.kitchenId, Math.max(this.sequences.get(event.kitchenId) || 0, event.sequenceNumber));
    return event;
  }

  public getEventsAfter(kitchenId: string, lastProcessedSequence: number): KitchenEvent[] {
    const kitchenEvents = this.events.get(kitchenId) || [];
    return kitchenEvents.filter((evt) => evt.sequenceNumber > lastProcessedSequence);
  }

  public getAllEvents(kitchenId: string): KitchenEvent[] {
    return this.events.get(kitchenId) || [];
  }

  public getLatestSequence(kitchenId: string): number {
    return this.sequences.get(kitchenId) || 0;
  }

  public clear() {
    this.events.clear();
    this.sequences.clear();
    console.log('[EventStore] In-memory event cache cleared.');
  }
}

export const globalEventStore = new InMemoryEventStore();
