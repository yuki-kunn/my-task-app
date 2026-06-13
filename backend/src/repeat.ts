export type RepeatType = 'none' | 'daily' | 'weekly' | 'yearly';

/** Computes the deadline of the next occurrence of a repeating task. */
export function nextDeadline(deadline: Date, repeatType: RepeatType): Date | null {
  const next = new Date(deadline);
  switch (repeatType) {
    case 'daily':
      next.setDate(next.getDate() + 1);
      return next;
    case 'weekly':
      next.setDate(next.getDate() + 7);
      return next;
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1);
      return next;
    default:
      return null;
  }
}
