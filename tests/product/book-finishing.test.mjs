import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
import { createBook, editBookSource, updateSpecialPage, convertToFree } from '../../dist/domain/book.js';
import { restoreProject, serializeProject } from '../../dist/domain/project.js';
import { defaultStyle, presetStyle, validateStyle, pageMargins } from '../../dist/domain/style.js';
import { pageSide, spreadPages } from '../../dist/domain/page-order.js';
import { decorationSide } from '../../dist/domain/decoration.js';
import { bookHeadings, bookNavigation, tocEntries } from '../../dist/domain/navigation.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { paginate } from '../../dist/typesetting/paginator.js';
import { paginateAdvanced } from '../../dist/typesetting/flow.js';

const source = await readText('fixtures/book/finishing.md');
const makeBook = () => updateSpecialPage(createBook(source), 'contents', { toc: { depth: 3, fontPt: 10, indentMm: 4 } });
test('new books and presets use white paper while explicit paper choices roundtrip', () => {
  for (const style of [defaultStyle(), ...['standard','compact','relaxed'].map(presetStyle)]) assert.equal(style.paperColor, 'white');
  const book = createBook('本文'); book.style.paperColor = 'warm';
  assert.equal(restoreProject(serializeProject(book)).style.paperColor, 'warm');
  const oldStyle = {...defaultStyle()}; delete oldStyle.paperColor; assert.equal(validateStyle(oldStyle).paperColor, 'white');
});
test('binding controls physical sides, margins and decorations independently of writing direction and folios', () => {
  for (const writingMode of ['vertical-rl','horizontal-tb']) {
    const right = validateStyle({ ...defaultStyle(), writingMode }), left = validateStyle({ ...right, binding:'left' });
    assert.deepEqual([1,2,3].map(n=>pageSide(n,left.binding)), ['right','left','right']);
    assert.deepEqual(pageMargins(left,1), {left:17,right:13}); assert.deepEqual(pageMargins(left,2),{left:13,right:17});
    assert.equal(decorationSide('book',1,'top-outer','left'),'right'); assert.equal(decorationSide('book',2,'bottom-inner','left'),'right');
    assert.deepEqual(spreadPages(1,5,'left'),{left:null,right:1}); assert.deepEqual(spreadPages(4,5,'left'),{left:4,right:5}); assert.deepEqual(spreadPages(4,4,'left'),{left:4,right:null});
    assert.deepEqual(spreadPages(2,3,'right'),{left:3,right:2});
    assert.deepEqual(pageMargins({...left,pageLayout:'uniform'},1),pageMargins({...right,pageLayout:'uniform'},2));
    assert.equal(left.writingMode,writingMode);
  }
});
test('left/right starts follow binding and recto stays odd in both paginators', () => {
  const paragraph = id => ({ id,kind:'paragraph',indent:'manual',inlines:[{kind:'text',text:'本文'}] });
  for (const binding of ['left','right']) for (const start of ['left','right','recto']) {
    const style = {...defaultStyle(),binding,folio:{...defaultStyle().folio,startNumber:10}}, blocks=[paragraph('a'),{id:'break',kind:'pageBreak',start},paragraph('b')];
    const expected = start==='recto' ? 3 : binding==='left' ? start==='left'?2:3 : start==='right'?2:3;
    for (const pages of [paginate({schemaVersion:1,title:'',blocks},style).pages,paginateAdvanced(blocks,style).pages]) assert.equal(pages.find(p=>p.lines.some(l=>l.blockId==='b')).number,expected);
    assert.equal(paginateAdvanced(blocks,{...style,pageLayout:'uniform'}).pages.find(p=>p.lines.some(l=>l.blockId==='b')).number,2);
  }
});
test('TOC depth, hierarchy and typography use final heading pages and survive edits and JSON', () => {
  let book=makeBook(), pages=typesetPublication(book).pages;
  assert.deepEqual(bookHeadings(book,pages).map(h=>[h.title,h.level,h.pageNumber]),[['第一章',1,3],['節',2,4],['小節',3,5],['第二章',1,7]]);
  let entries=tocEntries(book,book.specialPages[0],pages); assert.deepEqual(entries.map(e=>e.page),[3,4,5,7]);
  const toc=pages.find(p=>p.kind==='structured'), titles=toc.elements.filter(e=>/^t-toc-\d+$/u.test(e.id));
  assert.deepEqual(titles.map(e=>e.xMm),[15,19,23,15]); assert.ok(titles.every(e=>e.fontPt===10));
  book=updateSpecialPage(book,'contents',{toc:{depth:2,fontPt:11,indentMm:3}}); assert.deepEqual(tocEntries(book,book.specialPages[0]).map(e=>e.level),[1,2,1]);
  const changed=editBookSource(book,source.replace('## 節','## 改名した節')); assert.equal(changed.error,undefined);book=changed.book;
  const restored=restoreProject(serializeProject(book)); assert.deepEqual(restored.specialPages[0].toc,{depth:2,fontPt:11,indentMm:3}); assert.equal(tocEntries(restored,restored.specialPages[0])[1].title,'改名した節');
});
test('navigation omits excluded destinations and a converted TOC remains fixed', () => {
  const book=makeBook(),pages=typesetPublication(book).pages,full=bookNavigation(book,pages);
  assert.equal(full.headings.length,4); assert.equal(full.links.length,8);
  const selected=pages.slice(0,5),part=bookNavigation(book,pages,selected);
  assert.deepEqual(part.headings.map(h=>h.pageNumber),[3,4,5]); assert.deepEqual([...new Set(part.links.map(l=>l.targetPageNumber))],[3,4,5]);
  const free=convertToFree(book,'contents',pages[0].elements),fixed=restoreProject(serializeProject(free));
  assert.equal(fixed.specialPages[0].representation,'layout'); assert.equal(bookNavigation(fixed,typesetPublication(fixed).pages).links.length,0);
  assert.throws(()=>serializeProject(updateSpecialPage(book,'contents',{toc:{depth:4,fontPt:9,indentMm:3}})));
  assert.throws(()=>serializeProject(updateSpecialPage(book,'contents',{toc:{depth:2,fontPt:2,indentMm:3}})));
  assert.throws(()=>serializeProject(updateSpecialPage(book,'contents',{toc:{depth:2,fontPt:9,indentMm:3,unknown:true}})));
});
test('spread image halves follow the physical side in both bindings',()=>{
  for(const binding of ['left','right']){
    const book=createBook('本文\n:::illustration id="wide"'); book.style.binding=binding;
    book.assets=[{id:'image',name:'spread',mediaType:'image/png',original:'data:image/png;base64,AA==',bytes:1,images:[{dataUrl:'data:image/png;base64,AA==',width:2400,height:1600}]}];
    const next=updateSpecialPage(book,'wide',{assetId:'image',imageMode:'spread',fit:'cover'}),pages=typesetPublication(next).pages.filter(p=>p.kind==='asset');
    assert.deepEqual(pages.map(p=>p.number),[2,3]); assert.deepEqual(pages.map(p=>p.elements[0].xMm),binding==='left'?[0,-105]:[-105,0]);
  }
});
