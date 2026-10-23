/* global document, Image */
import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { absolute, fingerprint } from '../../scripts/lib.mjs';
import { BookUI } from '../e2e/ui-driver.mjs';

async function measureImage(url){
  const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);const {data,width,height}=ctx.getImageData(0,0,canvas.width,canvas.height);let minX=width,minY=height,maxX=-1,maxY=-1,count=0,sumX=0,sumY=0;
  for(let y=0;y<height;y++)for(let x=95;x<205;x++){const i=(y*width+x)*4;if(data[i]<140&&data[i+1]<140&&data[i+2]<140){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);sumX+=x;sumY+=y;count++;}}
  return {minX,minY,maxX,maxY,cx:sumX/count,cy:sumY/count};
}
function checkCells(result,key){
  const ink=g=>result.find(r=>r.g===g)[key];
  expect(ink('、').cx).toBeGreaterThan(165);expect(ink('、').cy).toBeLessThan(90);
  expect(ink('。').cx).toBeGreaterThan(165);expect(ink('。').cy).toBeLessThan(90);
  expect(ink('「').maxX-ink('「').minX).toBeGreaterThan((ink('「').maxY-ink('「').minY)*1.6);expect(ink('「').minY).toBeGreaterThan(110);
  expect(ink('」').maxY).toBeLessThan(100);
  expect(ink('ー').maxY-ink('ー').minY).toBeGreaterThan((ink('ー').maxX-ink('ー').minX)*3);
  expect(Math.abs(ink('…').cx-150)).toBeLessThan(3);
  expect(ink('…').maxY-ink('…').minY).toBeGreaterThan((ink('…').maxX-ink('…').minX)*4);
  expect(Math.abs(ink('‥').cx-150)).toBeLessThan(3);expect(ink('‥').maxY-ink('‥').minY).toBeGreaterThan(40);
  expect(ink('ぁ').cx).toBeGreaterThan(155);expect(ink('ぁ').cy).toBeLessThan(110);
  expect(Math.abs(ink('雨').cy-100)).toBeLessThan(7);
}
test('vertical glyphs and marks occupy the same character cells in preview and raster output',async({page,browser},testInfo)=>{
  await page.goto('/');const ui=new BookUI(page),source=await readFile(absolute('fixtures/book/mobile-typography.md'),'utf8');await ui.paste(source);
  const result=await page.evaluate(async()=>{
    const {createBook}=await import('/domain/book.js'),{renderPageSVG}=await import('/render/svg.js'),{rasterize}=await import('/io/raster.js');
    const base=createBook(''),size=10,rows=[];
    for(const g of ['雨','「','」','、','。','ー','…','‥','ぁ']){
      const style={...base.style,page:{widthMm:30,heightMm:30},fontPt:size*72/25.4,folio:{...base.style.folio,enabled:false},runningHeads:[]};
      const p={kind:'flow',number:1,style,lines:[{blockId:'glyph',xMm:15,yMm:5,indentEm:0,runs:[{kind:'text',text:g,sizeMm:size,advanceEm:1,emphasis:'dot'}]}]};
      const svg=renderPageSVG(p,style),host=document.createElement('div');host.innerHTML=svg;document.body.append(host);
      const body=host.querySelector('[data-body]'),bodyBox=body.getBoundingClientRect(),mark=host.querySelector('[data-emphasis]');
      const visible={body:[bodyBox.x,bodyBox.y,bodyBox.width,bodyBox.height],mark:mark?[Number(mark.getAttribute('cx')),Number(mark.getAttribute('cy'))]:null};host.remove();
      const canvas=await rasterize(p,style,false,{dpi:254});rows.push({g,svg,raster:canvas.toDataURL(),visible});canvas.width=canvas.height=0;
    }return rows;
  });
  const folder=absolute('output/mobile-typography/'+testInfo.project.name);await mkdir(folder,{recursive:true});await page.screenshot({path:folder+'/preview.png',fullPage:true});
  for(const row of result){
    row.ink=await page.evaluate(measureImage,row.raster);
    await page.evaluate(svg=>{const host=document.createElement('div');host.id='glyph-probe';host.style='position:fixed;inset:0;z-index:9999;background:white';host.innerHTML=svg;host.firstElementChild.style='width:300px;height:300px';document.body.append(host);},row.svg);
    const screenshot=await page.locator('#glyph-probe svg').screenshot({scale:'css'});await writeFile(folder+'/cell-'+row.g.codePointAt(0).toString(16)+'.png',screenshot);row.previewInk=await page.evaluate(measureImage,'data:image/png;base64,'+screenshot.toString('base64'));await page.locator('#glyph-probe').evaluate(e=>e.remove());delete row.svg;delete row.raster;
  }
  await writeFile(folder+'/glyphs.json',JSON.stringify({fingerprint:await fingerprint(),browser:browser.version(),result},null,2));
  checkCells(result,'ink');checkCells(result,'previewInk');
  expect(result.find(r=>r.g==='雨').visible.mark).toEqual([22,10]);
});

