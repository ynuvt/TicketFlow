export type EventType = 'ORDER_CREATED' | 'ORDER_TRANSITIONED';

export type OrderStatus = 'PLACED' | 'PREPARING' | 'READY' | 'SERVED';

export type StationId = 'intake' | 'prep' | 'grill' | 'assembly' | 'expedite';
export type StationRoute = StationId | 'overview' | 'manager';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  notes?: string;
}

export interface Order {
  id: string;
  kitchenId: string;
  customerName: string;
  items: OrderItem[];
  priority: 'NORMAL' | 'HIGH' | 'VIP';
  estimatedPrepTime: number; // in minutes
  status: OrderStatus;
  currentStationId: StationId;
  assignedUserId?: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CreateOrderPayload {
  kitchenId: string;
  customerName: string;
  items: OrderItem[];
  priority?: 'NORMAL' | 'HIGH' | 'VIP';
  estimatedPrepTime?: number;
  stationId?: StationId;
}

export interface KitchenEvent {
  sequenceNumber: number;
  eventId: string;
  kitchenId: string;
  orderId: string;
  type: EventType;
  payload: {
    previousStatus?: OrderStatus;
    newStatus: OrderStatus;
    stationId?: StationId;
    customerName?: string;
    items?: OrderItem[];
    priority?: 'NORMAL' | 'HIGH' | 'VIP';
    estimatedPrepTime?: number;
    assignedUserId?: string | null;
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

