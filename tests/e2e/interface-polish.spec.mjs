import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { absolute } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';

for (const width of [1440, 320]) test(`@flow guide stays out of the manuscript and preserves editing position at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/');
  const ui = new BookUI(page); await ui.ready(); await ui.tab('原稿');
  await expect(page.locator('#left-source .notation-help')).toHaveCount(0);
  await expect(page.locator('#status-help, #source-syntax, #syntax-label')).toHaveCount(0);
  const source = '# 第一章\n' + '　｜雨音《あまおと》を聞いた。\n'.repeat(45);
  await ui.manuscript().fill(source); await ui.ready();
  await ui.manuscript().evaluate(editor => { editor.focus(); editor.setSelectionRange(120, 140); editor.scrollTop = 180; });
  const before = await ui.manuscript().evaluate(editor => ({ from: editor.selectionStart, to: editor.selectionEnd, scroll: editor.scrollTop, height: editor.clientHeight }));
  await page.getByRole('button', { name: '操作ガイド', exact: true }).click();
  await page.locator('#help-notation > summary').click();
  await expect(page.locator('#help-notation')).toContainText('｜漢字《かんじ》');
  await expect(page.locator('#help-dialog')).toBeVisible();
  await mkdir(absolute('output/polish-2026-10-22'), { recursive: true });
  await page.screenshot({ path: absolute(`output/polish-2026-10-22/guide-${width}.png`) });
  await page.locator('#close-help').click();
  expect(await ui.manuscript().inputValue()).toBe(source);
  expect(await ui.manuscript().evaluate(editor => ({ from: editor.selectionStart, to: editor.selectionEnd, scroll: editor.scrollTop, height: editor.clientHeight }))).toEqual(before);
  await expect(page.getByRole('button', { name: '操作ガイド', exact: true })).toBeFocused();
  await page.locator('#project-home').click();
  const menu = await page.locator('#file-menu').boundingBox(), title = await page.locator('#project-home').boundingBox();
  expect(menu.x).toBeGreaterThanOrEqual(8); expect(menu.x + menu.width).toBeLessThanOrEqual(width - 8);
  expect(menu.y).toBeGreaterThanOrEqual(title.y + title.height);
  await page.keyboard.press('Escape');
  if (width === 1440) {
    const logo = await page.locator('.wordmark').boundingBox();
    expect(title.x - logo.x - logo.width).toBeGreaterThanOrEqual(28);
    await page.getByRole('button', { name: '操作を検索 Ctrl K' }).click();
    await page.getByRole('combobox', { name: '操作を検索' }).fill('ページ番号');
    await page.getByRole('option', { name: 'ノンブル', exact: true }).click();
    await expect(page.locator('#detail-folio')).toHaveAttribute('open', '');
  }
  await ui.tab('原稿');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth)).toBe(false);
  await page.screenshot({ path: absolute(`output/polish-2026-10-22/workspace-${width}.png`) });
});
