import test from 'node:test';
import assert from 'node:assert/strict';
import { paginate } from '../../dist/typesetting/paginator.js';
import { defaultStyle } from '../../dist/domain/style.js';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { absolute } from '../../scripts/lib.mjs';
import { Rules } from '../../public/vendor/linebreak/index.js';
import { createBook } from '../../dist/domain/book.js';
import { restoreProject, serializeProject } from '../../dist/domain/project.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';

function layout(text, writingMode, chars = 5) { return paginate({ schemaVersion: 1, title: '', blocks: [{ kind: 'paragraph', id: 'text', indent: 'none', inlines: [{ kind: 'text', text }] }] }, { ...defaultStyle(), writingMode, paragraphIndent: false, maxCharsPerLine: chars }); }
const lines = result => result.pages.flatMap(p => p.lines.map(l => l.runs.map(r => r.kind === 'text' ? r.text : r.base).join('')));
for (const direction of ['vertical-rl', 'horizontal-tb']) {
  test('whole Latin words and nonbreaking spaces survive narrow ' + direction + ' lines', () => {
    for (const [text, protectedParts, capacity] of [['あいう hello world おわり', ['hello', 'world'], 5], ['あいAB\u00a0CDおわり', ['AB\u00a0CD'], 4]]) {
      const output = lines(layout(text, direction, capacity)); assert.equal(output.join(''), text);
      for (const part of protectedParts) assert.ok(output.some(l => l.includes(part)), JSON.stringify({ part, output }));
    }
  });
  test('zero-width joiners and mandatory Unicode separators retain their characters in ' + direction, () => {
    const joined = 'あい\u2060うえ', output = lines(layout(joined, direction, 3)); assert.equal(output.join(''), joined); assert.equal(output[0], 'あい\u2060う');
    assert.deepEqual(lines(layout('甲\u2028乙\u2029丙', direction, 20)), ['甲\u2028', '乙\u2029', '丙']);
    const overlong = 'abcdefghijklmnopqrstuvwxyz', constrained = layout(overlong, direction, 3); assert.equal(lines(constrained).join(''), overlong); assert.ok(constrained.diagnostics.length > 0);
  });
}

test('vendored Unicode17 rules pass every official LineBreakTest case', async () => {
  const bytes = await readFile(absolute('fixtures/unicode/LineBreakTest-17.0.0.txt')); assert.equal(createHash('sha256').update(bytes).digest('hex'), 'e69884e0dde6a8724873f885d68c52dc14518abf9ae4ca9e2283b8773db3b752');
  const rules = new Rules(); let count = 0;
  for (const [index, line] of bytes.toString('utf8').split('\n').entries()) {
    const data = line.split('#')[0].trim(); if (!data) continue; const tokens = data.split(/\s+/u), expected = []; let text = '';
    for (let at = 0; at < tokens.length; at += 2) { if (tokens[at] === '÷') expected.push(text.length); if (at + 1 < tokens.length) text += String.fromCodePoint(parseInt(tokens[at + 1], 16)); }
    assert.deepEqual([...rules.breaks(text)].map(b => b.position), expected, 'Unicode17 LineBreakTest line ' + (index + 1)); count++;
  }
  assert.equal(count, 19338);
});

test('local linebreak adapters preserve the pinned vendor files and introduce no runtime network imports', async () => {
  const manifest = JSON.parse(await readFile(absolute('public/vendor/linebreak/manifest.json'), 'utf8'));
  for (const item of manifest.files) { const bytes = await readFile(absolute('public/vendor/linebreak/' + item.file)); assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256, item.file); assert.doesNotMatch(bytes.toString(), /(?:from|import)\s*['"](?:https?:|@cto\.af|fflate['"])/u); }
  assert.ok((await readFile(absolute('public/vendor/linebreak/LICENSE.txt'), 'utf8')).includes('Permission is hereby granted'));
  assert.ok((await readFile(absolute('public/vendor/linebreak/unicode-trie/LICENSE.txt'), 'utf8')).includes('Permission is hereby granted'));
});

test('joining and separator characters retain source and model identity through save and styles', () => {
  const source = '原稿：AB\u00a0CD、い\u2060う。\u2028次の行。\u200b終わり。'; const book = createBook(source), restored = restoreProject(serializeProject(book)); assert.equal(restored.source, source);
  assert.equal(lines(typesetPublication(restored)).join(''), source);
  const atoms = [{ kind: 'text', text: 'あいAB' }, { kind: 'text', text: 'CD', fontWeight: 700 }, { kind: 'text', text: '末尾' }];
  for (const writingMode of ['vertical-rl', 'horizontal-tb']) {
    const result = paginate({ schemaVersion: 1, title: '', blocks: [{ kind: 'paragraph', id: 'text', indent: 'none', inlines: atoms }] }, { ...defaultStyle(), writingMode, paragraphIndent: false, maxCharsPerLine: 4 });
    assert.ok(lines(result).some(line => line.includes('ABCD'))); assert.equal(lines(result).join(''), 'あいABCD末尾');
  }
});
