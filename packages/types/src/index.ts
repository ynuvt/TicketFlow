export type EventType = 'ORDER_CREATED' | 'ORDER_TRANSITIONED';

export type OrderStatus = 'PLACED' | 'PREPARING' | 'READY' | 'SERVED';

export interface KitchenEvent {
  sequenceNumber: number;
  eventId: string;
  kitchenId: string;
  orderId: string;
  type: EventType;
  payload: {
    previousStatus?: OrderStatus;
    newStatus: OrderStatus;
    stationId?: string;
    items?: string[];
  };
  timestamp: number;
}

export interface ReplayRequestPayload {
  kitchenId: string;
  stationId: string;
  lastProcessedSequence: number;
}

export interface ReplayResponsePayload {
  kitchenId: string;
  fromSequence: number;
  toSequence: number;
  events: KitchenEvent[];
}
