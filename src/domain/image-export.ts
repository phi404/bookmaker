import type { BookPage } from './contracts.js';
import { integer } from './style.js';

/** Number by physical page, group by the explicitly selected export range. */
export function imageExportPlan(pages: readonly Pick<BookPage, 'number'>[], batchSize: number): { pageNumber: number; folder: string }[] {
  integer(batchSize, '一組の画像枚数', 0, 100);
  const seen = new Set<number>();
  return pages.map((page, index) => {
    integer(page.number, '出力するページ');
    if (seen.has(page.number)) throw new Error('出力するページが重複しています。'); seen.add(page.number);
    return { pageNumber: page.number, folder: batchSize ? `set-${String(Math.floor(index / batchSize) + 1).padStart(2, '0')}/` : '' };
  });
}
