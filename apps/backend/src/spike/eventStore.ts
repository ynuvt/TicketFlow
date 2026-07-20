import { KitchenEvent, EventType } from '../types/events';

export class InMemoryEventStore {
  private events: Map<string, KitchenEvent[]> = new Map();
  private sequences: Map<string, number> = new Map();

  public appendEvent(
    kitchenId: string,
    orderId: string,
    type: EventType,
    payload: KitchenEvent['payload']
  ): KitchenEvent {
    const currentSeq = this.sequences.get(kitchenId) || 0;
    const nextSeq = currentSeq + 1;
    this.sequences.set(kitchenId, nextSeq);

    const event: KitchenEvent = {
      sequenceNumber: nextSeq,
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      kitchenId,
      orderId,
      type,
      payload,
      timestamp: Date.now(),
    };

    const kitchenEvents = this.events.get(kitchenId) || [];
    kitchenEvents.push(event);
    this.events.set(kitchenId, kitchenEvents);

    return event;
  }

  public getEventsAfter(kitchenId: string, lastProcessedSequence: number): KitchenEvent[] {
    const kitchenEvents = this.events.get(kitchenId) || [];
    return kitchenEvents.filter((evt) => evt.sequenceNumber > lastProcessedSequence);
  }

  public getLatestSequence(kitchenId: string): number {
    return this.sequences.get(kitchenId) || 0;
  }
}

export const globalEventStore = new InMemoryEventStore();
