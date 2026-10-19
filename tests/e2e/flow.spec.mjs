import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { absolute, fingerprint, readJson, readText } from '../../scripts/lib.mjs';
import { loadAdapter } from '../product/load-adapter.mjs';
import { BookUI } from './ui-driver.mjs';

const config = await readJson('harness/config.json'), source = await readText('fixtures/basic.txt');
const fixture = (await readJson('fixtures/manifest.json')).fixtures.find(item => item.id === 'basic');

for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }, { width: 320, height: 720 }]) {
  test(`@flow paste/TXT/settings/local-first ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const external = [];
    page.on('request', request => { if (new URL(request.url()).origin !== new URL(config.appUrl).origin && /^https?:/u.test(request.url())) external.push(request.url()); });
    await page.goto('/');
    const ui = new BookUI(page);
    await ui.paste(source);
    expect(await ui.pageCount()).toBeGreaterThan(1);
    if (viewport.width > 375) {
      const left = Number(await ui.preview().locator('[data-side="left"][data-page-number]').first().getAttribute('data-page-number'));
      expect(left % 2).toBe(1);
      const right = ui.preview().locator('[data-side="right"][data-page-number]');
      if (await right.count()) expect(Number(await right.first().getAttribute('data-page-number')) % 2).toBe(0);
    }
    await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toBe(source);
    await ui.importTxt(absolute('fixtures/mixed-text.txt'));
    await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toBe(await readText('fixtures/mixed-text.txt'));
    await ui.paste(source);
    for (const [id, value] of [['font-size', 10], ['line-height', 1.9], ['margin', 2]]) await ui.control(id, value);
    await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toBe(source);
    if (viewport.width <= 375) {
      await mkdir(absolute('output/mobile'), { recursive: true });
      await ui.download('export-png', absolute(`output/mobile/page-${viewport.width}.png`));
    }
    await ui.tab('プレビュー'); await ui.ready();
    await expect(page.getByTestId('book-preview')).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
    expect(overflow).toBe(false);
    expect(external, '原稿入力・設定・出力時に外部接続がある').toEqual([]);
  });
}

test('@flow actual PNG/PDF exports and page count', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/');
  const ui = new BookUI(page); await ui.paste(source);
  const adapter = await loadAdapter(), expectedPages = adapter.paginate(adapter.parse(source), adapter.defaultStyle()).pages.length;
  expect(await ui.pageCount()).toBe(expectedPages);
  const folder = config.exportDirectory; await mkdir(absolute(folder), { recursive: true });
  await ui.download('export-png', absolute(`${folder}/page-001.png`));
  await ui.download('export-pdf', absolute(`${folder}/book.pdf`));
  const manifest = { schemaVersion: 1, phase: config.phase, sourceFingerprint: await fingerprint(), fixtureId: fixture.id, fixtureSourceSha256: fixture.sourceSha256, expectedPages, pngPageNumber: 1, dpi: config.pngDpi, png: 'page-001.png', pdf: 'book.pdf' };
  if (config.phase === 'mvp') {
    await ui.download('export-png-all', absolute(`${folder}/pages.zip`));
    // Choose spread 2-3 with the page control; odd pages appear on the left.
    await page.getByTestId('page-select').fill('2'); await ui.tab('プレビュー'); await ui.ready();
    await ui.download('export-spread', absolute(`${folder}/spread.png`));
    manifest.zip = 'pages.zip'; manifest.spread = 'spread.png'; manifest.spreadPages = { left: 3, right: 2 };
  }
  await writeFile(absolute(config.exportManifest), JSON.stringify(manifest, null, 2) + '\n');
});

if (config.phase === 'mvp') test('@flow persistence, page breaks and folios', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/');
  const ui = new BookUI(page), manuscript = await readText('fixtures/book/page-transitions.md');
  await ui.paste(manuscript); expect(await ui.pageCount()).toBe(4);
  await ui.control('font-size', 10);
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await page.reload(); await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toBe(manuscript);
  await ui.tab('設定'); await page.locator('#inspect-styles').click(); await expect(page.getByTestId('font-size')).toHaveValue('10');
  await ui.tab('プレビュー'); await ui.ready(); expect(await ui.pageCount()).toBe(4);
  await expect(page.getByTestId('folio').first()).toHaveText(/\d+/u);
});

for (const viewport of [{ width: 1440, height: 1000 }, { width: 375, height: 812 }]) {
  test(`@visual fixed book preview ${viewport.width}px`, async ({ page }) => {
    await page.setViewportSize(viewport); await page.goto('/');
    const ui = new BookUI(page); await ui.paste(config.phase === 'mvp' ? await readText('fixtures/ruby.txt') : source);
    await expect(ui.preview()).toHaveScreenshot(`book-${config.phase}-${viewport.width}.png`, { animations: 'disabled', maxDiffPixels: 0 });
  });
}

test('@flow draft survives an immediate reload after the last setting change', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/');
  const ui = new BookUI(page), manuscript = '保存の検証。最後の変更を残す。\n'.repeat(20);
  await ui.paste(manuscript); await ui.control('font-size', 10);
  await page.reload(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(manuscript);
  await ui.tab('設定'); await expect(page.getByTestId('font-size')).toHaveValue('10');
  await ui.tab('プレビュー'); await ui.ready(); expect(await ui.pageCount()).toBeGreaterThan(1);
});

test('@flow damaged local draft is preserved and automatic saving stops', async ({ page }) => {
  const damaged = '{unreadable original';
  await page.addInitScript(value => globalThis.localStorage.setItem('bookmaker-slice-draft-v1', value), damaged);
  await page.goto('/'); const ui = new BookUI(page); await ui.paste('新しい本文。');
  await expect(page.getByRole('status').filter({ hasText: '自動保存を停止' })).toBeVisible();
  await expect(page.locator('#save-state')).toHaveText('保存を停止');
  // Leave the app, so its pagehide persistence path also has an opportunity to run.
  await page.goto('/app.css');
  await expect.poll(() => page.evaluate(() => globalThis.localStorage.getItem('bookmaker-slice-draft-v1'))).toBe(damaged);
});

test('@flow long manuscript uses the latest layout and treats HTML as literal text', async ({ page }) => {
  await page.goto('/'); const ui = new BookUI(page), long = await readText('fixtures/long-chapter.txt');
  await ui.paste(long); expect(await ui.pageCount()).toBeGreaterThan(100);
  const literal = '<script>window.injected=true</script>\n<img src="x" onerror="window.injected=true">本文。';
  await ui.manuscript().fill(long + '終わり。'); await ui.manuscript().fill(literal); await ui.ready();
  await expect(ui.manuscript()).toHaveValue(literal); expect(await ui.pageCount()).toBe(1);
  expect(await ui.preview().locator('script,img,foreignObject').count()).toBe(0);
  expect(await page.evaluate(() => globalThis.injected ?? false)).toBe(false);
});
