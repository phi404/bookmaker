import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceMatches, validateSourceManifest } from '../../scripts/check-local-sources.mjs';

const abc = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad';
test('local reference bytes must match the recorded independent digest', () => {
  assert.equal(sourceMatches(Buffer.from('abc'), abc), true);
  assert.equal(sourceMatches(Buffer.from('abd'), abc), false);
});
test('local reference lists reject missing, duplicate or escaping paths', () => {
  const file = { path: 'fixtures/reference.txt', sha256: abc };
  assert.deepEqual(validateSourceManifest({ schemaVersion: 1, files: [file] }), []);
  assert.ok(validateSourceManifest({ schemaVersion: 1, files: [] }).length);
  assert.ok(validateSourceManifest({ schemaVersion: 1, files: [file, file] }).length);
  for (const path of ['../outside', '/outside', 'C:/outside', 'C:outside', '//host/share', 'a/../outside', 'a\\outside']) assert.ok(validateSourceManifest({ schemaVersion: 1, files: [{ ...file, path }] }).length);
  assert.ok(validateSourceManifest({ schemaVersion: 1, files: [{ ...file, sha256: 'bad' }] }).length);
});
