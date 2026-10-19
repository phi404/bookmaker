import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, readJson, readText } from '../../scripts/lib.mjs';
import { loadAdapter } from './load-adapter.mjs';

const config = await readJson('harness/config.json');
const fixtures = (await readJson('fixtures/manifest.json')).fixtures.filter(item => config.phase === 'mvp' || item.phase === 'slice-1');
const body = doc => doc.blocks.flatMap(block => block.inlines ?? []).map(run => run.kind === 'ruby' ? run.base : run.text).join('');
const readings = doc => doc.blocks.flatMap(block => block.inlines ?? []).filter(run => run.kind === 'ruby').map(run => run.reading).join('');
const lines = result => result.pages.flatMap(page => page.lines);
const renderedBody = result => lines(result).flatMap(line => line.runs).map(run => run.kind === 'ruby' ? run.base : run.text).join('');
const renderedReadings = result => lines(result).flatMap(line => line.runs).filter(run => run.kind === 'ruby').map(run => run.reading).join('');
const noStart = new Set([...'、。，．？！）］｝〉》」』】']);
const noEnd = new Set([...'（［｛〈《「『【']);

for (const fixture of fixtures) test(`document/layout: ${fixture.id}`, async () => {
  const adapter = await loadAdapter(), source = await readText(fixture.file);
  assert.equal(hash(source), fixture.sourceSha256);
  const document = adapter.parse(source), before = JSON.stringify(document);
  assert.equal(document.schemaVersion, 1);
  assert.equal(hash(body(document)), fixture.bodySha256, '文書モデルの本文欠落・重複・置換');
  assert.equal(hash(readings(document)), fixture.readingsSha256, '読みの欠落');
  const style = { ...adapter.defaultStyle(), ...fixture.grid };
  const styleBefore = JSON.stringify(style);
  const result = adapter.paginate(document, style);
  assert.ok(result.pages.length > 0);
  assert.equal(hash(renderedBody(result)), fixture.bodySha256, '組版結果の本文欠落・重複・置換');
  assert.equal(hash(renderedReadings(result)), fixture.readingsSha256, '組版結果の読み欠落');
  assert.equal(JSON.stringify(document), before, '組版で文書を変更してはいけない');
  assert.equal(JSON.stringify(style), styleBefore, '組版で設定を変更してはいけない');
  assert.deepEqual(adapter.paginate(document, style), result, '同じ条件でページングが変わる');
  result.pages.forEach((page, index) => {
    assert.equal(page.kind, 'flow'); assert.equal(page.number, index + 1);
    const naturalLines = Math.floor((style.page.widthMm - style.margins.innerMm - style.margins.outerMm) / (style.fontPt * 25.4 / 72 * style.lineHeight));
    assert.ok(page.lines.length <= Math.min(style.maxLinesPerPage ?? naturalLines, naturalLines), '版面より多い列を詰め込んでいる');
    for (const line of page.lines) assert.ok(Number.isFinite(line.indentEm) && line.indentEm >= 0);
  });
  if (fixture.minPages) assert.ok(result.pages.length >= fixture.minPages);
  if (fixture.exactPages) assert.equal(result.pages.length, fixture.exactPages);
  if (fixture.blockKinds) {
    const blocks = [...document.blocks];
    if (blocks.at(-1)?.kind === 'paragraph' && !blocks.at(-1).inlines.length) blocks.pop();
    assert.deepEqual(blocks.map(block => block.kind), fixture.blockKinds);
  }
  if (fixture.checks.includes('kinsoku')) for (const line of lines(result)) {
    const text = line.runs.map(run => run.kind === 'ruby' ? run.base : run.text).join('');
    assert.ok(!noStart.has([...text][0]), `行頭禁則: ${text}`);
    assert.ok(!noEnd.has([...text].at(-1)), `行末禁則: ${text}`);
    const next = lines(result)[lines(result).indexOf(line) + 1];
    const nextText = next?.runs.map(run => run.kind === 'ruby' ? run.base : run.text).join('') ?? '';
    for (const mark of ['…', '―']) assert.ok(!(text.endsWith(mark) && nextText.startsWith(mark)), '連続記号の分断');
  }
  if (fixture.checks.includes('indent')) {
    const firstByBlock = new Map();
    for (const line of lines(result)) if (!firstByBlock.has(line.blockId)) firstByBlock.set(line.blockId, line);
    for (const block of document.blocks.filter(block => block.kind === 'paragraph' && block.inlines.length)) {
      const start = block.inlines.map(run => run.kind === 'ruby' ? run.base : run.text).join('');
      assert.equal(firstByBlock.get(block.id).indentEm, style.paragraphIndent && !/^[　「『（]/u.test(start) ? 1 : 0);
    }
  }
  if (fixture.checks.includes('blank-pages')) {
    assert.equal(result.pages[1].lines.length, 0); assert.equal(result.pages[3].lines.length, 0);
  }
  if (fixture.checks.includes('keep-with-next')) {
    const index = document.blocks.findIndex(block => block.kind === 'heading');
    const headingPage = result.pages.find(page => page.lines.some(line => line.blockId === document.blocks[index].id));
    assert.ok(headingPage.lines.some(line => line.blockId === document.blocks[index + 1].id));
  }
  if (fixture.checks.includes('ruby')) {
    assert.ok(lines(result).some(line => line.runs.some(run => run.kind === 'ruby' && run.base === '余白' && run.reading === 'よはく')));
  }
  if (fixture.checks.includes('escaping')) {
    const svg = result.pages.map(page => adapter.renderSvg(page, style)).join('');
    assert.ok(!/<script(?:\s|>)/iu.test(svg)); assert.ok(!/<img\s/iu.test(svg)); assert.ok(svg.includes('&lt;'));
  }
});

