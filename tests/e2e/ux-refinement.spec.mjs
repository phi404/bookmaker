import { test, expect } from '@playwright/test';
import { BookUI } from './ui-driver.mjs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { absolute, fingerprint, hash } from '../../scripts/lib.mjs';

async function freePage(page, ui) {
  await ui.paste('本文'); await ui.tab('原稿'); await page.locator('#tab-structure').click(); await page.locator('#add-book-item').click();
  await page.locator('#new-page-role').selectOption('layout'); await page.locator('#new-page-template').selectOption('title');
  await page.locator('#new-page-name').fill('試作タイトル'); await page.locator('#confirm-add-page').click(); await ui.ready();
}
test('@flow canvas text remains selected after direct click and double click edits the same text', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000}); await page.goto('/'); const ui = new BookUI(page); await freePage(page, ui);
  const text = page.locator('.paper [data-element-id]').first(); await text.click();
  await expect(page.locator('.selected-element-box')).toHaveCount(1);
  await text.dblclick(); await expect(page.locator('#element-text')).toBeFocused(); await expect(page.locator('#element-text')).toHaveValue('試作タイトル');
  expect(await page.evaluate(()=>{const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);return ids.filter((id,i)=>ids.indexOf(id)!==i);})).toEqual([]);
  await page.locator('.element-handle').first().click();await expect(page.locator('.selected-element-box')).toHaveCount(1);
});
test('@flow mixed range formatting is explicit and changing one property preserves other differences', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000}); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste(':::format alignment="center" fontPt="12"\n一行目\n:::\n:::format alignment="end" fontPt="14"\n二行目\n:::');
  await ui.tab('原稿'); await ui.manuscript().focus(); await ui.manuscript().press('ControlOrMeta+a'); await page.locator('#select-block-style').click(); await page.locator('#block-local-details > summary').click();
  await expect(page.locator('#block-align')).toHaveValue('__mixed__');
  await page.locator('#block-character-details > summary').click(); await expect(page.locator('#block-character-fontPt')).toHaveAttribute('placeholder','混在');
  await page.locator('#block-weight').selectOption('700'); await ui.ready();
  await expect(page.locator('#block-align')).toHaveValue('__mixed__');
  await page.locator('#block-align').selectOption(''); await ui.ready();
  await expect(page.locator('#block-align')).toHaveValue('');
  await expect(ui.manuscript()).toHaveValue(/fontPt="12"/u); await expect(ui.manuscript()).toHaveValue(/fontPt="14"/u);
  await page.locator('#selection-scope').selectOption('book');await expect(page.locator('#settings-heading')).toHaveText('すべての文章');
});
test('@flow a generated file is invalidated by editing and incomplete source explains the export block', async ({page}) => {
  await page.goto('/'); const ui = new BookUI(page); await ui.paste('本文'); await page.locator('#open-export').click();
  const pending = page.waitForEvent('download'); await page.locator('#export-png').click(); await pending;
  await expect(page.locator('#export-result')).toBeVisible(); await page.locator('#close-export').click();
  await ui.paste('本文を変更'); await page.locator('#open-export').click(); await expect(page.locator('#export-result')).toBeHidden(); await page.locator('#close-export').click();
  await ui.tab('原稿'); await ui.manuscript().fill('本文\n:::format alignment="center"\n未完'); await page.locator('#open-export').click();
  await expect(page.locator('#export-preflight')).toContainText('原稿'); await expect(page.locator('#export-png')).toBeDisabled();
  await page.locator('#export-preflight button').first().click(); await expect(page.locator('#export-dialog')).not.toBeVisible(); await expect(ui.manuscript()).toBeFocused();
});

