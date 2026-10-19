import { existsSync } from 'node:fs';
import { absolute, fingerprint, readJson } from './lib.mjs';
import { validateManualReview } from './check-manual.mjs';

const config = await readJson('harness/config.json');
const requirements = (await readJson('harness/requirements.json')).requirements;
const selected = requirements.filter(item => config.phase === 'mvp' || item.phase === 'slice-1');
const revision = await fingerprint(), review = await readJson(config.manualReview);
async function verification(kind) {
  const file = `output/verification/${kind}.json`;
  if (!existsSync(absolute(file))) return { state: 'missing', file };
  let report;
  try { report = await readJson(file); } catch (error) { return { state: 'unreadable', file, error: error.message }; }
  const current = report.sourceFingerprint === revision && report.phase === config.phase;
  return { state: current ? report.status : 'stale', recordedStatus: report.status, file, finishedAt: report.finishedAt ?? null, sourceFingerprint: report.sourceFingerprint, steps: report.steps?.map(step => ({ name: step.name, exitCode: step.exitCode })) ?? [] };
}
const [harness, product] = await Promise.all([verification('harness'), verification('product')]);
const manualErrors = validateManualReview(review, revision);
console.log(JSON.stringify({
  phase: config.phase, productAdapterPresent: existsSync(absolute(config.adapterPath)),
  productStatus: !existsSync(absolute(config.adapterPath)) ? 'not-implemented' : product.state === 'pass' && !manualErrors.length ? 'verified-at-current-fingerprint' : 'verification-required',
  requiredIds: selected.map(item => item.id), deferredIds: requirements.filter(item => !selected.includes(item)).map(item => item.id),
  sourceFingerprint: revision, verification: { harness, product },
  manual: { revision: review.revision, current: review.revision === revision, errors: manualErrors, items: Object.fromEntries(Object.entries(review.items).map(([name, item]) => [name, { status: item.status, evidence: item.evidence }])) },
}, null, 2));
