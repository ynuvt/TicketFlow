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

  // Calculate and find the best staff member to route an order at a target station S
  private async routeOrderToStaff(tx: any, stationId: string, kitchenId: string): Promise<string | null> {
    if (stationId === 'intake') {
      return null;
    }

    // Find all active STAFF members assigned to S
    const staffMembers = await tx.user.findMany({
      where: {
        role: 'STAFF',
        assignedStations: {
          has: stationId,
        },
      },
    });

    if (staffMembers.length === 0) {
      return null;
    }

    const candidateWorkloads = [];

    for (const staff of staffMembers) {
      // Count active orders assigned to this staff at station S
      const activeOrdersCount = await tx.order.count({
        where: {
          kitchenId,
          currentStationId: stationId,
          assignedUserId: staff.id,
          status: { not: 'SERVED' },
        },
      });

      const prepTimes = (staff.stationPrepTimes as Record<string, number>) || {};
      const avgTime = prepTimes[stationId] !== undefined ? Number(prepTimes[stationId]) : 5;

      const workload = activeOrdersCount * avgTime;
      const canAccept = (activeOrdersCount + 1) * avgTime <= 20;

      candidateWorkloads.push({
        staffId: staff.id,
        workload,
        avgTime,
        canAccept,
      });
    }

    // Filter to those who have space in their 20-min window
    const availableCandidates = candidateWorkloads.filter((c) => c.canAccept);

    if (availableCandidates.length === 0) {
      return null;
    }

    // Sort by workload ascending, and then by average prep time ascending
    availableCandidates.sort((a, b) => a.workload - b.workload || a.avgTime - b.avgTime);

    return availableCandidates[0].staffId;
  }

  // Process the waiting queue for S. This is called when a staff member finishes an order, freeing up workload
  private async assignWaitingOrders(
    tx: any,
    stationId: string,
    kitchenId: string
  ): Promise<{ order: any; event: any }[]> {
    if (stationId === 'intake') {
      return [];
    }

    const extraEvents: { order: any; event: any }[] = [];

    while (true) {
      // Find oldest waiting order at S
      const oldestWaiting = await tx.order.findFirst({
        where: {
          kitchenId,
          currentStationId: stationId,
          assignedUserId: null,
          status: { not: 'SERVED' },
        },
        orderBy: {
          createdAt: 'asc',
        },
      });

      if (!oldestWaiting) {
        break;
      }

      // Try to find a staff member with space
      const assignedUserId = await this.routeOrderToStaff(tx, stationId, kitchenId);

      if (assignedUserId) {
        // Assign the waiting order to the staff member
        const updatedOrder = await tx.order.update({
          where: { id: oldestWaiting.id },
          data: {
            assignedUserId,
          },
          include: {
            orderItems: true,
          },
        });

        let nextSequence = await this.getNextSequenceNumber(tx, kitchenId);
        let event = null;
        let attempts = 0;

        while (!event && attempts < 5) {
          try {
            event = await tx.orderEvent.create({
              data: {
                kitchenId,
                orderId: oldestWaiting.id,
                sequenceNumber: BigInt(nextSequence),
                type: 'ORDER_TRANSITIONED',
                payload: {
                  newStatus: oldestWaiting.status,
                  stationId,
                  assignedUserId,
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

        if (event) {
          extraEvents.push({
            order: updatedOrder,
            event: { ...event, sequenceNumber: Number(event.sequenceNumber) },
          });
        }
      } else {
        break;
      }
    }

    return extraEvents;
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

      const initialStation = input.initialStationId || 'intake';
      // Route the order upon creation if initial station has staff limits
      const assignedUserId = await this.routeOrderToStaff(tx, initialStation, input.kitchenId);

      const order = await tx.order.create({
        data: {
          kitchenId: input.kitchenId,
          customerName: input.customerName,
          priority: priorityEnum,
          estimatedPrepTime: input.estimatedPrepTime,
          status: 'PLACED',
          currentStationId: initialStation,
          assignedUserId,
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
                assignedUserId,
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

      // Fetch the order first to check its current station
      const currentOrder = await tx.order.findUnique({
        where: { id: input.orderId },
      });
      const sourceStationId = currentOrder ? currentOrder.currentStationId : null;
      const targetStationId = input.nextStationId || 'prep';

      // 1. Run routing for target station
      const targetAssignedUserId = await this.routeOrderToStaff(tx, targetStationId, input.kitchenId);

      const updatedOrder = await tx.order.upsert({
        where: { id: input.orderId },
        update: {
          status: input.targetStatus,
          currentStationId: targetStationId,
          assignedUserId: targetAssignedUserId,
        },
        create: {
          id: input.orderId,
          kitchenId: input.kitchenId,
          customerName: 'Kitchen Order',
          status: input.targetStatus,
          currentStationId: targetStationId,
          assignedUserId: targetAssignedUserId,
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
                stationId: targetStationId,
                assignedUserId: targetAssignedUserId,
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

      // 2. Since this order has left the source station, run waiting queue checks on S to pull next tickets
      let extraQueueEvents: { order: any; event: any }[] = [];
      if (sourceStationId && (sourceStationId !== targetStationId || input.targetStatus === 'SERVED')) {
        extraQueueEvents = await this.assignWaitingOrders(tx, sourceStationId, input.kitchenId);
      }

      return {
        order: updatedOrder,
        event: { ...event, sequenceNumber: Number(event.sequenceNumber) },
        extraEvents: extraQueueEvents,
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
