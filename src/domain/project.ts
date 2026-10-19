import type { Project } from './contracts.js';
import { parseDocument, MAX_SOURCE } from './document.js';
import { validateStyle, integer } from './style.js';
import type { Publication } from './model.js';
import { validatePublication } from './publication.js';
import { MAX_PROJECT_BYTES } from './special.js';

/** Source and parsed document must agree; silently dropping unknown structure is not a migration. */
export function restoreProject(json: string): Project | Publication {
  if (json.length > MAX_PROJECT_BYTES + MAX_SOURCE * 12) throw new Error('プロジェクトが大きすぎます。');
  let value: Project;
  try { value = JSON.parse(json) as Project; } catch { throw new Error('プロジェクトJSONを読み込めません。'); }
  if ([2, 3].includes((value as unknown as { schemaVersion?: number })?.schemaVersion ?? 0)) return validatePublication(value);
  if (!value || value.schemaVersion !== 1) throw new Error('対応していないプロジェクト形式です。');
  const document = parseDocument(value.source);
  if (JSON.stringify(value.document) !== JSON.stringify(document)) throw new Error('原稿と文書構造が一致しません。対応していない指定が含まれる可能性があります。');
  const project: Project = { schemaVersion: 1, source: value.source, document, style: validateStyle(value.style) };
  if (value.metadata !== undefined) {
    const m = value.metadata;
    if (!m || typeof m.filename !== 'string' || m.filename.length > 200 || !['spread', 'single'].includes(m.viewMode)) throw new Error('プロジェクトの表示設定を読み込めません。');
    project.metadata = { filename: m.filename, viewMode: m.viewMode, selected: integer(m.selected, '表示ページ') };
  }
  return project;
}
export function serializeProject(project: Project | Publication): string { return JSON.stringify(restoreProject(JSON.stringify(project)), null, 2); }
