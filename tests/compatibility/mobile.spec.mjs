/* global document */
import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {absolute,fingerprint} from '../../scripts/lib.mjs';
import {BookUI} from '../e2e/ui-driver.mjs';

test('touch selection, local recovery and PNG/PDF saving preserve mobile manuscript',async({page,context,browser},testInfo)=>{
  const source=await readFile(absolute('fixtures/book/mobile-typography.md'),'utf8'),folder=absolute('output/mobile-typography/'+testInfo.project.name);await mkdir(folder,{recursive:true});
  const failures=[];page.on('pageerror',error=>failures.push(error.message));await page.goto('/');const ui=new BookUI(page);await ui.paste(source);
  await page.locator('[data-vertical-glyph="、"]').first().tap();await page.locator('#open-paper-source').tap();expect(await ui.manuscript().evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('、');
  await expect(page.locator('#save-state')).toHaveText('保存済み');await page.reload();await ui.ready();await ui.tab('原稿');await expect(ui.manuscript()).toHaveValue(source);
  await context.setOffline(true);await ui.manuscript().fill(source+'\n端末内で追記。');await ui.ready();await expect(page.locator('#save-state')).toHaveText('保存済み');await context.setOffline(false);await ui.tab('プレビュー');
  await ui.download('export-project',folder+'/book.json');await ui.download('export-png',folder+'/page.png');await ui.download('export-pdf',folder+'/book.pdf');
  expect(JSON.parse(await readFile(folder+'/book.json','utf8')).source).toBe(source+'\n端末内で追記。');
  const {PDFDocument}=await import('../../public/vendor/pdf-lib.js'),pdf=await PDFDocument.load(await readFile(folder+'/book.pdf'));expect(pdf.getPageCount()).toBe(await ui.pageCount());
  expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);expect(failures).toEqual([]);await page.screenshot({path:folder+'/touch.png',fullPage:true});await writeFile(folder+'/touch.json',JSON.stringify({fingerprint:await fingerprint(),browser:browser.version(),realDevice:false,failures},null,2));
});