test('@flow SNS presets export at the chosen pixel size and the close action stays visible on mobile', async ({page}) => {
  await page.setViewportSize({width:375,height:812});await page.goto('/');const ui=new BookUI(page);await ui.paste('雨の朝。\n小さな本の一頁。');
  await ui.control('page-layout','uniform');await ui.tab('設定');await page.locator('#image-preset').selectOption('portrait');await ui.ready();
  await expect(page.locator('#font-pt')).toHaveValue('16');await ui.tab('プレビュー');await expect(page.locator('#format-label')).toContainText('1080 × 1350');
  const file=absolute('output/ux-improvements-2026-10-19/sns-test.png');await ui.download('export-png',file);const png=await readFile(file);expect([png.readUInt32BE(16),png.readUInt32BE(20)]).toEqual([1080,1350]);
  await page.locator('#open-export').click();await page.locator('#export-dialog').evaluate(e=>{e.scrollTop=e.scrollHeight;});await expect(page.locator('#close-export')).toBeInViewport();
  const bounds=await page.locator('#close-export').boundingBox();expect(bounds.y).toBeGreaterThanOrEqual(0);expect(bounds.y+bounds.height).toBeLessThan(812);await page.locator('#close-export').click();
  await ui.tab('設定');await page.locator('#page-layout').selectOption('book');await ui.ready();await expect(page.locator('#page-layout')).toHaveValue('book');await expect(page.locator('#folio-enabled')).toBeChecked();await ui.tab('原稿');await expect(ui.manuscript()).toHaveValue('雨の朝。\n小さな本の一頁。');
});

test('@flow project menu saves before new work and the saved file restores the original book', async ({page}) => {
  await page.goto('/');const ui=new BookUI(page);const source='# 保存する本\n｜雨《あめ》の文章。';await ui.paste(source);
  await ui.manuscript().press('ControlOrMeta+s');await expect(page.locator('#export-dialog')).toBeVisible();await expect(page.locator('#export-result')).toBeVisible();await page.locator('#close-export').click();
  await page.locator('#project-home').click();await page.locator('#file-new').click();await expect(page.locator('#new-project-dialog')).toBeVisible();
  const pending=page.waitForEvent('download');await page.locator('#confirm-new-project').click();const downloaded=await pending;const file=absolute('output/ux-improvements-2026-10-19/before-new.book.json');await downloaded.saveAs(file);
  await expect(ui.manuscript()).toHaveValue('');await ui.ready();await ui.importTxt(file);await expect(ui.manuscript()).toHaveValue(source);
  const restored=JSON.parse(await readFile(file,'utf8'));expect(restored.source).toBe(source);expect(restored.schemaVersion).toBe(3);
});

test('@flow compact desktop reserves paper space for the inspector and restores the previous pane', async ({page}) => {
  await page.setViewportSize({width:1024,height:800});await page.goto('/');const ui=new BookUI(page);await ui.paste('# 章\n本文。');
  await page.locator('#toggle-right').click();await expect(page.locator('#workspace')).toHaveAttribute('data-left-open','false');
  const paper=await page.locator('.paper:not(.blank)').first().boundingBox(),inspector=await page.locator('.settings-panel').boundingBox();expect(paper.x+paper.width).toBeLessThanOrEqual(inspector.x);
  await page.reload();await ui.ready();await expect(page.locator('#workspace')).toHaveAttribute('data-left-open','false');
  await page.locator('#close-right').click();await expect(page.locator('#workspace')).toHaveAttribute('data-left-open','true');await expect(ui.manuscript()).toBeVisible();
});

test('@flow overflowing text blocks export until reviewed and the issue jumps to the actual element', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);await freePage(page,ui);
  await page.locator('.element-list button').first().click();await page.locator('#element-text').fill('長い文章。'.repeat(100));await ui.ready();await page.locator('#open-export').click();
  await expect(page.locator('#export-png')).toBeDisabled();await expect(page.locator('#export-preflight')).toContainText('テキストが枠');await page.locator('#export-issues button').first().click();
  await expect(page.locator('#element-text')).toHaveValue('長い文章。'.repeat(100));await expect(page.locator('.selected-element-box')).toHaveCount(1);
  await page.locator('#open-export').click();await page.locator('#export-accept-loss').check();await expect(page.locator('#export-png')).toBeEnabled();await page.locator('#close-export').click();
  await page.locator('#element-text').fill('短い文章');await ui.ready();await page.locator('#open-export').click();await expect(page.locator('#export-preflight')).toBeHidden();await expect(page.locator('#export-accept-loss')).not.toBeChecked();
});

