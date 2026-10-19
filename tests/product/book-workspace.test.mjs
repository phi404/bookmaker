import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
import { createBook, editBookSource, addSpecialPage, updateSpecialPage, duplicateSpecialPage, removeBookItem, moveBookItem, convertToFree, checkBook } from '../../dist/domain/book.js';
import { flattenDocument } from '../../dist/domain/publication.js';
import { serializeProject, restoreProject } from '../../dist/domain/project.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { renderPageSVG } from '../../dist/render/svg.js';

test('duplicating a page with a maximum length label keeps a valid bounded label', () => {
  const p = updateSpecialPage(createBook(':::title id="t"'), 't', { name: 'あ'.repeat(100) });
  const copy = duplicateSpecialPage(p, 't');
  assert.equal(checkBook(copy.book).specialPages.find(p => p.id === copy.id).name, 'あ'.repeat(97) + 'の複製');
  assert.equal(p.specialPages[0].name, 'あ'.repeat(100));
});

test('one canonical book retains special details across source edit, reorder, deletion and JSON', async () => {
  let p = createBook(await readText('fixtures/book/mixed.md'));
  p = updateSpecialPage(p, 'colophon-main', { fields: { title: '庭の本', author: '作者', date: '2026年10月' } });
  const refId = flattenDocument(p.document).find(b => b.pageId === 'colophon-main').id;
  p = editBookSource(p, p.source.replace('第一章', 'はじまり').replace('　――', '　追記。\n　――')).book;
  assert.equal(flattenDocument(p.document).find(b => b.pageId === 'colophon-main').id, refId);
  assert.equal(p.specialPages.find(p => p.id === 'colophon-main').fields.author, '作者');
  const restored = restoreProject(serializeProject({ ...p, source: '古いキャッシュ' }));
  assert.equal(restored.schemaVersion, 3); assert.match(restored.source, /:::colophon id="colophon-main"/u);
  assert.equal(restored.specialPages.find(p => p.id === 'colophon-main').fields.title, '庭の本');
  p = removeBookItem(p, 'colophon-main'); assert.ok(!p.source.includes(':::colophon')); assert.ok(p.specialPages.some(p => p.id === 'colophon-main'));
  p = editBookSource(p, p.source + '\n:::colophon id="colophon-main"').book; assert.equal(p.specialPages.find(p => p.id === 'colophon-main').fields.author, '作者');
});

test('incomplete or duplicate references preserve draft separately and block GUI overwrite', () => {
  const p = createBook('本文。\n:::colophon id="c"');
  const draft = editBookSource(p, '本文を編集。\n:::colophon id="');
  assert.ok(draft.error); assert.equal(draft.book.source, p.source); assert.equal(draft.book.sourceDraft, '本文を編集。\n:::colophon id="');
  assert.throws(() => addSpecialPage(draft.book, 'title'), /入力途中/u);
  assert.equal(restoreProject(serializeProject(draft.book)).sourceDraft, draft.book.sourceDraft);
  const duplicate = editBookSource(p, p.source + '\n:::colophon id="c"'); assert.match(duplicate.error, /二度/u);
  assert.match(editBookSource(p, p.source.replace('colophon', 'title')).error, /種別/u);
  assert.equal(editBookSource(draft.book, p.source).book.sourceDraft, undefined);
});

test('special page followed by a terminal explicit break leaves exactly one intentional blank', async () => {
  const p = createBook((await readText('fixtures/book/special-break.md')).trimEnd());
  const pages = typesetPublication(p).pages;
  assert.equal(pages.length, 2); assert.equal(pages[0].kind, 'structured'); assert.equal(pages[1].kind, 'flow'); assert.equal(pages[1].lines.length, 0);
  const withText = editBookSource(p, p.source + '\n次の本文').book;
  assert.equal(typesetPublication(withText).pages.length, 2);
});

test('structure reorder moves over a visible page item rather than invisible paragraph rows', () => {
  let p = createBook(':::title id="a"\n本文甲\n本文乙\n:::colophon id="b"');
  p = moveBookItem(p, 'b', -1);
  assert.ok(p.source.indexOf('id="b"') < p.source.indexOf('id="a"'));
  assert.match(p.source, /本文甲\n本文乙/u); checkBook(p);
});

test('template conversion preserves semantic role and identity, with editable elements outside source', () => {
  const p = createBook(':::colophon id="c"'), rendered = typesetPublication(p).pages[0];
  const free = convertToFree(p, 'c', rendered.elements);
  assert.equal(free.specialPages[0].role, 'colophon'); assert.equal(free.specialPages[0].representation, 'layout');
  assert.ok(free.specialPages[0].originalTemplate); assert.equal(free.source, p.source); assert.ok(!free.source.includes('xMm'));
  assert.equal(typesetPublication(restoreProject(serializeProject(free))).pages[0].kind, 'layout');
});

