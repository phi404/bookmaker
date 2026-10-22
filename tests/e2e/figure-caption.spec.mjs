import { test, expect } from '@playwright/test';
import { createBook } from '../../dist/domain/book.js';
import { BookUI } from './ui-driver.mjs';

test('@flow caption controls keep the open editor and numbered descriptions follow the same image', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=';
  const book = createBook('本文。\n:::illustration id="first"');
  book.assets = [{ id: 'image', name: '白い画像.png', mediaType: 'image/png', original: png, bytes: 68, images: [{ dataUrl: png, width: 1, height: 1 }] }]; book.specialPages[0].assetId = 'image';
  await ui.importTxt({ name: 'image.book.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(book)) });
  await page.locator('#tab-structure').click(); await page.locator('.outline-row[data-item-id="first"]').click();
  const detail = page.locator('details').filter({ has: page.locator('#caption-mode') });
  await detail.locator('summary').first().click(); await page.locator('#caption-mode').focus(); await page.locator('#caption-mode').selectOption('numbered');
  await expect(detail).toHaveAttribute('open', ''); await expect(page.locator('#caption-mode')).toBeFocused();
  await page.locator('#caption-text').fill('画像と一緒に移動する説明。'); await ui.ready();
  await expect(page.locator('.paper [data-element-id="caption-first"]')).toContainText('図 1　画像と一緒に移動する説明。');
  const source = book.source; await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toBe(source);
  await page.locator('#undo').click(); await ui.ready();
  await expect(page.locator('.paper [data-element-id="caption-first"]')).not.toContainText('画像と一緒に移動する説明。');
});
