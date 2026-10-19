import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
import { createBook, addSpecialPage, updateSpecialPage } from '../../dist/domain/book.js';
import { createLayoutPage, movePageElements, editPageElements } from '../../dist/domain/editing.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { renderPageSVG } from '../../dist/render/svg.js';
import { assetReferences, insertAssetPages, replaceBookAsset, removeUnusedAsset } from '../../dist/domain/media.js';
import { imageStyle, IMAGE_PRESETS } from '../../dist/domain/style.js';

test('right-bound spread takes the right image half on the even physical page and left half on the odd page', () => {
  const added = addSpecialPage(createBook('本文'), 'illustration');
  added.book.assets = [{ id:'wide', name:'left-red-right-blue', mediaType:'image/png', original:'data:image/png;base64,AA==', bytes:1, images:[{dataUrl:'data:image/png;base64,AA==',width:2400,height:1600}] }];
  const book = updateSpecialPage(added.book, added.id, { assetId:'wide', imageMode:'spread', fit:'cover' });
  const pages = typesetPublication(book).pages.filter(p => p.kind === 'asset');
  assert.equal(pages.length, 2); assert.equal(pages[0].number % 2, 0);
  assert.equal(pages[0].elements[0].xMm, -105, 'physical right page must reveal the right half');
  assert.equal(pages[1].elements[0].xMm, 0, 'physical left page must reveal the left half');
  const first=createBook(':::illustration id="wide"');first.style.pageLayout='uniform';first.assets=added.book.assets;first.specialPages[0].assetId='wide';first.specialPages[0].imageMode='spread';
  const uniform=typesetPublication(first).pages;assert.deepEqual(uniform.filter(p=>p.kind==='asset').map(p=>p.number),[2,3]);assert.equal(uniform[0].lines.length,0);
});

test('32-chapter TOC paginates before body layout and all references match final pages', async () => {
  const initial = createBook(await readText('fixtures/book/toc-many.md'));
  const added = addSpecialPage(initial, 'toc', initial.document.children[0].children[0].id);
  const result = typesetPublication(added.book), pages = result.pages.filter(p => p.kind === 'structured' && p.pageId === added.id);
  assert.ok(pages.length > 1, 'TOC must continue on additional physical pages');
  const entries = pages.flatMap(p => p.elements).filter(e => e.kind === 'text' && e.id.startsWith('t-toc-'));
  assert.deepEqual(entries.map(e => e.text), Array.from({length:32},(_,i)=>`第${String(i+1).padStart(2,'0')}章`));
  for (const [i, entry] of entries.entries()) {
    const heading = added.book.document.children[i+1].headingId, physical = result.pages.find(p => p.lines.some(l => l.blockId === heading)).number;
    const number = pages.flatMap(p => p.elements).find(e => e.id === entry.id.replace('t-toc-', 't-num-'));
    assert.equal(number.text, String(physical));
  }
  assert.equal(result.diagnostics.filter(d => /overflow/u.test(d.code)).length, 0);
});

test('new title and completed external pages suppress added folios and heads while an explicit choice remains effective', () => {
  for (const role of ['title','chapter-title','colophon','external']) {
    const added = role === 'external' ? addSpecialPage(createBook('本文'), role) : createLayoutPage(createBook('本文'), role, '作品');
    const page = typesetPublication(added.book).pages.find(p => p.kind !== 'flow' && p.pageId === added.id);
    assert.equal(page.folioVisible, false, role); assert.equal(page.hideHeads, true, role);
    const changed = updateSpecialPage(added.book, added.id, { localStyle:{showFolio:true,showHeads:true} });
    assert.match(renderPageSVG(typesetPublication(changed).pages.find(p => p.kind !== 'flow' && p.pageId === added.id), changed.style), /data-testid="folio"/u);
  }
});