test('@flow PDF range insertion, multiple imports and replacement preserve page references through JSON recovery', async ({page}) => {
  const {PDFDocument}=await import('../../public/vendor/pdf-lib.js'),pdf=await PDFDocument.create();for(let i=0;i<3;i++){const sheet=pdf.addPage([300,420]);sheet.drawText(`PDF ${i+1}`);}
  const original=Buffer.from(await pdf.save());await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);await ui.paste('本文');await ui.tab('原稿');await page.locator('#tab-assets').click();
  const image=await readFile(absolute('fixtures/book/local-page.svg'));
  await page.locator('#asset-file').setInputFiles([{name:'three.pdf',mimeType:'application/pdf',buffer:original},{name:'image.svg',mimeType:'image/svg+xml',buffer:image}]);await expect(page.locator('.asset-card')).toHaveCount(2);
  await page.locator('.asset-card').first().getByRole('button',{name:'ページとして挿入'}).click();await page.locator('#asset-insert-from').fill('2');await page.locator('#confirm-asset-insert').click();await ui.ready();
  await expect(page.locator('.outline-row[data-kind=special]')).toHaveCount(2);await expect(ui.preview().locator('[data-testid=folio]')).toHaveCount(0);
  await ui.tab('原稿');await page.locator('#tab-assets').click();await page.locator('.asset-card').first().getByText('管理',{exact:true}).click();await page.locator('.asset-card').first().getByRole('button',{name:'差し替える…'}).click();
  const replacement=await PDFDocument.load(original);replacement.getPage(0).drawText('UPDATED',{y:50});
  await page.locator('#asset-file').setInputFiles({name:'replacement.pdf',mimeType:'application/pdf',buffer:Buffer.from(await replacement.save())});await expect(page.locator('.asset-card').first()).toContainText('replacement.pdf');
  await mkdir(absolute('output/ux-improvements-2026-10-19'),{recursive:true});const file=absolute('output/ux-improvements-2026-10-19/assets-test.book.json');await ui.download('export-project',file);const book=JSON.parse(await readFile(file,'utf8'));
  expect(book.specialPages.map(p=>p.assetPage)).toEqual([2,3]);expect(book.specialPages.every(p=>p.assetId===book.assets[0].id)).toBe(true);expect(book.assets).toHaveLength(2);
  await page.reload();await ui.ready();await expect(page.locator('.outline-row[data-kind=special]')).toHaveCount(2);await writeFile(absolute('output/ux-improvements-2026-10-19/assets-result.json'),JSON.stringify({pages:book.specialPages.length,assets:book.assets.length,preservedReferences:true}));
});

test('@flow command editing keeps the manuscript selection and resolved draft errors disappear after undo', async ({page}) => {
  await page.goto('/');const ui=new BookUI(page);await ui.paste('最初\n中央にする\n最後');await ui.tab('原稿');await ui.manuscript().evaluate(e=>{const at=e.value.indexOf('中央');e.focus();e.setSelectionRange(at,at+6);});
  await ui.manuscript().press('ControlOrMeta+k');await page.locator('#command-search').fill('中央揃え');await page.locator('#command-search').press('Enter');await ui.ready();await expect(ui.manuscript()).toHaveValue(/alignment="center"\n中央にする/u);
  await ui.tab('原稿');await ui.manuscript().fill(':::format alignment="center"\n未完');await expect(page.locator('#notice')).toBeVisible();await page.locator('#undo').click();await ui.ready();await expect(page.locator('#notice')).toBeHidden();
});

test('@flow canvas multi-selection supports shared movement, locked elements and one-step undo', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);await freePage(page,ui);
  await page.locator('#add-element-text').click();await page.locator('#element-text').fill('二つ目');await ui.ready();
  await page.locator('.paper [data-element-id]').first().click();await page.locator('.paper [data-element-id]').nth(1).click({modifiers:['Shift']});await expect(page.locator('.selected-element-box')).toHaveCount(2);
  await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');const before=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')).project.specialPages.at(-1).elements);
  await page.locator('.paper[data-editing=true]').press('ArrowRight');await ui.ready();await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');
  const after=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')).project.specialPages.at(-1).elements);expect(after.map(e=>e.xMm)).toEqual(before.map(e=>e.xMm+1));
  await page.locator('#undo').click();await ui.ready();await expect(page.locator('#save-state')).toHaveAttribute('data-state','saved');expect(await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')).project.specialPages.at(-1).elements)).toEqual(before);
  await page.locator('.paper [data-element-id]').first().click();await page.locator('#lock-element').click();await ui.ready();await page.locator('.paper[data-editing=true]').press('ControlOrMeta+a');await expect(page.locator('.selected-element-box')).toHaveCount(2);
  await page.locator('.paper[data-editing=true]').press('Delete');await expect(page.locator('#notice-text')).toContainText('固定');await expect(page.locator('.paper [data-element-id]')).toHaveCount(2);
});

