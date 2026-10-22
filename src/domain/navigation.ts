import type { BookPage } from './contracts.js';
import type { SpecialPageDefinition } from './model.js';
import type { LayoutPublication } from './layout-input.js';
import { flattenDocument } from './publication.js';
import { folioNumber } from './decoration.js';
import type { TocEntry } from './templates.js';

export interface HeadingTarget { blockId: string; title: string; level: 1 | 2 | 3; pageNumber: number }
export interface InternalPageLink { pageNumber: number; targetPageNumber: number; xMm: number; yMm: number; widthMm: number; heightMm: number }
export interface BookNavigation { headings: HeadingTarget[]; links: InternalPageLink[] }
export function bookHeadings(book: LayoutPublication, pages: readonly BookPage[] = []): HeadingTarget[] {
  const firstPages = new Map<string, number>();
  for (const page of pages) for (const line of page.lines) if (!firstPages.has(line.blockId)) firstPages.set(line.blockId, page.number);
  return flattenDocument(book.document).flatMap(block => {
    if (block.kind !== 'heading') return [];
    const level = block.level; if (level !== 1 && level !== 2 && level !== 3) throw new Error('見出しの階層を確認してください。');
    return [{ blockId: block.id, title: block.inlines.map(run => run.kind === 'ruby' ? run.base : run.text).join(''), level, pageNumber: firstPages.get(block.id) ?? 0 }];
  });
}
export function tocEntries(book: LayoutPublication, definition: SpecialPageDefinition, pages: readonly BookPage[] = []): TocEntry[] {
  return bookHeadings(book, pages).filter(h => h.level <= (definition.toc?.depth ?? 1)).map(h => {
    const label = pages.find(p => p.number === h.pageNumber)?.folioLabel;
    return { blockId: h.blockId, level: h.level, title: h.title, page: h.pageNumber ? label ? /^\d+$/u.test(label) ? Number(label) : label : folioNumber(book.style.folio, h.pageNumber) ?? h.pageNumber : pages.length ? '—' : '' };
  });
}
/** Navigation is derived from canonical headings and the final pages, never stored page coordinates. */
export function bookNavigation(book: LayoutPublication, allPages: readonly BookPage[], selectedPages: readonly BookPage[] = allPages): BookNavigation {
  const included = new Set(selectedPages.map(p => p.number)), headings = bookHeadings(book, allPages), targets = new Map(headings.map(h => [h.blockId, h.pageNumber]));
  const links: InternalPageLink[] = [];
  for (const page of selectedPages) {
    if (page.kind !== 'structured') continue;
    const definition = book.specialPages?.find(p => p.id === page.pageId);
    if (!definition || definition.role !== 'toc') continue;
    const entries = tocEntries(book, definition, allPages);
    for (const element of page.elements) {
      if (element.kind !== 'text') continue;
      const match = /^t-(?:toc|num)-(\d+)(?:-\d+)?$/u.exec(element.id), entry = match ? entries[Number(match[1])] : undefined;
      const targetPageNumber = entry?.blockId ? targets.get(entry.blockId) : undefined;
      if (targetPageNumber && included.has(targetPageNumber)) links.push({ pageNumber: page.number, targetPageNumber, xMm: element.xMm, yMm: element.yMm, widthMm: element.widthMm, heightMm: element.heightMm });
    }
  }
  return { headings: headings.filter(h => included.has(h.pageNumber)), links };
}
