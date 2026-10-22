import test from 'node:test';
import assert from 'node:assert/strict';
import { createBook } from '../../dist/domain/book.js';
import { layoutInput, resolveLayoutAssets } from '../../dist/domain/layout-input.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { serializeProject } from '../../dist/domain/project.js';

test('metadata-only layout resolves to the same canonical image pages, captions and print data', () => {
  for (const imageMode of ['flow', 'page', 'spread', 'bleed', 'external']) {
    const book = createBook('本文。\n:::illustration id="art"\n続く本文。');
    book.assets = [{ id: 'asset', name: '原本.svg', mediaType: 'image/svg+xml', bytes: 3, original: 'data:image/svg+xml;base64,QUJD', images: [{ dataUrl: 'data:image/png;base64,QUJD', width: 1200, height: 1800, widthMm: 105, heightMm: 148 }] }];
    Object.assign(book.specialPages[0], { assetId: 'asset', imageMode, caption: { text: '図の説明。', numbered: true, fontPt: 8 } });
    const before = serializeProject(book), input = layoutInput(book);
    assert.equal('source' in input, false); assert.equal('original' in input.assets[0], false); assert.equal('dataUrl' in input.assets[0].images[0], false);
    const raw = typesetPublication(input); assert.doesNotMatch(JSON.stringify(raw), /data:(?:image|application)/u);
    assert.deepEqual(resolveLayoutAssets(raw, book), typesetPublication(book));
    assert.equal(serializeProject(book), before);
  }
});
