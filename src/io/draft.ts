import type { BookStyle, ViewMode } from '../domain/contracts.js';
import type { Publication } from '../domain/model.js';
import { MAX_SOURCE } from '../domain/document.js';
import { createPublication, validatePublication } from '../domain/publication.js';
import { validateStyle } from '../domain/style.js';
import { object } from '../domain/validation.js';

export interface Draft { schemaVersion: 3; project: Publication; marginOffset: number }
interface OldDraft { schemaVersion: number; source: string; style: BookStyle; filename: string; marginOffset: number; viewMode: ViewMode; selected: number }
const KEY = 'bookmaker-slice-draft-v1';
const BACKUP_KEY = 'bookmaker-draft-backup-before-v3';
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
    const draft = parsed as OldDraft;
    if (![1, 2].includes(draft.schemaVersion) || typeof draft.source !== 'string' || draft.source.length > MAX_SOURCE || typeof draft.filename !== 'string' || draft.filename.length > 200 || !Number.isFinite(draft.marginOffset) || draft.marginOffset < -3 || draft.marginOffset > 5) throw new Error('Invalid draft');
    if (draft.schemaVersion === 2 && (!['spread', 'single'].includes(draft.viewMode) || !Number.isInteger(draft.selected) || draft.selected < 1 || draft.selected > 100_000)) throw new Error('Invalid view');
    const project = createPublication(draft.source); project.style = validateStyle(draft.style);
    project.metadata = { filename: draft.filename, viewMode: draft.schemaVersion === 1 ? 'spread' : draft.viewMode, selected: draft.schemaVersion === 1 ? 1 : draft.selected };
    return { schemaVersion: 3, project, marginOffset: draft.marginOffset };
  } catch { throw new Error('端末内の下書きを読み込めませんでした。元データを保護し、自動保存を停止しています。'); }
}
export function saveDraft(draft: Draft): void {
  const previous = localStorage.getItem(KEY);
  if (previous && [1, 2].includes((JSON.parse(previous) as { schemaVersion?: number }).schemaVersion ?? 0) && localStorage.getItem(BACKUP_KEY) === null) localStorage.setItem(BACKUP_KEY, previous);
  localStorage.setItem(KEY, JSON.stringify(draft));
}
