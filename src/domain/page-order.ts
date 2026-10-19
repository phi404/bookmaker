/** Logical page order is independent of printed folio numbers and preview mode. */
export function spreadPages(selected: number, total: number): { left: number | null; right: number | null } {
  if (selected === 1) return { left: 1, right: null };
  const even = selected % 2 === 0, left = even ? selected + 1 : selected;
  return { left: left <= total ? left : null, right: even ? selected : selected - 1 };
}
export function adjacentPage(selected: number, total: number, direction: -1 | 1, single: boolean): number {
  if (single) return Math.min(total, Math.max(1, selected + direction));
  const spreadStart = selected === 1 ? 1 : selected % 2 === 0 ? selected : selected - 1;
  return Math.min(total, Math.max(1, direction === 1 ? spreadStart === 1 ? 2 : spreadStart + 2 : spreadStart === 2 ? 1 : spreadStart - 2));
}
