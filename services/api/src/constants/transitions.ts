import { TicketStatus } from '@prisma/client';

/**
 * Valid ticket status transitions.
 * Implements the state machine defined in spec §4.
 *
 * `closed` maps to an empty array — it is a terminal state.
 * Any transition attempt from `closed` will be rejected with 422.
 */
export const TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  open:         ['in_progress', 'closed'],
  in_progress:  ['pending_info', 'resolved', 'closed'],
  pending_info: ['in_progress', 'closed'],
  resolved:     ['closed', 'in_progress'],
  closed:       [],
};

/**
 * Returns true when moving from `current` to `next` is an allowed transition.
 * Used by ticket.service.ts before applying a status update.
 */
export function isValidTransition(current: TicketStatus, next: TicketStatus): boolean {
  return TRANSITIONS[current].includes(next);
}

/**
 * Returns a human-readable list of valid next statuses from a given status.
 * Included in the 422 error message so the client knows what is allowed.
 */
export function allowedTransitionsFrom(current: TicketStatus): string {
  const next = TRANSITIONS[current];
  return next.length > 0 ? next.join(', ') : 'none — this is a terminal state';
}
