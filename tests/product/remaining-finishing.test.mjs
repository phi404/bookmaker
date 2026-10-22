import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
import { createBook, editBookSource, moveBookItem } from '../../dist/domain/book.js';
import { serializeProject, restoreProject } from '../../dist/domain/project.js';
import { defaultStyle } from '../../dist/domain/style.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { paginate } from '../../dist/typesetting/paginator.js';
import { tocEntries } from '../../dist/domain/navigation.js';
import { renderPageSVG } from '../../dist/render/svg.js';
import { imageExportPlan } from '../../dist/domain/image-export.js';
import { figureNumbers } from '../../dist/domain/figures.js';

test('semantic front/body number series, recto and generated end blanks share the final page list', async () => {
  const book = createBook(await readText('fixtures/book/number-series.md')); book.style.pageCountMultiple = 8;
  const original = book.source, pages = typesetPublication(book).pages;
  assert.equal(pages.length, 8);
  const preface = pages.find(p => p.lines.some(l => l.runs.some(r => (r.text ?? r.base).includes('前'))));
  assert.equal(preface.number, 2); assert.equal(preface.folioLabel, 'i');
  const bodyHeading = book.document.children.find(s => s.role === 'chapter' && s.localStyle?.numberFormat === 'decimal').headingId;
  const bodyPage = pages.find(p => p.lines.some(l => l.blockId === bodyHeading));
  assert.equal(bodyPage.number, 3); assert.equal(bodyPage.folioLabel, '1');
  assert.deepEqual(tocEntries(book, book.specialPages[0], pages).map(e => e.page), ['i', 1]);
  const blanks = pages.filter(p => p.generatedBlank);
  assert.equal(blanks.length, 5); assert.ok(blanks.every(p => !p.lines.length && p.folioLabel === null && p.hideHeads));
  assert.match(renderPageSVG(preface, book.style), /data-testid="folio"[^>]*>i<\/text>/u);
  assert.doesNotMatch(renderPageSVG(blanks[0], book.style), /data-testid="folio"/u);
  assert.equal(book.source, original);
  const restored = restoreProject(serializeProject(book)); assert.deepEqual(typesetPublication(restored).pages, pages);
  const moved = moveBookItem(book, book.document.children[2].id, -1), movedPages = typesetPublication(moved).pages;
  assert.equal(movedPages.find(p => p.lines.some(l => l.blockId === bodyHeading)).folioLabel, '1');
  const edited = editBookSource(book, book.source.replace('前付の番号', '変わった前付の番号'));
  assert.equal(edited.error, undefined); assert.equal(edited.book.document.children[1].localStyle.numberFormat, 'roman');
});

test('paragraph fragments reserve opening and closing lines and preserve every character in both directions', () => {
  const source = ':::format orphans="2" widows="2"\n段落の原稿。\n:::';
  const roundtrip = restoreProject(serializeProject(createBook(source)));
  assert.equal(roundtrip.source, source); assert.deepEqual(roundtrip.document.children[0].children[0].localStyle.paragraph, { orphans: 2, widows: 2 });
  for (const writingMode of ['vertical-rl', 'horizontal-tb']) {
    const style = { ...defaultStyle(), writingMode, maxCharsPerLine: 4, maxLinesPerPage: 3 };
    const text = 'あいうえおかきくけこさしすせそた';
    const block = { kind: 'paragraph', id: 'paragraph', indent: 'none', orphans: 2, widows: 2, inlines: [{ kind: 'text', text }] };
    const result = paginate({ schemaVersion: 1, title: '', blocks: [block] }, style);
    assert.deepEqual(result.pages.map(p => p.lines.length), [2, 2]);
    assert.equal(result.pages.flatMap(p => p.lines.flatMap(l => l.runs.map(r => r.text))).join(''), text);
    const prefix = { kind: 'paragraph', id: 'prefix', indent: 'none', inlines: [{ kind: 'text', text: '先の本文です。あ' }] };
    const after = paginate({ schemaVersion: 1, title: '', blocks: [prefix, { ...block, inlines: [{ kind: 'text', text: text.slice(0, 12) }] }] }, style);
    assert.equal(after.pages[0].lines.filter(l => l.blockId === 'paragraph').length, 0);
    assert.equal(after.pages[1].lines.filter(l => l.blockId === 'paragraph').length, 3);
    const impossible = paginate({ schemaVersion: 1, title: '', blocks: [block] }, { ...style, maxLinesPerPage: 1 });
    assert.equal(impossible.pages.flatMap(p => p.lines.flatMap(l => l.runs.map(r => r.text))).join(''), text);
    assert.ok(impossible.diagnostics.some(d => d.code === 'paragraph-fragment-relaxed'));
  }
});

test('SNS image sets preserve physical page numbers in a selected range', () => {
  const pages = Array.from({ length: 9 }, (_, i) => ({ number: i + 7 }));
  const plan = imageExportPlan(pages, 4);
  assert.deepEqual(plan.map(p => p.pageNumber), [7, 8, 9, 10, 11, 12, 13, 14, 15]);
  assert.deepEqual(plan.map(p => p.folder), ['set-01/', 'set-01/', 'set-01/', 'set-01/', 'set-02/', 'set-02/', 'set-02/', 'set-02/', 'set-03/']);
  assert.ok(imageExportPlan(pages, 0).every(p => p.folder === ''));
  assert.throws(() => imageExportPlan(pages, 1.5)); assert.throws(() => imageExportPlan([{ number: 7 }, { number: 7 }], 4));
});

test('captions and figure numbers follow structural image moves and keep their reserved image band', () => {
  const png = 'data:image/png;base64,AA==';
  for (const writingMode of ['vertical-rl', 'horizontal-tb']) for (const imageMode of ['flow', 'page', 'spread', 'bleed', 'external']) {
    const book = createBook('本文。\n:::illustration id="first"\n次の本文。\n:::illustration id="second"'); book.style.writingMode = writingMode;
    book.assets = [{ id: 'art', name: '画像.png', mediaType: 'image/png', original: png, bytes: 1, images: [{ dataUrl: png, width: 1000, height: 1000 }] }];
    for (const page of book.specialPages) Object.assign(page, { assetId: 'art', imageMode, caption: { text: '図の説明を画像と一緒に保つ。', numbered: true, fontPt: 8 } });
    const result = typesetPublication(book), elements = result.pages.flatMap(p => p.elements ?? []), captions = elements.filter(e => e.id.startsWith('caption-'));
    assert.deepEqual(captions.map(e => e.text), ['図 1　図の説明を画像と一緒に保つ。', '図 2　図の説明を画像と一緒に保つ。']);
    assert.equal(result.diagnostics.some(d => d.code === 'text-box-overflow'), false);
    for (const page of result.pages) for (const caption of (page.elements ?? []).filter(e => e.id.startsWith('caption-'))) {
      const image = page.elements.find(e => e.kind === 'image' && (page.kind !== 'flow' || e.blockId === caption.blockId));
      assert.ok(image.yMm + image.heightMm < caption.yMm);
      assert.ok(caption.yMm + caption.heightMm <= book.style.page.heightMm);
    }
    const moved = moveBookItem(book, 'second', -1);
    assert.deepEqual([...figureNumbers(moved)], [['second', 1], ['first', 2]]);
    assert.deepEqual(restoreProject(serializeProject(book)).specialPages.map(p => p.caption), book.specialPages.map(p => p.caption));
  }
});
