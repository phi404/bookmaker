import test from 'node:test';
import assert from 'node:assert/strict';
import { createBook, editBookSource } from '../../dist/domain/book.js';
import { createBookSettingsPreset, applyBookSettingsPreset, parseBookSettingsPreset } from '../../dist/domain/settings-preset.js';
import { validatePublication } from '../../dist/domain/publication.js';
import { inheritedStyle } from '../../dist/domain/styles.js';

function sourceBook() {
  const book = createBook('# 一冊目\n　｜薔薇《ばら》の本文。');
  book.document.title = '秘密の作品名'; book.document.author = '持ち出さない著者';
  book.style.fontPt = 12; book.style.folio.startNumber = 27;
  book.style.runningHeads = [{ id:'private', from:1, to:null, side:'both', position:'top-outer', text:'固定の秘密', fontPt:7, insetMm:8 }];
  book.runningElements = [
    { id:'literal', scope:{kind:'book'}, content:{kind:'text',text:'持ち出さない固定文'}, position:'top-outer', side:'both', fontPt:7, insetMm:8, hideOnSectionFirst:true },
    { id:'semantic', scope:{kind:'book'}, content:{kind:'title'}, position:'top-outer', side:'odd', fontPt:7, insetMm:8, hideOnSectionFirst:true },
    { id:'scoped', scope:{kind:'section',sectionId:book.document.children[0].id}, content:{kind:'chapter'}, position:'top-outer', side:'even', fontPt:7, insetMm:8, hideOnSectionFirst:true }
  ];
  return book;
}
test('settings snapshots contain no manuscript, metadata, literal headings or physical ranges', () => {
  const preset = createBookSettingsPreset(sourceBook(), '再利用する本');
  const serialized = JSON.stringify(preset);
  for (const privateText of ['秘密の作品名','持ち出さない著者','固定の秘密','持ち出さない固定文','薔薇']) assert.equal(serialized.includes(privateText), false);
  assert.deepEqual(preset.running.map(item=>item.content), [{kind:'title'}]);
  assert.equal(preset.style.folio.startNumber,1); assert.deepEqual(preset.style.folio.rules,[]);
  assert.deepEqual(parseBookSettingsPreset(serialized),preset);
});
test('applying reusable settings changes the requested groups while preserving source, IDs, local settings and target numbering', () => {
  const source = sourceBook(); source.styles.characters[0].properties.fontWeight=700;
  const target = createBook('# 二冊目\n:::format alignment="center"\n　元の本文。\n:::');
  target.document.author='この本の著者'; target.style.folio.startNumber=8;
  const before=globalThis.structuredClone(target), result=applyBookSettingsPreset(target,createBookSettingsPreset(source,'設定'));
  assert.equal(result.style.fontPt,12); assert.equal(result.style.folio.startNumber,8);
  assert.equal(result.styles.characters[0].properties.fontWeight,700);
  assert.deepEqual(result.document,before.document); assert.equal(result.source,before.source);
  assert.deepEqual(target,before); assert.equal(result.document.author,'この本の著者');
  assert.deepEqual(validatePublication(JSON.parse(JSON.stringify(result))),result);
  const layoutOnly=applyBookSettingsPreset(target,createBookSettingsPreset(source,'設定'),{layout:true,styles:false,decorations:false});
  assert.deepEqual(layoutOnly.styles,target.styles); assert.deepEqual(layoutOnly.runningElements,target.runningElements);
});
test('custom ID collisions and cross-kind inheritance are remapped without changing existing references', () => {
  const source=sourceBook();
  source.styles.characters.push({id:'custom',name:'取り込む文字',basedOn:'text',properties:{fontPt:11}});
  source.styles.paragraphs.push({id:'custom',name:'取り込む段落',basedOn:'body',characterStyleId:'custom',properties:{alignment:'end'}});
  source.styles.pages.push({id:'custom',name:'取り込む版面',basedOn:'default-page',properties:{columns:2}});
  source.styles.sections.push({id:'custom',name:'取り込む章',properties:{paragraphStyleId:'custom',pageStyleId:'custom'}});
  const target=createBook(':::format style="custom"\n本文\n:::');
  target.styles.paragraphs.push({id:'custom',name:'現在の段落',basedOn:'body',properties:{indentEm:3}});
  const result=applyBookSettingsPreset(target,createBookSettingsPreset(source,'設定'));
  assert.deepEqual(result.document,target.document);
  assert.deepEqual(result.styles.paragraphs.find(item=>item.id==='custom'),target.styles.paragraphs.find(item=>item.id==='custom'));
  const imported=result.styles.paragraphs.find(item=>item.name==='取り込む段落'); assert.notEqual(imported.id,'custom');
  assert.equal(result.styles.characters.find(item=>item.id===imported.characterStyleId).name,'取り込む文字');
  const section=result.styles.sections.find(item=>item.name==='取り込む章');
  assert.equal(result.styles.paragraphs.find(item=>item.id===section.properties.paragraphStyleId).id,imported.id);
  assert.equal(result.styles.pages.find(item=>item.id===section.properties.pageStyleId).name,'取り込む版面');
  assert.equal(inheritedStyle(result.styles.paragraphs,imported.id).properties.alignment,'end');
});
test('invalid, future and partial settings files are rejected without changing the book', () => {
  const book=sourceBook(), preset=createBookSettingsPreset(book,'設定');
  for(const mutate of [value=>{value.schemaVersion=9;},value=>{value.document={};},value=>{value.style.unknown=1;},value=>{value.style.page.unknown=1;},value=>{value.style.folio.rules=[{id:'rule',from:1,to:1,enabled:false}];},value=>{value.catalog.characters[0].basedOn='text';},value=>{value.catalog.paragraphs[0].characterStyleId='missing';},value=>{value.running[0].content={kind:'text',text:'持ち込む本文'};}]) {
    const value=globalThis.structuredClone(preset);mutate(value);assert.throws(()=>parseBookSettingsPreset(JSON.stringify(value)));
  }
  assert.throws(()=>parseBookSettingsPreset('{'));
  assert.throws(()=>applyBookSettingsPreset(book,preset,{layout:false,styles:false,decorations:false}));
  const draft=editBookSource(book,':::format fontPt="入力中"\n未確定');
  assert.throws(()=>applyBookSettingsPreset(draft.book,preset),/確定/u);
  assert.equal(draft.book.sourceDraft,':::format fontPt="入力中"\n未確定');
});

import { readSettingsPresets, saveSettingsPreset, removeSettingsPreset } from '../../dist/io/settings-presets.js';
test('saved templates preserve corrupt and quota-limited storage rather than clearing it', () => {
  let raw=null,blocked=false; const storage={getItem:()=>raw,setItem:(_key,value)=>{if(blocked)throw new Error('quota');raw=value;}};
  const preset=createBookSettingsPreset(sourceBook(),'再利用');saveSettingsPreset(preset,storage);const before=raw;
  assert.deepEqual(readSettingsPresets(storage),[preset]);
  blocked=true;assert.throws(()=>saveSettingsPreset(createBookSettingsPreset(sourceBook(),'別の設定'),storage),/保存できません/u);assert.equal(raw,before);
  blocked=false;removeSettingsPreset(preset.name,storage);assert.deepEqual(readSettingsPresets(storage),[]);
  raw='{broken';assert.throws(()=>readSettingsPresets(storage),/保護/u);assert.throws(()=>saveSettingsPreset(preset,storage),/保護/u);assert.equal(raw,'{broken');
});
