import type { BookPage, RenderElement } from './contracts.js';
import type { SpecialPageDefinition } from './model.js';
import type { LayoutPublication } from './layout-input.js';
import { flattenDocument } from './publication.js';
import { elementTextLines } from './element-layout.js';
import { pageMargins } from './style.js';
import { imagePrintInfo } from './image-print.js';

export function figureNumbers(book: LayoutPublication): Map<string, number> {
  let number = 0; const result = new Map<string, number>();
  for (const block of flattenDocument(book.document)) if (block.kind === 'specialPage' && book.specialPages?.find(p => p.id === block.pageId)?.caption?.numbered) result.set(block.pageId, ++number);
  return result;
}
/** Reserve a caption inside the existing image band; never add coordinates to body text. */
export function captionedPages(book: LayoutPublication, pages: readonly BookPage[]): BookPage[] {
  const numbers = figureNumbers(book), refs = new Map(flattenDocument(book.document).flatMap(b => b.kind === 'specialPage' ? [[b.id, b.pageId] as const] : []));
  const seen = new Set<string>();
  return pages.map(page => {
    const style = page.style ?? book.style, elements: RenderElement[] = [], captions: RenderElement[] = [];
    let flowInfo = page.kind === 'flow' ? [...(page.imageInfo ?? [])] : [];
    let assetInfo = page.kind !== 'flow' ? page.imageInfo : undefined;
    for (const element of page.elements ?? []) {
      const pageId = page.kind === 'flow' ? refs.get(element.blockId ?? '') : page.pageId;
      const definition: SpecialPageDefinition | undefined = book.specialPages?.find(p => p.id === pageId), caption = definition?.caption;
      if (element.kind !== 'image' || !caption || !definition) { elements.push(element); continue; }
      const text = `${caption.numbered ? `図 ${numbers.get(definition.id)}${caption.text ? '　' : ''}` : ''}${caption.text}`;
      const margins = pageMargins(style, page.number), spread = definition.imageMode === 'spread';
      const box = page.kind === 'flow' ? element : { xMm: spread ? 5 : margins.left, yMm: spread ? 5 : style.margins.topMm, widthMm: style.page.widthMm - (spread ? 10 : margins.left + margins.right), heightMm: style.page.heightMm - (spread ? 10 : style.margins.topMm + style.margins.bottomMm) };
      const size = caption.fontPt * 25.4 / 72, rows = elementTextLines(text, box.widthMm / size).length;
      const needed = size * (1 + Math.max(0, rows - 1) * 1.65) + size * .4;
      const height = Math.min(Math.max(size, needed), Math.max(size, box.heightMm - size * 2));
      const imageHeight = Math.max(.1, box.heightMm - height - size * .5);
      const image = { ...element, xMm: spread ? element.xMm : box.xMm, yMm: box.yMm, widthMm: spread ? element.widthMm : box.widthMm, heightMm: imageHeight };
      elements.push(image);
      if (!spread || !seen.has(definition.id)) captions.push({ id: `caption-${definition.id}`, kind: 'text', xMm: box.xMm, yMm: box.yMm + imageHeight + size * .5, widthMm: box.widthMm, heightMm: height, text, fontPt: caption.fontPt, fontWeight: 400, alignment: 'center', direction: 'horizontal', ...(element.blockId ? { blockId: element.blockId } : {}) });
      seen.add(definition.id);
      const assetImage = book.assets?.find(a => a.id === definition.assetId)?.images[definition.assetPage - 1];
      if (assetImage) {
        const info = imagePrintInfo(assetImage, image.widthMm, image.heightMm, definition.fit, definition.imageMode ?? 'page', definition.bleedMm ?? 0);
        if (page.kind === 'flow') {
          const index = (page.elements ?? []).filter(e => e.kind === 'image').findIndex(e => e.id === element.id && e.blockId === element.blockId);
          flowInfo = flowInfo.map((item, at) => at === index ? info : item);
        } else assetInfo = info;
      }
    }
    const updated = page.elements ? { elements: [...elements, ...captions] } : {};
    return page.kind === 'flow' ? { ...page, ...updated, ...(page.imageInfo ? { imageInfo: flowInfo } : {}) } : { ...page, ...updated, ...(assetInfo ? { imageInfo: assetInfo } : {}) };
  });
}
