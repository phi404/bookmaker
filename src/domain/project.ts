import { MAX_SOURCE } from './document.js';
import type { Publication } from './model.js';
import { validatePublication } from './publication.js';
import { MAX_PROJECT_BYTES } from './special.js';

export function restoreProject(json: string): Publication {
  if (json.length > MAX_PROJECT_BYTES + MAX_SOURCE * 12) throw new Error('プロジェクトが大きすぎます。');
  let value: unknown;
  try { value = JSON.parse(json); } catch { throw new Error('プロジェクトJSONを読み込めません。'); }
  return validatePublication(value);
}
export function serializeProject(project: Publication): string { return JSON.stringify(restoreProject(JSON.stringify(project)), null, 2); }