test('all dash families make centered connected strokes without touching neighbouring glyphs',async({page},testInfo)=>{
  await page.goto('/');const results=await page.evaluate(async()=>{
    const {createBook}=await import('/domain/book.js'),{advance}=await import('/domain/style.js'),{rasterize}=await import('/io/raster.js');const b=createBook(''),size=10,result=[];
    for(const g of ['‒','–','—','―','⸺','⸻','︱','︲']){
      const style={...b.style,page:{widthMm:30,heightMm:100},fontPt:size*72/25.4,folio:{...b.style.folio,enabled:false}},runs=Array.from('前'+g+g+'後').map(text=>({kind:'text',text,sizeMm:size,advanceEm:advance(text)}));
      const p={kind:'flow',number:1,style,lines:[{blockId:'dash',xMm:15,yMm:5,indentEm:0,runs}]},canvas=await rasterize(p,style,false,{dpi:254}),ctx=canvas.getContext('2d'),{data,width}=ctx.getImageData(0,0,canvas.width,canvas.height),start=150,end=start+advance(g)*200,black=(x,y)=>data[(y*width+x)*4]<140;
      let gaps=0,widest=0;for(let y=start;y<Math.floor(end);y++){if(!black(150,y))gaps++;for(let x=130;x<170;x++)if(black(x,y))widest=Math.max(widest,Math.abs(x-150));}
      const dashPage={...p,lines:[{...p.lines[0],yMm:15,runs:runs.slice(1,3)}]},afterPage={...p,lines:[{...p.lines[0],yMm:15+advance(g)*20,runs:[runs[3]]}]},dash=await rasterize(dashPage,style,false,{dpi:254}),after=await rasterize(afterPage,style,false,{dpi:254}),d=dash.getContext('2d').getImageData(0,0,dash.width,dash.height).data,a=after.getContext('2d').getImageData(0,0,after.width,after.height).data;
      let overlap=0;for(let at=0;at<d.length;at+=4)if(d[at]<140&&a[at]<140)overlap++;
      result.push({g,gaps,widest,overlap,png:canvas.toDataURL()});canvas.width=canvas.height=dash.width=dash.height=after.width=after.height=0;
    }return result;
  });
  const folder=absolute('output/mobile-typography/'+testInfo.project.name);await mkdir(folder,{recursive:true});for(const row of results){await writeFile(folder+'/dash-'+row.g.codePointAt(0).toString(16)+'.png',Buffer.from(row.png.split(',')[1],'base64'));delete row.png;}await writeFile(folder+'/dashes.json',JSON.stringify(results,null,2));
  for(const row of results){expect(row.gaps,row.g).toBe(0);expect(row.widest,row.g).toBeLessThanOrEqual(3);expect(row.overlap,row.g).toBe(0);}
});
