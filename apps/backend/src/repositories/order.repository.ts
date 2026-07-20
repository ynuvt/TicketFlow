import { prisma } from '../lib/prisma';
import { OrderStatus } from '../domain/stateMachine';

export interface CreateOrderInput {
  kitchenId: string;
  customerName: string;
  items: string[];
  priority?: number;
  estimatedPrepTime: number;
  initialStationId?: string;
}

export interface TransitionOrderInput {
  orderId: string;
  kitchenId: string;
  targetStatus: OrderStatus;
  nextStationId?: string;
}

export class OrderRepository {
  public async createOrder(input: CreateOrderInput) {
    return prisma.$transaction(async (tx: any) => {
      const lastEvent = await tx.orderEvent.findFirst({
        where: { kitchenId: input.kitchenId },
        orderBy: { sequenceNumber: 'desc' },
      });

      const nextSequence = lastEvent ? Number(lastEvent.sequenceNumber) + 1 : 1;

      const order = await tx.order.create({
        data: {
          kitchenId: input.kitchenId,
          customerName: input.customerName,
          items: JSON.stringify(input.items),
          priority: input.priority || 0,
          estimatedPrepTime: input.estimatedPrepTime,
          status: 'PLACED',
          currentStationId: input.initialStationId,
        },
      });

      const event = await tx.orderEvent.create({
        data: {
          kitchenId: input.kitchenId,
          orderId: order.id,
          sequenceNumber: BigInt(nextSequence),
          type: 'ORDER_CREATED',
          payload: {
            customerName: input.customerName,
            items: input.items,
            priority: order.priority,
            status: order.status,
            stationId: order.currentStationId,
          },
        },
      });

      return { order, event: { ...event, sequenceNumber: Number(event.sequenceNumber) } };
    });
  }

  public async transitionOrder(input: TransitionOrderInput) {
    return prisma.$transaction(async (tx: any) => {
      const existingOrder = await tx.order.findUnique({
        where: { id: input.orderId },
      });

      if (!existingOrder) {
        throw new Error(`Order ${input.orderId} not found`);
      }

      const lastEvent = await tx.orderEvent.findFirst({
        where: { kitchenId: input.kitchenId },
        orderBy: { sequenceNumber: 'desc' },
      });

      const nextSequence = lastEvent ? Number(lastEvent.sequenceNumber) + 1 : 1;

      const updatedOrder = await tx.order.update({
        where: { id: input.orderId },
        data: {
          status: input.targetStatus,
          currentStationId: input.nextStationId ?? existingOrder.currentStationId,
        },
      });

      const event = await tx.orderEvent.create({
        data: {
          kitchenId: input.kitchenId,
          orderId: input.orderId,
          sequenceNumber: BigInt(nextSequence),
          type: 'ORDER_TRANSITIONED',
          payload: {
            previousStatus: existingOrder.status,
            newStatus: input.targetStatus,
            stationId: updatedOrder.currentStationId,
          },
        },
      });

      return {
        order: updatedOrder,
        event: { ...event, sequenceNumber: Number(event.sequenceNumber) },
      };
    });
  }

  public async getEventsAfter(kitchenId: string, lastProcessedSequence: number) {
    const events = await prisma.orderEvent.findMany({
      where: {
        kitchenId,
        sequenceNumber: { gt: BigInt(lastProcessedSequence) },
      },
      orderBy: { sequenceNumber: 'asc' },
    });

    return events.map((event: any) => ({
      ...event,
      sequenceNumber: Number(event.sequenceNumber),
    }));
  }

  public async getOrdersByStation(kitchenId: string, stationId: string) {
    return prisma.order.findMany({
      where: {
        kitchenId,
        currentStationId: stationId,
      },
      orderBy: [
        { priority: 'desc' },
        { createdAt: 'asc' },
      ],
    });
  }
}

export const orderRepository = new OrderRepository();
