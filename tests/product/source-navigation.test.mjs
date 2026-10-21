import test from 'node:test';
import assert from 'node:assert/strict';
import { createBook, editBookSource, sourceRangeFor } from '../../dist/domain/book.js';
import { bookSourceMap, textSourceRange, sourceTextRanges } from '../../dist/domain/source-map.js';
import { parseInlines, parseInlinesWithMap } from '../../dist/domain/document.js';
import { flattenDocument } from '../../dist/domain/publication.js';
import { typesetPublication } from '../../dist/typesetting/publication.js';
import { renderPageSVG } from '../../dist/render/svg.js';
import { findSourceMatches, replaceSourceMatches } from '../../dist/domain/source-search.js';

test('source positions come from the parser through nested styles, escapes, unknown syntax and ruby', () => {
  const input='***｜雨音《あまおと》*** [丸]{.circle} [太い]{fontWeight="700"} \\* 👨‍👩‍👧‍👦 が [未]{unknown="x"}';
  const mapped=parseInlinesWithMap(input);assert.deepEqual(mapped.inlines,parseInlines(input,undefined,true));
  const text=mapped.inlines.map(r=>r.kind==='ruby'?r.base:r.text).join('');
  for(const span of mapped.spans.filter(s=>s.part==='text')) assert.equal(input.slice(span.sourceFrom,span.sourceTo).replace(/^\\/u,''),text.slice(span.from,span.to));
  assert.equal(input.slice(...['sourceFrom','sourceTo'].map(k=>mapped.spans.find(s=>s.part==='reading')[k])),'あまおと');
  assert.equal(text,'雨音 丸 太い * 👨‍👩‍👧‍👦 が [未]{unknown="x"}');
});

test('raw manuscript offsets preserve BOM, CRLF, headings, quotes, fences and combining clusters', () => {
  const source='\uFEFF# 章\r\n:::center\r\n> **雨**と｜音《おと》、が👨‍👩‍👧‍👦。\r\n:::\r\n```\r\n**文字**\r\n```';
  const book=createBook(source),blocks=flattenDocument(book.document),map=bookSourceMap(book),body=blocks.find(b=>b.role==='quote');
  const base=textSourceRange(map,body.id,2,3);assert.equal(source.slice(base.from,base.to),'音');
  const reading=textSourceRange(map,body.id,2,3,'reading');assert.equal(source.slice(reading.from,reading.to),'おと');
  const family=textSourceRange(map,body.id,6,17);assert.equal(source.slice(family.from,family.to),'👨‍👩‍👧‍👦');
  assert.equal(source.slice(sourceRangeFor(book,body.id).from,sourceRangeFor(book,body.id).to),'> **雨**と｜音《おと》、が👨‍👩‍👧‍👦。');
  assert.deepEqual(sourceTextRanges(map,reading.from,reading.to),[{blockId:body.id,from:2,to:3}]);
  const literal=blocks.find(b=>'inlines'in b&&b.inlines.some(r=>r.text==='**文字**'));assert.equal(map.filter(s=>s.blockId===literal.id&&s.part==='text').length,6);
  assert.deepEqual(bookSourceMap(editBookSource(book,source+'\n:::format broken').book),[]);
});

test('generated paper positions retain every source cluster after wrapping, ruby splitting, TCY and dash joining', () => {
  const source='# 章\n　12｜長い親文字《とてもながいよみかたのれい》と――が👨‍👩‍👧‍👦。';const book=createBook(source);book.style.maxCharsPerLine=7;
  const result=typesetPublication(book),map=bookSourceMap(book),body=flattenDocument(book.document).find(b=>b.kind==='paragraph'),runs=result.pages.flatMap(p=>p.lines).filter(l=>l.blockId===body.id).flatMap(l=>l.runs);
  assert.equal(runs[0].textFrom,0);for(let i=1;i<runs.length;i++)assert.equal(runs[i].textFrom,runs[i-1].textTo);
  assert.equal(runs.at(-1).textTo,'　12長い親文字と――が👨‍👩‍👧‍👦。'.length);
  for(const run of runs){const r=textSourceRange(map,body.id,run.textFrom,run.textTo);assert.ok(r);}
  const svg=result.pages.map(p=>renderPageSVG(p,book.style)).join('');assert.match(svg,/data-text-from="\d+" data-text-to="\d+"/u);assert.match(svg,/data-tcy="true"/u);assert.match(svg,/data-ruby="reading" data-text-from=/u);
});

test('literal search and replacement preserve source notation and make ranges explicit', () => {
  const source='雨 **雨** ｜雨《あめ》 [雨]{.dot}\r\nA+a a+A $& 👨‍👩‍👧‍👦';
  const matches=findSourceMatches(source,{query:'雨'});assert.equal(matches.length,4);
  const range={from:source.indexOf('**'),to:source.indexOf('\r')};assert.equal(findSourceMatches(source,{query:'雨',range}).length,3);
  assert.equal(findSourceMatches(source,{query:'a+a'}).length,2);assert.equal(findSourceMatches(source,{query:'a+a',caseSensitive:true}).length,0);
  assert.equal(replaceSourceMatches(source,matches,'$&').source,'$& **$&** ｜$&《あめ》 [$&]{.dot}\r\nA+a a+A $& 👨‍👩‍👧‍👦');
  assert.equal(replaceSourceMatches(source,findSourceMatches(source,{query:'👨‍👩‍👧‍👦'}),'家族').source.endsWith('家族'),true);
  assert.deepEqual(findSourceMatches(source,{query:''}),[]);assert.throws(()=>replaceSourceMatches('a'.repeat(500000),[{from:0,to:1}],'aa'),/50万/u);assert.throws(()=>replaceSourceMatches(source,[{from:3,to:2}],'x'),/位置/u);
});
