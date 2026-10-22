import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = fileURLToPath(new URL('../', import.meta.url));
export const absolute = relative => path.resolve(root, relative);
export const posix = value => value.split(path.sep).join('/');
export const hash = value => createHash('sha256').update(value).digest('hex');
export const readText = relative => readFile(absolute(relative), 'utf8');
export const readJson = async relative => JSON.parse(await readText(relative));
export async function walk(relative) {
  const files = [];
  for (const entry of await readdir(absolute(relative), { withFileTypes: true })) {
    if (entry.name === '__pycache__') continue;
    const item = posix(path.join(relative, entry.name));
    if (entry.isDirectory()) files.push(...await walk(item));
    else if (entry.isFile()) files.push(item);
  }
  return files.sort();
}
export async function fingerprint() {
  const files = ['requirements-qa.txt', 'package.json', 'package-lock.json', 'README.md', 'AGENTS.md', '.gitattributes', '.gitignore', '.node-version', 'eslint.config.mjs', 'playwright.config.mjs', 'playwright.compatibility.config.mjs', 'tsconfig.json', 'tsconfig.build.json', 'harness/config.json', 'harness/boundaries.json', 'harness/requirements.json', 'harness/documents.json', ...await walk('.github'),
    ...await walk('src'), ...await walk('tests'), ...await walk('fixtures'), ...await walk('docs'), ...await walk('scripts'), ...await walk('public'), ...await walk('sources')];
  const digests = await Promise.all(files.sort().map(async file => `${file}\0${hash(await readFile(absolute(file)))}`));
  return hash(digests.join('\n'));
}