test('@flow right-bound spread exports the correct image half on each physical page', async ({page}) => {
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);await ui.paste('見開きの前。');await ui.tab('原稿');await page.locator('#tab-assets').click();
  await page.locator('#asset-file').setInputFiles(absolute('fixtures/book/spread-colors.svg'));await expect(page.locator('.asset-card')).toHaveCount(1);await page.locator('.asset-card').getByRole('button',{name:'ページとして挿入'}).click();await ui.ready();
  await page.locator('#special-image-mode').selectOption('spread');await ui.ready();await page.locator('#special-fit').selectOption('cover');await ui.ready();expect(await ui.pageCount()).toBe(3);await page.locator('#view-spread').click();await page.locator('#page-select').fill('2');
  const dir='output/ux-spread';await mkdir(absolute(dir),{recursive:true});await ui.download('export-png',absolute(dir+'/page-002.png'));await ui.download('export-pdf',absolute(dir+'/book.pdf'));await ui.download('export-png-all',absolute(dir+'/pages.zip'));await ui.download('export-spread',absolute(dir+'/spread.png'));await ui.download('export-project',absolute(dir+'/book.book.json'));
  const book=JSON.parse(await readFile(absolute(dir+'/book.book.json'),'utf8'));
  await writeFile(absolute(dir+'/manifest.json'),JSON.stringify({schemaVersion:1,phase:'mvp',sourceFingerprint:await fingerprint(),inputSha256:hash(book.source),expectedPages:3,pngPageNumber:2,dpi:300,pageMm:[105,148],png:'page-002.png',pdf:'book.pdf',zip:'pages.zip',spread:'spread.png',spreadPages:{left:3,right:2},colorSamples:[{page:2,position:[.5,.8],rgb:[69,111,210]},{page:3,position:[.5,.8],rgb:[217,80,80]}]},null,2));
  await page.screenshot({path:absolute(dir+'/workspace.png')});
});

test('@flow mobile free page multi-selection and alignment work without modifier keys', async ({page}) => {
  await page.setViewportSize({width:320,height:812});await page.goto('/');const ui=new BookUI(page);await freePage(page,ui);await page.locator('#add-element-text').click();await page.locator('#element-text').fill('二つ目');await ui.ready();
  await page.locator('.element-row input[type=checkbox]').nth(1).check();await expect(page.locator('#context-inspector')).toContainText('2要素を選択');await page.getByRole('button',{name:'左右中央',exact:true}).click();await ui.ready();
  await ui.tab('プレビュー');await expect(page.locator('.selected-element-box')).toHaveCount(2);expect(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test('@flow deleting a selected manuscript range clears its stale editing target', async ({page}) => {
  await page.goto('/');const ui=new BookUI(page);await ui.paste('# 章\n残す段落\n消す一\n消す二');await ui.tab('原稿');await ui.manuscript().evaluate(e=>{e.focus();e.setSelectionRange(e.value.indexOf('消す一'),e.value.length);});await page.locator('#select-block-style').click();await expect(page.locator('#settings-heading')).toHaveText('選択範囲');
  await ui.tab('原稿');await ui.manuscript().fill('# 章\n残す段落');await ui.ready();await expect(page.locator('#inspect-selection')).toBeDisabled();await expect(page.locator('#block-inspector')).toBeHidden();
});

test('@flow ruby validation resets when reopened for a new selection', async ({page}) => {
  await page.goto('/');const ui=new BookUI(page);await ui.paste('薔薇と雨');await ui.tab('原稿');await ui.manuscript().focus();await ui.manuscript().press('ControlOrMeta+Home');await page.locator('[data-insert=ruby]').click();await page.locator('#apply-insert').click();await expect(page.locator('#insert-help')).toContainText('親文字と読みを入れて');await page.locator('#close-insert').click();
  await ui.manuscript().evaluate(e=>{e.focus();e.setSelectionRange(0,2);});await page.locator('[data-insert=ruby]').click();await expect(page.locator('#insert-help')).toHaveText('選択した本文に読みを付けます。');
});
