/**
 * Interval-overlap predicate (MVP plan §2.6): two intervals overlap iff
 * `aStart < bEnd && bStart < aEnd` (strict inequality — touching at a
 * boundary is not an overlap). `occurrence.repository.findOverlapping`
 * expresses this same formula as a Prisma `where` clause for the DB query —
 * keep the two in sync if this formula ever changes.
 */
export function hasOverlap(
  aStart: Date,
  aEnd: Date,
  bStart: Date,
  bEnd: Date,
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
