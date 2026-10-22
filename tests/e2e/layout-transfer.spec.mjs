import { test, expect } from '@playwright/test';
import { createBook } from '../../dist/domain/book.js';
import { BookUI } from './ui-driver.mjs';

test('@flow layout worker transfers metadata and resolves image bytes from the current canonical book', async ({ page }) => {
  await page.addInitScript(() => {
    const NativeWorker = globalThis.Worker; globalThis.layoutTransferFixture = { inputContainsBytes: [], outputContainsBytes: [] };
    globalThis.Worker = class extends NativeWorker {
      constructor(url, options) { super(url, options); this.book = String(url).includes('typesetter.worker'); }
      postMessage(job, ...rest) { if (this.book) globalThis.layoutTransferFixture.inputContainsBytes.push(/data:(?:image|application)/u.test(JSON.stringify(job))); return super.postMessage(job, ...rest); }
      set onmessage(handler) { super.onmessage = event => { if (this.book) globalThis.layoutTransferFixture.outputContainsBytes.push(/data:(?:image|application)/u.test(JSON.stringify(event.data))); handler(event); }; }
    };
  });
  await page.goto('/'); const ui = new BookUI(page);
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jXioAAAAASUVORK5CYII=';
  const book = createBook('本文。\n:::illustration id="image"');
  book.assets = [{ id: 'original', name: '元の画像.png', mediaType: 'image/png', original: png, bytes: 68, images: [{ dataUrl: png, width: 1, height: 1 }] }]; book.specialPages[0].assetId = 'original';
  await ui.importTxt({ name: 'source.book.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(book)) });
  await page.locator('#page-select').fill('2');
  await expect(page.locator('.paper image').first()).toHaveAttribute('href', png);
  const transfer = await page.evaluate(() => globalThis.layoutTransferFixture);
  expect(transfer.inputContainsBytes.length).toBeGreaterThan(0); expect(transfer.outputContainsBytes.length).toBeGreaterThan(0);
  expect(transfer.inputContainsBytes).not.toContain(true); expect(transfer.outputContainsBytes).not.toContain(true);
});
