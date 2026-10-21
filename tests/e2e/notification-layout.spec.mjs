import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { absolute } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';

for (const width of [1440, 320]) test(`@flow notification leaves the workspace and paper stationary at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/');
  const ui = new BookUI(page), source = await readFile(absolute('fixtures/basic.txt'), 'utf8');
  await ui.paste(source); await ui.tab('原稿');
  const targets = ['.app-header', '#workspace', '#manuscript', '#preview-panel', '.settings-panel'];
  const before = new Map();
  for (const selector of targets) if (await page.locator(selector).isVisible()) before.set(selector, await page.locator(selector).boundingBox());
  await ui.manuscript().fill(source + '\n:::format alignment="center"\n未完');
  await expect(page.locator('#notice')).toBeVisible();
  for (const [selector, bounds] of before) expect(await page.locator(selector).boundingBox(), selector).toEqual(bounds);
  await expect(page.locator('#dismiss-notice')).toBeInViewport();
  const notice = await page.locator('#notice').boundingBox();
  expect(notice.x).toBeGreaterThanOrEqual(0); expect(notice.x + notice.width).toBeLessThanOrEqual(width);
  if (width === 320) { const tabs = await page.locator('.mobile-tabs').boundingBox(); expect(notice.y + notice.height).toBeLessThanOrEqual(tabs.y); }
  await page.locator('#dismiss-notice').click(); await expect(page.locator('#notice')).toBeHidden();
  for (const [selector, bounds] of before) expect(await page.locator(selector).boundingBox(), selector).toEqual(bounds);
  await expect(ui.manuscript()).toHaveValue(source + '\n:::format alignment="center"\n未完');
});

test('@flow import completion yields to resumed work while validation errors remain dismissible',async({page})=>{
  await page.setViewportSize({width:375,height:812});await page.goto('/');const ui=new BookUI(page);await ui.paste('最初の本文');await ui.tab('原稿');
  await page.getByTestId('manuscript-file').setInputFiles({name:'notice.md',mimeType:'text/markdown',buffer:Buffer.from('# 通知の確認\n本文。')});await ui.ready();await expect(page.locator('#notice')).toBeVisible();await expect(page.locator('#undo-import')).toBeVisible();
  await ui.tab('プレビュー');await expect(page.locator('#notice')).toBeHidden();await page.locator('#view-gallery').click();await page.getByLabel('通しページ1を追加選択',{exact:true}).check();
  await ui.tab('原稿');await ui.manuscript().fill(':::format alignment="center"\n未完');await expect(page.locator('#notice')).toBeVisible();await ui.tab('プレビュー');await expect(page.locator('#notice')).toBeVisible();await page.locator('#dismiss-notice').click();await expect(page.locator('#notice')).toBeHidden();
});