test('a special page can move before the first chapter without corrupting the chapter anchor', async () => {
  let p = createBook((await readText('fixtures/book/move-before-chapter.md')).trimEnd()); const chapter = p.document.children[0].id;
  p = moveBookItem(p, 'front', -1); assert.match(p.source, /^:::title id="front"\n# 第一章/u);
  assert.equal(p.document.children[1].id, chapter); assert.equal(p.document.children[1].children[0].kind, 'heading'); checkBook(p);
});

test('sparse physical page overrides do not affect capacity and semantic running text follows insertion', () => {
  let p = createBook('# 甲\n本文。\n===\n# 乙\n後の本文。\n===\n最後。');
  const chapterId = p.document.children[1].id;
  p.runningElements = [{ id: 'head', scope: { kind: 'section', sectionId: chapterId }, content: { kind: 'chapter' }, position: 'top-center', side: 'both', fontPt: 7, insetMm: 8, hideOnSectionFirst: false }];
  p.pageOverrides = [{ id: 'sparse', pages: [1, 3], folio: false, hideHeads: true, paperColor: 'white' }];
  const pages = typesetPublication(p).pages;
  assert.equal(pages[0].folioVisible, false); assert.equal(pages[1].folioVisible, undefined); assert.equal(pages[2].folioVisible, false);
  const without = typesetPublication({ ...p, pageOverrides: [] }); assert.deepEqual(pages.map(p => p.lines), without.pages.map(p => p.lines));
  p = editBookSource(p, '前付\n===\n' + p.source).book;
  assert.equal(p.document.children.at(-1).id, chapterId);
  assert.ok(typesetPublication(p).pages.some(p => p.runningElements?.some(e => e.text === '乙')));
  assert.deepEqual(p.pageOverrides[0].pages, [1, 3]);
});

test('mixed flow, template, external image and free pages share rendering and diagnose missing assets', () => {
  const p = createBook('本文\n:::illustration id="pic"\n:::free id="free"');
  p.assets = [{ id: 'asset-a', name: 'tiny.png', mediaType: 'image/png', original: 'data:image/png;base64,aGVsbG8=', bytes: 5, images: [{ dataUrl: 'data:image/png;base64,aGVsbG8=', width: 100, height: 100 }] }];
  p.specialPages.find(p => p.id === 'pic').assetId = 'asset-a';
  const result = typesetPublication(checkBook(p)); assert.deepEqual(result.pages.map(p => p.kind), ['flow', 'asset', 'layout']);
  assert.match(renderPageSVG(result.pages[1], p.style), /<image/u); assert.ok(result.diagnostics.some(d => d.code === 'image-resolution'));
  p.assets = []; assert.ok(typesetPublication(p).diagnostics.some(d => d.code === 'asset-missing'));
});

test('until-next-section scope never leaks into the following chapter', () => {
  const p = createBook('# 一\n先\n後\n===\n# 二\n別'); const first = p.document.children[0], from = first.children.find(b => b.kind === 'paragraph');
  p.overrides = [{ id: 'anchor', scope: { kind: 'untilSection', fromId: from.id }, paragraph: { alignment: 'end' } }];
  const lines = typesetPublication(p).pages.flatMap(p => p.lines);
  assert.equal(lines.find(l => l.blockId === from.id).alignment, 'end');
  assert.ok(lines.filter(l => p.document.children[1].children.some(b => b.id === l.blockId)).every(l => l.alignment !== 'end'));
});

test('unsupported templates are rejected rather than rendering an empty imported page', () => {
  const p = createBook(':::external id="x"'); p.specialPages[0].representation = 'template';
  assert.throws(() => checkBook(p), /テンプレート/u);
});

test('long colophon content and out-of-page free elements are diagnosed', () => {
  const p = createBook(':::colophon id="c"\n:::free id="f"'); p.specialPages[0].fields.note = '収まりを確認する文章。'.repeat(100);
  p.specialPages[1].elements = [{ id: 'box', kind: 'rect', xMm: 100, yMm: 140, widthMm: 20, heightMm: 20, color: '#000000', strokeMm: .2 }];
  const codes = typesetPublication(checkBook(p)).diagnostics.map(d => d.code);
  assert.ok(codes.includes('text-box-overflow')); assert.ok(codes.includes('element-overflow'));
});
