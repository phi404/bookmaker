import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { performance } from 'node:perf_hooks';
import { createBook } from '../dist/domain/book.js';
import { layoutInput, resolveLayoutAssets } from '../dist/domain/layout-input.js';
import { typesetPublication } from '../dist/typesetting/publication.js';
import { absolute, fingerprint } from './lib.mjs';

const percentile = (values, fraction) => [...values].sort((a, b) => a - b)[Math.min(values.length - 1, Math.ceil(values.length * fraction) - 1)];
const report = { environment: { node: process.version, platform: process.platform, arch: process.arch }, sourceFingerprint: await fingerprint(), runtime: 'Node; not real phones or browser-memory evidence', cases: [] };
for (const length of [100000, 500000]) {
  const unit = '　時間が静かに流れ、ページが続いていく。\n', source = unit.repeat(Math.ceil(length / unit.length)).slice(0, length), book = createBook(source), durations = [];
  let pages = 0;
  for (let trial = 0; trial < 7; trial++) {
    const started = performance.now(), result = typesetPublication(layoutInput(book));
    const duration = performance.now() - started; pages = result.pages.length; if (trial) durations.push(duration);
    const actual = result.pages.flatMap(p => p.lines.flatMap(l => l.runs.map(r => r.kind === 'ruby' ? r.base : r.text))).join('');
    if (actual !== source.replaceAll('\n', '')) throw new Error('Long manuscript changed');
  }
  report.cases.push({ codeUnits: source.length, pages, trials: durations.length, medianMs: percentile(durations, .5), p95Ms: percentile(durations, .95), maxRSSKiB: process.resourceUsage().maxRSS });
}
try {
  const fixture = JSON.parse(await readFile(absolute('output/remaining-2026-10-22/pdf-preservation/book.book.json'), 'utf8'));
  const book = { ...fixture, assets: Array.from({ length: 64 }, (_, index) => ({ ...fixture.assets[0], id: index ? `copy-${index}` : fixture.assets[0].id })) };
  const input = layoutInput(book), raw = typesetPublication(input), hydrated = resolveLayoutAssets(raw, book);
  const bytes = value => Buffer.byteLength(JSON.stringify(value));
  report.transfer = { assets: book.assets.length, canonicalJSONBytes: bytes(book), layoutInputJSONBytes: bytes(input), inputReduction: 1 - bytes(input) / bytes(book), resultJSONBytes: bytes(raw), hydratedJSONBytes: bytes(hydrated), caveat: 'JSON-size equivalents; not a serialized-wire measurement or memory upper bound' };
} catch (error) { report.transfer = { status: 'not-measured', reason: error.message }; }
await mkdir(absolute('output/performance'), { recursive: true }); await writeFile(absolute('output/performance/layout.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
