import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { absolute, fingerprint, hash } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';
// Visual scenarios keep the three editing views on the same canonical book.
const KEY = 'bookmaker-slice-draft-v1';
const draft = page => page.evaluate(key => JSON.parse(globalThis.localStorage.getItem(key)), KEY);
const openView = async (page, ui, view) => { await ui.tab('原稿'); await page.getByRole('tab', { name: view, exact: true }).click(); };
const selectItem = (page, id) => page.locator(`.outline-row[data-item-id="${id}"]`).click();
async function add(page, ui, role, name = '') {
  await openView(page, ui, '構成'); await page.locator('#add-book-item').click();
  const template = ['title','chapter-title','colophon'].includes(role);
  await page.locator('#new-page-role').selectOption(template ? 'layout' : role === 'free' ? 'layout' : role); if (template) await page.locator('#new-page-template').selectOption(role);  await page.locator('#new-page-name').fill(name); await page.locator('#confirm-add-page').click(); await ui.ready(); if (template) { await page.getByText('元のテンプレート',{exact:true}).click(); await page.locator('#restore-template').click(); await ui.ready(); }
}
for (const width of [1440, 375]) test(`@flow book views, special details, source round trip and common history ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 812 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste('# 一章\n　本文。\n===\n# 二章\n　後の本文。');
  await add(page, ui, 'colophon');
  await page.getByTestId('special-title').fill('庭の向こう'); await page.getByTestId('special-title').blur();
  await page.getByTestId('special-author').fill('試用作者'); await page.getByTestId('special-author').blur(); await ui.ready();
  await ui.tab('プレビュー'); await expect(ui.preview().locator('[data-special-page]')).toContainText('庭の向こう'); await expect(ui.preview().locator('[data-special-page]')).toContainText('試用作者');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  let saved = (await draft(page)).project; const special = saved.specialPages[0]; expect(special.fields.title).toBe('庭の向こう');
  await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(saved.source); expect(saved.source).toContain(`:::colophon id="${special.id}"`); expect(saved.source).not.toContain('試用作者');
  await ui.paste('先頭に追加。\n' + saved.source.replace('二章', '改名した章')); await page.reload(); await ui.ready();
  await openView(page, ui, '構成'); await selectItem(page, special.id); await expect(page.getByTestId('special-title')).toHaveValue('庭の向こう');
  await page.getByText('詳細 / 自由ページへ', { exact: true }).click(); await page.locator('#convert-free').click(); await expect(page.locator('.element-list')).toBeVisible(); await ui.ready();
  await page.locator('#add-element-text').click(); await page.getByTestId('element-text').fill('自由ページの注記'); await page.getByTestId('element-text').blur();
  await ui.tab('プレビュー'); await ui.ready(); await expect(ui.preview().locator('[data-special-page]')).toContainText('自由ページの注記');
  await page.locator('#undo').click(); await ui.ready(); await expect(ui.preview().locator('[data-special-page]')).not.toContainText('自由ページの注記');
  await page.locator('#redo').click(); await ui.ready(); await expect(ui.preview().locator('[data-special-page]')).toContainText('自由ページの注記');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); saved = (await draft(page)).project;
  expect(saved.specialPages[0].role).toBe('colophon'); expect(saved.specialPages[0].representation).toBe('layout'); expect(saved.specialPages[0].originalTemplate.fields.title).toBe('庭の向こう');
  await mkdir(absolute('output/book'), { recursive: true }); const file = absolute(`output/book/workspace-${width}.book.json`); await ui.download('export-project', file);
  expect(JSON.parse(await readFile(file, 'utf8')).specialPages).toEqual(saved.specialPages);
  await ui.paste('別原稿'); await ui.importTxt(file); await ui.ready(); expect((await draft(page)).project.schemaVersion).toBe(3);
  if (width === 375) {
    await ui.tab('プレビュー'); await page.getByTestId('view-gallery').click(); await page.getByLabel('通しページ1を追加選択', { exact: true }).check(); await expect(ui.preview()).toBeVisible();
    await page.getByLabel('通しページ3を追加選択', { exact: true }).check(); await expect(ui.preview()).toBeVisible(); await page.screenshot({ path: absolute('output/book/mobile-gallery.png') });
    await ui.tab('設定'); await expect(page.locator('#typography-target')).toBeVisible(); await expect(page.locator('#edit-current-target')).toContainText('1・3'); await expect(page.locator('#inspector-scope')).toHaveText('通しページに固定'); await page.screenshot({ path: absolute('output/book/mobile-page-scope.png') });
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
});

test('@flow unfinished special reference survives reload without overwriting canonical details', async ({ page }) => {
  await page.goto('/'); const ui = new BookUI(page); await ui.paste('本文。\n:::colophon id="c"');
  const initial = (await draft(page))?.project; await ui.manuscript().fill('別の本文。\n:::colophon id="');
  await expect(ui.preview()).toHaveAttribute('data-layout-state', 'draft'); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  const raw = (await draft(page)).project; expect(raw.source).toBe(initial?.source ?? '本文。\n:::colophon id="c"'); expect(raw.sourceDraft).toContain('別の本文');
  await page.reload(); await expect(ui.preview()).toHaveAttribute('data-layout-state', 'draft'); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(raw.sourceDraft);
  await page.getByRole('tab', { name: '構成', exact: true }).click(); await page.locator('#add-book-item').click(); await page.locator('#new-page-role').selectOption('layout'); await page.locator('#confirm-add-page').click();
  await expect(page.locator('#notice-text')).toContainText('確定'); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(raw.sourceDraft);
  await ui.paste('別の本文。\n:::colophon id="c"'); await expect(ui.preview()).toHaveAttribute('data-layout-state', 'ready');
});

test('@flow panes retain source position; chapter scopes follow reflow; sparse gallery overrides stay physical', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste('# 一章\n本文\n===\n# 二章\n後の本文\n===\n最後の本文');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); const saved = (await draft(page)).project, chapter = saved.document.children[1];
  await ui.manuscript().evaluate(e => { e.setSelectionRange(7, 7); e.scrollTop = 20; }); const caret = await ui.manuscript().evaluate(e => e.selectionStart);
  await page.locator('#tab-structure').click(); await page.locator('#tab-source').click(); expect(await ui.manuscript().evaluate(e => e.selectionStart)).toBe(caret);
  await page.locator('#close-left').click(); await expect(page.locator('#left-source')).not.toBeVisible(); await page.locator('#toggle-left').click();
  const divider = page.locator('#resize-left'); await divider.focus(); await divider.press('ArrowRight'); await expect(divider).toHaveAttribute('aria-valuenow', '430');
  await page.locator('#tab-structure').click(); await selectItem(page, chapter.id); await page.getByTestId('chapter-start').selectOption('right'); await ui.ready();
  await page.getByRole('button', { name: 'この章の柱を設定', exact: true }).click(); await page.getByTestId('running-position').selectOption('top-center'); await ui.ready();
  await ui.paste('前付\n===\n' + saved.source); await ui.ready(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); const next = (await draft(page)).project; expect(next.runningElements[0].scope.sectionId).toBe(chapter.id);
  await page.getByTestId('view-gallery').click(); await page.getByLabel('通しページ1を追加選択', { exact: true }).check(); await page.getByLabel('通しページ3を追加選択', { exact: true }).check();
  const paperSize = await ui.preview().locator('.gallery-item .paper').first().boundingBox(); expect(paperSize.height / paperSize.width).toBeCloseTo(148 / 105, 2);
  await page.getByTestId('pages-folio').selectOption('hide'); await page.getByTestId('pages-paper').selectOption('white'); await ui.ready();
  await expect(ui.preview().locator('.gallery-item[data-page-number="1"] [data-testid=folio]')).toHaveCount(0); await expect(ui.preview().locator('.gallery-item[data-page-number="2"] [data-testid=folio]')).toHaveCount(1);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); const rule = (await draft(page)).project.pageOverrides.at(-1); expect(rule.pages).toEqual([1, 3]);
  await page.reload(); await ui.ready(); expect((await draft(page)).project.pageOverrides.at(-1).pages).toEqual([1, 3]);
});

test('@flow local assets, PDF page selection, IndexedDB recovery and matching mixed-page exports', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); const external = [];
  page.on('request', r => { if (/^https?:/u.test(r.url()) && new URL(r.url()).origin !== 'http://127.0.0.1:5174') external.push(r.url()); });
  const { PDFDocument, rgb } = await import('../../public/vendor/pdf-lib.js'); const pdf = await PDFDocument.create();
  for (const text of ['LOCAL PDF 1', 'LOCAL PDF 2']) { const p = pdf.addPage([105 * 72 / 25.4, 148 * 72 / 25.4]); p.drawRectangle({ x: 30, y: 40, width: 200, height: 250, borderColor: rgb(.3, .4, .3), borderWidth: 1 }); p.drawText(text, { x: 55, y: 200, size: 14 }); }
  await mkdir(absolute('output/book'), { recursive: true }); await writeFile(absolute('output/book/external.pdf'), await pdf.save());
  await page.goto('/'); const ui = new BookUI(page); await ui.paste('# 本文\n　｜薔薇《ばら》の話。\n:::colophon id="c"');
  await openView(page, ui, '構成'); await selectItem(page, 'c'); await page.getByTestId('special-title').fill('庭の向こう'); await page.getByTestId('special-author').fill('試用作者'); await page.getByTestId('special-date').fill('2026年10月3日'); await ui.ready();
  await openView(page, ui, '素材'); await page.locator('#asset-file').setInputFiles(absolute('fixtures/book/unsafe.svg')); await expect(page.locator('#notice-text')).toContainText('SVG'); expect(await page.locator('.asset-card').count()).toBe(0);
  await page.locator('#asset-file').setInputFiles(absolute('fixtures/book/local-page.svg')); await expect(page.locator('.asset-card')).toHaveCount(1);
  await page.locator('.asset-card').getByRole('button',{name:'ページとして挿入'}).click(); await ui.ready(); await expect(ui.preview().locator('image')).toHaveCount(1);
  await openView(page, ui, '素材'); await page.locator('#asset-file').setInputFiles(absolute('output/book/external.pdf')); await expect(page.locator('.asset-card')).toHaveCount(2);
  await page.locator('.asset-card').nth(1).getByRole('button', { name: 'ページとして挿入' }).click(); await page.locator('#asset-insert-from').fill('2'); await page.locator('#confirm-asset-insert').click(); await ui.ready(); await expect(page.getByTestId('special-asset-page')).toHaveValue('2');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); expect((await draft(page)).schemaVersion).toBe(4);
  await page.reload(); await ui.ready(); const local = await page.evaluate(async () => { const db = await new Promise((resolve, reject) => { const req = globalThis.indexedDB.open('bookmaker-local-books', 1); req.onsuccess = () => resolve(req.result); req.onerror = reject; }); return await new Promise(resolve => { const req = db.transaction('drafts').objectStore('drafts').get(JSON.parse(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')).snapshot ?? 'current'); req.onsuccess = () => { db.close(); resolve(req.result); }; }); });
  expect(local.project.assets.length).toBe(2); expect(local.project.assets[1].images.length).toBe(2); expect(local.project.specialPages.at(-1).assetPage).toBe(2);
  await add(page, ui, 'free', '余白のページ'); await page.locator('#add-element-text').click(); await page.getByTestId('element-text').fill('自由ページの注記'); await ui.ready();
  await ui.tab('プレビュー'); const box = await ui.preview().locator('[data-special-page] [data-element-id] text').first().boundingBox();
  await page.mouse.move(box.x + 5, box.y + box.height / 2); await page.mouse.down(); await page.mouse.move(box.x + 45, box.y + box.height / 2 + 20, { steps: 5 }); await page.mouse.up(); await ui.ready();
  const pngPageNumber = 4; await page.getByTestId('page-select').fill(String(pngPageNumber));
  await ui.download('export-png', absolute('output/book/page-004.png')); await ui.download('export-pdf', absolute('output/book/book.pdf')); await ui.download('export-png-all', absolute('output/book/pages.zip')); await page.getByTestId('page-select').fill('2'); await ui.download('export-spread', absolute('output/book/spread.png')); await ui.download('export-project', absolute('output/book/assets.book.json'));
  const exported = JSON.parse(await readFile(absolute('output/book/assets.book.json'), 'utf8')); expect(exported.assets).toEqual(local.project.assets);
  expect(exported.specialPages.at(-1).elements[0].xMm).toBeGreaterThan(15); expect(exported.specialPages.at(-1).elements[0].text).toBe('自由ページの注記');
  await ui.paste('別の本文'); await ui.importTxt(absolute('output/book/assets.book.json')); await ui.ready(); await page.getByTestId('page-select').fill('4'); await expect(ui.preview().locator('image')).not.toHaveCount(0);
  expect(external).toEqual([]); const expectedPages = await ui.pageCount(); expect(expectedPages).toBe(5);
  await writeFile(absolute('output/book/manifest.json'), JSON.stringify({ schemaVersion: 1, phase: 'mvp', sourceFingerprint: await fingerprint(), inputSha256: hash(exported.source), expectedPages, pngPageNumber, dpi: 300, pageMm: [105, 148], png: 'page-004.png', pdf: 'book.pdf', zip: 'pages.zip', spread: 'spread.png', spreadPages: { left: 3, right: 2 } }, null, 2));
  await page.screenshot({ path: absolute('output/book/workspace-desktop.png') });
});
test('@flow damaged panel preferences do not block manuscript recovery or saving', async ({ page }) => {
  await page.goto('/'); const ui = new BookUI(page); await ui.paste('復元する本文。');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await page.evaluate(() => globalThis.localStorage.setItem('bookmaker-workspace-v1', '{invalid'));
  await page.reload(); await ui.ready(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue('復元する本文。');
  await ui.paste('復元後の修正。'); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await page.reload(); await ui.ready(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue('復元後の修正。');
});

test('@flow PNG and JPEG originals survive insertion, reorder, duplicate, removal and undo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); const ui = new BookUI(page); await ui.paste('# 本文\n　画像の前の本文。');
  const originals = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 420; canvas.height = 592; const c = canvas.getContext('2d'); c.fillStyle = '#fffefa'; c.fillRect(0, 0, 420, 592); c.strokeStyle = '#52624e'; c.strokeRect(35, 50, 350, 492); c.fillStyle = '#52624e'; c.font = '24px serif'; c.fillText('LOCAL IMAGE', 100, 300); return ['image/png', 'image/jpeg'].map(type => canvas.toDataURL(type)); });
  for (const [i, mimeType] of ['image/png', 'image/jpeg'].entries()) {
    await openView(page, ui, '素材'); await page.locator('#asset-file').setInputFiles({ name: i ? 'local.jpg' : 'local.png', mimeType, buffer: Buffer.from(originals[i].split(',')[1], 'base64') });
    await expect(page.locator('.asset-card')).toHaveCount(i + 1); await page.locator('.asset-card').nth(i).getByRole('button', { name: 'ページとして挿入' }).click(); await ui.ready();
  }
  await openView(page, ui, '構成'); const ids = await page.locator('.outline-row[data-kind=special]').evaluateAll(rows => rows.map(row => row.dataset.itemId));
  await selectItem(page, ids[1]); await page.locator('.outline-row[data-item-id="' + ids[1] + '"]').press('Alt+ArrowUp'); await ui.ready();
  let refs = await page.locator('.outline-row[data-kind=special]').evaluateAll(rows => rows.map(row => row.dataset.itemId)); expect(refs).toEqual([ids[1], ids[0]]);
  await page.locator('[data-menu-item-id="' + ids[1] + '"]').click(); await page.getByRole('menuitem', { name: '複製', exact: true }).click(); await ui.ready(); expect(await page.locator('.outline-row[data-kind=special]').count()).toBe(3);
  const copiedId = await page.locator('.outline-row[aria-current=true]').getAttribute('data-item-id'); await page.locator('[data-menu-item-id="' + copiedId + '"]').click(); await page.getByRole('menuitem', { name: '削除', exact: true }).click(); await ui.ready(); expect(await page.locator('.outline-row[data-kind=special]').count()).toBe(2);
  await page.locator('#undo').click(); await ui.ready(); await openView(page, ui, '構成'); expect(await page.locator('.outline-row[data-kind=special]').count()).toBe(3);
  await ui.download('export-project', absolute('output/book/images.book.json')); const exported = JSON.parse(await readFile(absolute('output/book/images.book.json'), 'utf8'));
  expect(exported.assets.map(asset => asset.original)).toEqual(originals); expect(exported.source).not.toContain('base64');
});

test('@visual revised workspace source, colophon, gallery and mobile context', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); const ui = new BookUI(page);
  const { SAMPLE } = await import('../../dist/domain/sample.js');
  await ui.paste(SAMPLE.replace('[見出し] 朝の余白', '# 朝の余白') + '\n:::colophon id="colophon-main"');
  await page.getByTestId('page-select').fill('2'); await page.locator('#close-right').click();
  await page.locator('#toggle-right').click();
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await mkdir(absolute('output/book'), { recursive: true }); await page.screenshot({ path: absolute('output/book/01-source-spread.png') });
  await expect.soft(page).toHaveScreenshot('workspace-source.png', { animations: 'disabled', maxDiffPixels: 0 });
  await page.locator('#tab-structure').click(); await selectItem(page, 'colophon-main');
  await page.getByTestId('special-title').fill('朝の余白'); await page.getByTestId('special-author').fill('試用作者'); await page.getByTestId('special-date').fill('2026年10月3日'); await page.getByTestId('special-note').fill('この本は組版確認用のサンプルです。');
  await page.getByTestId('view-single').click(); await ui.ready(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await page.screenshot({ path: absolute('output/book/02-colophon-inspector.png') }); await expect.soft(page).toHaveScreenshot('workspace-colophon.png', { animations: 'disabled', maxDiffPixels: 0 });
  await page.getByTestId('view-gallery').click(); await page.getByLabel('通しページ1を追加選択', { exact: true }).check(); await page.getByLabel('通しページ3を追加選択', { exact: true }).check();
  await page.getByTestId('pages-folio').selectOption('hide'); await ui.ready(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await page.screenshot({ path: absolute('output/book/03-gallery-scope.png') }); await expect.soft(page).toHaveScreenshot('workspace-gallery.png', { animations: 'disabled', maxDiffPixels: 0 });
  await page.setViewportSize({ width: 375, height: 812 }); await ui.tab('原稿'); await page.locator('#tab-structure').click(); await selectItem(page, 'colophon-main'); await ui.ready(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); await page.screenshot({ path: absolute('output/book/mobile-inspector.png') });
  await expect.soft(page).toHaveScreenshot('workspace-mobile-inspector.png', { animations: 'disabled', maxDiffPixels: 0 });
});
