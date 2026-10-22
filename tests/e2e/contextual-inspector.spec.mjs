import { test, expect } from '@playwright/test';
import { BookUI } from './ui-driver.mjs';
import { mkdir, writeFile } from 'node:fs/promises';
import { absolute, fingerprint } from '../../scripts/lib.mjs';
const review = 'output/remaining-2026-10-22/context-review';

test('@flow edit panel shares one explicit target picker for local and common formatting', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste('# 章\n最初の文章。\n次の文章。');
  await expect(page.locator('.inspector-tab-options [role=tab]')).toHaveText(['本', '編集']);
  await page.getByTestId('view-single').click(); await ui.preview().locator('[data-body]').last().click();
  await expect(page.locator('#book-settings')).toBeVisible();
  await page.locator('#edit-selection').click();
  await expect(page.locator('#typography-target')).toHaveValue('context');
  await expect(page.locator('#block-align')).toBeVisible();
  await page.locator('#block-align').getByRole('button', { name: '中央揃え', exact: true }).click(); await ui.ready();
  expect(await ui.manuscript().inputValue()).toContain('alignment="center"');
  const source = await ui.manuscript().inputValue();
  await mkdir(absolute(review), { recursive: true }); await page.screenshot({ path: absolute(review + '/desktop-context.png') });
  await page.locator('#typography-target').selectOption('body');
  await expect(page.locator('#block-inspector')).toBeHidden(); await expect(page.locator('#typography-settings')).toBeVisible();
  await page.locator('#type-character-fontPt').fill('10'); await page.locator('#type-character-fontPt').blur(); await ui.ready();
  expect(await ui.manuscript().inputValue()).toBe(source);
  await page.screenshot({ path: absolute(review + '/desktop-common.png') });
  await ui.preview().locator('[data-body]').first().click(); await expect(page.locator('#typography-target')).toHaveValue('body');
  await page.locator('#typography-target').selectOption('context'); await expect(page.locator('#block-inspector')).toBeVisible();
  await page.locator('#inspect-book').click(); await page.locator('#inspect-book').press('ArrowRight');
  await expect(page.locator('#inspect-styles')).toBeFocused(); await expect(page.locator('#typography-target')).toHaveValue('context');
});

test('@flow chapter numbering and finishing controls persist through saving and undo', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste('# 前書き\n前付の文章。\n# 本文\n本文の文章。');
  await page.locator('#tab-structure').click(); await page.locator('.outline-row[data-kind=chapter]').filter({ hasText: '前書き' }).click();
  await page.getByText('ページ番号の区切り', { exact: true }).click();
  await page.locator('#chapter-number-start').fill('1'); await page.locator('#chapter-number-start').blur(); await ui.ready();
  await page.locator('#chapter-number-format').selectOption('roman'); await ui.ready();
  await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toContain('numberFormat="roman"');
  await page.locator('#inspect-book').click(); await page.locator('#detail-finishing > summary').click();
  await page.locator('#page-count-multiple').selectOption('8'); await ui.ready();
  expect(await ui.pageCount()).toBe(8);
  await page.locator('#undo').click(); await ui.ready(); expect(await ui.pageCount()).not.toBe(8);
});

test('@flow undo and redo keep the common style being edited', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page); await ui.paste('そのままの本文。');
  await page.locator('#inspect-styles').click(); await page.locator('#typography-target').selectOption('body');
  await page.locator('#type-character-fontWeight').getByRole('button', { name: '太字', exact: true }).click(); await ui.ready();
  await page.locator('#undo').click(); await ui.ready();
  await expect(page.locator('#typography-settings')).toBeVisible(); await expect(page.locator('#typography-target')).toHaveValue('body'); await expect(page.locator('#type-character-fontWeight')).toHaveAttribute('data-value', '');
  await page.locator('#redo').click(); await ui.ready(); await expect(page.locator('#type-character-fontWeight')).toHaveAttribute('data-value', '700'); expect(await ui.manuscript().inputValue()).toBe('そのままの本文。');
});

test('@flow compact edit panel exposes the actual target without repeating its heading', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 }); await page.goto('/'); const ui = new BookUI(page); await ui.paste('# 章\n一つ目の段落。\n二つ目の段落。'); await ui.tab('原稿');
  await ui.manuscript().evaluate(input => { input.focus(); input.setSelectionRange(input.value.indexOf('一つ目'), input.value.length); }); await page.locator('#select-block-style').click();
  await expect(page.locator('#typography-target')).toHaveValue('context'); await expect(page.locator('#block-align')).toBeInViewport();
  await page.locator('#block-align').getByRole('button', { name: '中央揃え', exact: true }).click(); await ui.ready(); expect(await page.locator('#manuscript').inputValue()).toContain('alignment="center"');
  await page.locator('#selection-scope').selectOption('book'); await expect(page.locator('#edit-current-target')).toHaveText('すべての文章');
  await page.locator('#typography-target').selectOption('body'); await expect(page.locator('#typography-settings')).toBeVisible();
  expect(await page.evaluate(() => globalThis.document.documentElement.scrollWidth - globalThis.document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await mkdir(absolute(review), { recursive: true }); await page.screenshot({ path: absolute(review + '/mobile-common.png') }); await writeFile(absolute(review + '/manifest.json'), JSON.stringify({ sourceFingerprint: await fingerprint(), viewports: [320, 1440], capturedBy: 'existing Playwright UI verification' }, null, 2));
});

for (const width of [1440, 320]) test('@flow free-page properties follow the object and keep deliberate layer selection open at ' + width + 'px', async ({ page }) => {
  await page.setViewportSize({ width, height: 900 }); await page.goto('/'); const ui = new BookUI(page); await ui.paste('本文。'); await ui.tab('原稿'); await page.locator('#tab-structure').click(); await page.locator('#add-book-item').click();
  await page.locator('#new-page-role').selectOption('layout'); await page.locator('#new-page-template').selectOption('blank'); await page.locator('#new-page-name').fill('図版'); await page.locator('#confirm-add-page').click(); await ui.ready();
  await page.locator('#add-element-text').click(); await page.locator('#element-text').fill('図版の見出し'); await ui.ready();
  await expect(page.locator('#edit-current-target')).toContainText('文字'); await expect(page.locator('#free-layers')).not.toHaveAttribute('open', ''); await expect(page.locator('#element-text')).toBeInViewport(); await expect(page.locator('#inspector-scope')).toContainText('要素');
  await mkdir(absolute(review), { recursive: true }); await page.screenshot({ path: absolute(review + '/free-object-' + width + '.png') });
  const source = await page.locator('#manuscript').inputValue();
  await page.locator('#free-layers > summary').click(); await page.locator('#add-element-text').click(); await ui.ready();
  await expect(page.locator('#free-layers')).toHaveAttribute('open', ''); await page.locator('.element-row input[type=checkbox]').nth(1).check(); await expect(page.locator('#edit-current-target')).toContainText('2要素'); await expect(page.locator('#free-layers')).toHaveAttribute('open', '');
  await page.locator('#free-layers > summary').click(); await expect(page.locator('#free-layers')).not.toHaveAttribute('open', ''); expect(await page.locator('#manuscript').inputValue()).toBe(source);
  await mkdir(absolute(review), { recursive: true }); await page.screenshot({ path: absolute(review + '/free-selection-' + width + '.png') });
});
