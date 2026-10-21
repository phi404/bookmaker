import {test,expect} from '@playwright/test';
import {BookUI} from './ui-driver.mjs';
import {absolute} from '../../scripts/lib.mjs';

test('a stale tab cannot silently overwrite the newer saved manuscript @flow',async({page,context})=>{
  const first=new BookUI(page);await page.goto('/');await first.paste('　最初の原稿。');await expect(page.locator('#save-state')).toHaveText('保存済み');
  const other=await context.newPage(),second=new BookUI(other);await other.goto('/');await second.ready();await second.tab('原稿');await expect(second.manuscript()).toHaveValue('　最初の原稿。');await expect(other.locator('#save-state')).toHaveText('保存済み');
  await first.tab('原稿');await first.manuscript().fill('　新しい原稿。');await first.ready();await expect(page.locator('#save-state')).toHaveText('保存済み');
  await second.manuscript().fill('　古いタブで変更した原稿。');await second.ready();await expect(other.locator('#save-state')).toHaveText('保存を停止');await expect(other.locator('#notice-text')).toContainText('別のタブ');
  await page.reload();await first.ready();await first.tab('原稿');await expect(first.manuscript()).toHaveValue('　新しい原稿。');await expect(second.manuscript()).toHaveValue('　古いタブで変更した原稿。');
});

test('quota failure retains the earlier committed draft and the current in-memory draft @flow',async({page})=>{
  const ui=new BookUI(page);await page.goto('/');await ui.paste('　保存済みの原稿。');await expect(page.locator('#save-state')).toHaveText('保存済み');
  await page.evaluate(()=>{const original=globalThis.Storage.prototype.setItem;globalThis.Storage.prototype.setItem=function(key,value){if(key==='bookmaker-slice-draft-v1')throw new globalThis.DOMException('quota fixture','QuotaExceededError');return original.call(this,key,value);};});
  await ui.tab('原稿');await ui.manuscript().fill('　保存容量が足りないときの入力。');await ui.ready();await expect(page.locator('#save-state')).toHaveText('保存できません');await expect(ui.manuscript()).toHaveValue('　保存容量が足りないときの入力。');
  await page.reload();await ui.ready();await ui.tab('原稿');await expect(ui.manuscript()).toHaveValue('　保存済みの原稿。');
});

test('asset snapshots commit by pointer so failed pointer writes keep the previous book recoverable @flow',async({page})=>{
  const ui=new BookUI(page);await page.goto('/');await ui.paste('　素材と保存した本文。');await ui.tab('原稿');await page.locator('#tab-assets').click();await page.locator('#asset-file').setInputFiles(absolute('fixtures/book/local-page.svg'));await expect(page.locator('.asset-card')).toHaveCount(1);await expect(page.locator('#save-state')).toHaveText('保存済み');
  const pointer=await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')));expect(pointer.snapshot).toMatch(/^snapshot-/u);
  await page.evaluate(()=>{const original=globalThis.Storage.prototype.setItem;globalThis.Storage.prototype.setItem=function(key,value){if(key==='bookmaker-slice-draft-v1')throw new globalThis.DOMException('interrupted commit fixture','QuotaExceededError');return original.call(this,key,value);};});
  await ui.tab('原稿');await ui.manuscript().fill('　保存が中断された新しい本文。');await ui.ready();await expect(page.locator('#save-state')).toHaveText('保存できません');expect(await page.evaluate(()=>JSON.parse(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')))).toEqual(pointer);
  await page.reload();await ui.ready();await ui.tab('原稿');await expect(ui.manuscript()).toHaveValue('　素材と保存した本文。');await page.locator('#tab-assets').click();await expect(page.locator('.asset-card')).toHaveCount(1);
});

test('a recovery journal based on an older save remains editable without replacing another tab work @flow',async({page})=>{
  const {createBook}=await import('../../dist/domain/book.js');
  const old={schemaVersion:3,project:createBook('　元の保存。'),marginOffset:0},current={...old,project:createBook('　別のタブで確定した本文。')},pending={...old,project:createBook('　再読み込み前の未保存の入力。')};
  const raw=JSON.stringify(current),key='bookmaker-draft-recovery-fixture';
  await page.addInitScript(({raw,key,entry})=>{if(globalThis.localStorage.getItem('bookmaker-slice-draft-v1')===null){globalThis.localStorage.setItem('bookmaker-slice-draft-v1',raw);globalThis.localStorage.setItem(key,JSON.stringify(entry));globalThis.sessionStorage.setItem('bookmaker-active-recovery',key);}}, {raw,key,entry:{schemaVersion:1,owner:'previous-page',order:2,base:JSON.stringify(old),draft:pending}});
  const ui=new BookUI(page);await page.goto('/');await ui.ready();await ui.tab('原稿');await expect(ui.manuscript()).toHaveValue(pending.project.source);await expect(page.locator('#save-state')).toHaveText('保存を停止');await expect(page.locator('#notice-text')).toContainText('別のタブ');
  await ui.manuscript().fill('　復旧した入力をさらに修正。');await ui.ready();expect(await page.evaluate(()=>globalThis.localStorage.getItem('bookmaker-slice-draft-v1'))).toBe(raw);
});
