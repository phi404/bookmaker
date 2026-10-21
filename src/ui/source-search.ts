import { findSourceMatches, replaceSourceMatches, type SourceMatch } from '../domain/source-search.js';
import { el, input } from './dom.js';
import { scrollToPosition } from './manuscript.js';
interface SearchHost {
  showSource(): void; changed(): void; notify(message: string): void;
  reveal(from: number, to: number, showPaper?: boolean): void;
}
export function sourceSearch(editor: HTMLTextAreaElement, host: SearchHost): { sync(): void } {
  const panel = el('source-find'), query = input('source-find-query'), replacement = input('source-find-replacement'), scope = input('source-find-scope'), sensitive = input('source-find-case');
  let matches: SourceMatch[] = [], active = -1, range: SourceMatch | undefined, observed = editor.value, composing = false;
  const options = () => ({ query: query.value, caseSensitive: sensitive.checked, ...(scope.checked && range ? { range } : {}) });
  const refresh = () => {
    if (panel.hidden || composing) return;
    matches = findSourceMatches(editor.value, options()); active = matches.findIndex(m => m.from === editor.selectionStart && m.to === editor.selectionEnd);
    el('source-find-count').textContent = query.value ? `${active >= 0 ? `${active + 1} / ` : ''}${matches.length.toLocaleString('ja-JP')}件` : '';
    for (const id of ['source-find-next', 'source-find-previous', 'source-replace-one', 'source-replace-all', 'source-find-paper']) el<HTMLButtonElement>(id).disabled = !matches.length;
    host.reveal(active >= 0 ? matches[active]!.from : -1, active >= 0 ? matches[active]!.to : -1);
  };
  const choose = (direction: 1 | -1) => {
    refresh(); if (!matches.length) return;
    let previous = -1; for (let i = 0; i < matches.length; i++) if (matches[i]!.to <= editor.selectionEnd) previous = i;
    const index = active >= 0 ? (active + direction + matches.length) % matches.length : direction === 1 ? matches.findIndex(m => m.from >= editor.selectionStart) : previous;
    const match = matches[index >= 0 ? index : direction === 1 ? 0 : matches.length - 1]!;
    editor.setSelectionRange(match.from, match.to); scrollToPosition(editor, match.from); refresh();
  };
  const open = (replace = false) => {
    const from = editor.selectionStart, to = editor.selectionEnd, selected = editor.value.slice(from, to);
    range = from < to ? { from, to } : undefined; scope.disabled = !range; scope.checked = false;
    if (selected && !/[\r\n]/u.test(selected) && selected.length <= 200) query.value = selected;
    observed = editor.value; host.showSource(); panel.hidden = false; if (replace) el<HTMLDetailsElement>('source-replace').open = true;
    refresh(); query.focus(); query.select();
  };
  const close = () => { panel.hidden = true; host.reveal(-1, -1); editor.focus(); };
  const replace = (all: boolean) => {
    refresh(); if (!matches.length || composing) return;
    const selected = matches.find(m => m.from === editor.selectionStart && m.to === editor.selectionEnd);
    if (!all && !selected) { choose(1); return; }
    const targets = all ? matches : [selected!];
    try {
      const result = replaceSourceMatches(editor.value, targets, replacement.value), from = targets[0]!.from;
      editor.value = result.source; editor.setSelectionRange(from, from + replacement.value.length);
      if (range && scope.checked) range.to += result.delta; observed = editor.value; host.changed(); refresh();
      el('source-find-count').textContent = `${targets.length.toLocaleString('ja-JP')}件置換 · ${matches.length.toLocaleString('ja-JP')}件`;
    } catch (error) { host.notify(error instanceof Error ? error.message : '置換できません。'); }
  };
  el('open-source-find').addEventListener('click', () => open()); el('close-source-find').addEventListener('click', close);
  el('source-find-next').addEventListener('click', () => choose(1)); el('source-find-previous').addEventListener('click', () => choose(-1));
  el('source-replace-one').addEventListener('click', () => replace(false)); el('source-replace-all').addEventListener('click', () => replace(true));
  el('source-find-paper').addEventListener('click', () => { if (active < 0) choose(1); const match = matches[active]; if (match) host.reveal(match.from, match.to, true); });
  for (const field of [query, replacement]) {
    field.addEventListener('compositionstart', () => { composing = true; }); field.addEventListener('compositionend', () => { composing = false; refresh(); });
    field.addEventListener('input', () => { if (field === query) refresh(); });
    field.addEventListener('keydown', event => { if (event.isComposing || composing) return; if (event.key === 'Enter') { event.preventDefault(); if (field === query) choose(event.shiftKey ? -1 : 1); else replace(event.ctrlKey || event.metaKey); } else if (event.key === 'Escape') { event.preventDefault(); close(); } });
  }
  for (const field of [scope, sensitive]) field.addEventListener('change', refresh);
  editor.addEventListener('select', refresh);
  document.addEventListener('keydown', event => {
    if (event.isComposing || composing || document.querySelector('dialog[open]')) return;
    if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && ['f', 'h'].includes(event.key.toLowerCase())) { event.preventDefault(); open(event.key.toLowerCase() === 'h'); }
    else if (event.key === 'F3' && !panel.hidden) { event.preventDefault(); choose(event.shiftKey ? -1 : 1); }
  });
  return { sync() { if (editor.value !== observed) { observed = editor.value; range = undefined; scope.checked = false; scope.disabled = true; } refresh(); } };
}
