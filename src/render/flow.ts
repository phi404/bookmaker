import type { BookStyle, FlowLine, Inline } from '../domain/contracts.js';
import { advance, graphemes } from '../domain/style.js';
const n=(v:number)=>Number(v.toFixed(5)),width=(s:string)=>graphemes(s).reduce((sum,g)=>sum+advance(g),0);
export function renderFlowLine(line: FlowLine,style: BookStyle,escape:(s:string)=>string):string {
  const vertical=style.writingMode==='vertical-rl',out:string[]=[],font=style.fontPt*25.4/72;let x=line.xMm!,y=line.yMm!;
  const text=(value:string,px:number,py:number,size:number,attrs:string='',orientation='mixed')=>`<text ${attrs} x="${n(px)}" y="${n(py)}" font-size="${n(size)}" writing-mode="${vertical?'vertical-rl':'horizontal-tb'}" text-orientation="${orientation}"${vertical?' dominant-baseline="central"':''}>${escape(value)}</text>`;
  const marks=(run:Inline,value:string,px:number,py:number,size:number)=>{
    if(!run.emphasis||run.emphasis==='none')return;let offset=0;
    for(const g of graphemes(value)){const a=vertical&&run.orientation==='upright'&&/^[0-9A-Za-z]$/u.test(g)?1:advance(g),center=(offset+a/2)*size;offset+=a;if(/^[\s　、。！？「」『』（）]/u.test(g))continue;
      const cx=vertical?px+(run.kind==='ruby'?-.72:.7)*size:px+center,cy=vertical?py+center:py-(run.kind==='ruby'?1.22:.72)*size;
      if(run.emphasis==='dot'||run.emphasis==='circle')out.push(`<circle data-emphasis="${run.emphasis}" cx="${n(cx)}" cy="${n(cy)}" r="${n(size*.075)}"${run.emphasis==='circle'?` fill="none" stroke="currentColor" stroke-width="${n(size*.035)}"`:''}/>`);
      else if(run.emphasis==='triangle')out.push(`<path data-emphasis="triangle" d="M${n(cx)} ${n(cy-size*.1)}l${n(size*.09)} ${n(size*.16)}h${n(-size*.18)}Z"/>`);
      else out.push(`<ellipse data-emphasis="sesame" cx="${n(cx)}" cy="${n(cy)}" rx="${n(size*.055)}" ry="${n(size*.12)}" transform="rotate(28 ${n(cx)} ${n(cy)})"/>`);
    }
  };
  for(let i=0;i<line.runs.length;i++){
    const run=line.runs[i]!,size=run.sizeMm??font,span=(run.advanceEm??1)*font,value=run.displayText??(run.kind==='text'?run.text:run.base),weight=run.fontWeight===700?' font-weight="700"':'';
    const attrs=`data-body="${run.kind==='ruby'?'ruby-base':'text'}"${weight}${line.heading?' data-heading="true"':''}${run.orientation?` data-orientation="${run.orientation}"`:''}${run.displayText?` data-source-text="${escape(run.kind==='text'?run.text:run.base)}"`:''}`;
    if(run.kind==='text'&&/^[―—]+$/u.test(run.text)){
      let length=span;while(line.runs[i+1]?.kind==='text'&&/^[―—]+$/u.test((line.runs[i+1] as {text:string}).text)&&line.runs[i+1]!.emphasis===run.emphasis&&line.runs[i+1]!.sizeMm===run.sizeMm)length+=(line.runs[++i]!.advanceEm??1)*font;
      out.push(`<line data-dash="continuous" x1="${n(x)}" y1="${n(y)}" x2="${n(vertical?x:x+length)}" y2="${n(vertical?y+length:y)}" stroke="currentColor" stroke-width="${n(size*.045)}"/>`);marks(run,'―'.repeat(Math.round(length/size)),x,y,size);if(vertical)y+=length;else x+=length;continue;
    }
    if(run.kind==='ruby'){
      const baseSpan=width(run.base)*size,baseOffset=Math.max(0,(span-baseSpan)/2);let offset=0;
      for(const g of graphemes(run.base)){out.push(text(g,vertical?x:x+baseOffset+offset,vertical?y+baseOffset+offset:y,size,attrs,run.orientation));offset+=advance(g)*size;}
      const readingSize=size*Math.min(.5,span/Math.max(size,width(run.reading)*size)),readingSpan=width(run.reading)*readingSize;offset=Math.max(0,(span-readingSpan)/2);
      for(const g of graphemes(run.reading)){out.push(text(g,vertical?x+size*.76:x+offset,vertical?y+offset:y-size*.76,readingSize,'data-ruby="reading"'));offset+=advance(g)*readingSize;}
      marks(run,run.base,vertical?x:x+baseOffset,vertical?y+baseOffset:y,size);
    }else if(run.tcy&&vertical){out.push(`<text ${attrs} data-tcy="true" x="${n(x)}" y="${n(y+size*.5)}" font-size="${n(size*.9)}" text-anchor="middle" dominant-baseline="central"${width(value)>1.1?` textLength="${n(size)}" lengthAdjust="spacingAndGlyphs"`:''}>${escape(value)}</text>`);marks(run,value,x,y,size);}
    else if(vertical&&run.orientation==='sideways'&&/^[0-9A-Za-z]+$/u.test(value)){out.push(`<text ${attrs} x="${n(x)}" y="${n(y)}" font-size="${n(size)}" dominant-baseline="central" transform="rotate(90 ${n(x)} ${n(y)})">${escape(value)}</text>`);marks(run,value,x,y,size);}
    else {out.push(text(value,x,y,size,attrs,run.orientation));marks(run,value,x,y,size);}
    if(vertical)y+=span;else x+=span;
  }
  return `<g data-block-id="${escape(line.blockId)}">${out.join('')}</g>`;
}
