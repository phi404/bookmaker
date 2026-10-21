import test from 'node:test';
import assert from 'node:assert/strict';
import { latestJob } from '../../dist/ui/latest-job.js';

test('layout requests retain only the running snapshot and the newest pending revision',()=>{
  const sent=[],queue=latestJob(job=>sent.push(job));queue.submit({revision:1,value:'first'});
  for(let revision=2;revision<=100;revision++)queue.submit({revision,value:`edit ${revision}`});
  assert.deepEqual(sent,[{revision:1,value:'first'}]);queue.complete(999);assert.equal(sent.length,1);
  queue.complete(1);assert.deepEqual(sent.at(-1),{revision:100,value:'edit 100'});assert.equal(sent.length,2);
  queue.complete(1);queue.submit({revision:99,value:'late'});assert.equal(sent.length,2);
  queue.complete(100);queue.submit({revision:101,value:'next'});assert.equal(sent.at(-1).value,'next');
  queue.clear();queue.submit({revision:102,value:'recovered'});assert.equal(sent.at(-1).value,'recovered');
});
