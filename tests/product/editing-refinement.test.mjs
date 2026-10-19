import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
import { createBook, editBookSource, checkBook } from '../../dist/domain/book.js';
import { flattenDocument, sourceOf } from '../../dist/domain/publication.js';
import { applyLocalStyle } from '../../dist/domain/styles.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';

test('GUI paragraph formatting is visible in source, editable there and removed without resurrecting hidden values', () => {
  let book = createBook('冒頭\n中央の一行\n末尾');
  const id = flattenDocument(book.document)[1].id;
  book.document = applyLocalStyle(book.document, id, { paragraph: { alignment: 'center', beforeEm: 1 } });
  book = checkBook(book);
  assert.match(book.source, /:::format alignment="center" beforeEm="1"/u);
  const edited = editBookSource(book, book.source.replace('center', 'end')).book;
  assert.equal(flattenDocument(edited.document)[1].id, id);
  assert.equal(flattenDocument(edited.document)[1].localStyle.paragraph.alignment, 'end');
  const reset = editBookSource(edited, '冒頭\n中央の一行\n末尾').book;
  assert.equal(flattenDocument(reset.document)[1].id, id);
  assert.equal(flattenDocument(reset.document)[1].localStyle, undefined);
  assert.equal(typesetPublication(reset).pages[0].lines[1].alignment, 'start');
});

test('range formatting wraps consecutive blocks once and retains ruby, whitespace and IDs through a content edit', async () => {
  const book = createBook(await readText('fixtures/book/range-format.md'));
  const blocks = flattenDocument(book.document), range = blocks.filter(b => b.localStyle?.paragraph?.alignment === 'center');
  assert.equal(range.length, 2);
  assert.equal(range[0].inlines[0].kind, 'ruby');
  assert.equal(range[0].localStyle.character.emphasis, 'dot');
  const source = sourceOf(book.document, 'markdown');
  assert.equal((source.match(/:::format/gu) ?? []).length, 1);
  const edited = editBookSource(book, source.replace('二行目。', '二行目を編集。'));
  assert.equal(edited.error, undefined);
  assert.equal(flattenDocument(edited.book.document).find(b => b.id === range[1].id).localStyle.paragraph.alignment, 'center');
  assert.equal(checkBook(edited.book).source, edited.book.source);
});

test('recto begins on physical odd pages and preserves intentional blanks in both pagination engines', () => {
  for (const mode of ['vertical-rl', 'horizontal-tb']) {
    const b = createBook('一\n:::recto\n二'); b.style.writingMode = mode;
    const pages = typesetPublication(b).pages;
    assert.equal(pages.length, 3);
    assert.equal(pages[1].lines.length, 0);
    assert.equal(pages[2].lines[0].runs[0].text, '二');
    b.style.pageLayout = 'uniform'; assert.equal(typesetPublication(b).pages.length, 2);
  }
});

test('invalid unfinished formatting protects the previous canonical book and source draft', () => {
  const book = createBook('本文');
  for (const source of [':::format alignment="center"\n本文', ':::format fontPt="abc"\n本文\n:::']) {
    const result = editBookSource(book, source);
    assert.ok(result.error);
    assert.equal(result.book.source, '本文');
    assert.equal(result.book.sourceDraft, source);
  }
});

test('a source style reference cannot poison the saved canonical book', () => {
  const book = createBook('本文');
  for (const source of [':::format style="missing"\n本文\n:::', '[本文]{style="missing"}', ':::section pageStyleId="missing"\n# 章\n本文']) {
    const result = editBookSource(book, source);
    assert.ok(result.error);
    assert.equal(result.book.source, '本文');
    assert.equal(result.book.sourceDraft, source);
  }
});

test('section start and partial styles are visible in source and stale cache is regenerated from the model', () => {
  let book = createBook('# 一\n本文\n# 二\n二の本文');
  const section = book.document.children[1];
  section.localStyle = { start: 'recto', paragraph: { alignment: 'center', beforeEm: 1 }, character: { numbers: 'kanji' }, page: { margins: { topMm: 22 } } };
  book = checkBook(book);
  assert.match(book.source, /:::section start="recto" alignment="center"/u);
  const edited = editBookSource(book, '前付\n' + book.source.replace('二の本文', '二の本文を編集'));
  assert.equal(edited.error, undefined);
  assert.equal(edited.book.document.children.at(-1).id, section.id);
  assert.deepEqual(edited.book.document.children.at(-1).localStyle, section.localStyle);
  const pages = typesetPublication(edited.book).pages;
  assert.ok(pages.find(p => p.lines.some(l => l.blockId === section.headingId)).number % 2 === 1);
});
