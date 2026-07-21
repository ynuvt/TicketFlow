import { prisma } from '../lib/prisma';
import { OrderStatus } from '../domain/stateMachine';

export interface CreateOrderInput {
  kitchenId: string;
  customerName: string;
  items: Array<{ id?: string; name: string; quantity: number; notes?: string }>;
  priority?: 'NORMAL' | 'HIGH' | 'VIP' | number;
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
  private async getNextSequenceNumber(tx: any, kitchenId: string): Promise<number> {
    const maxResult = await tx.orderEvent.aggregate({
      where: { kitchenId },
      _max: { sequenceNumber: true },
    });
    const maxSeq = maxResult._max.sequenceNumber;
    return maxSeq !== null && maxSeq !== undefined ? Number(maxSeq) + 1 : 1;
  }

  public async createOrder(input: CreateOrderInput) {
    return prisma.$transaction(async (tx: any) => {
      await tx.kitchen.upsert({
        where: { id: input.kitchenId },
        update: {},
        create: { id: input.kitchenId, name: 'Main Kitchen' },
      });

      let nextSequence = await this.getNextSequenceNumber(tx, input.kitchenId);
      const priorityEnum =
        typeof input.priority === 'string'
          ? (input.priority as 'NORMAL' | 'HIGH' | 'VIP')
          : input.priority === 2
          ? 'VIP'
          : input.priority === 1
          ? 'HIGH'
          : 'NORMAL';

      const order = await tx.order.create({
        data: {
          kitchenId: input.kitchenId,
          customerName: input.customerName,
          priority: priorityEnum,
          estimatedPrepTime: input.estimatedPrepTime,
          status: 'PLACED',
          currentStationId: input.initialStationId || 'intake',
          orderItems: {
            create: (input.items || []).map((item) => ({
              name: item.name,
              quantity: item.quantity || 1,
              notes: item.notes || null,
            })),
          },
        },
        include: {
          orderItems: true,
        },
      });

      let event: any = null;
      let attempts = 0;

      while (!event && attempts < 5) {
        try {
          event = await tx.orderEvent.create({
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
        } catch (err: any) {
          if (err.code === 'P2002') {
            nextSequence++;
            attempts++;
          } else {
            throw err;
          }
        }
      }

      return { order, event: { ...event, sequenceNumber: Number(event.sequenceNumber) } };
    });
  }

  public async transitionOrder(input: TransitionOrderInput) {
    return prisma.$transaction(async (tx: any) => {
      let nextSequence = await this.getNextSequenceNumber(tx, input.kitchenId);

      const updatedOrder = await tx.order.upsert({
        where: { id: input.orderId },
        update: {
          status: input.targetStatus,
          currentStationId: input.nextStationId,
        },
        create: {
          id: input.orderId,
          kitchenId: input.kitchenId,
          customerName: 'Kitchen Order',
          status: input.targetStatus,
          currentStationId: input.nextStationId || 'prep',
        },
        include: {
          orderItems: true,
        },
      });

      let event: any = null;
      let attempts = 0;

      while (!event && attempts < 5) {
        try {
          event = await tx.orderEvent.create({
            data: {
              kitchenId: input.kitchenId,
              orderId: input.orderId,
              sequenceNumber: BigInt(nextSequence),
              type: 'ORDER_TRANSITIONED',
              payload: {
                newStatus: input.targetStatus,
                stationId: updatedOrder.currentStationId,
              },
            },
          });
        } catch (err: any) {
          if (err.code === 'P2002') {
            nextSequence++;
            attempts++;
          } else {
            throw err;
          }
        }
      }

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
      include: {
        orderItems: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }
}

export const orderRepository = new OrderRepository();
