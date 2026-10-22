import test from 'node:test';
import assert from 'node:assert/strict';
import { createBook } from '../../dist/domain/book.js';
import { restoreProject, serializeProject } from '../../dist/domain/project.js';
import { parseDocument } from '../../dist/domain/document.js';

test('only the current book format is accepted and rejected input is untouched', () => {
  const book = createBook('元の本文。');
  assert.equal(restoreProject(serializeProject(book)).source, book.source);
  const previous = { ...book, schemaVersion: 2 };
  for (const key of ['specialPages', 'assets', 'pageOverrides']) delete previous[key];
  for (const value of [previous, { schemaVersion: 1, source: '旧原稿', document: parseDocument('旧原稿'), style: book.style }, { ...book, syntax: 'legacy' }]) {
    const raw = JSON.stringify(value);
    assert.throws(() => restoreProject(raw), /未対応|対応していない/u);
    assert.equal(JSON.stringify(value), raw);
  }
});

test('obsolete Japanese tags are literal in the canonical manuscript', () => {
  const source = '[見出し] 章\n[圏点]文字[/圏点]';
  const book = createBook(source), blocks = book.document.children.flatMap(section => section.children);
  assert.ok(blocks.every(block => block.kind === 'paragraph'));
  assert.equal(blocks[1].inlines.map(run => run.text).join(''), '[圏点]文字[/圏点]');
  assert.ok(blocks[1].inlines.every(run => !run.emphasis));
});
