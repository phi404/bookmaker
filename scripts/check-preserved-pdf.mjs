import { spawnSync } from 'node:child_process';
import { absolute, fingerprint, readJson } from './lib.mjs';

const directory = 'output/remaining-2026-10-22/pdf-preservation';
const manifest = await readJson(directory + '/manifest.json');
if (manifest.sourceFingerprint !== await fingerprint()) throw new Error('STALE_EXPORTS: 素材PDFを保持した出力を作り直してください。');
const result = spawnSync(process.env.BOOKMAKER_PYTHON ?? 'python', [absolute('scripts/verify-preserved-pdf.py'), absolute(directory)], { cwd: absolute(''), stdio: 'inherit' });
if (result.error) throw result.error;
if (result.status !== 0) process.exitCode = result.status ?? 1;
