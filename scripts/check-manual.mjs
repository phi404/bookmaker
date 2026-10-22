import { stat, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { absolute, fingerprint, readJson } from './lib.mjs';

export function validateManualReview(review, revision) {
  const errors = [];
  for (const item of Object.values(review.items ?? {})) if (!['unknown', 'pass', 'fail'].includes(item.status)) errors.push('Invalid manual review status');
  if (review.revision !== revision) errors.push('目視レビューのソース指紋がありません、または古くなっています');
  if (!review.reviewer || !review.environment) errors.push('レビュー者と環境を記録してください');
  for (const name of ['default-page-quality', 'vertical-glyphs-and-spacing', 'mobile-usability', 'export-appearance', 'local-first']) {
    const item = review.items?.[name];
    if (item?.status !== 'pass' || !item.evidence) errors.push(`${name}: ${item?.status ?? 'missing'}, 証拠=${item?.evidence ?? 'なし'}`);
  }
  return errors;
}
export async function checkManual() {
  const config = await readJson('harness/config.json'), review = await readJson(config.manualReview);
  const errors = validateManualReview(review, await fingerprint());
  for (const item of Object.values(review.items)) if (item.evidence) {
    const target = absolute(item.evidence);
    if (!target.startsWith(absolute('') + path.sep)) errors.push('Evidence must be in the repository');
    else await stat(target).catch(() => errors.push(`Missing evidence: ${item.evidence}`));
  }
  if (errors.length) throw new Error(`MANUAL_REVIEW_PENDING\n${errors.join('\n')}`);
}
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  if (process.argv.includes('--init')) {
    const config = await readJson('harness/config.json'), target = absolute(config.manualReview);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, JSON.stringify({ revision: await fingerprint(), reviewer: '', environment: '', items: Object.fromEntries(['default-page-quality', 'vertical-glyphs-and-spacing', 'mobile-usability', 'export-appearance', 'local-first'].map(name => [name, { status: 'unknown', evidence: '' }])) }, null, 2) + '\n', { flag: 'wx' });
    console.log(config.manualReview);
  } else await checkManual();
}
