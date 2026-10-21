import { test, expect } from '@playwright/test';
import { BookUI } from './ui-driver.mjs';

test('paper jumps account for imported CRLF line endings in the textarea @flow',async({page})=>{
  const ui=new BookUI(page);await page.goto('/');await ui.tab('原稿');await page.getByTestId('manuscript-file').setInputFiles({name:'line-endings.md',mimeType:'text/markdown',buffer:Buffer.from('# 章\r\n　｜雨音《あまおと》を聞く。\r\n次の行。')});await ui.ready();
  await page.locator('[data-body="ruby-base"]').filter({hasText:'音'}).dblclick();expect(await ui.manuscript().evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('音');
});

test('paper selects quietly and explicit source jumps distinguish ruby text and reading @flow',async({page})=>{
  const ui=new BookUI(page);await page.goto('/');await ui.paste('# 章\n　｜雨音《あまおと》と12、が👨‍👩‍👧‍👦。');
  const editor=ui.manuscript(),base=page.locator('[data-body="ruby-base"]').filter({hasText:'音'});
  await base.click();expect(await editor.evaluate(e=>e===document.activeElement)).toBe(false);
  await page.locator('#open-paper-source').click();expect(await editor.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('音');
  await base.dblclick();expect(await editor.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('音');
  await page.locator('[data-ruby="reading"]').filter({hasText:'ま'}).dblclick();expect(await editor.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('あまおと');
  await page.locator('[data-tcy="true"]').dblclick();expect(await editor.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('12');
  await page.locator('[data-body="text"]').filter({hasText:'👨‍👩‍👧‍👦'}).dblclick();expect(await editor.evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('👨‍👩‍👧‍👦');
});

test('literal manuscript search shares paper positions, scoped replacement, common undo and draft recovery @flow',async({page})=>{
  const ui=new BookUI(page);await page.goto('/');const source='# 章\n　雨 **雨** ｜雨《あめ》 [雨]{.dot}\n　A+a a+A $&';await ui.paste(source);await ui.tab('原稿');
  await ui.manuscript().press('Control+f');await page.locator('#source-find-query').fill('雨');await expect(page.locator('#source-find-count')).toHaveText('4件');
  await page.locator('#source-find-query').press('Enter');await expect(page.locator('[data-search-hit]')).toHaveCount(1);expect(await ui.manuscript().evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('雨');
  await page.locator('#source-find-query').press('Enter');await expect(page.locator('#source-find-count')).toHaveText('2 / 4件');
  await page.locator('#source-replace summary').click();await page.locator('#source-find-replacement').fill('$&');await page.locator('#source-replace-all').click();await ui.ready();
  await expect(ui.manuscript()).toHaveValue('# 章\n　$& **$&** ｜$&《あめ》 [$&]{.dot}\n　A+a a+A $&');
  await page.locator('#undo').click();await ui.ready();await expect(ui.manuscript()).toHaveValue(source);await page.locator('#redo').click();await ui.ready();await page.locator('#undo').click();await ui.ready();
  await page.locator('#close-source-find').click();await ui.manuscript().press('Control+Home');await ui.manuscript().press('ArrowDown');await ui.manuscript().press('Home');await ui.manuscript().press('Shift+End');await ui.manuscript().press('Control+h');
  await page.locator('#source-find-scope').check();await page.locator('#source-find-query').fill('雨');await page.locator('#source-find-replacement').fill('雪');await page.locator('#source-replace-all').click();await ui.ready();await expect(ui.manuscript()).toHaveValue(source.replaceAll('雨','雪'));
  await page.locator('#close-source-find').click();await ui.manuscript().fill(source+'\n:::format broken');await expect(page.locator('#source-draft-status')).toBeVisible();
  await ui.manuscript().press('Control+h');await page.locator('#source-find-query').fill('broken');await page.locator('#source-find-replacement').fill('alignment="center"');await page.locator('#source-replace-all').click();await expect(ui.manuscript()).toHaveValue(source+'\n:::format alignment="center"');
  await page.locator('#undo').click();await expect(ui.manuscript()).toHaveValue(source+'\n:::format broken');
});

test('mobile source jump is explicit and IME Enter does not execute search @flow',async({page})=>{
  await page.setViewportSize({width:375,height:812});const ui=new BookUI(page);await page.goto('/');await ui.paste('　｜雨音《あまおと》を聞く。');
  await page.locator('[data-body="ruby-base"]').filter({hasText:'音'}).click();await expect(page.locator('#preview-panel')).toBeVisible();
  await page.locator('#open-paper-source').click();await expect(ui.manuscript()).toBeVisible();expect(await ui.manuscript().evaluate(e=>e.value.slice(e.selectionStart,e.selectionEnd))).toBe('音');
  await page.locator('#open-source-find').click();await page.locator('#source-find-query').fill('雨');
  const before=await ui.manuscript().evaluate(e=>[e.selectionStart,e.selectionEnd]);await page.locator('#source-find-query').dispatchEvent('compositionstart');await page.locator('#source-find-query').dispatchEvent('keydown',{key:'Enter',isComposing:true});expect(await ui.manuscript().evaluate(e=>[e.selectionStart,e.selectionEnd])).toEqual(before);
  await page.locator('#source-find-query').dispatchEvent('compositionend');await page.locator('#source-find-query').press('Enter');await page.locator('#source-find-paper').click();await expect(page.locator('#preview-panel')).toBeVisible();
});
