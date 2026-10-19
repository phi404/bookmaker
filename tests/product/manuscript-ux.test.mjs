import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
import { sourceBlocks, contentKey } from '../../dist/domain/source.js';
import { createPublication, flattenDocument } from '../../dist/domain/publication.js';
import { asBook, checkBook } from '../../dist/domain/book.js';

test('Markdown emphasis and English page directives preserve ruby, strong, literal marks and page side', async () => {
  const b = sourceBlocks(await readText('fixtures/book/modern-notation.md'), 'markdown').map(r => r.block);
  assert.deepEqual(b.slice(0, 5).map(b => b.kind), ['heading', 'paragraph', 'pageBreak', 'pageBreak', 'heading']);
  assert.equal(b[3].start, 'right');
  assert.ok(b[1].inlines.some(r => r.kind === 'ruby' && r.base === '薔薇' && r.reading === 'ばら' && r.emphasis === 'sesame'));
  assert.ok(b[1].inlines.some(r => r.text === '太字' && r.strong));
  assert.ok(b[1].inlines.some(r => r.kind === 'text' && r.text.includes('*記号*')));
  assert.ok(b[5].inlines.some(r => r.text === '丸い圏点' && r.emphasis === 'dot'));
  assert.ok(b[5].inlines.some(r => r.text === '重なる強調' && r.strong && r.emphasis === 'sesame'));
});

test('modernizing legacy notation keeps canonical nodes, identifiers, styles and literal Markdown characters', async () => {
  const { modernizeNotation } = await import('../../dist/domain/book.js');
  const p = asBook(createPublication('[見出し] 第一章\n　[圏点]｜薔薇《ばら》[/圏点]\n[右ページ]\n# literal * symbols\n[圏点:丸]丸[/圏点]', 'legacy'));
  p.document.children[0].children[1].localStyle = { paragraph: { indentEm: 2 } };
  const old = globalThis.structuredClone(p); const modern = modernizeNotation(p);
  assert.equal(modern.syntax, 'markdown'); assert.deepEqual(modern.document, old.document); assert.equal(p.syntax, 'legacy');
  assert.match(modern.source, /# 第一章/u); assert.match(modern.source, /:::page-break side="right"/u); assert.ok(!/\[(?:見出し|圏点|右ページ|改ページ)/u.test(modern.source));
  assert.deepEqual(sourceBlocks(modern.source, 'markdown').map(r => contentKey(r.block)), flattenDocument(p.document).map(contentKey));
  assert.deepEqual(checkBook(modern).document, old.document);
});

test('notation projection leaves ordinary punctuation and URLs readable while protecting leading directives', async () => {
  const { modernizeNotation } = await import('../../dist/domain/book.js');
  const raw = 'URL https://example.invalid/path と 3.14。\n:::center\n# 本文の記号\n> 文字としての括弧\n---\n===\n```\n:::colophon id="literal"\n[圏点]言葉と｜薔薇《ばら》[/圏点]';
  const original = asBook(createPublication(raw, 'legacy')), projected = modernizeNotation(original);
  assert.ok(projected.source.includes('URL https://example.invalid/path と 3.14。'));
  assert.deepEqual(sourceBlocks(projected.source, 'markdown').map(r => contentKey(r.block)), flattenDocument(original.document).map(contentKey));
});

test('adjacent emphasis and strong spans survive semantic projection across ruby boundaries', async () => {
  const { sourceOf } = await import('../../dist/domain/publication.js');
  for (const source of ['*甲***乙**', '**甲***乙*', '*言葉と｜薔薇《ばら》*', '***太字と｜薔薇《ばら》***']) {
    const book = asBook(createPublication(source, 'markdown')), before = flattenDocument(book.document).map(contentKey);
    assert.ok(flattenDocument(book.document)[0].inlines.some(i => i.emphasis === 'sesame'));
    assert.ok(flattenDocument(book.document)[0].inlines.some(i => i.strong || source.includes('言葉と')));
    assert.deepEqual(sourceBlocks(sourceOf(book.document, 'markdown'), 'markdown').map(r => contentKey(r.block)), before);
  }
});
