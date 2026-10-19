import test from 'node:test';
import assert from 'node:assert/strict';
import { readText } from '../../scripts/lib.mjs';
const modules = async () => ({ ...(await import('../../dist/domain/book.js')), ...(await import('../../dist/domain/styles.js')), ...(await import('../../dist/domain/publication.js')), ...(await import('../../dist/domain/project.js')), ...(await import('../../dist/domain/style.js')), ...(await import('../../dist/typesetting/publication.js')), ...(await import('../../dist/render/svg.js')) });
const body = p => p.document.children.flatMap(s => s.children).filter(b => b.inlines).map(b => b.inlines.map(r => r.kind === 'ruby' ? r.base : r.text).join('')).join('\n');
test('all style families inherit, roundtrip and reset a local change without removing a named style', async () => {
  const a = await modules(), p = a.createBook('# 章\n本文');
  p.styles.pages = [{id:'default-page', name:'標準', properties:{}}, {id:'wide', name:'余白の広い版面', basedOn:'default-page', properties:{margins:{topMm:24}}}];
  p.styles.sections = [{id:'default-section',name:'標準',properties:{}}, {id:'letter',name:'手紙',basedOn:'default-section',properties:{pageStyleId:'wide', paragraphStyleId:'centered'}}];
  p.document.children[0].styleId = 'letter';
  const id=p.document.children[0].children[1].id;
  p.document=a.applyLocalStyle(p.document,id,{character:{fontPt:11,letterSpacingEm:.2,orientation:'upright'},paragraph:{beforeEm:1,afterEm:1,lineHeight:2,alignment:'end'}});
  const copy=a.restoreProject(a.serializeProject(p)); assert.equal(copy.document.children[0].styleId,'letter'); assert.equal(a.typesetPublication(copy).pages[0].style.margins.topMm,24);
  copy.document=a.resetLocalStyle(copy.document,id); assert.equal(copy.document.children[0].styleId,'letter'); assert.equal(a.localStyleCount(a.flattenDocument(copy.document).find(b=>b.id===id)),0);
  const bad=globalThis.structuredClone(p); bad.styles.pages[0].basedOn='wide'; assert.throws(()=>a.checkBook(bad),/循環/u);
});
test('local orientation, tate chu yoko, numeral display and marks preserve canonical text and ruby', async () => {
  const a=await modules(), p=a.createBook(await readText('fixtures/book/style-exceptions.md')), original=body(p);
  const result=a.typesetPublication(a.checkBook(p)), svg=result.pages.map(page=>a.renderPageSVG(page,p.style)).join('');
  assert.ok(svg.includes('data-orientation="upright"')); assert.ok(svg.includes('data-orientation="sideways"')); assert.ok(svg.includes('data-tcy="true"'));
  const converted=[...svg.matchAll(/<text [^>]*data-source-text="[0-9]"[^>]*>([^<]+)<\/text>/gu)].map(m=>m[1]).join('');
  assert.equal(converted,'二〇二六');
  assert.equal(body(a.restoreProject(a.serializeProject(p))),original); assert.ok(original.includes('2026')); assert.ok(svg.includes('data-ruby="reading"'));
  const mixed=result.pages.flatMap(page=>page.lines).flatMap(line=>line.runs).filter(r=>/[日本語猫]/u.test(r.kind==='ruby'?r.base:r.text));
  assert.ok(mixed.length>0); assert.ok(mixed.every(r=>r.orientation!=='sideways'), 'Latin direction overrides must keep Japanese text and ruby upright');
  const marked=svg.match(/<text ([^>]*data-orientation="upright"[^>]*)>A<\/text><circle data-emphasis="circle"[^>]*cy="([^"]+)"/u); assert.ok(marked);
  const top=Number(marked[1].match(/\by="([^"]+)"/u)[1]), size=Number(marked[1].match(/font-size="([^"]+)"/u)[1]);
  assert.ok(Math.abs(Number(marked[2])-top-size/2)<.0001,'upright Latin emphasis must be centered in its full-height character cell');
});
test('section page styles change flow direction and two bands while later body returns to book style', async () => {
  const a=await modules(),p=a.createBook('# 一\n'+ '本文。'.repeat(140)+'\n# 二\n'+ '横書き。'.repeat(220)+'\n# 三\n戻る本文。');
  p.styles.pages=[{id:'default-page',name:'標準',properties:{}},{id:'horizontal',name:'横書き二段',properties:{writingMode:'horizontal-tb',columns:2,columnGapMm:6,margins:{topMm:20}}}];
  p.document.children[1].localStyle={pageStyleId:'horizontal'}; const id=p.document.children[1].id;
  const result=a.typesetPublication(a.checkBook(p)), pages=result.pages.filter(page=>page.sectionId===id);
  assert.ok(pages.length>1); assert.ok(pages.every(page=>page.style.writingMode==='horizontal-tb' && page.style.columns===2)); assert.ok(pages.flatMap(page=>page.lines).some(line=>line.band===1));
  assert.equal(result.pages.at(-1).style.writingMode,'vertical-rl'); assert.match(a.renderPageSVG(pages[0],p.style),/writing-mode="horizontal-tb"/u);
});
test('chapter heads and anchored page styles follow text insertion and newly inserted chapters', async () => {
  const a=await modules(); let p=a.createBook('# 一\n最初\n# 二\n対象\n# 三\n最後'), target=p.document.children[1].id, anchor=p.document.children[1].children[1].id;
  p.runningElements=[{id:'chapter-head',scope:{kind:'section',sectionId:target},content:{kind:'chapter'},position:'bottom-center',side:'both',fontPt:7,insetMm:8,hideOnSectionFirst:false}];
  for(const s of p.document.children) s.start='next';
  p.overrides=[{id:'anchored-page',scope:{kind:'untilSection',fromId:anchor},page:{margins:{topMm:22}}}];
  const prior=a.typesetPublication(p).pages.find(page=>page.runningElements.some(e=>e.id==='chapter-head')).number;
  p=a.checkBook(p); p=a.editBookSource(p,p.source.replace('最初','最初'+ '追加文。'.repeat(500)).replace('# 三','# 新章\n挿入\n# 三')).book;
  const result=a.typesetPublication(a.checkBook(p)), heads=result.pages.filter(page=>page.runningElements.some(e=>e.id==='chapter-head'));
  assert.ok(heads.every(page=>page.sectionId===target)); assert.ok(heads[0].number>prior); assert.equal(result.pages.find(page=>page.lines.some(line=>line.blockId===anchor)).style.margins.topMm,22);
  assert.equal(result.pages.at(-1).style.margins.topMm,15);
});
test('flow, spread and bleed images have structural placement and measurable effective print data', async () => {
  const a=await modules(),p=a.createBook('前の本文\n:::illustration id="image-flow"\n後の本文\n:::illustration id="image-spread"\n:::illustration id="image-bleed"');
  p.assets=[{id:'local-image',name:'挿絵',mediaType:'image/png',original:'data:image/png;base64,AA==',bytes:1,images:[{dataUrl:'data:image/png;base64,AA==',width:2400,height:1800}]}];
  for(const page of p.specialPages){page.assetId='local-image';page.imageMode=page.id.endsWith('flow')?'flow':page.id.endsWith('spread')?'spread':'bleed';if(page.imageMode==='bleed')page.bleedMm=3;}
  const result=a.typesetPublication(a.checkBook(p)), flow=result.pages.find(page=>page.kind==='flow'&&page.elements?.length);
  assert.ok(flow.lines.length); assert.equal(result.pages.filter(page=>page.kind==='asset'&&page.pageId==='image-spread').length,2);
  assert.ok(result.pages.find(page=>page.pageId==='image-bleed').imageInfo.bleedMm===3); assert.ok(flow.imageInfo[0].effectiveDpi>150);
  assert.ok(a.renderPageSVG(flow,p.style).includes('data-image-placement="flow"'));
});
test('free page alignment and snapping remain isolated, and template conversion retains its fields', async () => {
  const a=await modules(), p=a.createBook(':::colophon id="colophon"'); p.specialPages[0].fields={title:'本',author:'著者'};
  let free=a.convertToFree(p,'colophon',a.typesetPublication(p).pages[0].elements), id=free.specialPages[0].elements[0].id;
  free=a.alignPageElement(free,'colophon',id,'center-x'); const element=free.specialPages[0].elements[0]; assert.equal(element.xMm,(105-element.widthMm)/2);
  free=a.movePageElement(free,'colophon',id,13.3,15.7,1); assert.equal(free.specialPages[0].elements[0].xMm,13); assert.equal(free.specialPages[0].elements[0].yMm,16);
  assert.equal(free.source,p.source); assert.equal(free.specialPages[0].originalTemplate.fields.author,'著者'); assert.throws(()=>a.alignPageElement(p,'colophon',id,'center-x'),/自由/u);
});
test('different paper formats, horizontal special pages, moves and removals keep body identity and output dimensions', async () => {
  const a=await modules(),original=a.createBook('# 章\n本文\n:::colophon id="colophon"\n後の本文');
  for(const size of [{widthMm:105,heightMm:148},{widthMm:128,heightMm:182},{widthMm:148,heightMm:210},{widthMm:182,heightMm:257},{widthMm:140,heightMm:140}]){
    let p=globalThis.structuredClone(original); p.style.page=size; const id=a.flattenDocument(p.document).find(b=>b.inlines?.some(i=>i.text==='後の本文')).id;
    p=a.moveBookItem(p,'colophon',1); const pages=a.typesetPublication(a.checkBook(p)).pages;
    assert.ok(pages.some(page=>page.lines.some(line=>line.blockId===id))); assert.match(a.renderPageSVG(pages[0],p.style),new RegExp(`width="${size.widthMm}mm"`));
    p=a.removeBookItem(p,'colophon'); assert.ok(a.flattenDocument(a.checkBook(p).document).some(b=>b.id===id));
  }
});

