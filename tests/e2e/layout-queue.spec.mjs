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
