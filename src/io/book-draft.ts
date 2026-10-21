import type { Draft } from './draft.js';
import { restoreDraft, saveDraft } from './draft.js';
import { validatePublication } from '../domain/publication.js';

const KEY = 'bookmaker-slice-draft-v1', BACKUP = 'bookmaker-draft-backup-before-book-v3';
let observed: string | null | undefined;
const RECOVERY = 'bookmaker-active-recovery', owner = crypto.randomUUID(), recoveryKeys = new Set<string>();
let recoveryKey: string | undefined;
const recovery = { restored: false, conflict: false };
interface Recovery { schemaVersion: 1; owner: string; order: number; base: string | null; draft: Draft }
export const draftRecoveryState = (): Readonly<typeof recovery> => recovery;
/** A per-tab journal needs no shared lock and never replaces the committed book. */
export function preserveBookDraft(draft: Draft, order: number): void {
  if (draft.project.assets?.length || observed === undefined) return;
  recoveryKey ??= `bookmaker-draft-recovery-${crypto.randomUUID()}`; recoveryKeys.add(recoveryKey);
  localStorage.setItem(recoveryKey, JSON.stringify({ schemaVersion: 1, owner, order, base: observed, draft } satisfies Recovery));
  sessionStorage.setItem(RECOVERY, recoveryKey);
}
function finishSave(order: number): void {
  const before = observed; observed = localStorage.getItem(KEY);
  for (const key of recoveryKeys) try {
    const raw = localStorage.getItem(key); if (!raw) continue; const entry = JSON.parse(raw) as Recovery;
    if (entry.owner === owner && entry.order > order) { if (entry.base === before) localStorage.setItem(key, JSON.stringify({ ...entry, base: observed })); }
    else { localStorage.removeItem(key); recoveryKeys.delete(key); if (sessionStorage.getItem(RECOVERY) === key) sessionStorage.removeItem(RECOVERY); }
  } catch { /* A failed journal cleanup cannot turn a committed book into a failed save. */ }
}
export class DraftConflict extends Error { constructor() { super('別のタブで新しい作業が保存されました。このタブの入力を残し、自動保存を停止しています。必要なら作業ファイル（JSON）を保存してください。'); this.name = 'DraftConflict'; } }
async function locked<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks) throw new Error('この環境ではタブ間の保存を保護できません。作業ファイル（JSON）を保存してください。');
  return navigator.locks.request('bookmaker-local-draft', operation);
}
const database = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open('bookmaker-local-books', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('端末内の作業保存を開けません。'));
});
async function restore(): Promise<Draft | null> {
  const raw = localStorage.getItem(KEY); observed = raw; if (!raw) return null;
  let marker: { schemaVersion?: number; snapshot?: string }; try { marker = JSON.parse(raw) as typeof marker; } catch { return restoreDraft(); }
  if (marker.schemaVersion !== 4) return restoreDraft();
  const db = await database();
  try {
    const value = await new Promise<Draft>((resolve, reject) => { const request = db.transaction('drafts').objectStore('drafts').get(marker.snapshot ?? 'current'); request.onsuccess = () => resolve(request.result as Draft); request.onerror = () => reject(new Error('作業を復元できません。')); });
    if (!value || value.schemaVersion !== 3 || !Number.isFinite(value.marginOffset) || value.marginOffset < -3 || value.marginOffset > 5) throw new Error('端末内の作業が破損しています。元データを保護し、自動保存を停止しています。');
    return { ...value, project: validatePublication(value.project) };
  } finally { db.close(); }
}
export function restoreBookDraft(): Promise<Draft | null> { return locked(async () => {
  const raw = localStorage.getItem(KEY); observed = raw;
  const key = sessionStorage.getItem(RECOVERY);
  if (key && /^bookmaker-draft-recovery-[a-zA-Z0-9-]+$/u.test(key)) {
    const journal = localStorage.getItem(key);
    if (journal) {
      const entry = JSON.parse(journal) as Recovery;
      if (entry.schemaVersion !== 1 || !Number.isInteger(entry.order) || typeof entry.owner !== 'string' || entry.base !== null && typeof entry.base !== 'string' || entry.draft?.schemaVersion !== 3 || !Number.isFinite(entry.draft.marginOffset) || entry.draft.marginOffset < -3 || entry.draft.marginOffset > 5) throw new Error('復旧用の作業を読み込めません。元データを保護し、自動保存を停止しています。');
      const draft = { ...entry.draft, project: validatePublication(entry.draft.project) }; recoveryKeys.add(key); recovery.restored = true; recovery.conflict = entry.base !== raw; return draft;
    }
  }
  return restore();
}); }
async function save(draft: Draft, order: number): Promise<void> {
  const previous = localStorage.getItem(KEY);
  if (observed === undefined) observed = previous;
  if (previous !== observed) throw new DraftConflict();
  if (previous && (JSON.parse(previous) as { project?: { schemaVersion?: number } }).project?.schemaVersion === 2 && localStorage.getItem(BACKUP) === null) localStorage.setItem(BACKUP, previous);
  if (!draft.project.assets?.length) { saveDraft(draft); finishSave(order); return; }
  // Write a new snapshot before moving the pointer: interruption/quota cannot replace the committed book.
  const db = await database();
  try {
    const snapshot = `snapshot-${crypto.randomUUID()}`;
    await new Promise<void>((resolve, reject) => { const transaction = db.transaction('drafts', 'readwrite'); transaction.objectStore('drafts').put(draft, snapshot); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(new Error('素材を含む作業を端末に保存できません。JSONも保存してください。')); transaction.onabort = transaction.onerror; });
    if (previous && (JSON.parse(previous) as { schemaVersion?: number }).schemaVersion !== 4 && localStorage.getItem(BACKUP) === null) localStorage.setItem(BACKUP, previous);
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 4, storage: 'indexedDB', snapshot })); finishSave(order);
    // Keep the previous committed snapshot; discard only older snapshots and interrupted writes.
    const old = previous ? (JSON.parse(previous) as { snapshot?: string }).snapshot : undefined;
    await new Promise<void>(resolve => { const transaction = db.transaction('drafts', 'readwrite'), cursor = transaction.objectStore('drafts').openKeyCursor(); cursor.onsuccess = () => { const item = cursor.result; if (!item) return; if (typeof item.key === 'string' && item.key.startsWith('snapshot-') && item.key !== snapshot && item.key !== old) transaction.objectStore('drafts').delete(item.key); item.continue(); }; transaction.oncomplete = () => resolve(); transaction.onerror = () => resolve(); transaction.onabort = () => resolve(); });
  } finally { db.close(); }
}
export function saveBookDraft(draft: Draft, order = 0): Promise<void> { return locked(() => save(draft, order)); }
