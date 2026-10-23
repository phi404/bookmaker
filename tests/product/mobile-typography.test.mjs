import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { emphasisMarks } from '../../dist/render/emphasis.js';
import { verticalText } from '../../dist/render/text.js';
import { VERTICAL_FONT_SHA256, VERTICAL_UNICODE_SHA256 } from '../../dist/render/vertical-font.js';

test('vertical glyph resources are reproducible from the pinned font and official Unicode data',async()=>{
  const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash(await readFile(new URL('../../public/fonts/NotoSerifJP-Regular.otf',import.meta.url))),VERTICAL_FONT_SHA256);
  assert.equal(hash(await readFile(new URL('../../fixtures/unicode/VerticalOrientation-17.0.0.txt',import.meta.url))),VERTICAL_UNICODE_SHA256);
  execFileSync(process.execPath,['scripts/vertical-font.mjs','--check'],{stdio:'pipe'});
});
test('emphasis uses one mark for a combined numeral cell and none for surrounding punctuation',()=>{
  for(const emphasis of ['sesame','dot','circle','triangle']){
    const run={kind:'text',text:'12',emphasis,tcy:true},marks=emphasisMarks(run,'12',10,20,4);
    assert.equal((marks.match(/data-emphasis=/gu)??[]).length,1);assert.match(marks,emphasis==='triangle'?/M12\.8 21\.6/u:/cx="12\.8" cy="22"/u);
    assert.equal(emphasisMarks({...run,tcy:false},'「」『』、。！？（）［］｛｝〈〉《》【】・…　',10,20,4),'');
    assert.equal((emphasisMarks({...run,kind:'ruby',base:'雨音',reading:'あまおと',tcy:false},'雨音',10,20,4).match(/data-emphasis=/gu)??[]).length,2);
  }
});
test('Unicode orientation and vertical alternates retain full grapheme text and explicit Latin overrides',()=>{
  const escape=s=>s;for(const g of ['か\u3099','葛\u{E0100}','👨‍👩‍👧‍👦']){const svg=verticalText(g,10,20,4,escape);assert.ok(svg.includes('>'+g+'</text>'));assert.doesNotMatch(svg,/rotate\(90/u);}
  assert.match(verticalText('é',10,20,4,escape),/rotate\(90/u);
  assert.doesNotMatch(verticalText('A',10,20,4,escape,'','upright'),/rotate\(90/u);
  for(const g of ['「','、','ぁ','ー'])assert.ok(verticalText(g,10,20,4,escape).includes('data-vertical-glyph="'+g+'"'));
});

test('upright Latin ruby reserves full-height cells matching its emphasis centers',async()=>{
  const {createBook}=await import('../../dist/domain/book.js'),{typesetPublication}=await import('../../dist/typesetting/publication.js');const b=createBook('[｜AB《英》]{orientation="upright" emphasis="dot"}'),run=typesetPublication(b).pages[0].lines[0].runs[0];assert.equal(run.kind,'ruby');assert.equal(run.orientation,'upright');assert.equal(run.advanceEm,2);
});
