import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { absolute, fingerprint, hash, readText } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';

const KEY = 'bookmaker-slice-draft-v1';
const draft = page => page.evaluate(key => JSON.parse(globalThis.localStorage.getItem(key)), KEY);
for (const width of [1440, 375]) test(`@flow canonical paragraph styles survive source edits, reload and JSON ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 812 }); await page.goto('/'); const ui = new BookUI(page);
  await expect(page.locator('#block-inspector')).toBeHidden();
  const source = await readText('fixtures/model/sections.md'); await ui.importTxt(absolute('fixtures/model/sections.md'));
  await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(source);
  await ui.manuscript().evaluate(editor => { const at = editor.value.indexOf('本文を残す。'); editor.focus(); editor.setSelectionRange(at, at); });
  await page.locator('#select-block-style').click(); await expect(page.locator('#block-inspector')).toBeVisible();
  await page.getByTestId('block-style').selectOption('centered'); await page.locator('#block-local-details > summary').click();
  await page.getByTestId('block-indent').fill('2'); await page.getByTestId('block-indent').blur(); await page.getByTestId('block-weight').getByRole('button', { name: '太字', exact: true }).click();
  await expect(page.locator('#block-local-count')).toHaveText('中央揃えから継承 · 個別指定 2件');
  await ui.tab('プレビュー'); await ui.ready(); await page.getByTestId('page-select').fill('2');
  await expect(ui.preview().locator('[data-body][font-weight="700"]').first()).toBeVisible();
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  const before = await draft(page), b = before.project.document.children[1].children.find(b => b.inlines?.some(i => i.text === '本文を残す。'));
  expect(b.localStyle.paragraph.indentEm).toBe(2); expect(b.styleId).toBe('centered'); expect(before.schemaVersion).toBe(3);
  await ui.paste('先頭への追加。\n' + before.project.source.replace('第二章', '改名した章'));
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); await page.reload(); await ui.ready();
  const restored = await draft(page), blocks = restored.project.document.children.flatMap(s => s.children);
  const same = blocks.find(x => x.id === b.id); expect(same.styleId).toBe('centered'); expect(same.localStyle.character.fontWeight).toBe(700);
  await mkdir(absolute('output/project'), { recursive: true }); const file = absolute(`output/project/foundation-${width}.json`); await ui.download('export-project', file);
  const exported = JSON.parse(await readFile(file, 'utf8')); expect(exported.schemaVersion).toBe(3); expect(exported.specialPages).toEqual([]); expect(exported.document.children.flatMap(s => s.children).find(x => x.id === b.id)).toEqual(same);
  await ui.paste('別の原稿'); await ui.importTxt(file); await ui.tab('プレビュー'); await page.getByTestId('page-select').fill('2');
  // Select the paragraph on the finished page; the inspector follows its stable document identity.
  await ui.preview().locator(`[data-block-id="${b.id}"] [data-body]`).first().click();
  await page.locator('#edit-selection').click(); await page.getByTestId('reset-block-style').click(); await expect(page.locator('#block-local-count')).toHaveText('中央揃えから継承 · 個別指定 0件');
  await ui.tab('プレビュー'); await ui.ready(); await expect(ui.preview().locator(`[data-block-id="${b.id}"] [font-weight="700"]`)).toHaveCount(0);
  await ui.tab('原稿'); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state','saved'); const reset = (await draft(page)).project; await expect(ui.manuscript()).toHaveValue(reset.source); expect(reset.source).toContain('style="centered"'); expect(reset.source).not.toContain('fontWeight="700"');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
});

test('@flow legacy draft migrates with an exact backup before the first canonical save', async ({ page }) => {
  const { defaultStyle } = await import('../../dist/domain/style.js');
  const raw = JSON.stringify({ schemaVersion: 2, source: '　旧原稿の文字。', style: defaultStyle(), filename: '旧作業', marginOffset: 0, viewMode: 'single', selected: 1 });
  await page.addInitScript(({ key, raw }) => { if (globalThis.localStorage.getItem(key) === null) globalThis.localStorage.setItem(key, raw); }, { key: KEY, raw });
  await page.goto('/'); const ui = new BookUI(page); await ui.ready(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  const saved = await draft(page); expect(saved.schemaVersion).toBe(3); expect(saved.project.source).toBe('　旧原稿の文字。'); expect(saved.project.metadata.filename).toBe('旧作業');
  expect(await page.evaluate(() => globalThis.localStorage.getItem('bookmaker-draft-backup-before-v3'))).toBe(raw);
  await ui.paste('編集した原稿。'); await page.reload(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue('編集した原稿。');
  expect(await page.evaluate(() => globalThis.localStorage.getItem('bookmaker-draft-backup-before-v3'))).toBe(raw);
});

test('@flow scoped running elements render and export from the canonical document', async ({ page }) => {
  const { createPublication } = await import('../../dist/domain/publication.js');
  const { serializeProject } = await import('../../dist/domain/project.js');
  const p = createPublication(await readText('fixtures/model/running.md'), 'markdown');
  p.runningElements = [{ id: 'chapter', scope: { kind: 'section', sectionId: p.document.children[1].id }, content: { kind: 'chapter' }, position: 'bottom-center', side: 'both', fontPt: 7, insetMm: 8, hideOnSectionFirst: false }];
  await mkdir(absolute('output/foundation'), { recursive: true }); await writeFile(absolute('output/foundation/scoped.book.json'), serializeProject(p));
  await page.goto('/'); const ui = new BookUI(page); await ui.importTxt(absolute('output/foundation/scoped.book.json')); await page.getByTestId('page-select').fill('2');
  await expect(ui.preview().locator('[data-running-element]')).toHaveText('後章');
  await expect(ui.preview().locator('[data-ruby]')).not.toHaveCount(0); await expect(ui.preview().locator('[data-emphasis]')).not.toHaveCount(0);
  await ui.paste('挿入する本文\n' + p.source.replace('後章', '新しい章名')); await page.getByTestId('page-select').fill('2');
  await expect(ui.preview().locator('[data-running-element]')).toHaveText('新しい章名');
  await ui.download('export-png', absolute('output/foundation/page-002.png')); await ui.download('export-pdf', absolute('output/foundation/book.pdf'));
  await ui.download('export-png-all', absolute('output/foundation/pages.zip')); await ui.download('export-spread', absolute('output/foundation/spread.png'));
  await writeFile(absolute('output/foundation/manifest.json'), JSON.stringify({ schemaVersion: 1, phase: 'mvp', sourceFingerprint: await fingerprint(), inputSha256: hash('挿入する本文\n' + p.source.replace('後章', '新しい章名')), expectedPages: 3, pngPageNumber: 2, dpi: 300, pageMm: [105, 148], png: 'page-002.png', pdf: 'book.pdf', zip: 'pages.zip', spread: 'spread.png', spreadPages: { left: 3, right: 2 } }, null, 2));
});

test('@flow backup write failure preserves the legacy draft and stops automatic replacement', async ({ page }) => {
  const { defaultStyle } = await import('../../dist/domain/style.js');
  const raw = JSON.stringify({ schemaVersion: 2, source: '上書きしない元原稿', style: defaultStyle(), filename: '旧作業', marginOffset: 0, viewMode: 'single', selected: 1 });
  await page.addInitScript(({ key, raw }) => {
    const write = globalThis.Storage.prototype.setItem;
    if (globalThis.localStorage.getItem(key) === null) write.call(globalThis.localStorage, key, raw);
    globalThis.Storage.prototype.setItem = function(key, value) { if (key === 'bookmaker-draft-backup-before-v3') throw new Error('Simulated quota failure'); return write.call(this, key, value); };
  }, { key: KEY, raw });
  await page.goto('/'); const ui = new BookUI(page); await ui.ready(); await expect(page.locator('#save-state')).toHaveText('保存できません');
  await ui.paste('変更しても旧値を破壊しない。'); await page.goto('/app.css');
  expect(await page.evaluate(key => globalThis.localStorage.getItem(key), KEY)).toBe(raw);
});

test('@flow unsupported canonical input leaves the active project and local styles intact', async ({ page }) => {
  const { createPublication } = await import('../../dist/domain/publication.js'); const p = createPublication('読むべきではない別原稿');
  p.document.unknown = 'future structure'; await mkdir(absolute('output/project'), { recursive: true }); const file = absolute('output/project/unsupported.book.json'); await writeFile(file, JSON.stringify(p));
  await page.goto('/'); const ui = new BookUI(page); await ui.paste('保護する現在の原稿。'); await ui.importTxt(file);
  await expect(page.locator('#notice-text')).toContainText('未対応'); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue('保護する現在の原稿。');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); expect((await draft(page)).project.source).toBe('保護する現在の原稿。');
});
