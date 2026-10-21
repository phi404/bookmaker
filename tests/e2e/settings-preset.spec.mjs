import { test, expect } from '@playwright/test';
import { BookUI } from './ui-driver.mjs';
import { readFile, mkdir } from 'node:fs/promises';
import { absolute } from '../../scripts/lib.mjs';

test('reusable book settings preserve the manuscript and share undo, restoration and file exchange @flow', async ({ page }) => {
  const ui=new BookUI(page);await page.goto('/');const source=await readFile(absolute('fixtures/book/roadmap-evaluation.md'),'utf8');await ui.paste(source);
  await ui.tab('設定');await page.locator('#inspect-book').click();await page.locator('#settings-presets').click();
  await page.locator('#settings-preset-save-current').click();await page.locator('#settings-preset-save-name').fill('再利用テスト');await page.locator('#settings-preset-save').click();
  await expect(page.locator('#settings-preset-name')).toHaveText('再利用テスト');
  const pending=page.waitForEvent('download');await page.locator('#settings-preset-write').click();const saved=await pending;
  await mkdir(absolute('output/roadmap-implementation-2026-10-21/exports'),{recursive:true});const settingsPath=absolute('output/roadmap-implementation-2026-10-21/exports/reusable.bookstyle.json');await saved.saveAs(settingsPath);
  const json=JSON.parse(await readFile(settingsPath,'utf8'));expect(json.kind).toBe('book-settings');expect(JSON.stringify(json)).not.toContain('雨音');
  await page.locator('#close-settings-presets').click();await ui.control('font-size',11);await expect(page.locator('#font-size')).toHaveValue('11');
  await ui.tab('設定');await page.locator('#inspect-book').click();await page.locator('#settings-presets').click();await page.locator('#settings-preset-list').getByRole('button',{name:'再利用テスト',exact:true}).click();
  await page.locator('#settings-preset-apply').click();await ui.ready();await expect(ui.manuscript()).toHaveValue(source);await expect(page.locator('#font-size')).toHaveValue('9');
  await page.locator('#undo').click();await ui.ready();await expect(page.locator('#font-size')).toHaveValue('11');await page.locator('#redo').click();await ui.ready();await expect(page.locator('#font-size')).toHaveValue('9');
  await expect(page.locator('#save-state')).toHaveText('保存済み');await page.reload();await ui.ready();await expect(ui.manuscript()).toHaveValue(source);
  await ui.tab('設定');await page.locator('#inspect-book').click();await page.locator('#settings-presets').click();await page.locator('#settings-preset-list').getByRole('button',{name:'再利用テスト',exact:true}).click();await page.locator('#settings-preset-delete').click();await expect(page.locator('#settings-preset-list button')).toHaveCount(0);await page.locator('#settings-preset-restore').click();await expect(page.locator('#settings-preset-list button')).toHaveCount(1);
  await page.locator('#settings-preset-file').setInputFiles(settingsPath);await expect(page.locator('#settings-preset-name')).toHaveText('再利用テスト');await page.locator('#settings-preset-apply').click();await ui.ready();await expect(ui.manuscript()).toHaveValue(source);
});

test('settings file rejection leaves the book intact and works at mobile width @flow', async ({ page }) => {
  await page.setViewportSize({width:375,height:812});const ui=new BookUI(page);await page.goto('/');await ui.paste('　元の本文。');
  await ui.tab('設定');await page.locator('#inspect-book').click();await page.locator('#settings-presets').click();
  await page.locator('#settings-preset-file').setInputFiles({name:'future.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({kind:'book-settings',schemaVersion:99}))});
  await expect(page.locator('#settings-preset-message')).toContainText('未対応');await page.locator('#close-settings-presets').click();await ui.tab('原稿');await expect(ui.manuscript()).toHaveValue('　元の本文。');
  await ui.tab('設定');await page.locator('#inspect-book').click();await page.locator('#settings-presets').click();await expect(page.locator('#settings-preset-dialog')).toBeInViewport();
  await page.keyboard.press('Escape');await expect(page.locator('#settings-preset-dialog')).not.toBeVisible();
});
