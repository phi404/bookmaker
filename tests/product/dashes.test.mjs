import test from 'node:test';
import assert from 'node:assert/strict';
import {createBook} from '../../dist/domain/book.js';
import {typesetPublication} from '../../dist/typesetting/publication.js';
import {renderPageSVG} from '../../dist/render/svg.js';
import {advance} from '../../dist/domain/style.js';

test('dash families reserve their intended width and join without covering neighbouring text',()=>{
  for(const [g,length] of [['‒',.557],['–',.5],['—',1],['―',1],['⸺',2],['⸻',3],['︱',1],['︲',.5]]){
    assert.equal(advance(g),length,'advance of '+g);
    for(const writingMode of ['vertical-rl','horizontal-tb']){
      const book=createBook('前'+g.repeat(2)+'後');book.style.writingMode=writingMode;const result=typesetPublication(book),page=result.pages[0],svg=renderPageSVG(page,book.style),line=svg.match(/<line data-dash="continuous"([^>]+)>/u);assert.ok(line,'continuous '+g);
      const attr=name=>Number(line[1].match(new RegExp(name+'="([^"]+)"','u'))[1]),size=book.style.fontPt*25.4/72;
      assert.ok(Math.abs((writingMode==='vertical-rl'?attr('y2')-attr('y1'):attr('x2')-attr('x1'))-length*2*size)<.00002);
      const plain=result.pages.flatMap(p=>p.lines.flatMap(l=>l.runs.map(r=>r.text))).join('');assert.equal(plain,'前'+g.repeat(2)+'後');
    }
  }
});
test('hyphen, minus and prolonged sound marks retain their own glyphs',()=>{
  const b=createBook('ハイフン-‐‑ マイナス−－ 長音ー');const svg=typesetPublication(b).pages.map(p=>renderPageSVG(p,b.style)).join('');assert.doesNotMatch(svg,/data-dash=/u);assert.ok(svg.includes('data-vertical-glyph="ー"'));
});

test('free-page vertical dashes join and heading/body dash sizes keep their own stroke',async()=>{
  const {verticalText}=await import('../../dist/render/text.js');const svg=verticalText('前⸺⸻後',10,20,4,s=>s);
  assert.equal((svg.match(/data-dash=/gu)??[]).length,1);assert.match(svg,/y1="24"[^>]*y2="44"/u);
  const b=createBook('前—**—**後');const out=typesetPublication(b).pages.map(p=>renderPageSVG(p,b.style)).join('');assert.equal((out.match(/data-dash=/gu)??[]).length,2);
});
