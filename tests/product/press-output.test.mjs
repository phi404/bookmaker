import test from 'node:test';
import assert from 'node:assert/strict';
import { createBook, checkBook, duplicateBookItem, updateSpecialPage } from '../../dist/domain/book.js';
import { serializeProject, restoreProject } from '../../dist/domain/project.js';
test('print settings round trip without changing source, paper size or folios', () => {
  const book = createBook('# 本文\n変更しない本文。');
  book.printSettings = { purpose: 'print', bleedMm: 3, marks: 'all', dpi: 600, color: 'gray', pdfSource: 'raster' };
  const round = restoreProject(serializeProject(book));
  assert.deepEqual(round.printSettings, book.printSettings);
  assert.equal(round.source, book.source);
  assert.deepEqual(round.style, book.style);
});
test('invalid print settings never silently fall back', () => {
  const book = createBook('本文');
  for (const patch of [{ bleedMm: -1 }, { bleedMm: 11 }, { dpi: 72 }, { color: 'cmyk' }, { marks: 'yes' }, { purpose: ['print'] }, { marks: ['none'] }, { color: ['gray'] }, { pdfSource: ['raster'] }, { unknown: true }]) {
    assert.throws(() => checkBook({ ...book, printSettings: { purpose: 'print', bleedMm: 3, marks: 'none', dpi: 600, color: 'gray', pdfSource: 'raster', ...patch } }));
  }
});

import { printGeometry, printRasterSize, monoPDF, colorPDF, screenPDF, printIssues } from '../../dist/domain/print.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { renderPageSVG } from '../../dist/render/svg.js';
test('PDF boxes and marks surround fixed A6 trim without touching bleed', () => {
  const book=createBook('本文'), plain=printGeometry(book.style,{...monoPDF}), marked=printGeometry(book.style,{...monoPDF,marks:'all'});
  assert.deepEqual(plain.trim,{x:3,y:3,width:105,height:148});assert.deepEqual(plain.media,{width:111,height:154});assert.equal(plain.marks.length,0);
  assert.deepEqual(marked.trim,{x:10,y:10,width:105,height:148});assert.deepEqual(marked.bleed,{x:7,y:7,width:111,height:154});assert.deepEqual(marked.media,{width:125,height:168});assert.equal(marked.marks.length,24);
  for(const l of marked.marks)assert.ok((l.x1 < -3 && l.x2 < -3)||(l.x1 > 108 && l.x2 > 108)||(l.y1 < -3 && l.y2 < -3)||(l.y1 > 151 && l.y2 > 151));
  assert.deepEqual(printRasterSize(book.style,{...monoPDF}),{width:2622,height:3638});
  assert.throws(()=>printRasterSize({page:{widthMm:350,heightMm:500}},{...monoPDF}),/大きすぎ/);
});
test('print settings preserve the full page array, source and structure', () => {
  const book=createBook('# 本文\n'+'日本語と｜漢字《かんじ》の原稿。'.repeat(80)), original=typesetPublication(book);
  for(const settings of [monoPDF,colorPDF,{...monoPDF,bleedMm:5,marks:'all'}]){const next=checkBook({...book,printSettings:{...settings}});assert.equal(next.source,book.source);assert.deepEqual(typesetPublication(next),original);}
  const svg=renderPageSVG(original.pages[0],book.style,undefined,false,{bleedMm:3,blackText:true});
  assert.match(svg,/viewBox="-3 -3 111 154"/);assert.match(svg,/<g fill="#000000"/);
  assert.deepEqual(printGeometry(book.style,{...screenPDF}).media,{width:105,height:148});
});
test('edge-touching objects are diagnosed when real bleed is missing', () => {
  const book=updateSpecialPage(createBook(':::free id="cover"'),'cover',{representation:'layout',elements:[{kind:'rect',id:'el-999',xMm:0,yMm:0,widthMm:105,heightMm:148,color:'#ff0000',strokeMm:0}]});
  const pages=typesetPublication(book).pages;assert.ok(printIssues(pages,book.style,{...monoPDF}).some(i=>/届いていません/.test(i.message)));assert.deepEqual(printIssues(pages,book.style,{...screenPDF}),[]);
});
test('chapter copies have fresh IDs for structure, nested pages, elements and contained scopes', () => {
  let book=createBook('# 第一章\n原稿。\n:::free id="drawing"\n# 第二章\n後の原稿。');
  book=updateSpecialPage(book,'drawing',{representation:'layout',elements:[{kind:'text',id:'el-100',xMm:15,yMm:20,widthMm:50,heightMm:20,fontPt:12,fontWeight:400,text:'保持',direction:'horizontal',alignment:'center'}]});
  const section=book.document.children[0],block=section.children[1];
  book.overrides.push({id:'original-rule',scope:{kind:'block',blockId:block.id},character:{fontWeight:700}});
  book.runningElements.push({id:'original-head',scope:{kind:'section',sectionId:section.id},content:{kind:'text',text:'柱'},position:'top-center',side:'both',fontPt:7,insetMm:8,hideOnSectionFirst:false});
  const original=globalThis.structuredClone(book),copy=duplicateBookItem(book,section.id),cloned=copy.book.document.children[1];
  assert.deepEqual(book,original);assert.equal(copy.id,cloned.id);assert.notEqual(cloned.id,section.id);assert.notEqual(cloned.headingId,section.headingId);assert.notEqual(cloned.children[1].id,block.id);
  const ref=cloned.children.find(b=>b.kind==='specialPage'),page=copy.book.specialPages.find(p=>p.id===ref.pageId);
  assert.notEqual(ref.pageId,'drawing');assert.equal(page.elements[0].text,'保持');assert.notEqual(page.elements[0].id,'el-100');
  assert.deepEqual(copy.book.overrides[1].scope,{kind:'block',blockId:cloned.children[1].id});assert.deepEqual(copy.book.runningElements[1].scope,{kind:'section',sectionId:cloned.id});
  assert.deepEqual(restoreProject(serializeProject(copy.book)),copy.book);
});

test('chapter duplication keeps block identity separate from valid element namespaces',()=>{
  const base=createBook('# 章\n本文。\n:::free id="drawing"'),headingId=base.document.children[0].headingId;
  const book=checkBook(updateSpecialPage(base,'drawing',{representation:'layout',elements:[{kind:'text',id:headingId,xMm:15,yMm:20,widthMm:50,heightMm:20,fontPt:12,fontWeight:400,text:'元の要素',direction:'horizontal',alignment:'start'}]}));
  const copied=duplicateBookItem(book,book.document.children[0].id).book;
  assert.equal(copied.document.children[1].headingId,copied.document.children[1].children[0].id);
  assert.deepEqual(restoreProject(serializeProject(copied)),copied);
});

test('PDF media dimensions include real bleed while unrelated page mismatches stay diagnosed',()=>{
  const base=createBook(':::illustration id="figure"');
  const book=updateSpecialPage(base,'figure',{assetId:'pdf-source',representation:'asset',imageMode:'bleed',bleedMm:3,fit:'cover'});
  book.assets.push({id:'pdf-source',name:'source.pdf',mediaType:'application/pdf',original:'data:application/pdf;base64,JVBERi0=',bytes:5,images:[{dataUrl:'data:image/png;base64,AA==',width:1311,height:1819,widthMm:111,heightMm:154}]});
  assert.ok(!typesetPublication(book).diagnostics.some(d=>d.code==='asset-page-size'));
  const plain=updateSpecialPage(book,'figure',{imageMode:'page'});
  assert.ok(typesetPublication(plain).diagnostics.some(d=>d.code==='asset-page-size'));
});
