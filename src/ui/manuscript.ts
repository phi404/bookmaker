import { MAX_SOURCE, parseInlines } from '../domain/document.js';
import type { CharacterProperties } from '../domain/contracts.js';
import { inlineSource } from '../domain/source.js';
import { styleFields } from './style-fields.js';
import { el, input } from './dom.js';

/** Wrapped manuscript navigation measures the same text style; visual wrapping never edits the book. */
export function scrollToPosition(editor: HTMLTextAreaElement, offset: number): void {
  const mirror = document.createElement('div'), css = getComputedStyle(editor);
  Object.assign(mirror.style, { position: 'fixed', visibility: 'hidden', pointerEvents: 'none', width: `${editor.clientWidth}px`, font: css.font, lineHeight: css.lineHeight, padding: css.padding, boxSizing: 'border-box', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' });
  mirror.textContent = editor.value.slice(0, offset) + '\u200b'; document.body.append(mirror);
  editor.scrollTop = Math.max(0, mirror.getBoundingClientRect().height - editor.clientHeight / 3); mirror.remove();
}

export function manuscriptTools(editor: HTMLTextAreaElement, changed: () => void, notify: (message: string) => void, whole: () => void, range: () => void): void {
  let start = 0, end = 0;
  let character: CharacterProperties = {};
  const insert = (text: string, from = start, to = end) => {
    if (editor.value.length - (to - from) + text.length > MAX_SOURCE) { notify('原稿は50万文字以内にしてください。'); return; }
    editor.setRangeText(text, from, to, 'end'); editor.focus(); changed();
  };
  el('character-format').addEventListener('click',()=>{
    start=editor.selectionStart;end=editor.selectionEnd;const value=editor.value.slice(start,end);
    if(!value){whole();return;} if(/[\r\n]/u.test(value)){range();return;}
    const before=editor.value.slice(0,start),after=editor.value.slice(end),open=before.lastIndexOf('['),close=before.lastIndexOf(']');
    if(open>close&&/^.*?\]\{/u.test(after)||value.includes(']{')&&!/^\[[\s\S]*\]\{[^{}]+\}$/u.test(value)){notify('書式のある文字は、角括弧と属性も含めて指定全体を選択してください。');return;}
    const runs=parseInlines(value,undefined,true);character={...runs[0]?.localStyle};
    const fields=el('character-fields');fields.replaceChildren();styleFields(fields,'selected-character','character',()=>character,v=>{character=v;});
    el('character-selection').textContent=`選択中：${runs.map(r=>r.kind==='ruby'?r.base:r.text).join('').slice(0,80)} · この文字だけに適用`;
    el<HTMLDialogElement>('character-dialog').showModal();
  });
  el('close-character').addEventListener('click',()=>el<HTMLDialogElement>('character-dialog').close());
  const applyCharacter=(reset:boolean)=>{
    const runs=parseInlines(editor.value.slice(start,end),undefined,true).map(run=>{const next={...run};if(reset){delete next.localStyle;delete next.strong;delete next.emphasis;}else if(Object.keys(character).length)next.localStyle={...character};else delete next.localStyle;return next;});
    el<HTMLDialogElement>('character-dialog').close();insert(inlineSource(runs,'markdown'));
  };
  el('apply-character').addEventListener('click',()=>applyCharacter(false));el('reset-character').addEventListener('click',()=>applyCharacter(true));
  document.querySelectorAll<HTMLElement>('[data-insert]').forEach(b => b.addEventListener('click', () => {
    start = editor.selectionStart; end = editor.selectionEnd;
    const selection = editor.value.slice(start, end), kind = b.dataset.insert;
    if (kind === 'ruby') {
      el('insert-help').textContent = '選択した本文に読みを付けます。';
      input('insert-base').value = selection; input('insert-reading').value = ''; el<HTMLDialogElement>('insert-dialog').showModal(); (selection ? input('insert-reading') : input('insert-base')).focus(); return;
    }
    if (kind === 'emphasis') {
      if (!selection || selection.includes('\n')) { notify('圏点を付ける、同じ段落内の文字を選択してください。'); editor.focus(); return; }
      const emphasis = el<HTMLSelectElement>('insert-emphasis-kind').value;
      insert(emphasis === 'sesame' ? `*${selection}*` : `[${selection}]{.${emphasis}}`); return;
    }
    if (kind === 'heading') {
      const lineStart = editor.value.lastIndexOf('\n', start - 1) + 1;
      if (/^#{1,6}\s/u.test(editor.value.slice(lineStart))) { notify('この行には見出しが指定されています。'); return; }
      insert(`${'#'.repeat(Number(el<HTMLSelectElement>('insert-heading-level').value))} `, lineStart, lineStart); return;
    }
    insert(`${start && editor.value[start - 1] !== '\n' ? '\n' : ''}${kind === 'recto' ? ':::recto' : '---'}${editor.value[end] === '\n' ? '' : '\n'}`);
  }));
  editor.addEventListener('keydown', event => {
    if (event.isComposing || !(event.ctrlKey || event.metaKey)) return;
    if (event.key === 'Enter') { event.preventDefault(); document.querySelector<HTMLButtonElement>(`[data-insert="${event.shiftKey ? 'recto' : 'page-break'}"]`)!.click(); }
    else if (event.altKey && ['1', '2', '3'].includes(event.key)) { event.preventDefault(); el<HTMLSelectElement>('insert-heading-level').value = event.key; document.querySelector<HTMLButtonElement>('[data-insert=heading]')!.click(); }
    else if (event.key.toLowerCase() === 'b' && !event.altKey && !event.shiftKey) { event.preventDefault(); start = editor.selectionStart; end = editor.selectionEnd; const value = editor.value.slice(start, end); if (value && !value.includes('\n')) insert(`**${value}**`); }
  });
  el('close-insert').addEventListener('click', () => el<HTMLDialogElement>('insert-dialog').close());
  el('apply-insert').addEventListener('click', () => {
    const base = input('insert-base').value, reading = input('insert-reading').value;
    if (!base || !reading || /[|｜《\n]/u.test(base) || /[》\n]/u.test(reading)) { el('insert-help').textContent = '親文字と読みを入れてください。改行や記法の区切り文字は使えません。'; return; }
    el<HTMLDialogElement>('insert-dialog').close(); insert(`｜${base}《${reading}》`);
  });
}
