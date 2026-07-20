export type OrderStatus = 'PLACED' | 'PREPARING' | 'READY' | 'SERVED';

const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PLACED: ['PREPARING'],
  PREPARING: ['READY'],
  READY: ['SERVED'],
  SERVED: [],
};

export class InvalidStateTransitionError extends Error {
  constructor(public currentStatus: OrderStatus, public targetStatus: OrderStatus) {
    super(`Invalid transition from ${currentStatus} to ${targetStatus}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export function validateStateTransition(currentStatus: OrderStatus, targetStatus: OrderStatus): void {
  const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    throw new InvalidStateTransitionError(currentStatus, targetStatus);
  }
}
