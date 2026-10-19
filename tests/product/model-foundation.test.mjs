import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readText } from '../../scripts/lib.mjs';
const modules = async () => ({ ...(await import('../../dist/domain/publication.js')), ...(await import('../../dist/domain/styles.js')), ...(await import('../../dist/domain/scope.js')), ...(await import('../../dist/typesetting/publication.js')) });
const text = b => (b.inlines ?? []).map(i => i.kind === 'ruby' ? i.base : i.text).join('');

test('canonical sections, Markdown marks and literal unsupported syntax retain content', async () => {
  const a = await modules(), p = a.createPublication(await readText('fixtures/model/sections.md'), 'markdown');
  assert.equal(p.document.schemaVersion, 2); assert.equal(p.document.children.length, 2);
  const blocks = a.flattenDocument(p.document); assert.equal(blocks.filter(b => b.kind === 'heading').length, 3);
  assert.equal(blocks.filter(b => b.kind === 'pageBreak').length, 1);
  assert.ok(blocks.some(b => b.role === 'quote')); assert.ok(blocks.some(b => b.localStyle?.paragraph?.alignment === 'center'));
  assert.ok(blocks.some(b => b.inlines?.some(i => i.strong))); assert.ok(blocks.some(b => text(b).includes('未知の[指定]と<sample>')));
  assert.ok(a.flattenDocument(a.createPublication('# 本文\n**文字**', 'legacy').document).every(b => b.kind === 'paragraph'));
});

test('source insertion and heading rename preserve IDs, styles and chapter scope', async () => {
  const a = await modules(); let p = a.createPublication('# 第一章\n段落A\n段落B\n===\n# 第二章\n段落C', 'markdown');
  const second = p.document.children[1], block = second.children.find(b => b.kind === 'paragraph');
  p.document = a.applyLocalStyle(p.document, block.id, { paragraph: { indentEm: 2 } });
  p.runningElements = [{ id: 'chapter-head', scope: { kind: 'section', sectionId: second.id }, content: { kind: 'chapter' }, position: 'bottom-center', side: 'both', fontPt: 7, insetMm: 8, hideOnSectionFirst: false }];
  p = a.updateSource(p, '前へ挿入。\n' + a.sourceOf(p.document, 'markdown').replace('第二章', '改名した章'));
  assert.equal(p.document.children.at(-1).id, second.id);
  assert.equal(a.flattenDocument(p.document).find(b => text(b) === '段落C').id, block.id);
  assert.equal(a.flattenDocument(p.document).find(b => b.id === block.id).localStyle.paragraph.indentEm, 2);
  const result = a.typesetPublication(p); assert.ok(result.pages.some(page => page.runningElements?.some(e => e.text === '改名した章')));
});

test('unique paragraph moves retain its local style without borrowing a removed identity', async () => {
  const a = await modules(); let p = a.createPublication('甲の段落\n乙の段落\n丙の段落', 'markdown');
  const b = a.flattenDocument(p.document)[1]; p.document = a.applyLocalStyle(p.document, b.id, { character: { fontWeight: 700 } });
  p.source = a.sourceOf(p.document, 'markdown'); const old = p.document.children[0].children; p.document.children[0].children = [old[1], old[0], old[2]]; p = a.updateSource(p, a.sourceOf(p.document, 'markdown'));
  assert.equal(a.flattenDocument(p.document)[0].id, b.id);
  assert.equal(a.flattenDocument(p.document)[0].localStyle.character.fontWeight, 700);
});

