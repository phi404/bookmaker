import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { absolute, hash, readJson } from './lib.mjs';

export function validateSourceManifest(manifest) {
  if (manifest?.schemaVersion !== 1 || !Array.isArray(manifest.files) || !manifest.files.length || manifest.files.length > 100) return ['Invalid source manifest'];
  const errors = [], seen = new Set();
  for (const item of manifest.files) {
    if (typeof item.path !== 'string' || path.posix.isAbsolute(item.path) || path.win32.isAbsolute(item.path) || /^[A-Za-z]:/u.test(item.path) || item.path.includes('\\') || item.path.split('/').some(part => !part || part === '.' || part === '..')) errors.push('Invalid local source path');
    if (!/^[a-f0-9]{64}$/u.test(item.sha256 ?? '')) errors.push('Invalid source digest');
    if (seen.has(item.path)) errors.push('Duplicate local source');
    seen.add(item.path);
  }
  return errors;
}
export const sourceMatches = (bytes, sha256) => hash(bytes) === sha256;
async function bytes(file) {
  const target = await realpath(absolute(file)), root = await realpath(absolute(''));
  if (!target.startsWith(root + path.sep)) throw new Error('Local source escapes the workspace');
  return readFile(target);
}
export async function checkLocalSources() {
  const config = await readJson('harness/config.json'), manifest = await readJson(config.localSources);
  const errors = validateSourceManifest(manifest);
  if (errors.length) throw new Error(errors.join('\n'));
  for (const item of manifest.files) if (!sourceMatches(await bytes(item.path), item.sha256)) throw new Error('Local source changed: ' + item.path);
  return { status: 'pass', files: manifest.files.length };
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--init')) {
    const config = await readJson('harness/config.json'), paths = process.argv.slice(process.argv.indexOf('--init') + 1);
    const manifest = { schemaVersion: 1, files: (paths.length ? paths : ['fixtures/manifest.json']).map(file => ({ path: file, sha256: '0'.repeat(64) })) };
    const errors = validateSourceManifest(manifest); if (errors.length) throw new Error(errors.join('\n'));
    for (const item of manifest.files) item.sha256 = hash(await bytes(item.path));
    const target = absolute(config.localSources); await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' }); console.log(config.localSources);
  } else console.log(await checkLocalSources());
}
