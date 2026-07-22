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

let globalSequenceCounter: number | null = null;

export class OrderRepository {
  public static resetSequenceCounter() {
    globalSequenceCounter = null;
  }

  private async getNextSequenceNumber(tx: any, kitchenId: string): Promise<number> {
    if (globalSequenceCounter === null) {
      const maxResult = await tx.orderEvent.aggregate({
        where: { kitchenId },
        _max: { sequenceNumber: true },
      });
      const maxSeq = maxResult._max.sequenceNumber;
      globalSequenceCounter = maxSeq !== null && maxSeq !== undefined ? Number(maxSeq) : 0;
    }
    globalSequenceCounter += 1;
    return globalSequenceCounter;
  }

  // Helper to calculate dynamic predicted workload for a staff member at station S using elapsed time
  public async calculateStaffPredictedWorkload(
    tx: any,
    staffId: string,
    stationId: string,
    kitchenId: string
  ): Promise<{ predictedWorkload: number; activeCount: number; avgTime: number }> {
    const staff = await tx.user.findUnique({ where: { id: staffId } });
    if (!staff) return { predictedWorkload: 0, activeCount: 0, avgTime: 5 };

    const prepTimes = (staff.stationPrepTimes as Record<string, number>) || {};
    const avgTime = prepTimes[stationId] !== undefined ? Number(prepTimes[stationId]) : 5;

    // Fetch active assigned orders for this staff member at station S sorted by updatedAt asc
    const activeOrders = await tx.order.findMany({
      where: {
        kitchenId,
        currentStationId: stationId,
        assignedUserId: staffId,
        status: { not: 'SERVED' },
      },
      orderBy: { updatedAt: 'asc' },
    });

    if (activeOrders.length === 0) {
      return { predictedWorkload: 0, activeCount: 0, avgTime };
    }

    const now = Date.now();
    let totalWorkload = 0;

    for (let i = 0; i < activeOrders.length; i++) {
      const order = activeOrders[i];
      if (i === 0) {
        // First order is currently in-progress
        const elapsedMinutes = (now - new Date(order.updatedAt).getTime()) / 60000;
        if (elapsedMinutes >= avgTime) {
          // Overdue order: real delay extends the predicted timeline
          totalWorkload += elapsedMinutes;
        } else {
          // Normal in-progress order: remaining time until completion
          totalWorkload += Math.max(avgTime - elapsedMinutes, 0);
        }
      } else {
        // Queued behind in cook's personal queue -> full avgTime
        totalWorkload += avgTime;
      }
    }

    return {
      predictedWorkload: Math.round(totalWorkload * 10) / 10,
      activeCount: activeOrders.length,
      avgTime,
    };
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
      const { predictedWorkload, avgTime } = await this.calculateStaffPredictedWorkload(
        tx,
        staff.id,
        stationId,
        kitchenId
      );

      // Order fits if current predicted workload + avgTime <= 20
      const canAccept = (predictedWorkload + avgTime) <= 20;

      candidateWorkloads.push({
        staffId: staff.id,
        workload: predictedWorkload,
        avgTime,
        canAccept,
      });
    }

    // 1. Try candidates who have space in their 20-min window
    const availableCandidates = candidateWorkloads.filter((c) => c.canAccept);

    if (availableCandidates.length > 0) {
      availableCandidates.sort((a, b) => a.workload - b.workload || a.avgTime - b.avgTime);
      return availableCandidates[0].staffId;
    }

    // 2. Fallback: If all cooks exceed the 20-min cap, ALWAYS assign to the least-busy cook!
    candidateWorkloads.sort((a, b) => a.workload - b.workload || a.avgTime - b.avgTime);
    return candidateWorkloads[0].staffId;
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

      // Automatically push new intake orders directly to prep for cooks
      const initialStation = (!input.initialStationId || input.initialStationId === 'intake') ? 'prep' : input.initialStationId;
      const initialStatus = initialStation === 'prep' ? 'PREPARING' : 'PLACED';

      // Route the order upon creation directly to available prep cooks
      const assignedUserId = await this.routeOrderToStaff(tx, initialStation, input.kitchenId);