test('named style inheritance, explicit local precedence and reset leave text intact', async () => {
  const a = await modules(); let p = a.createPublication('本文の文字'); const id = a.flattenDocument(p.document)[0].id;
  p.styles.paragraphs.find(s => s.id === 'body').properties.indentEm = 1;
  p.document = a.applyLocalStyle(p.document, id, { paragraph: { indentEm: 2, alignment: 'end' }, character: { fontWeight: 700 } });
  assert.equal(a.localStyleCount(a.flattenDocument(p.document)[0]), 3);
  const result = a.typesetPublication(p); assert.equal(result.pages[0].lines[0].indentEm, 2);
  assert.equal(result.pages[0].lines[0].alignment, 'end'); assert.equal(result.pages[0].lines[0].runs[0].fontWeight, 700);
  p.document = a.resetLocalStyle(p.document, id); assert.equal(a.localStyleCount(a.flattenDocument(p.document)[0]), 0);
  assert.equal(a.typesetPublication(p).pages[0].lines[0].indentEm, 1); assert.equal(text(a.flattenDocument(p.document)[0]), '本文の文字');
  const cycle = a.defaultCatalog(); cycle.paragraphs.find(s => s.id === 'body').basedOn = 'quote';
  assert.throws(() => a.validateCatalog(cycle), /循環/u);
  assert.throws(() => a.validateCatalog({ ...a.defaultCatalog(), unknown: true }), /未対応/u);
});

test('semantic scopes distinguish sections and ranges; more specific overrides win', async () => {
  const a = await modules(), p = a.createPublication('# 章\n一\n二', 'markdown');
  const section = p.document.children[0], b = section.children[1];
  p.overrides = [
    { id: 'book', scope: { kind: 'book' }, paragraph: { indentEm: 1 } },
    { id: 'local-target', scope: { kind: 'block', blockId: b.id }, paragraph: { indentEm: 3 } },
    { id: 'chapter', scope: { kind: 'section', sectionId: section.id }, paragraph: { indentEm: 2 } },
  ];
  const result = a.typesetPublication(p), line = result.pages.flatMap(page => page.lines).find(l => l.blockId === b.id);
  assert.equal(line.indentEm, 3);
  const context = { sectionId: section.id, blockId: b.id, blockOrder: section.children.map(x => x.id), pageNumber: 7 };
  assert.ok(a.matchesScope({ kind: 'section', sectionId: section.id }, context));
  assert.ok(a.matchesScope({ kind: 'pages', from: 6, to: 8 }, context));
  assert.ok(!a.matchesScope({ kind: 'pages', from: 1, to: 2 }, context));
});

test('missing section references are diagnosed and never rebound to the next chapter', async () => {
  const a = await modules(); let p = a.createPublication('# 前章\n前の本文\n===\n# 後章\n後の本文', 'markdown');
  const removed = p.document.children[0].id;
  p.runningElements = [{ id: 'orphan', scope: { kind: 'section', sectionId: removed }, content: { kind: 'text', text: '消えた章の柱' }, position: 'top-center', side: 'both', fontPt: 7, insetMm: 8, hideOnSectionFirst: false }];
  p = a.updateSource(p, '# 後章\n後の本文'); const result = a.typesetPublication(p);
  assert.ok(result.diagnostics.some(d => d.code === 'scope-orphan'));
  assert.ok(result.pages.every(page => !(page.runningElements ?? []).some(e => e.text === '消えた章の柱')));
  assert.equal(p.runningElements[0].scope.sectionId, removed);
});

test('canonical project restores AST rather than a stale source cache; legacy projects remain readable', async () => {
  const a = await modules(), { restoreProject, serializeProject } = await import('../../dist/domain/project.js');
  const p = a.createPublication('正本の文字。', 'markdown'), id = a.flattenDocument(p.document)[0].id;
  p.document = a.applyLocalStyle(p.document, id, { character: { fontWeight: 700 } });
  const restored = restoreProject(serializeProject({ ...p, source: '古いキャッシュ。' }));
  assert.match(restored.source, /:::format fontWeight="700"\n正本の文字。/u); assert.equal(restored.document.children[0].children[0].localStyle.character.fontWeight, 700);
  const legacy = { schemaVersion: 1, source: '旧原稿。', document: (await import('../../dist/domain/document.js')).parseDocument('旧原稿。'), style: p.style };
  assert.equal(restoreProject(JSON.stringify(legacy)).source, '旧原稿。');
  assert.throws(() => restoreProject(JSON.stringify({ ...p, document: { ...p.document, unknown: 'lost' } })), /未対応/u);
});

