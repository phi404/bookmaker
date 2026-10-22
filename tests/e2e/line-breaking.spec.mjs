import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { BookUI } from './ui-driver.mjs';
import { absolute } from '../../scripts/lib.mjs';

test('@flow narrow Latin and no-break text survives direction changes and actual JSON and PNG downloads', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page), source = await readFile(absolute('fixtures/book/word-boundaries.md'), 'utf8'); await ui.paste(source); await page.getByTestId('view-single').click();
  await page.locator('#detail-layout > summary').click(); await page.locator('#grid-chars').fill('5'); await page.locator('#grid-chars').blur(); await ui.ready();
  for (const direction of ['horizontal-tb', 'vertical-rl']) {
    await page.locator('#page-writing').selectOption(direction); await ui.ready();
    const lines = await ui.preview().locator('svg [data-block-id]').allTextContents();
    for (const word of ['hello', 'world', 'AB\u00a0CD']) expect(lines.some(line => line.includes(word))).toBe(true);
    expect(lines.join('')).toBe(source.replaceAll('\n', '')); expect(await ui.manuscript().inputValue()).toBe(source);
  }
  await mkdir(absolute('output/unicode-lines'), { recursive: true }); await ui.download('export-project', absolute('output/unicode-lines/book.json'));
  expect(JSON.parse(await readFile(absolute('output/unicode-lines/book.json'), 'utf8')).source).toBe(source);
  await ui.download('export-png', absolute('output/unicode-lines/page.png')); await page.reload(); await ui.ready(); expect(await ui.manuscript().inputValue()).toBe(source);
});