test('A6 style and setting changes preserve source, document and all body text', async () => {
  const adapter = await loadAdapter(), fixture = fixtures.find(item => item.id === 'basic');
  const document = adapter.parse(await readText(fixture.file)), before = JSON.stringify(document), style = adapter.defaultStyle();
  assert.deepEqual(style.page, { widthMm: 105, heightMm: 148 });
  assert.equal(style.writingMode, 'vertical-rl'); assert.equal(style.binding, 'right'); assert.equal(style.columns, 1);
  const results = [];
  for (const variant of [style, { ...style, fontPt: style.fontPt + 1 }, { ...style, lineHeight: style.lineHeight + 0.2 }, { ...style, margins: { ...style.margins, outerMm: style.margins.outerMm + 3 } }]) {
    const result = adapter.paginate(document, variant); results.push(JSON.stringify(result));
    assert.equal(hash(renderedBody(result)), fixture.bodySha256);
    assert.equal(JSON.stringify(document), before);
  }
  assert.ok(new Set(results).size > 1, '設定変更が組版結果に反映されない');
});

test('only documented BOM/newline normalization changes the parsed text', async () => {
  const adapter = await loadAdapter(), fixture = fixtures.find(item => item.id === 'basic'), source = await readText(fixture.file);
  for (const variant of ['\uFEFF' + source, source.replaceAll('\n', '\r\n'), source.replaceAll('\n', '\r')]) assert.equal(hash(body(adapter.parse(variant))), fixture.bodySha256);
});

if (config.phase === 'mvp') test('project round trip, malformed JSON and invalid numbers', async () => {
  const adapter = await loadAdapter(), source = await readText('fixtures/ruby.txt');
  const project = { schemaVersion: 1, source, document: adapter.parse(source), style: adapter.defaultStyle() };
  assert.deepEqual(adapter.restore(adapter.serialize(project)), project);
  assert.throws(() => adapter.restore('{invalid'));
  assert.throws(() => adapter.restore(JSON.stringify({ ...project, style: { ...project.style, fontPt: -1 } })));
  assert.throws(() => adapter.restore(JSON.stringify({ ...project, schemaVersion: 999 })));
});
