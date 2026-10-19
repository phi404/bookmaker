import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { absolute, fingerprint, hash } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';
const KEY='bookmaker-slice-draft-v1';
const draft=async page=>{await expect(page.getByTestId('save-state')).toHaveAttribute('data-state','saved');return await page.evaluate(async key=>{const saved=JSON.parse(globalThis.localStorage.getItem(key));if(saved.storage!=='indexedDB')return saved.project;const db=await new Promise((resolve,reject)=>{const req=globalThis.indexedDB.open('bookmaker-local-books',1);req.onsuccess=()=>resolve(req.result);req.onerror=reject;});return await new Promise((resolve,reject)=>{const req=db.transaction('drafts').objectStore('drafts').get('current');req.onsuccess=()=>{db.close();resolve(req.result.project);};req.onerror=reject;});},KEY);};
async function pickChapter(page,ui,index){await ui.tab('原稿');await page.locator('#tab-structure').click();await page.locator('.outline-row[data-kind=chapter]').nth(index).click();}
for(const width of [1440,375])test(`@flow selected character formatting, reset, format and horizontal two-column body ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:width===1440?1000:812});await page.goto('/');const ui=new BookUI(page);
  await ui.paste('｜薔薇《ばら》とHTML、12と2026。');await ui.tab('原稿');
  await ui.manuscript().evaluate(editor=>{const at=editor.value.indexOf('HTML');editor.focus();editor.setSelectionRange(at,at+4);});await page.locator('#character-format').click();
  await expect(page.locator('#character-dialog')).toBeVisible();
  const contrast=await page.locator('#apply-character').evaluate(button=>{
    const rgb=color=>color.match(/[\d.]+/gu).map(Number), luminance=values=>values.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
    const style=globalThis.getComputedStyle(button),foreground=luminance(rgb(style.color)),raw=rgb(style.backgroundColor),background=luminance(raw[3]===0?rgb(globalThis.getComputedStyle(button.closest('dialog')).backgroundColor):raw);
    return (Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
  });expect(contrast).toBeGreaterThanOrEqual(4.5);
  await page.locator('#selected-character-orientation').selectOption('upright');await page.locator('#selected-character-emphasis').selectOption('circle');await page.locator('#apply-character').click();await ui.tab('プレビュー');await ui.ready();
  await expect(ui.preview().locator('[data-orientation=upright]')).not.toHaveCount(0);await expect(ui.preview().locator('[data-emphasis=circle]')).toHaveCount(4);await expect(ui.preview().locator('[data-tcy=true]')).toHaveText('12');
  const saved=await draft(page);expect(saved.source).toContain('[HTML]{orientation="upright" emphasis="circle"}');expect(saved.source).toContain('｜薔薇《ばら》');
  await page.reload();await ui.ready();await ui.tab('原稿');await ui.manuscript().evaluate(editor=>{const at=editor.value.indexOf('[HTML]'),to=editor.value.indexOf('}',at)+1;editor.focus();editor.setSelectionRange(at,to);});
  await page.locator('#character-format').click();await page.locator('#reset-character').click();await expect(ui.manuscript()).toHaveValue('｜薔薇《ばら》とHTML、12と2026。');
  await ui.tab('設定');await page.getByTestId('page-size').selectOption('custom');await page.getByTestId('page-width').fill('150');await page.getByTestId('page-width').blur();await page.getByTestId('page-height').fill('210');await page.getByTestId('page-height').blur();await ui.tab('プレビュー');await ui.ready();
  const custom=await draft(page);expect(custom.style.page).toEqual({widthMm:150,heightMm:210});expect(await ui.preview().locator('svg').first().getAttribute('width')).toBe('150mm');
  await ui.tab('設定');await page.getByTestId('page-width').fill('149.5');await page.getByTestId('page-width').blur();await ui.ready();expect((await draft(page)).style.page).toEqual({widthMm:149.5,heightMm:210});
  await ui.control('page-size','square');await ui.control('page-layout','uniform');await expect(ui.preview().locator('svg')).toHaveAttribute('width','140mm');await expect(ui.preview().locator('[data-testid=folio]')).toHaveCount(0);
  await ui.tab('設定');await page.locator('#detail-layout > summary').click();await page.locator('#page-writing').selectOption('horizontal-tb');await page.locator('#page-columns').selectOption('2');
  await ui.paste('横書きの本文。'.repeat(600));const p=await draft(page);expect(p.style.writingMode).toBe('horizontal-tb');expect(p.style.columns).toBe(2);expect(await ui.pageCount()).toBeGreaterThan(1);
  expect(await ui.preview().locator('[data-body]').first().getAttribute('writing-mode')).toBe('horizontal-tb');expect(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth+1)).toBe(false);
});

test('@flow chapter page style, named heading styles, anchored overrides and reflow',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page),source='# 一章\n最初。\n---\n# 二章\n対象の本文。\n---\n# 三章\n最後。';await ui.paste(source);
  await pickChapter(page,ui,1);await page.getByText('章全体の書式',{exact:true}).click();await page.locator('#chapter-page-style').selectOption('horizontal-page');await ui.ready();
  await expect(ui.preview().locator('[data-page-number="2"] [data-body]').first()).toHaveAttribute('writing-mode','horizontal-tb');await page.getByRole('button',{name:'この章の柱を設定',exact:true}).click();await page.getByTestId('running-position').selectOption('top-center');
  const prior=await draft(page),section=prior.document.children[1].id;await ui.paste(prior.source.replace('最初。','追加本文。'.repeat(450)));const next=await draft(page);expect(next.document.children[1].id).toBe(section);expect(next.document.children[1].localStyle.pageStyleId).toBe('horizontal-page');expect(next.runningElements[0].scope).toEqual({kind:'section',sectionId:section});
  await ui.tab('原稿');await ui.manuscript().evaluate(e=>{const at=e.value.indexOf('対象の本文');e.focus();e.setSelectionRange(at,at);});await page.locator('#select-block-style').click();await page.locator('#block-local-details > summary').click();await page.locator('#block-align').selectOption('end');
  await page.locator('#selection-scope').selectOption('until');await page.locator('#block-align').selectOption('end');await ui.ready();
  const scoped=await draft(page);expect(scoped.source).toContain('alignment="end"');expect(scoped.document.children[1].children.find(b=>b.kind==='paragraph').localStyle.paragraph.alignment).toBe('end');expect(scoped.document.children[2].children.find(b=>b.kind==='paragraph').localStyle).toBeUndefined();
  await ui.tab('設定');await page.locator('#inspect-styles').click();await page.locator('#shared-styles > summary').click();await page.locator('#style-family').selectOption('headings');await page.locator('#style-entry').selectOption('chapter');await page.locator('#style-beforeEm').fill('1');await page.locator('#style-beforeEm').blur();
  const style=await draft(page);expect(style.styles.headings.find(s=>s.id==='chapter').properties.beforeEm).toBe(1);await page.reload();await ui.ready();expect((await draft(page)).styles.headings.find(s=>s.id==='chapter').properties.beforeEm).toBe(1);
  await ui.tab('設定');await page.locator('#inspect-styles').click();await page.locator('#shared-styles > summary').click();await page.locator('#style-family').selectOption('headings');await page.locator('#style-entry').selectOption('chapter');await page.locator('#reset-shared-style').click();
  expect((await draft(page)).styles.headings.find(s=>s.id==='chapter').properties.beforeEm).toBeUndefined();
  await page.locator('#style-family').selectOption('pages');await page.locator('#style-entry').selectOption('horizontal-page');await page.locator('#reset-shared-style').click();
  const resetPage=(await draft(page)).styles.pages.find(s=>s.id==='horizontal-page');expect(resetPage.properties).toEqual({writingMode:'horizontal-tb'});expect(Object.hasOwn(resetPage,'characterStyleId')).toBe(false);
  await page.locator('#style-family').selectOption('characters');await page.locator('#reset-shared-style').click();expect((await draft(page)).styles.characters.find(s=>s.id==='text').properties).toEqual({fontWeight:400,numbers:'auto'});
});

test('@flow image modes, free alignment and A5 mixed-direction exports share pages',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);
  const source='# 第一章\n　｜薔薇《ばら》と[HTML]{orientation="upright"}、12、[2026]{numbers="kanji"}。\n　*圏点*と[白丸]{.circle}、[三角]{.triangle}。――長音のコーヒー。\n---\n# 第二章\n'+ '横書き二段組の本文。'.repeat(170)+'\n:::colophon id="colophon"\n# 第三章\n　通常の縦書きに戻る。';
  await ui.paste(source);await ui.control('page-size','a5');await pickChapter(page,ui,1);await page.getByText('章全体の書式',{exact:true}).click();await page.getByTestId('chapter-page-style').selectOption('horizontal-page');
  await page.getByText('この章だけの版面',{exact:true}).click();await page.locator('#chapter-page-columns').selectOption('2');await ui.ready();const book=await draft(page);expect(book.document.children[1].localStyle.page.columns).toBe(2);
  await ui.tab('原稿');await page.locator('#tab-structure').click();await page.locator('.outline-row[data-item-id=colophon]').click();await page.getByTestId('special-title').fill('書式の例外');await page.getByTestId('special-author').fill('組版確認');await ui.ready();
  await mkdir(absolute('output/exceptions'),{recursive:true});await page.getByTestId('page-select').fill('1');await ui.download('export-png',absolute('output/exceptions/page-001.png'));await ui.download('export-pdf',absolute('output/exceptions/book.pdf'));await ui.download('export-png-all',absolute('output/exceptions/pages.zip'));await page.getByTestId('page-select').fill('2');await ui.download('export-spread',absolute('output/exceptions/spread.png'));await ui.download('export-project',absolute('output/exceptions/project.book.json'));
  const expectedPages=await ui.pageCount();expect(expectedPages).toBe(5);const output=JSON.parse(await readFile(absolute('output/exceptions/project.book.json'),'utf8'));
  await writeFile(absolute('output/exceptions/manifest.json'),JSON.stringify({schemaVersion:1,phase:'mvp',sourceFingerprint:await fingerprint(),inputSha256:hash(output.source),pageMm:[148,210],expectedPages,pngPageNumber:1,dpi:300,png:'page-001.png',pdf:'book.pdf',zip:'pages.zip',spread:'spread.png',spreadPages:{left:3,right:2}},null,2));
  await ui.tab('原稿');await page.locator('#tab-assets').click();await page.locator('#asset-file').setInputFiles(absolute('fixtures/book/local-page.svg'));await expect(page.locator('.asset-card')).toHaveCount(1);await page.locator('.asset-card').getByRole('button',{name:'ページとして挿入'}).click();await ui.ready();
  await page.getByTestId('special-image-mode').selectOption('flow');await ui.ready();await expect(ui.preview().locator('[data-image-placement=flow]')).toHaveCount(1);const withImage=await draft(page),id=withImage.specialPages.at(-1).id;
  await page.getByTestId('special-image-mode').selectOption('spread');await ui.ready();expect((await draft(page)).specialPages.at(-1).imageMode).toBe('spread');await page.getByTestId('special-image-mode').selectOption('bleed');await ui.ready();await expect(page.locator('[data-image-info]')).toContainText('塗り足し想定 3 mm');
  await ui.tab('原稿');await page.locator('#tab-structure').click();await page.locator('.outline-row[data-item-id=colophon]').click();await page.getByText('詳細 / 自由ページへ',{exact:true}).click();await page.locator('#convert-free').click();await page.locator('.element-list button').first().click();
  await page.getByText('位置と大きさ / mm',{exact:true}).click();await page.locator('#align-center-x').click();const free=await draft(page),p=free.specialPages.find(p=>p.id==='colophon'),e=p.elements.at(-1);expect(e.xMm).toBe((148-e.widthMm)/2);expect(free.specialPages.some(p=>p.id===id)).toBe(true);expect(free.source).not.toContain('xMm');
  await page.screenshot({path:absolute('output/exceptions/free-page.png')});
});

test('@visual A5 chapter inspector, mixed-direction pages and manuscript at 1440px',async({page})=>{
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);
  await ui.paste('# 第一章\n　｜薔薇《ばら》が咲く。12月の[HTML]{orientation="upright"}。\n　*強調*と[圏点]{.circle}。――まだ、コーヒーは温かい。\n---\n# 第二章\n'+ '横書きの手紙。'.repeat(220));await ui.control('page-size','a5');
  await pickChapter(page,ui,1);await page.getByText('章全体の書式',{exact:true}).click();await page.getByTestId('chapter-page-style').selectOption('horizontal-page');await ui.ready();
  await draft(page);
  await expect(page).toHaveScreenshot('a5-chapter-inspector.png',{maxDiffPixels:0,animations:'disabled'});
  await page.locator('#close-right').click();await page.locator('#tab-source').click();await page.getByTestId('page-select').fill('1');await page.getByTestId('view-single').click();await ui.ready();await draft(page);
  await ui.manuscript().evaluate(e=>{e.setSelectionRange(0,0);e.scrollTop=0;e.blur();});await expect(page).toHaveScreenshot('a5-manuscript-single.png',{maxDiffPixels:0,animations:'disabled'});
});
