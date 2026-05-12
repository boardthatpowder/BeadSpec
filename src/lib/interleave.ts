/**
 * Interleave two arrays by timestamp, sorted ascending.
 *
 * @param as   First array
 * @param bs   Second array
 * @param getDate  Function that extracts a Date from either element type
 * @returns  Merged array sorted by date ascending
 */
export function interleaveByTimestamp<A, B>(
  as: A[],
  bs: B[],
  getDate: (x: A | B) => Date,
): (A | B)[] {
  const merged: (A | B)[] = [...as, ...bs]
  merged.sort((x, y) => getDate(x).getTime() - getDate(y).getTime())
  return merged
}
