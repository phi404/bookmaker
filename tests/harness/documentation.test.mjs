import test from 'node:test';
import assert from 'node:assert/strict';
import { readJson, readText, publicDocuments } from '../../scripts/lib.mjs';
import { validateDocuments, validateRequirements } from '../../scripts/check-harness.mjs';

test('every maintained document has a purpose and each current purpose has one owner', async () => {
  const registry = await readJson('harness/documents.json');
  const files = publicDocuments;
  assert.deepEqual(validateDocuments(registry, files), []);
  assert.equal(registry.owners.guide, 'docs/guide.md');
  assert.equal(registry.owners.development, 'docs/development.md');
  assert.equal(registry.documents.length, 3);
});

test('missing owners, duplicate documents and unregistered files are rejected', async () => {
  const registry = await readJson('harness/documents.json');
  const files = registry.documents.map(item => item.path);
  const missing = globalThis.structuredClone(registry); delete missing.owners.guide;
  assert.ok(validateDocuments(missing, files).some(error => error.includes('Missing owner: guide')));
  const duplicate = globalThis.structuredClone(registry); duplicate.documents.push(duplicate.documents[0]);
  assert.ok(validateDocuments(duplicate, files).some(error => error.includes('Duplicate document')));
  assert.ok(validateDocuments(registry, [...files, 'docs/UNREGISTERED.md']).some(error => error.includes('Unregistered document')));
});

test('historical or source files cannot become current specification owners', async () => {
  const registry = await readJson('harness/documents.json');
  const bad = globalThis.structuredClone(registry); bad.documents.push({ path: 'docs/notes.md', kind: 'history', purpose: 'guide' }); bad.owners.guide = 'docs/notes.md';
  assert.ok(validateDocuments(bad, bad.documents.map(item => item.path)).some(error => error.includes('Owner must be current')));
  const doubled = globalThis.structuredClone(registry); doubled.owners.development = doubled.owners.guide;
  assert.ok(validateDocuments(doubled, doubled.documents.map(item => item.path)).some(error => error.includes('Shared owner')));
});

test('requirement specifications reference current documents rather than historical plans', async () => {
  const registry = await readJson('harness/documents.json');
  const requirements = (await readJson('harness/requirements.json')).requirements;
  const fixtures = new Set(requirements.flatMap(item => item.fixtures));
  const current = new Set(registry.documents.filter(item => item.kind === 'current').map(item => item.path));
  assert.deepEqual(validateRequirements(requirements, fixtures, current), []);
  assert.ok(validateRequirements([{ ...requirements[0], specification: 'docs/tasks/FIRST_SLICE.md' }], fixtures, current).some(error => error.includes('current specification')));
  const missing = { ...requirements[0] }; delete missing.specification;
  assert.ok(validateRequirements([missing], fixtures, current).some(error => error.includes('current specification')));
});

test('documentation links are portable without generated output or machine-specific paths', async () => {
  const registry = await readJson('harness/documents.json'), errors = [];
  for (const entry of registry.documents.filter(item => item.kind !== 'source')) {
    const text = await readText(entry.path);
    for (const match of text.matchAll(/\]\((?:<([^>]+)>|([^\s)]+))\)/gu)) {
      const link = match[1] ?? match[2];
      if (/^[a-z]:[\\/]/iu.test(link) || /(?:^|\/)output\//u.test(link)) errors.push(`${entry.path}: ${link}`);
    }
  }
  assert.deepEqual(errors, []);
});