test('asset page ranges insert in order and replacement preserves references while rejecting missing referenced pages', () => {
  const book=createBook('前\n後'), image={dataUrl:'data:image/png;base64,AA==',width:1200,height:1600};
  const asset={id:'pdf',name:'外部PDF',mediaType:'application/pdf',original:'data:application/pdf;base64,AA==',bytes:1,images:[image,image,image]};book.assets=[asset];
  const inserted=insertAssetPages(book,'pdf',2,3,book.document.children[0].children[0].id), refs=inserted.book.document.children[0].children;
  assert.deepEqual(refs.map(b=>b.kind),['paragraph','specialPage','specialPage','paragraph']);
  assert.deepEqual(inserted.book.specialPages.map(p=>p.assetPage),[2,3]);assert.deepEqual(assetReferences(inserted.book,'pdf').map(r=>r.page),[2,3]);
  assert.throws(()=>replaceBookAsset(inserted.book,'pdf',{...asset,images:[image,image]}),/3ページ目/u);
  assert.throws(()=>removeUnusedAsset(inserted.book,'pdf'),/参照/u);
  const replaced=replaceBookAsset(inserted.book,'pdf',{...asset,id:'incoming',name:'差し替え'});
  assert.deepEqual(replaced.specialPages,inserted.book.specialPages);assert.equal(replaced.assets[0].id,'pdf');
  assert.equal(removeUnusedAsset(book,'pdf').assets.length,0);
});

test('image presets produce their advertised pixel dimensions with readable type and keep the original book intact', () => {
  const book=createBook('原稿');for(const [id,preset] of Object.entries(IMAGE_PRESETS)){
    const style=imageStyle(book.style,id);assert.equal(style.fontPt,16);assert.equal(style.pageLayout,'uniform');assert.equal(style.folio.enabled,false);
    assert.equal(Math.round(style.page.widthMm/25.4*300),Number(preset.label.match(/(\d+) ×/u)[1]));
    assert.equal(Math.round(style.page.heightMm/25.4*300),Number(preset.label.match(/× (\d+)/u)[1]));
  }assert.equal(book.style.fontPt,9);assert.equal(book.source,'原稿');
});

test('canvas multi-selection moves together within the page, leaves locked elements fixed and keeps delete atomic', () => {
  const initial=createLayoutPage(createBook('本文'),'blank','自由ページ'),make=(id,x,locked=false)=>({id,kind:'text',xMm:x,yMm:20,widthMm:20,heightMm:15,text:id,fontPt:10,fontWeight:400,alignment:'start',direction:'horizontal',locked});
  const book=updateSpecialPage(initial.book,initial.id,{elements:[make('a',10),make('b',50),make('locked',20,true)]});
  const moved=movePageElements(book,initial.id,['a','b','locked'],100,5).specialPages.at(-1).elements;
  assert.equal(moved[1].xMm+moved[1].widthMm,105);assert.equal(moved[1].xMm-moved[0].xMm,40);assert.equal(moved[2].xMm,20);assert.equal(moved[2].yMm,20);
  assert.throws(()=>editPageElements(book,initial.id,['a','locked'],'delete'),/固定/u);assert.equal(book.specialPages.at(-1).elements.length,3);
  const copied=editPageElements(book,initial.id,['a','b'],'duplicate');assert.equal(copied.ids.length,2);assert.equal(copied.book.specialPages.at(-1).elements.length,5);assert.equal(book.specialPages.at(-1).elements.length,3);
});

test('long TOC titles continue without losing graphemes or overlapping their page header at the smallest page size', () => {
  const title='長い章名と｜記号😀'.repeat(60),original=createBook('前\n# '+title+'\n本文');original.style.page={widthMm:60,heightMm:60};original.style.margins={topMm:5,bottomMm:5,innerMm:5,outerMm:5};original.style.folio.enabled=false;
  const added=addSpecialPage(original,'toc',original.document.children[0].children[0].id),result=typesetPublication(added.book),pages=result.pages.filter(p=>p.kind==='structured');
  assert.ok(pages.length>1);assert.equal(pages.flatMap(p=>p.elements).filter(e=>e.id.startsWith('t-toc-')).map(e=>e.text.replace(/\n/gu,'')).join(''),title);
  for(const page of pages){const heading=page.elements.find(e=>e.id==='t-title');for(const entry of page.elements.filter(e=>e.id.startsWith('t-toc-'))){assert.ok(entry.yMm>=heading.yMm+heading.heightMm);assert.ok(entry.yMm+entry.heightMm<=45+.001);}}
  assert.equal(result.diagnostics.filter(d=>/overflow/u.test(d.code)&&pages.some(p=>p.blockId===d.blockId)).length,0);
});