test('page style inheritance keeps independent margins and section wins over book while local scope wins last', async()=>{
  const a=await modules(),p=a.createBook('# 章\n本文');
  p.styles.pages=[{id:'default-page',name:'本',properties:{margins:{topMm:16}}},{id:'base',name:'基',properties:{margins:{topMm:22,bottomMm:20}}},{id:'child',name:'派生',basedOn:'base',properties:{margins:{topMm:24}}}];
  p.document.children[0].localStyle={pageStyleId:'child',page:{margins:{outerMm:15}}};
  p.overrides=[{id:'book-rule',scope:{kind:'book'},page:{margins:{topMm:18,bottomMm:19}}}];
  let style=a.typesetPublication(a.checkBook(p)).pages[0].style;assert.deepEqual(style.margins,{topMm:24,bottomMm:20,innerMm:17,outerMm:15});
  p.overrides.push({id:'chapter-rule',scope:{kind:'section',sectionId:p.document.children[0].id},page:{margins:{topMm:26}}});
  style=a.typesetPublication(a.checkBook(p)).pages[0].style;assert.equal(style.margins.topMm,26);assert.equal(style.margins.bottomMm,20);
});

test('invalid character attributes remain literal, and automatic numerals work in older catalogs without rewriting source', async()=>{
  const a=await modules(),source='[**保持**]{position="3mm"}\n12、3、2026',p=a.createBook(source);
  delete p.styles.characters[0].properties.numbers;
  const pages=a.typesetPublication(a.checkBook(p)).pages,svg=pages.map(page=>a.renderPageSVG(page,p.style)).join('');assert.equal(body(p),'[**保持**]{position="3mm"}\n12、3、2026');
  assert.ok(svg.includes('data-tcy="true"'));assert.equal(a.restoreProject(a.serializeProject(p)).source,source);
});

