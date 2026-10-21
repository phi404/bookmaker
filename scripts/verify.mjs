import { mkdir, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { absolute, fingerprint, readJson, walk } from './lib.mjs';

const harnessOnly = process.argv.includes('--harness-only');
const steps = [
  ['lint', ['node_modules/eslint/bin/eslint.js', '.']],
  ['boundaries', ['scripts/check-boundaries.mjs']],
  ['test-policy', ['scripts/check-test-policy.mjs']],
  ['typecheck', ['node_modules/typescript/bin/tsc', '--noEmit']],
  ['harness-integrity', ['scripts/check-harness.mjs']],
  ['harness-tests', ['--test', ...(await walk('tests/harness')).filter(file => file.endsWith('.test.mjs'))]],
];
if (!harnessOnly) steps.push(
  ['build', ['scripts/build.mjs']],
  ['product-tests', ['--test', ...(await walk('tests/product')).filter(file => file.endsWith('.test.mjs'))]],
  ['e2e-1', ['scripts/browser-test.mjs', '--grep', '@flow', '--shard', '1/3']],
  ['e2e-2', ['scripts/browser-test.mjs', '--grep', '@flow', '--shard', '2/3']],
  ['e2e-3', ['scripts/browser-test.mjs', '--grep', '@flow', '--shard', '3/3']],
  ['visual', ['scripts/browser-test.mjs', '--grep', '@visual']],
  ['exports', ['scripts/run-export-check.mjs']],
  ['manual-review', ['scripts/check-manual.mjs']],
);
const report = { kind: harnessOnly ? 'harness' : 'product', startedAt: new Date().toISOString(), phase: (await readJson('harness/config.json')).phase, node: process.version, platform: process.platform, sourceFingerprint: await fingerprint(), status: 'running', steps: [] };
for (const [name, args] of steps) {
  console.log(`\n[${name}]`);
  const started = Date.now();
  const result = spawnSync(process.execPath, args, { cwd: absolute(''), encoding: 'utf8', timeout: 180000 });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  const exitCode = result.status ?? 1;
  report.steps.push({ name, command: ['node', ...args], exitCode, durationMs: Date.now() - started, error: result.error?.message ?? null });
  if (exitCode !== 0) { report.status = 'fail'; break; }
}
if (report.status === 'running') report.status = 'pass';
report.finishedAt = new Date().toISOString();
await mkdir(absolute('output/verification'), { recursive: true });
await writeFile(absolute(`output/verification/${report.kind}.json`), JSON.stringify(report, null, 2) + '\n');
console.log(`\n${report.kind.toUpperCase()}: ${report.status}. output/verification/${report.kind}.json`);
if (report.status !== 'pass') process.exitCode = 1;
