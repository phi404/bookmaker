import type { BookStyle, DecorationPosition, FolioStyle, RunningHead } from './contracts.js';

import { pageSide } from './page-order.js';

export function decorationSide(layout: BookStyle['pageLayout'], page: number, position: DecorationPosition, binding: BookStyle['binding'] = 'right'): 'left' | 'center' | 'right' {
  const side = position.split('-')[1], mirrored = layout !== 'uniform' && pageSide(page, binding) === 'right';
  return side === 'outer' ? mirrored ? 'right' : 'left' : side === 'inner' ? mirrored ? 'left' : 'right' : side as 'left' | 'center' | 'right';
}
export function folioNumber(f: FolioStyle | undefined, page: number): number | null {
  if (!f) return null;
  let enabled = f.enabled && page >= f.fromPage, number = f.startNumber + page - f.fromPage;
  for (const r of f.rules) if (page >= r.from && (r.to === null || page <= r.to)) { enabled = r.enabled; if (r.startNumber !== undefined) number = r.startNumber + page - r.from; }
  return enabled ? number : null;
}
export function headsForPage(style: BookStyle, page: number): readonly RunningHead[] {
  const heads = new Map<string, RunningHead>();
  for (const h of style.runningHeads ?? []) if (page >= h.from && (h.to === null || page <= h.to) && (h.side === 'both' || (page % 2 === 1) === (h.side === 'odd'))) heads.set(decorationSide(style.pageLayout, page, h.position, style.binding), h);
  return [...heads.values()].filter(h => h.text);
}