test('local character metrics, paragraph inset and two-column keep-next fit generated bounds and keep every grapheme',async()=>{
  const a=await modules(),p=a.createBook('冒頭文。'.repeat(15)+'\n## 一緒に置く\n　[大きい]{fontPt="14" letterSpacingEm="0.15"}'+ '本文。'.repeat(90));
  p.style.columns=2;p.style.maxCharsPerLine=12;p.style.maxLinesPerPage=4;
  const block=p.document.children[0].children.at(-1);block.localStyle={paragraph:{insetEm:2,endInsetEm:1,beforeEm:.5,afterEm:1}};
  const result=a.typesetPublication(a.checkBook(p)),heading=result.pages.find(page=>page.lines.some(line=>line.heading));
  assert.ok(heading.lines.some(line=>line.blockId===block.id));const actual=result.pages.flatMap(p=>p.lines).flatMap(l=>l.runs).map(r=>r.kind==='ruby'?r.base:r.text).join('');assert.equal(actual,body(p).replace(/\n/gu,''));
  for(const page of result.pages)for(const line of page.lines){assert.ok(line.xMm>=p.style.margins.innerMm-1);assert.ok(line.xMm<=105-p.style.margins.outerMm+1);assert.ok(line.yMm>=15&&line.yMm<148-16);}
});

test('running elements respect the resolved chapter margin, with hidden pages exempt from collision checks',async()=>{
  const a=await modules(),p=a.createBook('# 章\n本文');p.document.children[0].localStyle={page:{margins:{topMm:5}}};
  p.runningElements=[{id:'head',scope:{kind:'section',sectionId:p.document.children[0].id},content:{kind:'chapter'},position:'top-center',side:'both',fontPt:7,insetMm:8,hideOnSectionFirst:false}];
  assert.throws(()=>a.typesetPublication(a.checkBook(p)),/柱.*余白.*重な/u);
  p.document.children[0].localStyle.page.showHeads=false;assert.doesNotThrow(()=>a.typesetPublication(a.checkBook(p)));
});
