import { describe, it, expect } from 'vitest';
import { validateStateTransition, InvalidStateTransitionError } from './stateMachine';

describe('Order State Machine', () => {
  it('allows valid sequential transitions', () => {
    expect(() => validateStateTransition('PLACED', 'PREPARING')).not.toThrow();
    expect(() => validateStateTransition('PREPARING', 'READY')).not.toThrow();
    expect(() => validateStateTransition('READY', 'SERVED')).not.toThrow();
  });

  it('allows same-status transitions for station movements', () => {
    expect(() => validateStateTransition('PREPARING', 'PREPARING')).not.toThrow();
    expect(() => validateStateTransition('READY', 'READY')).not.toThrow();
  });

  it('rejects invalid state jumps', () => {
    expect(() => validateStateTransition('PLACED', 'READY')).toThrow(InvalidStateTransitionError);
    expect(() => validateStateTransition('PLACED', 'SERVED')).toThrow(InvalidStateTransitionError);
  });

  it('rejects backward state transitions', () => {
    expect(() => validateStateTransition('PREPARING', 'PLACED')).toThrow(InvalidStateTransitionError);
    expect(() => validateStateTransition('SERVED', 'READY')).toThrow(InvalidStateTransitionError);
  });
});
