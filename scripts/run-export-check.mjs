import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { absolute, fingerprint, readJson } from './lib.mjs';
import { loadAdapter } from '../tests/product/load-adapter.mjs';

const config = await readJson('harness/config.json');
try { await access(absolute(config.exportManifest)); } catch { throw new Error('EXPORTS_NOT_VERIFIED: 実際のアプリからPNG/PDFを出力するE2Eを先に実行してください。'); }
const manifest = await readJson(config.exportManifest);
if (manifest.sourceFingerprint !== await fingerprint() || manifest.phase !== config.phase) throw new Error('STALE_EXPORTS: 現在のソースと段階で出力を作り直してください。');
const fixtures = (await readJson('fixtures/manifest.json')).fixtures;
const fixture = fixtures.find(item => item.id === manifest.fixtureId);
if (!fixture || fixture.sourceSha256 !== manifest.fixtureSourceSha256) throw new Error('Export fixture mismatch');
const adapter = await loadAdapter();
const { readText } = await import('./lib.mjs');
if (manifest.expectedPages !== adapter.paginate(adapter.parse(await readText(fixture.file)), adapter.defaultStyle()).pages.length) throw new Error('Export page count does not match the current layout');
for (const file of [config.exportManifest, ...(config.additionalExportManifests ?? [])]) {
  const additional = await readJson(file);
  if (additional.sourceFingerprint !== await fingerprint() || additional.phase !== config.phase) throw new Error(`STALE_EXPORTS: ${file}`);
  const result = spawnSync(process.env.BOOKMAKER_PYTHON ?? 'python', [absolute('scripts/verify-exports.py'), absolute(file), config.phase, config.pdfProfile], { cwd: absolute(''), stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
}
