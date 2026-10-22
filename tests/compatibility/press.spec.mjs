import { test, expect } from '@playwright/test';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { PDFDocument } from '../../public/vendor/pdf-lib.js';
import { absolute, fingerprint } from '../../scripts/lib.mjs';
import { BookUI } from '../e2e/ui-driver.mjs';
test('structure menu, icon formatting and monochrome print PDF work on desktop and narrow layouts',async({page,browserName})=>{
  await page.goto('/');const ui=new BookUI(page);
  for(const width of [1440,320]){
    await page.setViewportSize({width,height:900});await ui.paste('# 章\n保存する本文。');await ui.tab('原稿');await page.locator('#tab-structure').click();
    await page.getByRole('button',{name:'章の操作',exact:true}).click();await expect(page.getByRole('menu',{name:'構成の操作'})).toBeVisible();await page.getByRole('menuitem',{name:'複製',exact:true}).click();await ui.ready();await expect(page.locator('.outline-row[data-kind=chapter]')).toHaveCount(2);
    await page.getByRole('button',{name:'章の複製の操作',exact:true}).click();await page.getByRole('menuitem',{name:'削除',exact:true}).click();await ui.ready();await expect(page.locator('.outline-row[data-kind=chapter]')).toHaveCount(1);
  }
  await ui.tab('原稿');await ui.manuscript().press('ControlOrMeta+a');await page.locator('#select-block-style').click();await page.locator('#block-align').getByRole('button',{name:'中央揃え',exact:true}).click();await ui.ready();expect(await page.locator('#manuscript').inputValue()).toContain('alignment="center"');
  await page.locator('#open-export').click();await page.locator('#export-pdf-preset').selectOption('mono');await ui.ready();await page.locator('#close-export').click();
  const dir=absolute('output/press-2026-10-22');await mkdir(dir,{recursive:true});const file='compat-'+browserName+'.pdf';await ui.download('export-pdf',dir+'/'+file);
  const pdf=await PDFDocument.load(await readFile(dir+'/'+file));expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(111*72/25.4,6);expect(pdf.getPage(0).getHeight()).toBeCloseTo(154*72/25.4,6);
  await writeFile(dir+'/compat-'+browserName+'.json',JSON.stringify({sourceFingerprint:await fingerprint(),file,pages:1}));
});
