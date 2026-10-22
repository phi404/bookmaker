import test from 'node:test';
import assert from 'node:assert/strict';
import { loadAdapter } from './load-adapter.mjs';

const body = result => result.pages.flatMap(p => p.lines).flatMap(l => l.runs).map(r => r.kind === 'ruby' ? r.base : r.text).join('');
test('manual spaces are respected; automatic indent requires an explicit choice', async () => {
  const a = await loadAdapter(), doc = a.parse('本文\n　字下げ\n「会話」');
  const normal = a.paginate(doc, a.defaultStyle());
  assert.deepEqual(normal.pages[0].lines.map(l => l.indentEm), [0, 0, 0]);
  assert.equal(body(normal), '本文　字下げ「会話」');
  assert.deepEqual(a.paginate(doc, { ...a.defaultStyle(), paragraphIndent: true }).pages[0].lines.map(l => l.indentEm), [1, 0, 0]);
});
test('ruby and emphasis survive line/page boundaries; unknown notation stays literal', async () => {
  const a = await loadAdapter(), doc = a.parse('[圏点]｜薔薇《ばら》と花[/圏点]。\n[未知]残す');
  const result = a.paginate(doc, { ...a.defaultStyle(), maxCharsPerLine: 3, maxLinesPerPage: 2 });
  assert.equal(body(result), '薔薇と花。[未知]残す');
  const runs = result.pages.flatMap(p => p.lines).flatMap(l => l.runs);
  assert.equal(runs.find(r => r.kind === 'ruby').reading, 'ばら');
  assert.ok(runs.some(r => r.emphasis === 'sesame'));
  assert.ok(result.pages.map(p => a.renderSvg(p, a.defaultStyle())).join('').includes('data-emphasis'));
});
test('dash spans connect while prolonged sound marks retain their glyph', async () => {
  const a = await loadAdapter(), style = a.defaultStyle(), page = a.paginate(a.parse('―――コーヒー——。'), style).pages[0];
  const svg = a.renderSvg(page, style);
  assert.equal((svg.match(/data-dash=/gu) ?? []).length, 2);
  assert.equal((svg.match(/>ー<\/text>/gu) ?? []).length, 2);
});
test('uniform pages do not mirror margins; folios and heads can be scoped', async () => {
  const a = await loadAdapter(), style = { ...a.defaultStyle(), pageLayout: 'uniform',
    folio: { enabled: true, fromPage: 2, startNumber: 7, position: 'bottom-center', fontPt: 7, insetMm: 8, rules: [{ id: 'hide', from: 3, to: 3, enabled: false }] },
    runningHeads: [{ id: 'h', from: 2, to: 3, side: 'both', position: 'top-left', text: '第二章', fontPt: 7, insetMm: 8 }] };
  const pages = a.paginate(a.parse('前\n[改ページ]\n後\n[改ページ]\n末'), style).pages;
  assert.equal(pages.length, 3);
  const svg = pages.map(p => a.renderSvg(p, style));
  assert.ok(!svg[0].includes('data-testid="folio"')); assert.ok(svg[1].includes('>7</text>')); assert.ok(!svg[2].includes('data-testid="folio"'));
  assert.ok(!svg[0].includes('第二章')); assert.ok(svg[1].includes('第二章')); assert.ok(svg[2].includes('第二章'));
  const x = s => s.match(/data-body[^>]*x="([^"]+)"/u)?.[1]; assert.ok(x(svg[0])); assert.equal(x(svg[0]), x(svg[1]));
});
test('non A6 pages and long ruby keep every character without mutating settings', async () => {
  const a = await loadAdapter(), style = { ...a.defaultStyle(), page: { widthMm: 128, heightMm: 182 }, maxCharsPerLine: 4 };
  const base = '長い親文字を分割しても失わない', reading = 'ながいおやもじをぶんかつしてもうしなわない';
  const result = a.paginate(a.parse(`｜${base}《${reading}》`), style);
  assert.equal(body(result), base);
  assert.equal(result.pages.flatMap(p => p.lines).flatMap(l => l.runs).filter(r => r.kind === 'ruby').map(r => r.reading).join(''), reading);
  assert.match(a.renderSvg(result.pages[0], style), /viewBox="0 0 128 182"/u);
});
test('heading ruby stays clear of neighboring columns even at compact line pitch', async () => {
  const a = await loadAdapter(), style = { ...a.defaultStyle(), lineHeight: 1.55, maxCharsPerLine: 3 };
  const page = a.paginate(a.parse('[見出し] ｜薔薇《ばら》｜組版《くみはん》\n本文。'), style).pages[0];
  const headingLines = page.lines.filter(l => l.heading); assert.ok(headingLines.length > 1);
  // Ruby extends .76em + half of .5em; the next heading's body extends .5em.
  for (const line of headingLines) assert.ok((line.fontScale ?? 1) * 1.51 <= style.lineHeight - .02, 'heading ruby collides with neighboring heading column');
});
test('decoration settings that intrude into the body are rejected with a useful error', async () => {
  const a = await loadAdapter(), style = a.defaultStyle(), doc = a.parse('本文。');
  assert.throws(() => a.paginate(doc, { ...style, margins: { ...style.margins, bottomMm: 5 } }), /ノンブル.*余白/u);
  assert.throws(() => a.paginate(doc, { ...style, runningHeads: [{ id: 'h', from: 1, to: null, side: 'both', position: 'top-center', text: '章', fontPt: 7, insetMm: 20 }] }), /柱.*余白/u);
});
test('overlapping head ranges resolve by position; active folios cannot occupy that same position', async () => {
  const a = await loadAdapter(), style = a.defaultStyle(), doc = a.parse('本文。');
  const h = { id: 'old', from: 1, to: null, side: 'both', position: 'top-left', text: '旧章', fontPt: 7, insetMm: 6 };
  const next = { ...h, id: 'new', text: '新章', insetMm: 8 }, s = { ...style, runningHeads: [h, next] };
  const svg = a.renderSvg(a.paginate(doc, s).pages[0], s); assert.ok(svg.includes('新章')); assert.ok(!svg.includes('旧章'));
  assert.throws(() => a.paginate(doc, { ...s, folio: { ...style.folio, position: 'top-left' } }), /柱.*ノンブル.*位置/u);
});
test('uniform pages do not insert parity blanks for book-side starts', async () => {
  const a = await loadAdapter(), doc = a.parse('前\n[左ページ]\n後'), style = a.defaultStyle();
  assert.equal(a.paginate(doc, style).pages.length, 3);
  const uniform = a.paginate(doc, { ...style, pageLayout: 'uniform' });
  assert.equal(uniform.pages.length, 2); assert.equal(body(uniform), '前後');
  assert.ok(uniform.diagnostics.some(d => d.code === 'uniform-page-start'));
});
