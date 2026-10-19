import type { Document, BookStyle, BookPage } from '../../src/domain/contracts.ts';

export const validDocument: Document = {
  schemaVersion: 1, title: '組版確認', blocks: [
    { id: 'p1', kind: 'paragraph', indent: 'auto', inlines: [{ kind: 'text', text: '本文' }, { kind: 'ruby', base: '薔薇', reading: 'ばら' }] },
    { id: 'h1', kind: 'heading', level: 1, keepWithNext: true, inlines: [{ kind: 'text', text: '第一章' }] },
    { id: 'b1', kind: 'pageBreak', start: 'right' },
  ],
};
export const validStyle: BookStyle = {
  page: { widthMm: 105, heightMm: 148 }, writingMode: 'vertical-rl', binding: 'right', columns: 1,
  fontFamily: 'standard-mincho', fontPt: 9, lineHeight: 1.8,
  margins: { topMm: 15, bottomMm: 16, innerMm: 17, outerMm: 13 },
};
export const externalPage: BookPage = { kind: 'asset', pageId: 'cover-art', blockId: 'cover-ref', number: 1, lines: [], name: '扉絵', elements: [] };

// @ts-expect-error Ruby must retain its reading, not only base characters.
export const missingReading: Document = { schemaVersion: 1, title: 'invalid', blocks: [{ id: 'x', kind: 'paragraph', indent: 'auto', inlines: [{ kind: 'ruby', base: '薔薇' }] }] };
// @ts-expect-error A draft source string is not a structured Document.
export const sourceOnly: Document = '本文';
// @ts-expect-error User coordinate overrides are not a paragraph field.
export const coordinateOverride: Document = { schemaVersion: 1, title: 'invalid', blocks: [{ id: 'x', kind: 'paragraph', indent: 'auto', inlines: [], xMm: 2 }] };
