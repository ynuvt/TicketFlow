import { prisma } from '../lib/prisma';
import { OrderStatus } from '../domain/stateMachine';
import { globalEventStore } from '../spike/eventStore';

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
  public static onlineUserIds = new Set<string>([
    'user-admin',
    'user-cook1',
    'user-cook2',
    'user-cook3',
    'user-cook4',
    'user-cook5',
    'user-cook6',
    'user-cook7',
    'user-cook8',
    'user-recep1'
  ]);
  public static ioInstance: any = null;
  public static offlineTimers = new Map<string, NodeJS.Timeout>();
  public static originalAssignments = new Map<string, string[]>();

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

    // Filter to only online staff members
    let activeStaff = staffMembers.filter((s: any) => OrderRepository.onlineUserIds.has(s.id));
    if (activeStaff.length === 0) {
      // Fallback: If ALL cooks at this station are offline, route among all cooks so the ticket can be visible to admin
      activeStaff = staffMembers;
    }

    const candidateWorkloads = [];

    for (const staff of activeStaff) {
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

    // If all cooks exceed the 20-min cap, keep the order in the waiting pool (assignedUserId = null)
    return null;
  }

  // Process the waiting queue for S. This is called when a staff member finishes an order, freeing up workload
  public async assignWaitingOrders(
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
            status: 'PREPARING',
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
                  newStatus: 'PREPARING',
                  stationId,
                  assignedUserId,
                  customerName: oldestWaiting.customerName,
                  items: oldestWaiting.orderItems || [],
                  priority: oldestWaiting.priority,
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

        // Backpressure check: If we promoted a waiting order at prep,
        // we have room in the prep waiting queue. Pull the oldest from intake!
        if (stationId === 'prep') {
          const prepWaitingCount = await tx.order.count({
            where: {
              kitchenId,
              currentStationId: 'prep',
              assignedUserId: null,
              status: { not: 'SERVED' }
            }
          });

          if (prepWaitingCount < 10) {
            const oldestIntake = await tx.order.findFirst({
              where: {
                kitchenId,
                currentStationId: 'intake',
                assignedUserId: null,
                status: { not: 'SERVED' }
              },
              orderBy: { createdAt: 'asc' }
            });

            if (oldestIntake) {
              const promotedOrder = await tx.order.update({
                where: { id: oldestIntake.id },
                data: {
                  currentStationId: 'prep',
                  status: 'PLACED',
                  updatedAt: new Date()
                },
                include: { orderItems: true }
              });

              let promoSeq = await this.getNextSequenceNumber(tx, kitchenId);
              let promoEvent = null;
              let promoAttempts = 0;

              while (!promoEvent && promoAttempts < 5) {
                try {
                  promoEvent = await tx.orderEvent.create({
                    data: {
                      kitchenId,
                      orderId: oldestIntake.id,
                      sequenceNumber: BigInt(promoSeq),
                      type: 'ORDER_TRANSITIONED',
                      payload: {
                        newStatus: 'PLACED',
                        stationId: 'prep',
                        assignedUserId: null,
                        customerName: oldestIntake.customerName,
                        items: oldestIntake.orderItems || [],
                        priority: oldestIntake.priority,
                      }
                    }
                  });
                } catch (err: any) {
                  if (err.code === 'P2002') {
                    promoSeq++;
                    promoAttempts++;
                  } else {
                    throw err;
                  }
                }
              }

              if (promoEvent) {
                extraEvents.push({
                  order: promotedOrder,
                  event: { ...promoEvent, sequenceNumber: Number(promoEvent.sequenceNumber) }
                });
              }
            }
          }
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

      // Automatically route new intake/prep orders to prep cooks under the 20-min cap,
      // or to prep waiting queue if size < 10, or keep at intake.
      let initialStation = input.initialStationId || 'intake';
      let initialStatus: OrderStatus = 'PLACED';
      let assignedUserId: string | null = null;

      if (initialStation === 'intake' || initialStation === 'prep') {
        const routeCookId = await this.routeOrderToStaff(tx, 'prep', input.kitchenId);
        if (routeCookId) {
          initialStation = 'prep';
          assignedUserId = routeCookId;
          initialStatus = 'PREPARING';
        } else {
          const prepWaitingCount = await tx.order.count({
            where: {
              kitchenId: input.kitchenId,
              currentStationId: 'prep',
              assignedUserId: null,
              status: { not: 'SERVED' },
            },
          });

          if (prepWaitingCount < 10) {
            initialStation = 'prep';
            assignedUserId = null;
            initialStatus = 'PLACED';
          } else {
            initialStation = 'intake';
            assignedUserId = null;
            initialStatus = 'PLACED';
          }
        }
      } else {
        assignedUserId = await this.routeOrderToStaff(tx, initialStation, input.kitchenId);
        initialStatus = assignedUserId ? 'PREPARING' : 'PLACED';
      }

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

  public async redistributeOfflineUserOrders(userId: string) {
    const io = OrderRepository.ioInstance;
    if (!io) return;

    // Find all active, non-served orders assigned to userId
    const activeOrders = await prisma.order.findMany({
      where: {
        assignedUserId: userId,
        status: { not: 'SERVED' }
      }
    });

    if (activeOrders.length === 0) return;

    console.log(`[Network Re-routing] Cook ${userId} offline for 1 min. Redistributing ${activeOrders.length} orders...`);

    // Group orders by station to route them
    for (const order of activeOrders) {
      const stationId = order.currentStationId;
      const kitchenId = order.kitchenId;

      await prisma.$transaction(async (tx) => {
        // Find other cooks assigned to this station
        const staffMembers = await tx.user.findMany({
          where: {
            role: 'STAFF',
            assignedStations: {
              has: stationId,
            },
            id: { not: userId }
          },
        });

        // Filter to only online staff members
        const activeStaff = staffMembers.filter((s: any) => OrderRepository.onlineUserIds.has(s.id));
        if (activeStaff.length === 0) {
          // If no other online cooks, leave it assigned to the offline cook so it's not lost
          return;
        }

        // Calculate workloads and find the best candidate
        const candidateWorkloads = [];
        for (const staff of activeStaff) {
          const { predictedWorkload, avgTime } = await this.calculateStaffPredictedWorkload(
            tx,
            staff.id,
            stationId,
            kitchenId
          );
          const canAccept = (predictedWorkload + avgTime) <= 20;
          candidateWorkloads.push({
            staffId: staff.id,
            workload: predictedWorkload,
            avgTime,
            canAccept,
          });
        }

        let newStaffId = null;
        const availableCandidates = candidateWorkloads.filter((c) => c.canAccept);
        if (availableCandidates.length > 0) {
          availableCandidates.sort((a, b) => a.workload - b.workload || a.avgTime - b.avgTime);
          newStaffId = availableCandidates[0].staffId;
        } else {
          candidateWorkloads.sort((a, b) => a.workload - b.workload || a.avgTime - b.avgTime);
          newStaffId = candidateWorkloads[0].staffId;
        }

        if (newStaffId) {
          // Reassign order
          await tx.order.update({
            where: { id: order.id },
            data: {
              assignedUserId: newStaffId,
              updatedAt: new Date(),
            }
          });

          // Create an event for the sequence number update
          const seq = await this.getNextSequenceNumber(tx, kitchenId);
          const event = await tx.orderEvent.create({
            data: {
              kitchenId,
              orderId: order.id,
              type: 'ORDER_TRANSITIONED',
              sequenceNumber: seq,
              payload: JSON.stringify({
                orderId: order.id,
                stationId,
                newStatus: order.status,
                assignedUserId: newStaffId,
              }),
            }
          });

          const clientEvent = {
            sequenceNumber: Number(event.sequenceNumber),
            eventId: event.id,
            kitchenId: event.kitchenId,
            orderId: event.orderId,
            type: event.type as any,
            payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
            timestamp: new Date(event.createdAt).getTime(),
          };

          const room = `kitchen:${kitchenId}`;
          globalEventStore.appendEvent(clientEvent);
          io.to(room).emit('order:transition', clientEvent);
          console.log(`[Network Re-routing] Order ${order.id} reassigned from ${userId} to ${newStaffId}`);
        }
      });
    }
  }

  public async handleUserReconnect(userId: string) {
    const io = OrderRepository.ioInstance;
    if (!io) return;

    // Clear any offline timer
    const timer = OrderRepository.offlineTimers.get(userId);
    if (timer) {
      clearTimeout(timer);
      OrderRepository.offlineTimers.delete(userId);
    }

    // Find the user to get their assigned stations
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) return;

    const kitchenId = 'kitchen-main';

    // Check if this user's stations were collectively offline before they connected!
    for (const stationId of user.assignedStations) {
      if (stationId === 'intake') continue;

      // Find other cooks assigned to stationId
      const otherCooks = await prisma.user.findMany({
        where: {
          role: 'STAFF',
          assignedStations: { has: stationId },
          id: { not: userId }
        }
      });

      const otherOnlineCooks = otherCooks.filter((c: any) => OrderRepository.onlineUserIds.has(c.id));
      if (otherOnlineCooks.length === 0) {
        // Yes! The station was collectively offline. Give ALL active orders at this station to this cook!
        console.log(`[Network Reconnect] Station ${stationId} was collectively offline. Assigning all active orders to ${userId}...`);
        
        const stationOrders = await prisma.order.findMany({
          where: {
            currentStationId: stationId,
            status: { not: 'SERVED' }
          }
        });

        for (const order of stationOrders) {
          // Reassign to user
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: order.id },
              data: {
                assignedUserId: userId,
                updatedAt: new Date()
              }
            });

            const seq = await this.getNextSequenceNumber(tx, kitchenId);
            const event = await tx.orderEvent.create({
              data: {
                kitchenId,
                orderId: order.id,
                type: 'ORDER_TRANSITIONED',
                sequenceNumber: seq,
                payload: JSON.stringify({
                  orderId: order.id,
                  stationId,
                  newStatus: order.status,
                  assignedUserId: userId,
                })
              }
            });

            const clientEvent = {
              sequenceNumber: Number(event.sequenceNumber),
              eventId: event.id,
              kitchenId: event.kitchenId,
              orderId: event.orderId,
              type: event.type as any,
              payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
              timestamp: new Date(event.createdAt).getTime()
            };

            io.to(`kitchen:${kitchenId}`).emit('order:transition', clientEvent);
          });
        }
      }
    }

    // Check if this user had any original assignments that were reassigned away from them
    const originalOrders = OrderRepository.originalAssignments.get(userId);
    if (originalOrders && originalOrders.length > 0) {
      console.log(`[Network Reconnect] User ${userId} reconnected. Returning original assignments: ${originalOrders.join(', ')}`);
      
      for (const orderId of originalOrders) {
        // Check if the order is still at user's station and is active (not served)
        const order = await prisma.order.findUnique({ where: { id: orderId } });
        if (order && order.status !== 'SERVED' && user.assignedStations.includes(order.currentStationId)) {
          // If the order has been reassigned to someone else, assign it back to userId!
          if (order.assignedUserId !== userId) {
            await prisma.$transaction(async (tx) => {
              await tx.order.update({
                where: { id: orderId },
                data: {
                  assignedUserId: userId,
                  updatedAt: new Date()
                }
              });

              const seq = await this.getNextSequenceNumber(tx, kitchenId);
              const event = await tx.orderEvent.create({
                data: {
                  kitchenId,
                  orderId: orderId,
                  type: 'ORDER_TRANSITIONED',
                  sequenceNumber: seq,
                  payload: JSON.stringify({
                    orderId: orderId,
                    stationId: order.currentStationId,
                    newStatus: order.status,
                    assignedUserId: userId,
                  })
                }
              });

              const clientEvent = {
                sequenceNumber: Number(event.sequenceNumber),
                eventId: event.id,
                kitchenId: event.kitchenId,
                orderId: event.orderId,
                type: event.type as any,
                payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
                timestamp: new Date(event.createdAt).getTime()
              };

              globalEventStore.appendEvent(clientEvent);
              io.to(`kitchen:${kitchenId}`).emit('order:transition', clientEvent);
              console.log(`[Network Reconnect] Restored original order ${orderId} assignment to ${userId}`);
            });
          }
        }
      }

      OrderRepository.originalAssignments.delete(userId);
    }

    // Workload balancing: pull latest order(s) from other online cooks at their station
    if (user.assignedStations.length > 0) {
      const mainStation = user.assignedStations[0];
      const userWorkloadInfo = await this.calculateStaffPredictedWorkload(prisma, userId, mainStation, kitchenId);
      if (userWorkloadInfo.predictedWorkload < 5) {
        const otherActiveOrders = await prisma.order.findMany({
          where: {
            currentStationId: mainStation,
            status: { not: 'SERVED' },
            assignedUserId: { not: userId },
            NOT: {
              assignedUserId: null
            }
          },
          orderBy: { createdAt: 'desc' }
        });

        if (otherActiveOrders.length > 0) {
          const latestOrder = otherActiveOrders[0];
          console.log(`[Network Reconnect] Load balancing: Moving latest order ${latestOrder.id} to reconnected cook ${userId}`);
          await prisma.$transaction(async (tx) => {
            await tx.order.update({
              where: { id: latestOrder.id },
              data: { assignedUserId: userId, updatedAt: new Date() }
            });
            const seq = await this.getNextSequenceNumber(tx, kitchenId);
            const event = await tx.orderEvent.create({
              data: {
                kitchenId,
                orderId: latestOrder.id,
                type: 'ORDER_TRANSITIONED',
                sequenceNumber: seq,
                payload: JSON.stringify({
                  orderId: latestOrder.id,
                  stationId: latestOrder.currentStationId,
                  newStatus: latestOrder.status,
                  assignedUserId: userId
                })
              }
            });
            const clientEvent = {
              sequenceNumber: Number(event.sequenceNumber),
              eventId: event.id,
              kitchenId: event.kitchenId,
              orderId: event.orderId,
              type: event.type as any,
              payload: typeof event.payload === 'string' ? JSON.parse(event.payload) : event.payload,
              timestamp: new Date(event.createdAt).getTime()
            };
            globalEventStore.appendEvent(clientEvent);
            io.to(`kitchen:${kitchenId}`).emit('order:transition', clientEvent);
          });
        }
      }
    }
  }
}

export const orderRepository = new OrderRepository();
