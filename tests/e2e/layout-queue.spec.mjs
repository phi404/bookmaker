import {test,expect} from '@playwright/test';
import {BookUI} from './ui-driver.mjs';

test('slow worker replies coalesce pending edits and the newest layout alone becomes ready @flow',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=globalThis.Worker;globalThis.layoutQueueFixture={sent:0,delay:0};
    globalThis.Worker=class extends NativeWorker{
      constructor(url,options){super(url,options);this.book=String(url).includes('typesetter.worker');}
      postMessage(...args){if(this.book)globalThis.layoutQueueFixture.sent++;return super.postMessage(...args);}
      set onmessage(handler){super.onmessage=event=>{if(this.book)setTimeout(()=>handler(event),globalThis.layoutQueueFixture.delay);else handler(event);};}
    };
  });
  const ui=new BookUI(page);await page.goto('/');await ui.paste('　元の本文。');await ui.tab('原稿');await page.evaluate(()=>{globalThis.layoutQueueFixture.sent=0;globalThis.layoutQueueFixture.delay=1200;});
  for(const value of ['一','二','三','最後']){await ui.manuscript().fill(`　${value}の本文。`);await page.waitForTimeout(220);}
  await ui.ready();expect(await page.evaluate(()=>globalThis.layoutQueueFixture.sent)).toBe(2);
  const text=await page.locator('[data-body="text"]').allTextContents();expect(text.join('')).toBe('　最後の本文。');await expect(ui.manuscript()).toHaveValue('　最後の本文。');
});

test('asset controls survive background layout without losing focus or an open menu @flow',async({page})=>{
  await page.addInitScript(()=>{
    const NativeWorker=globalThis.Worker;globalThis.assetLayoutFixture={hold:false,pending:[],release(){this.hold=false;for(const resume of this.pending.splice(0))resume();}};
    globalThis.Worker=class extends NativeWorker{
      constructor(url,options){super(url,options);this.book=String(url).includes('typesetter.worker');}
      set onmessage(handler){super.onmessage=event=>{if(this.book&&globalThis.assetLayoutFixture.hold)globalThis.assetLayoutFixture.pending.push(()=>handler(event));else handler(event);};}
    };
  });
  await page.setViewportSize({width:1440,height:1000});await page.goto('/');const ui=new BookUI(page);await ui.paste('# 本文\n元の原稿。');
  const {PDFDocument}=await import('../../public/vendor/pdf-lib.js'),pdf=await PDFDocument.create();pdf.addPage([200,280]).drawText('ONE');pdf.addPage([200,280]).drawText('TWO');
  await page.locator('#tab-assets').click();await page.locator('#asset-file').setInputFiles({name:'two-pages.pdf',mimeType:'application/pdf',buffer:Buffer.from(await pdf.save())});await expect(page.locator('.asset-card')).toHaveCount(1);await ui.ready();
  await page.evaluate(()=>{globalThis.assetLayoutFixture.hold=true;});await page.locator('#page-size').selectOption('b6');await expect.poll(()=>page.evaluate(()=>globalThis.assetLayoutFixture.pending.length)).toBeGreaterThan(0);
  const manage=page.locator('.asset-card details'),insert=page.locator('.asset-card').getByRole('button',{name:'ページとして挿入',exact:true});await manage.locator('summary').click();await insert.focus();await page.evaluate(()=>globalThis.assetLayoutFixture.release());await ui.ready();
  await expect(manage).toHaveAttribute('open','');await expect(insert).toBeFocused();await insert.click();await expect(page.locator('#asset-insert-dialog')).toBeVisible();await page.locator('#confirm-asset-insert').click();await ui.ready();expect(await ui.pageCount()).toBe(3);
});
