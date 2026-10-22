import { test, expect } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';
import { BookUI } from './ui-driver.mjs';
import { absolute } from '../../scripts/lib.mjs';
import { unzipSync } from '../../public/vendor/fflate.js';

test('@flow grouped PNG ranges preserve physical order, pixel size and invalidate the previous download', async ({ page }) => {
  await page.goto('/'); const ui = new BookUI(page), source = Array.from({ length: 9 }, (_, i) => 'ページ' + (i + 1)).join('\n---\n'); await ui.paste(source);
  await ui.control('page-layout', 'uniform'); await page.locator('#image-preset').selectOption('square'); await ui.ready(); expect(await ui.pageCount()).toBe(9);
  await mkdir(absolute('output/image-batches'), { recursive: true }); await page.locator('#open-export').click();
  await page.locator('#export-scope').selectOption('range'); await page.locator('#export-from').fill('2'); await page.locator('#export-to').fill('9');
  await page.getByText('PNGのまとめ方', { exact: true }).click(); await page.locator('#export-batch-size').selectOption('4');
  await ui.download('export-png-all', absolute('output/image-batches/grouped.zip'));
  const entries = unzipSync(new Uint8Array(await readFile(absolute('output/image-batches/grouped.zip'))));
  expect(Object.keys(entries)).toEqual(Array.from({ length: 8 }, (_, i) => 'set-0' + (Math.floor(i / 4) + 1) + '/無題-' + String(i + 2).padStart(5, '0') + '.png'));
  for (const bytes of Object.values(entries)) { const image = Buffer.from(bytes); expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]); expect([image.readUInt32BE(16), image.readUInt32BE(20)]).toEqual([1080, 1080]); }
  await page.locator('#open-export').click(); await expect(page.locator('#export-result')).toBeVisible(); await page.locator('#export-batch-size').selectOption('0'); await expect(page.locator('#export-result')).toBeHidden();
  await ui.download('export-png-all', absolute('output/image-batches/ungrouped.zip'));
  expect(Object.keys(unzipSync(new Uint8Array(await readFile(absolute('output/image-batches/ungrouped.zip')))))).toEqual(Array.from({ length: 8 }, (_, i) => '無題-' + String(i + 2).padStart(5, '0') + '.png'));
  await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(source);
});
