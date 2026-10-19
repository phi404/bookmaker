import type { Draft } from './draft.js';
import { restoreDraft, saveDraft } from './draft.js';
import { validatePublication } from '../domain/publication.js';

const KEY = 'bookmaker-slice-draft-v1', BACKUP = 'bookmaker-draft-backup-before-book-v3';
const database = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open('bookmaker-local-books', 1);
  request.onupgradeneeded = () => request.result.createObjectStore('drafts');
  request.onsuccess = () => resolve(request.result); request.onerror = () => reject(new Error('端末内の作業保存を開けません。'));
});
export async function restoreBookDraft(): Promise<Draft | null> {
  const raw = localStorage.getItem(KEY); if (!raw) return null;
  let marker: { schemaVersion?: number }; try { marker = JSON.parse(raw) as typeof marker; } catch { return restoreDraft(); }
  if (marker.schemaVersion !== 4) return restoreDraft();
  const db = await database();
  try {
    const value = await new Promise<Draft>((resolve, reject) => { const request = db.transaction('drafts').objectStore('drafts').get('current'); request.onsuccess = () => resolve(request.result as Draft); request.onerror = () => reject(new Error('作業を復元できません。')); });
    if (!value || value.schemaVersion !== 3 || !Number.isFinite(value.marginOffset) || value.marginOffset < -3 || value.marginOffset > 5) throw new Error('端末内の作業が破損しています。元データを保護し、自動保存を停止しています。');
    return { ...value, project: validatePublication(value.project) };
  } finally { db.close(); }
}
export async function saveBookDraft(draft: Draft): Promise<void> {
  const previous = localStorage.getItem(KEY);
  if (previous && (JSON.parse(previous) as { project?: { schemaVersion?: number } }).project?.schemaVersion === 2 && localStorage.getItem(BACKUP) === null) localStorage.setItem(BACKUP, previous);
  if (!draft.project.assets?.length) { saveDraft(draft); return; }
  // One atomic snapshot includes model, original files and render images.
  const db = await database();
  try {
    await new Promise<void>((resolve, reject) => { const transaction = db.transaction('drafts', 'readwrite'); transaction.objectStore('drafts').put(draft, 'current'); transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(new Error('素材を含む作業を端末に保存できません。JSONも保存してください。')); transaction.onabort = transaction.onerror; });
    if (previous && (JSON.parse(previous) as { schemaVersion?: number }).schemaVersion !== 4 && localStorage.getItem(BACKUP) === null) localStorage.setItem(BACKUP, previous);
    localStorage.setItem(KEY, JSON.stringify({ schemaVersion: 4, storage: 'indexedDB' }));
  } finally { db.close(); }
}
