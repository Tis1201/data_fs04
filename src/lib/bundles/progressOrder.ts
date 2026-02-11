/**
 * Single canonical order for bundle wave device progress: End On (completedAt) desc, then device name asc.
 * Used by progress APIs and bundle process so order never mixes up after data updates.
 */
export function compareProgressOrder(
  aEnd: number,
  aName: string,
  bEnd: number,
  bName: string
): number {
  if (bEnd !== aEnd) return bEnd - aEnd; // completedAt desc
  return (aName || '').localeCompare(bName || '', undefined, { sensitivity: 'base' }); // name asc
}
