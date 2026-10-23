import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SAMPLE } from '../../dist/domain/sample.js';
import { createPublication, flattenDocument } from '../../dist/domain/publication.js';

const sha256 = value => createHash('sha256').update(value).digest('hex');

// Independent values from Aozora's 628_14895.html (2012-05-08 revision).
// Original SHA-256: b5349b05e15045ce567769ccce400c176c7657ede7fcd65eacc898c5c4c552b0.
test('Gongitsune sample preserves the complete Aozora body, six chapters, ruby and sesame emphasis', () => {
  assert.equal(SAMPLE.title, 'ごん狐'); assert.equal(SAMPLE.author, '新美南吉');
  const book = createPublication(SAMPLE.source), blocks = flattenDocument(book.document);
  const body = blocks.filter(block => 'inlines' in block).map(block => block.inlines.map(run => run.kind === 'ruby' ? run.base : run.text).join('')).filter(Boolean);
  assert.equal(body.length, 82);
  assert.equal(sha256(body.join('\n')), 'dfa716ba55c123f59d7cd1e82b743fa667443832a1ab3cd43052e871e7409648');
  assert.deepEqual(book.document.children.map(section => section.children[0]).map(block => [block.kind, block.level, block.inlines.map(run => run.text).join('')]), ['一','二','三','四','五','六'].map(name => ['heading', 1, name]));
  const runs = blocks.flatMap(block => 'inlines' in block ? block.inlines : []), rubies = runs.filter(run => run.kind === 'ruby').map(run => [run.base, run.reading]);
  assert.equal(rubies.length, 69);
  assert.equal(sha256(JSON.stringify(rubies)), '8dc51d393cda1737d8328bcd918e9bb402e5474b3ede06219de26caec8acfc46');
  assert.deepEqual(runs.filter(run => run.emphasis === 'sesame').map(run => run.text), ['しだ','がら','はりきり','はりきり','うなぎ','きす','はりきり','はん','はりきり']);
  assert.ok(!SAMPLE.source.includes('［＃'));
});