test('section-first visibility and bottom running text follow the chapter after reflow', async () => {
  const a = await modules(), p = a.createPublication('# 章\n' + '本文'.repeat(500), 'markdown');
  p.runningElements = [{ id: 'running', scope: { kind: 'section', sectionId: p.document.children[0].id }, content: { kind: 'chapter' }, position: 'bottom-center', side: 'both', fontPt: 7, insetMm: 8, hideOnSectionFirst: true }];
  const result = a.typesetPublication(p); assert.ok(result.pages.length > 1);
  assert.equal(result.pages[0].runningElements.length, 0); assert.ok(result.pages[1].runningElements.some(e => e.text === '章'));
});

test('nested strong, emphasis and ruby preserve both annotation layers on source round trip', async () => {
  const a = await modules(), { restoreProject, serializeProject } = await import('../../dist/domain/project.js');
  const p = a.createPublication((await readText('fixtures/model/nested.md')).replace(/\n$/u, ''), 'markdown');
  const blocks = a.flattenDocument(p.document), first = blocks[0].inlines[0];
  assert.equal(first.kind, 'ruby'); assert.equal(first.strong, true); assert.equal(first.emphasis, 'sesame');
  assert.equal(blocks[1].inlines[0].kind, 'ruby'); assert.equal(blocks[1].inlines[0].base, '星**空**');
  const restored = restoreProject(serializeProject({ ...p, source: '' }));
  assert.deepEqual(a.flattenDocument(restored.document).map(b => b.inlines), blocks.map(b => b.inlines));
});

test('ambiguous identical chapter deletion does not guess which scoped chapter survived', async () => {
  const a = await modules(); let p = a.createPublication((await readText('fixtures/model/duplicate-chapters.md')).trimEnd(), 'markdown');
  p.runningElements = [{ id: 'ambiguous', scope: { kind: 'section', sectionId: p.document.children[0].id }, content: { kind: 'text', text: '特定の章だけ' }, position: 'top-center', side: 'both', fontPt: 7, insetMm: 8, hideOnSectionFirst: false }];
  p = a.updateSource(p, '# 同じ章名\n同じ本文'); const result = a.typesetPublication(p);
  assert.ok(result.diagnostics.some(d => d.code === 'scope-orphan'));
  assert.ok(result.pages.every(page => page.runningElements.length === 0));
});

test('semantic range endpoints follow insertion, and explicit character rules override source strong', async () => {
  const a = await modules(); let p = a.createPublication((await readText('fixtures/model/style-range.md')).replace(/\n$/u, ''), 'markdown'); const [from, to] = a.flattenDocument(p.document).slice(1, 3);
  p.overrides = [{ id: 'range', scope: { kind: 'blockRange', fromId: from.id, toId: to.id }, paragraph: { alignment: 'end' }, character: { fontWeight: 400 } }];
  p = a.updateSource(p, '# 章\n**甲**\n間への挿入\n乙\n丙');
  const lines = a.typesetPublication(p).pages.flatMap(page => page.lines);
  assert.ok(lines.filter(l => [from.id, to.id].includes(l.blockId)).every(l => l.alignment === 'end'));
  assert.equal(lines.find(l => l.blockId === from.id).runs[0].fontWeight, 400);
  assert.equal(lines.find(l => text({ inlines: l.runs }) === '間への挿入').alignment, 'end');
  const { restoreProject } = await import('../../dist/domain/project.js');
  assert.throws(() => restoreProject(JSON.stringify({ ...p, overrides: [{ id: 'physical', scope: { kind: 'pages', from: 1, to: null }, paragraph: { indentEm: 1 } }] })), /章・段落/u);
});

test('unsupported book attributes and nonprojectable section structure are rejected without loss', async () => {
  const a = await modules(), { restoreProject } = await import('../../dist/domain/project.js'); const p = a.createPublication('本文');
  const fixture = await readJson('fixtures/model/unsupported.json');
  assert.throws(() => restoreProject(JSON.stringify({ ...p, style: { ...p.style, ...fixture.bookOverride } })), /未対応/u);
  const invalid = globalThis.structuredClone(p); invalid.document.children.push(fixture.extraSection); invalid.document.nextId = 101;
  assert.throws(() => restoreProject(JSON.stringify(invalid)), /セクション/u);
});
