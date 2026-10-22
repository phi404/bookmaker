import type { Publication } from '../domain/model.js';
import { validatePublication } from '../domain/publication.js';
import { object } from '../domain/validation.js';

export interface Draft { schemaVersion: 3; project: Publication; marginOffset: number }
const KEY = 'bookmaker-slice-draft-v1';
export function restoreDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const parsed = JSON.parse(raw) as unknown;
    if ((parsed as { schemaVersion?: number })?.schemaVersion === 3) {
      object(parsed, ['schemaVersion', 'project', 'marginOffset'], '端末内の下書き');
      if (!Number.isFinite(parsed.marginOffset) || (parsed.marginOffset as number) < -3 || (parsed.marginOffset as number) > 5) throw new Error('Invalid offset');
      return { schemaVersion: 3, project: validatePublication(parsed.project), marginOffset: parsed.marginOffset as number };
    }
    throw new Error('Unsupported draft');
  } catch { throw new Error('端末内の下書きを読み込めませんでした。元データを保護し、自動保存を停止しています。'); }
}
export function saveDraft(draft: Draft): void {
  localStorage.setItem(KEY, JSON.stringify(draft));
}