      const order = await tx.order.create({
        data: {
          kitchenId: input.kitchenId,
          customerName: input.customerName,
          priority: priorityEnum,
          estimatedPrepTime: input.estimatedPrepTime,
          status: initialStatus,
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
                newStatus: order.status,
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
                customerName: currentOrder?.customerName || 'Kitchen Order',
                items: currentOrder?.orderItems || [],
                priority: currentOrder?.priority || 'NORMAL',
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

  public async getKitchenWorkloadMetrics(kitchenId: string) {
    const stations = ['prep', 'grill', 'assembly', 'expedite'];
    const staffMembers = await prisma.user.findMany({
      where: { role: 'STAFF' },
    });

    const now = Date.now();
    const staffMetrics = [];

    for (const staff of staffMembers) {
      const stationBreakdown: Record<string, { workload: number; activeCount: number; avgTime: number; isOverdue: boolean }> = {};
      let totalCookWorkload = 0;

      for (const stId of staff.assignedStations) {
        const prepTimes = (staff.stationPrepTimes as Record<string, number>) || {};
        const avgTime = prepTimes[stId] !== undefined ? Number(prepTimes[stId]) : 5;

        const activeOrders = await prisma.order.findMany({
          where: {
            kitchenId,
            currentStationId: stId,
            assignedUserId: staff.id,
            status: { not: 'SERVED' },
          },
          orderBy: { updatedAt: 'asc' },
        });

        let stWorkload = 0;
        let isOverdue = false;

        for (let i = 0; i < activeOrders.length; i++) {
          const order = activeOrders[i];
          if (i === 0) {
            const elapsed = (now - new Date(order.updatedAt).getTime()) / 60000;
            if (elapsed >= avgTime) {
              stWorkload += elapsed;
              isOverdue = true;
            } else {
              stWorkload += Math.max(avgTime - elapsed, 0);
            }
          } else {
            stWorkload += avgTime;
          }
        }

        stWorkload = Math.round(stWorkload * 10) / 10;
        totalCookWorkload += stWorkload;

        stationBreakdown[stId] = {
          workload: stWorkload,
          activeCount: activeOrders.length,
          avgTime,
          isOverdue,
        };
      }

      staffMetrics.push({
        id: staff.id,
        fullName: staff.fullName,
        username: staff.username,
        assignedStations: staff.assignedStations,
        totalPredictedWorkload: Math.round(totalCookWorkload * 10) / 10,
        stationBreakdown,
      });
    }

    // Station Summary & Waiting Queues
    const stationSummaries: Record<string, { waitingCount: number; activeCount: number; shortestTimeline: number }> = {};
    let totalPipelineEta = 0;

    for (const stId of stations) {
      const waitingCount = await prisma.order.count({
        where: {
          kitchenId,
          currentStationId: stId,
          assignedUserId: null,
          status: { not: 'SERVED' },
        },
      });

      const activeCount = await prisma.order.count({
        where: {
          kitchenId,
          currentStationId: stId,
          assignedUserId: { not: null },
          status: { not: 'SERVED' },
        },
      });

      // Find shortest predicted completion timeline among staff assigned to stId
      const staffForStation = staffMetrics.filter((s) => s.assignedStations.includes(stId));
      let shortestStaffTimeline = 5; // default fallback if no staff assigned

      if (staffForStation.length > 0) {
        const timelines = staffForStation.map((s) => s.stationBreakdown[stId]?.workload || 0);
        shortestStaffTimeline = Math.min(...timelines);
      }

      // Add waiting queue delay (distributed across staff)
      const waitingDelay = staffForStation.length > 0 ? (waitingCount * 5) / staffForStation.length : waitingCount * 5;
      const stationTotalTimeline = Math.round((shortestStaffTimeline + waitingDelay) * 10) / 10;

      stationSummaries[stId] = {
        waitingCount,
        activeCount,
        shortestTimeline: stationTotalTimeline,
      };

      totalPipelineEta += stationTotalTimeline;
    }

    return {
      staffMetrics,
      stationSummaries,
      totalCustomerEtaMinutes: Math.round(totalPipelineEta),
      updatedAt: now,
    };
  }
}

export const orderRepository = new OrderRepository();
