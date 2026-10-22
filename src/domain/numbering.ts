import type { BookPage } from './contracts.js';
import type { SectionProperties } from './model.js';
import type { LayoutPublication } from './layout-input.js';
import { folioNumber } from './decoration.js';
import { inheritedStyle } from './styles.js';

export function sectionNumbering(book: LayoutPublication, sectionId: string): SectionProperties {
  const section = book.document.children.find(s => s.id === sectionId);
  if (!section) return {};
  return { ...(section.styleId ? inheritedStyle(book.styles.sections!, section.styleId).properties : {}), ...section.localStyle };
}
export function formatPageNumber(value: number, format: SectionProperties['numberFormat'] = 'decimal'): string {
  if (format === 'decimal' || value < 1 || value > 3999) return String(value);
  let text = '', rest = value;
  for (const [amount, mark] of [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']] as const) {
    while (rest >= amount) { text += mark; rest -= amount; }
  }
  return format === 'roman' ? text.toLowerCase() : text;
}
/** Semantic numbering follows a section's first physical page after pagination. */
export function pageNumberLabels(book: LayoutPublication, pages: readonly BookPage[]): Map<number, string | null> {
  const first = new Map<string, number>();
  for (const page of pages) if (page.sectionId && !page.generatedBlank && !first.has(page.sectionId)) first.set(page.sectionId, page.number);
  const rules = book.document.children.flatMap(section => {
    const properties = sectionNumbering(book, section.id), page = first.get(section.id);
    return page !== undefined && (properties.numberStart !== undefined || properties.numberFormat) ? [{ ...properties, fromPage: page }] : [];
  }).sort((a, b) => a.fromPage - b.fromPage);
  return new Map(pages.map(page => {
    let number = folioNumber(book.style.folio, page.number), format: SectionProperties['numberFormat'] = 'decimal';
    for (const rule of rules) if (rule.fromPage <= page.number) {
      if (rule.numberStart !== undefined && number !== null) number = rule.numberStart + page.number - rule.fromPage;
      if (rule.numberFormat) format = rule.numberFormat;
    }
    return [page.number, page.generatedBlank || page.folioVisible === false || number === null ? null : formatPageNumber(number, format)];
  }));
}

export function finishBookPages(book: LayoutPublication, input: readonly BookPage[]): BookPage[] {
  const pages = [...input], multiple = book.style.pageCountMultiple ?? 1;
  const hasContent = book.document.children.some(s => s.children.some(b => b.kind === 'specialPage' || 'inlines' in b && b.inlines.length));
  if (hasContent) while (pages.length % multiple) pages.push({ kind: 'flow', number: pages.length + 1, lines: [], style: book.style, generatedBlank: true, folioVisible: false, hideHeads: true });
  const labels = pageNumberLabels(book, pages);
  return pages.map(page => ({ ...page, folioLabel: labels.get(page.number) ?? null,
    ...(page.runningElements ? { runningElements: page.runningElements.map(element => book.runningElements.find(e => e.id === element.id)?.content.kind === 'pageNumber' ? { ...element, text: labels.get(page.number) ?? String(page.number) } : element) } : {}) }));
}
