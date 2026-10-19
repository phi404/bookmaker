import type { BookStyle, BookPage, ViewMode, Diagnostic } from '../domain/contracts.js';
import type { Publication } from '../domain/model.js';
import { serializeProject } from '../domain/project.js';
import { spreadPages } from '../domain/page-order.js';
import { rasterize, rasterizeSpread, pngBlob } from '../io/raster.js';
import { exportPDF } from '../io/pdf.js';
import { downloadBlob } from '../io/text.js';
import { zipBlobs } from '../io/zip.js';
import { el, input, setValue } from './dom.js';

interface OutputState { revision: number; diagnostics: readonly Diagnostic[]; source: string; project: Publication; filename: string; style: BookStyle; pages: readonly BookPage[]; selected: number; viewMode: ViewMode }
interface OutputHost { state(): OutputState; ready(): boolean; rename(name: string): void; active(open: boolean): void; revealIssue(blockId?: string, elementId?: string, pageNumber?: number): void }
type Format = 'png' | 'pdf' | 'zip' | 'spread' | 'project' | 'source';
export function output(host: OutputHost) {
  const dialog = el<HTMLDialogElement>('export-dialog'); let controller: AbortController | undefined, savedURL: string | undefined, savedKey = '', checkRevision = -1, preflightKey = '';
  const key = (s: OutputState) => `${s.revision}:${s.filename}:${s.selected}:${el<HTMLSelectElement>('export-scope').value}:${input('export-from').value}:${input('export-to').value}`;
  const lossCodes = new Set(['element-overflow', 'text-box-overflow', 'asset-missing']);
  function clearResult(): void {
    if (savedURL) URL.revokeObjectURL(savedURL); savedURL = undefined; savedKey = ''; el('export-result').hidden = true;
    el('save-output').removeAttribute('href'); el('open-output').removeAttribute('href');
  }
  const commitName = () => host.rename(input('export-name').value.trim() || '原稿');
  const range = (state: OutputState) => {
    const ranged = el<HTMLSelectElement>('export-scope').value === 'range', from = ranged ? Number(input('export-from').value) : 1, to = ranged ? Number(input('export-to').value) : state.pages.length;
    if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > state.pages.length) throw new Error(`ページ範囲は1〜${state.pages.length}ページの中で指定してください。`);
    return state.pages.slice(from - 1, to);
  };
  function sync(): void {
    const s = host.state(); if (savedURL && savedKey !== key(s)) clearResult();
    if (checkRevision !== s.revision) { checkRevision = s.revision; input('export-accept-loss').checked = false; }
    const issues = s.diagnostics.filter((d, i, all) => all.findIndex(v => v.code === d.code && v.blockId === d.blockId && v.elementId === d.elementId && v.pageNumber === d.pageNumber) === i), hasLoss = issues.some(d => lossCodes.has(d.code)), draft = s.project.sourceDraft !== undefined;
    const enabled = host.ready() && !controller && (!hasLoss || input('export-accept-loss').checked);
    const currentPreflight = JSON.stringify([draft, host.ready(), issues]);
    if (preflightKey !== currentPreflight) {
      preflightKey = currentPreflight; const list = el('export-issues'); list.replaceChildren();
      const add = (message: string, blockId?: string, elementId?: string, pageNumber?: number) => { const row = document.createElement('li'), button = document.createElement('button'); button.type = 'button'; button.textContent = `${pageNumber?`p.${pageNumber} · `:''}${message}`; button.addEventListener('click', () => { dialog.close(); host.revealIssue(blockId,elementId,pageNumber); }); row.append(button); list.append(row); };
      if (draft) add('原稿の指定が未完です。原稿を確認');
      else if (!host.ready()) add(s.source ? '組版の完了を待っています' : '原稿またはページを追加');
      for (const issue of issues) add(issue.message, issue.blockId,issue.elementId,issue.pageNumber);
    }
    el('export-preflight').hidden = !issues.length && !draft && host.ready();
    el('export-loss-choice').hidden = !hasLoss || draft || !host.ready(); input('export-accept-loss').disabled = !host.ready();
    for (const id of ['export-png', 'export-pdf', 'export-png-all', 'export-spread']) el<HTMLButtonElement>(id).disabled = !enabled;
    for (const id of ['export-project', 'export-source']) el<HTMLButtonElement>(id).disabled = !!controller;
    const size = s.pages[s.selected-1]?.style?.page ?? s.style.page, pixels = [size.widthMm, size.heightMm].map(mm => Math.round(mm / 25.4 * 300));
    el('png-label').textContent = `${s.selected}ページを一枚の画像に`; el('export-info').textContent = `${pixels.join(' × ')} px · ${s.pages.length}ページ · 300 dpi`;
    el('spread-label').textContent = `${s.selected}ページを含む見開き`;
    el('pdf-label').textContent = el<HTMLSelectElement>('export-scope').value === 'all' ? 'すべてのページ' : '指定した範囲';
    el('png-all-label').textContent = el<HTMLSelectElement>('export-scope').value === 'all' ? '全ページをまとめて保存（ZIP）' : '指定範囲をまとめて保存（ZIP）';
    el('export-range').hidden = el<HTMLSelectElement>('export-scope').value !== 'range';
    input('export-from').max = String(s.pages.length); input('export-to').max = String(s.pages.length);
    setValue('export-name', s.filename);
  }
  function open(): void {
    if (dialog.open) return;
    const s = host.state();
    if (!input('export-from').value || el<HTMLSelectElement>('export-scope').value === 'all') { input('export-from').value = '1'; input('export-to').value = String(s.pages.length); }
    else { input('export-from').value = String(Math.max(1, Math.min(s.pages.length, Number(input('export-from').value)))); input('export-to').value = String(Math.max(Number(input('export-from').value), Math.min(s.pages.length, Number(input('export-to').value)))); }
    sync(); dialog.showModal(); host.active(true);
  }
  async function write(format: Format): Promise<boolean> {
    const imageOutput = format !== 'project' && format !== 'source';
    if (controller || imageOutput && (!host.ready() || host.state().diagnostics.some(d => lossCodes.has(d.code)) && !input('export-accept-loss').checked)) return false;
    commitName();
    const s = structuredClone(host.state()), safeName = s.filename.replace(/[\\/:*?"<>|\u0000-\u001F]/gu, '_').slice(0, 100) || '原稿';
    controller = new AbortController(); const current = controller;
    el('export-progress').hidden = false; el('export-progress-text').textContent = 'ページを準備しています…'; el('output-error').hidden = true;
    clearResult(); sync(); const startedKey = key(s);
    try {
      let blob: Blob, name: string;
      if (format === 'project') {
        blob = new Blob([serializeProject({ ...s.project, metadata: { filename: s.filename, viewMode: s.viewMode, selected: s.selected } })], { type: 'application/json' }); name = `${safeName}.book.json`;
      } else if (format === 'source') { blob = new Blob([s.source], { type: 'text/plain;charset=utf-8' }); name = `${safeName}.${s.project.syntax === 'markdown' ? 'md' : 'txt'}`; }
      else if (format === 'png' || format === 'spread') {
        const spread = spreadPages(s.selected, s.pages.length), canvas = format === 'png' ? await rasterize(s.pages[s.selected - 1]!, s.style) : await rasterizeSpread(spread.left ? s.pages[spread.left - 1] : undefined, spread.right ? s.pages[spread.right - 1] : undefined, s.style);
        try { current.signal.throwIfAborted(); blob = await pngBlob(canvas); } finally { canvas.width = 0; canvas.height = 0; }
        name = `${safeName}-${format === 'spread' ? '見開き-' : ''}${String(s.selected).padStart(3, '0')}.png`;
      } else {
        const pages = range(s), span = pages.length === s.pages.length ? '' : `-${pages[0]!.number}-${pages.at(-1)!.number}`;
        if (format === 'pdf') { blob = await exportPDF(pages, s.style, s.filename, current.signal, count => { el('export-progress-text').textContent = `${count} / ${pages.length} ページを準備しました`; }); name = `${safeName}${span}.pdf`; }
        else {
          const files: Record<string, Uint8Array> = {}; let total = 0;
          for (const [i, page] of pages.entries()) {
            current.signal.throwIfAborted(); const canvas = await rasterize(page, s.style);
            try { const data = new Uint8Array(await (await pngBlob(canvas)).arrayBuffer()); total += data.byteLength; if (total > 128 * 1024 * 1024) throw new Error('画像が128MBを超えました。範囲を分けて書き出してください。'); files[`${safeName}-${String(page.number).padStart(5, '0')}.png`] = data; }
            finally { canvas.width = 0; canvas.height = 0; }
            el('export-progress-text').textContent = `${i + 1} / ${pages.length} ページを準備しました`; await new Promise<void>(resolve => setTimeout(resolve, 0));
          }
          current.signal.throwIfAborted(); blob = await zipBlobs(files); name = `${safeName}${span}-PNG.zip`;
        }
      }
      current.signal.throwIfAborted(); if (key(host.state()) !== startedKey) throw new Error('作業が更新されました。最新の内容で書き出してください。');
      savedURL = URL.createObjectURL(blob); savedKey = startedKey;
      const save = el<HTMLAnchorElement>('save-output'), show = el<HTMLAnchorElement>('open-output'); save.href = savedURL; save.download = name; show.href = savedURL; show.hidden = format === 'zip';
      el('export-result-text').textContent = name; el('export-result').hidden = false; downloadBlob(blob, name); return true;
    } catch (error) { el('output-error').textContent = current.signal.aborted ? '書き出しを中止しました。' : error instanceof Error ? error.message : '書き出しに失敗しました。'; el('output-error').hidden = false; return false; }
    finally { controller = undefined; el('export-progress').hidden = true; sync(); }
  }
  el('open-export').addEventListener('click', open);
  el('close-export').addEventListener('click', () => dialog.close()); dialog.addEventListener('close', () => { controller?.abort(); host.active(false); });
  el('export-cancel').addEventListener('click', () => controller?.abort());
  el('export-scope').addEventListener('change', sync);
  for (const id of ['export-from', 'export-to', 'export-accept-loss']) input(id).addEventListener('change', sync);
  input('export-name').addEventListener('input', () => host.rename(input('export-name').value));
  input('export-name').addEventListener('change', () => { commitName(); sync(); });
  for (const [id, format] of [['export-png', 'png'], ['export-pdf', 'pdf'], ['export-png-all', 'zip'], ['export-spread', 'spread'], ['export-project', 'project'], ['export-source', 'source']] as const) el(id).addEventListener('click', () => { void write(format); });
  return { sync, open, saveProject() { open(); return write('project'); } };
}
