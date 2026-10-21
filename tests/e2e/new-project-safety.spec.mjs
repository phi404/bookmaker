import { test, expect } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import { absolute } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';

// Regression fixture: preserve a book with ruby when a backup download is cancelled.
const source = '# 保存する本\n｜雨《あめ》の文章。';
for (const width of [1440, 320]) test(`@flow new work waits for explicit confirmation and retains the book when a download is cancelled at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:900}); await page.goto('/'); const ui=new BookUI(page); await ui.paste(source); await ui.tab('原稿');
  await page.locator('#project-home').click(); await page.locator('#file-new').click();
  const cancelled=page.waitForEvent('download'); await page.locator('#confirm-new-project').click(); await (await cancelled).cancel();
  await expect(ui.manuscript()).toHaveValue(source); await expect(page.locator('#export-dialog')).toBeVisible(); await expect(page.locator('#start-new-project')).toBeVisible(); await expect(page.locator('#export-png')).toBeHidden(); await expect(page.locator('#output-heading')).toHaveText('作業を保存');
  await page.locator('#export-name').fill('確認用'); await expect(page.locator('#start-new-project')).toBeHidden(); await expect(page.locator('#new-project-save')).toBeEnabled(); const renamed = page.waitForEvent('download'); await page.locator('#new-project-save').click(); await (await renamed).cancel(); await expect(page.locator('#start-new-project')).toBeVisible();
  await page.locator('#close-export').click(); await ui.tab('原稿'); await page.reload(); await ui.ready(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(source);
  await page.locator('#project-home').click(); await page.locator('#file-new').click(); const saved=page.waitForEvent('download'); await page.locator('#confirm-new-project').click(); const download=await saved;
  await mkdir(absolute('output/new-project-safety'),{recursive:true}); const file=absolute(`output/new-project-safety/before-new-${width}.book.json`); await download.saveAs(file); expect(JSON.parse(await readFile(file,'utf8')).source).toBe(source);
  await expect(ui.manuscript()).toHaveValue(source); await page.locator('#close-export').click(); await ui.tab('原稿'); await ui.manuscript().fill(source+'\n追加。'); await ui.ready(); await page.locator('#open-export').click(); await expect(page.locator('#start-new-project')).toBeHidden(); await expect(page.locator('#export-result')).toBeHidden(); await expect(page.locator('#export-png')).toBeVisible(); await page.locator('#close-export').click();
  await page.locator('#project-home').click(); await page.locator('#file-new').click(); const confirmed=page.waitForEvent('download'); await page.locator('#confirm-new-project').click(); await (await confirmed).saveAs(file); await page.locator('#start-new-project').click(); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(''); await ui.ready();
  await page.locator('#undo').click(); await ui.ready(); await expect(ui.manuscript()).toHaveValue(source+'\n追加。');
});
