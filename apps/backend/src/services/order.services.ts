import { orderRepository, CreateOrderInput } from '../repositories/order.repository';
import { validateStateTransition, OrderStatus } from '../domain/stateMachine';
import { distributedLockService } from './lock.services';

export interface OrderEventRecord {
  id: string;
  sequenceNumber: number;
  kitchenId: string;
  orderId: string;
  type: string;
  payload: any;
  createdAt: Date;
}

export class OrderService {
  public async createOrder(input: CreateOrderInput) {
    return orderRepository.createOrder(input);
  }

  public async transitionOrder(
    kitchenId: string,
    orderId: string,
    targetStatus: OrderStatus,
    nextStationId?: string,
    idempotencyKey?: string
  ) {
    if (idempotencyKey) {
      const isNew = await distributedLockService.checkAndSetIdempotency(idempotencyKey);
      if (!isNew) {
        console.log(`[OrderService] Duplicate transition request dropped via idempotency key: ${idempotencyKey}`);
        const currentEvents = await orderRepository.getEventsAfter(kitchenId, 0);
        const lastEvent = currentEvents.filter((event: OrderEventRecord) => event.orderId === orderId).pop();
        return { order: null, event: lastEvent, isDuplicate: true };
      }
    }

    const { acquired, lockValue } = await distributedLockService.acquireLock(`order:${orderId}`, 3000);
    if (!acquired) {
      throw new Error(`Concurrent modification lock conflict for order ${orderId}`);
    }

    try {
      const currentEvents = await orderRepository.getEventsAfter(kitchenId, 0);
      const orderEvents = currentEvents.filter((event: OrderEventRecord) => event.orderId === orderId);

      let currentStatus: OrderStatus = 'PLACED';
      if (orderEvents.length > 0) {
        const lastEvt = orderEvents[orderEvents.length - 1];
        const payload = lastEvt.payload as { newStatus?: OrderStatus; status?: OrderStatus };
        currentStatus = payload.newStatus || payload.status || 'PLACED';
      }

      validateStateTransition(currentStatus, targetStatus);

      const result = await orderRepository.transitionOrder({
        orderId,
        kitchenId,
        targetStatus,
        nextStationId,
      });

      return { ...result, isDuplicate: false };
    } finally {
      await distributedLockService.releaseLock(`order:${orderId}`, lockValue);
    }
  }

  public async getReplayEvents(kitchenId: string, lastProcessedSequence: number) {
    return orderRepository.getEventsAfter(kitchenId, lastProcessedSequence);
  }
}

export const orderService = new OrderService();
