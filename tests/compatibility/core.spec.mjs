import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { absolute, fingerprint } from '../../scripts/lib.mjs';
import { BookUI } from '../e2e/ui-driver.mjs';

const source = '# 雨の記録\n｜薔薇《ばら》と*静かな*朝。\n中央の段落。';
for (const width of [1440, 320]) test(`empty start, local recovery and mixed-page exports at ${width}px`, async ({ page, context, browserName, browser }) => {
  await page.setViewportSize({ width, height: 900 }); const failures = [];
  page.on('pageerror', error => failures.push(error.message));
  await page.goto('/'); const ui = new BookUI(page); await ui.ready();
  await expect(page).toHaveTitle('Compholio'); await expect(ui.manuscript()).toHaveValue('');
  await expect(page.locator('#sample-manuscript')).toBeVisible(); await page.reload(); await ui.ready(); await expect(ui.manuscript()).toHaveValue('');
  await ui.paste(source); await ui.tab('原稿');
  await expect(page.locator('#save-state')).toHaveText('保存済み'); await page.reload(); await ui.ready(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(source);
  await context.setOffline(true); await ui.manuscript().fill(source + '\n外部に送らず編集。'); await ui.ready(); await expect(page.locator('#save-state')).toHaveText('保存済み'); await context.setOffline(false);
  const { PDFDocument } = await import('../../public/vendor/pdf-lib.js');
  const external = await PDFDocument.create(); external.addPage([200, 280]).drawText('EXTERNAL 1'); external.addPage([280, 200]).drawText('EXTERNAL 2');
  await page.locator('#tab-assets').click(); await page.locator('#asset-file').setInputFiles({ name: 'external.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await external.save()) }); await expect(page.locator('.asset-card')).toHaveCount(1);
  await page.locator('.asset-card').getByRole('button', { name: 'ページとして挿入' }).click(); await page.locator('#confirm-asset-insert').click(); await ui.ready();
  const folder = absolute(`output/compatibility/${browserName}-${width}`); await mkdir(folder, { recursive: true });
  await ui.download('export-project', folder + '/book.json'); const saved = JSON.parse(await readFile(folder + '/book.json', 'utf8')); expect(saved.source).toContain('外部に送らず編集。'); expect(saved.assets).toHaveLength(1);
  await ui.download('export-png', folder + '/page.png'); await ui.download('export-png-all', folder + '/pages.zip'); await ui.download('export-pdf', folder + '/book.pdf');
  const png = await readFile(folder + '/page.png'); expect([...png.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  const pdf = await PDFDocument.load(await readFile(folder + '/book.pdf'), { updateMetadata: false }); expect(pdf.getPageCount()).toBe(await ui.pageCount()); expect(pdf.getProducer()).toBe('Compholio'); expect(pdf.getCreator()).toBe('Compholio');
  const { unzipSync } = await import('../../public/vendor/fflate.js'); const images = Object.values(unzipSync(new Uint8Array(await readFile(folder + '/pages.zip')))); expect(images).toHaveLength(pdf.getPageCount()); for (const image of images) expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  await page.reload(); await ui.ready(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(saved.source); await page.locator('#tab-assets').click(); await expect(page.locator('.asset-card')).toHaveCount(1);
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth)).toBeLessThanOrEqual(1); expect(failures).toEqual([]);
  await page.screenshot({ path: folder + '/restored.png' }); await writeFile(folder + '/result.json', JSON.stringify({ browserName, version: browser.version(), width, sourceFingerprint: await fingerprint(), sourcePreserved: true, assetCount: saved.assets.length, pageErrors: failures }, null, 2));
});
