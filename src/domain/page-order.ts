import type { BookStyle, PageBreak } from './contracts.js';

/** Physical sides follow binding; folio values and writing direction do not affect them. */
export function pageSide(number: number, binding: BookStyle['binding'] = 'right'): 'left' | 'right' {
  return (number % 2 === 1) === (binding === 'right') ? 'left' : 'right';
}
export function matchesPageStart(start: PageBreak['start'], number: number, style: BookStyle): boolean {
  return start === 'next' || style.pageLayout === 'uniform' || (start === 'recto' ? number % 2 === 1 : pageSide(number, style.binding) === start);
}
export function spreadPages(selected: number, total: number, binding: BookStyle['binding'] = 'right'): { left: number | null; right: number | null } {
  const first = selected === 1, even = selected % 2 === 0;
  const later = first ? 1 : even ? selected + 1 : selected, earlier = first ? null : even ? selected : selected - 1;
  const last = later <= total ? later : null;
  return binding === 'right' ? { left: last, right: earlier } : { left: earlier, right: last };
}
export function adjacentPage(selected: number, total: number, direction: -1 | 1, single: boolean): number {
  if (single) return Math.min(total, Math.max(1, selected + direction));
  const spreadStart = selected === 1 ? 1 : selected % 2 === 0 ? selected : selected - 1;
  return Math.min(total, Math.max(1, direction === 1 ? spreadStart === 1 ? 2 : spreadStart + 2 : spreadStart === 2 ? 1 : spreadStart - 2));
}
