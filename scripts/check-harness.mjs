import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { absolute, hash, readJson, walk } from './lib.mjs';
import { checkFixtures } from './generate-fixtures.mjs';

const documentPurposes = ['entry', 'development', 'navigation', 'product', 'principles', 'capabilities', 'roadmap', 'architecture', 'book-model', 'typography', 'source-format', 'interaction', 'acceptance', 'harness', 'evidence', 'decisions', 'cases', 'provenance', 'history-navigation', 'deployment'];

export function validateDocuments(registry, files) {
  const errors = [], paths = new Set(), entries = new Map(), owned = new Set();
  if (registry?.schemaVersion !== 1 || !Array.isArray(registry.documents) || !registry.owners || typeof registry.owners !== 'object' || Array.isArray(registry.owners)) return ['Invalid documentation registry'];
  for (const entry of registry.documents) {
    const file = entry.path;
    if (typeof file !== 'string' || !/^(?:README\.md|AGENTS\.md|(?:docs|sources)\/.+\.md)$/u.test(file) || file.includes('\\') || file.split('/').some(part => !part || part === '.' || part === '..')) { errors.push(`Invalid document path: ${file}`); continue; }
    if (paths.has(file)) errors.push(`Duplicate document: ${file}`);
    paths.add(file); entries.set(file, entry);
    if (typeof entry.purpose !== 'string' || !entry.purpose.trim() || !['current', 'history', 'source', 'template'].includes(entry.kind)) errors.push(`Invalid document purpose/kind: ${file}`);
    if (!files.includes(file)) errors.push(`Missing registered document: ${file}`);
  }
  for (const file of files) if (!paths.has(file)) errors.push(`Unregistered document: ${file}`);
  for (const purpose of documentPurposes) {
    const file = registry.owners[purpose];
    if (!file) { errors.push(`Missing owner: ${purpose}`); continue; }
    if (owned.has(file)) errors.push(`Shared owner: ${file}`);
    owned.add(file);
    if (entries.get(file)?.kind !== 'current') errors.push(`Owner must be current: ${purpose} -> ${file}`);
    if (entries.get(file)?.purpose !== purpose) errors.push(`Owner purpose mismatch: ${purpose} -> ${file}`);
  }
  for (const purpose of Object.keys(registry.owners)) if (!documentPurposes.includes(purpose)) errors.push(`Unknown owner purpose: ${purpose}`);
  for (const entry of registry.documents) if (entry.kind === 'current' && registry.owners[entry.purpose] !== entry.path) errors.push(`Current document needs one owner: ${entry.path}`);
  return errors;
}

export function validateRequirements(requirements, fixtureIds, specificationPaths) {
  const errors = [], ids = new Set();
  for (const item of requirements) {
    if (!item.id || ids.has(item.id)) errors.push(`Duplicate/missing requirement ID: ${item.id}`);
    ids.add(item.id);
    if (!['slice-1', 'mvp'].includes(item.phase)) errors.push(`${item.id}: unknown phase`);
    if (!item.summary || !item.automated?.length || !item.manual?.length) errors.push(`${item.id}: needs an automated route and manual review`);
    if (specificationPaths && !specificationPaths.has(item.specification)) errors.push(`${item.id}: needs a current specification document`);
    for (const id of item.fixtures ?? []) if (!fixtureIds.has(id)) errors.push(`${item.id}: unknown fixture ${id}`);
    for (const route of item.automated ?? []) if (!['product', 'e2e', 'visual', 'exports', 'boundary'].includes(route)) errors.push(`${item.id}: unknown verification route ${route}`);
  }
  return errors;
}

export async function checkHarness() {
  await checkFixtures();
  const original = await readFile(absolute('docs/PRODUCT_OVERVIEW.md'));
  if (hash(original) !== 'e1c440dbba1bf375370165050be40ec18ef5953403da1206afc4530c10d12107') throw new Error('共有された仕様原本が変更されています。派生仕様は別文書で更新してください。');
  const registry = await readJson('harness/documents.json');
  const maintained = ['README.md', 'AGENTS.md', ...await walk('docs'), ...await walk('sources')].filter(file => file.endsWith('.md'));
  const documentErrors = validateDocuments(registry, maintained);
  if (documentErrors.length) throw new Error(documentErrors.join('\n'));
  for (const file of maintained) if ((await readFile(absolute(file), 'utf8')).trim().length < 100) throw new Error(`Missing/empty document: ${file}`);
  const markdown = [...maintained, ...await walk('fixtures')].filter(file => file.endsWith('.md'));
  for (const file of markdown) {
    const text = await readFile(absolute(file), 'utf8');
    for (const match of text.matchAll(/\]\(([^\s)]+)\)/gu)) {
      const link = match[1];
      if (/^(?:[a-z]+:|#)/iu.test(link)) continue;
      const target = path.resolve(path.dirname(absolute(file)), link.split('#')[0]);
      if (!target.startsWith(absolute('') + path.sep)) throw new Error(`Repository link escapes workspace: ${file} -> ${link}`);
      await stat(target).catch(() => { throw new Error(`Broken link: ${file} -> ${link}`); });
    }
  }
  const manifest = await readJson('fixtures/manifest.json');
  const model = await readJson('fixtures/model/manifest.json');
  if (model.schemaVersion !== 1 || !Array.isArray(model.fixtures) || !model.fixtures.length) throw new Error('Missing model fixtures');
  const fixtureIds = new Set(manifest.fixtures.map(item => item.id));
  for (const fixture of model.fixtures) {
    if (fixtureIds.has(fixture.id) || !/^model-[a-z-]+$/u.test(fixture.id) || !/^fixtures\/model\/[a-z-]+\.(?:md|json)$/u.test(fixture.file) || hash(await readFile(absolute(fixture.file))) !== fixture.sourceSha256) throw new Error('Model fixture ID/path/hash mismatch');
    fixtureIds.add(fixture.id);
  }
  const requirements = await readJson('harness/requirements.json');
  const book = await readJson('fixtures/book/manifest.json');
  if (book.schemaVersion !== 1 || !Array.isArray(book.fixtures) || !book.fixtures.length) throw new Error('Missing book fixtures');
  for (const fixture of book.fixtures) {
    if (fixtureIds.has(fixture.id) || !/^book-[a-z-]+$/u.test(fixture.id) || !/^fixtures\/book\/[a-z-]+\.(?:md|svg)$/u.test(fixture.file) || hash(await readFile(absolute(fixture.file))) !== fixture.sourceSha256) throw new Error('Book fixture ID/path/hash mismatch');
    fixtureIds.add(fixture.id);
  }
  const specificationPaths = new Set(registry.documents.filter(item => item.kind === 'current').map(item => item.path));
  const errors = validateRequirements(requirements.requirements, fixtureIds, specificationPaths);
  if (errors.length) throw new Error(errors.join('\n'));
  const config = await readJson('harness/config.json');
  if (!['slice-1', 'mvp'].includes(config.phase) || !['raster', 'text'].includes(config.pdfProfile)) throw new Error('Unknown phase/PDF profile');
  const review = await readJson(config.manualReview);
  for (const item of Object.values(review.items)) if (!['unknown', 'pass', 'fail'].includes(item.status)) throw new Error('Invalid manual review status');
  return { documents: maintained.length, fixtures: manifest.fixtures.length, modelFixtures: model.fixtures.length, bookFixtures: book.fixtures.length, requirements: requirements.requirements.length };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) console.log(await checkHarness());
