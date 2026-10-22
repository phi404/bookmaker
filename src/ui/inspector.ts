import type { Publication, TreeBlock } from '../domain/model.js';
import { flattenDocument } from '../domain/publication.js';
import { blockStyleId, localStyleCount } from '../domain/styles.js';
import { editTextBlocks } from '../domain/editing.js';
import { el, input, setValue } from './dom.js';
import { iconChoices, alignmentOptions, weightOptions, setIconChoice } from './choices.js';
import { styleFields } from './style-fields.js';

interface Host { project(): Publication; update(project: Publication): void; reveal(): void; scopeChanged(): void; notify(message: string): void }
export function blockInspector(host: Host) {
  const panel = el('block-inspector'); let selectedIds: string[] = [], fieldKey = '', scope = 'selection';
  const current = (): TreeBlock | undefined => flattenDocument(host.project().document).find(b => targets().has(b.id) && 'inlines' in b);
  const targets = (): Set<string> => {
    if (scope === 'book') return new Set(flattenDocument(host.project().document).filter(b => 'inlines' in b).map(b => b.id));
    if (scope === 'chapter') return new Set(host.project().document.children.find(s => s.children.some(b => b.id === selectedIds[0]))?.children.filter(b => 'inlines' in b).map(b => b.id) ?? []);
    if (scope === 'until') { const blocks = host.project().document.children.find(s => s.children.some(b => b.id === selectedIds[0]))?.children ?? [], at = blocks.findIndex(b => b.id === selectedIds[0]); return new Set(blocks.slice(at).filter(b => 'inlines' in b).map(b => b.id)); }
    return new Set(selectedIds);
  };
  function sync(): void {
    const ids = targets(), blocks = flattenDocument(host.project().document).filter(b => ids.has(b.id) && 'inlines' in b), block = blocks[0]; panel.hidden = !block; if (!block || !('inlines' in block)) return;
    const styles = block.kind === 'heading' ? host.project().styles.headings : host.project().styles.paragraphs;
    const select = el<HTMLSelectElement>('block-style'), mixed = blocks.some(b => blockStyleId(b) !== blockStyleId(block));
    select.replaceChildren(new Option(mixed ? '書式が混在' : '書式を選ぶ', ''), ...styles.map(s => new Option(s.name, s.id))); select.value = mixed ? '' : blockStyleId(block);
    select.disabled = blocks.some(b => b.kind !== block.kind);
    const names = [...new Set(blocks.map(b => {const family=b.kind==='heading'?host.project().styles.headings:host.project().styles.paragraphs;return family.find(s=>s.id===blockStyleId(b))?.name??'共通書式';}))];
    el('block-local-count').textContent = `${names.join(' / ')}から継承 · 個別指定 ${blocks.reduce((n, b) => n + localStyleCount(b), 0)}件`;
    const mixedValue = Symbol('mixed');
    const common = (family: 'paragraph' | 'character', key: string) => {
      const values = blocks.map(b => (b.localStyle?.[family] as Record<string, unknown> | undefined)?.[key]);
      return values.every(v => v === values[0]) ? values[0] : mixedValue;
    };
    const showValue = (id: string, value: unknown) => {
      const control = el<HTMLInputElement | HTMLSelectElement | HTMLFieldSetElement>(id), mixed = value === mixedValue;
      control.dataset.valueState = mixed ? 'mixed' : value === undefined ? 'inherited' : 'local';
      if (control instanceof HTMLFieldSetElement) { setIconChoice(control, mixed ? undefined : value, mixed); control.dataset.vertical = String(host.project().style.writingMode === 'vertical-rl'); }
      else if (control instanceof HTMLSelectElement) {
        control.querySelector('option[value="__mixed__"]')?.remove();
        if (mixed) { const option = new Option('混在', '__mixed__'); option.disabled = true; control.prepend(option); }
        control.value = mixed ? '__mixed__' : value === undefined ? '' : String(value);
      } else { control.placeholder = mixed ? '混在' : 'スタイルに従う'; setValue(id, mixed || value === undefined ? '' : String(value)); }
    };
    for (const [id, family, key] of [['block-indent', 'paragraph', 'indentEm'], ['block-align', 'paragraph', 'alignment'], ['block-weight', 'character', 'fontWeight'], ['block-keep', 'paragraph', 'keepWithNext']] as const) showValue(id, common(family, key));
    el<HTMLButtonElement>('reset-block-style').disabled = !blocks.some(b => localStyleCount(b));
    const key = scope + ':' + blocks.map(b=>b.id).join(',');
    if (fieldKey !== key) {
      fieldKey = key; const container = el('block-extra-fields'); container.replaceChildren();
      const d = document.createElement('details'); d.className = 'nested-details'; d.id = 'block-character-details'; const summary = document.createElement('summary'); summary.textContent = '文字・余白・行間'; d.append(summary); container.append(d);
      styleFields(d, 'block-character', 'character', () => current()?.localStyle?.character ?? {}, (value, key) => property('character', key, (value as Record<string, unknown>)[key]), ['fontWeight']);
      styleFields(d, 'block-paragraph', 'paragraph', () => current()?.localStyle?.paragraph ?? {}, (value, key) => property('paragraph', key, (value as Record<string, unknown>)[key]), ['indentEm', 'alignment', 'keepWithNext']);
    }
    for (const control of panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('#block-extra-fields input, #block-extra-fields select, #block-extra-fields [data-choice-field]')) {
      const family = control.id.startsWith('block-character-') ? 'character' : 'paragraph', key = control.id.replace(/^block-(?:character|paragraph)-/u, ''); showValue(control.id, common(family, key));
    }
  }
  function select(ids: string | string[], reveal = true): void { selectedIds = typeof ids === 'string' ? [ids] : ids; scope = 'selection'; setValue('selection-scope', scope); sync(); if (panel.hidden) return; el<HTMLDetailsElement>('block-local-details').open = false; if(reveal)host.reveal(); }
  function change(edit: (block: TreeBlock) => void): void {
    try { host.update(editTextBlocks(host.project(), targets(), edit)); }
    catch (error) { host.notify(error instanceof Error ? error.message : '書式を確認してください。'); sync(); }
  }
  function property(family: 'paragraph' | 'character', key: string, value: unknown): void {
    change(block => { const local = { ...block.localStyle }, values = { ...local[family] } as Record<string, unknown>; if (value === undefined) delete values[key]; else values[key] = value; if (Object.keys(values).length) local[family] = values; else delete local[family]; if (Object.keys(local).length) block.localStyle = local; else delete block.localStyle; });
  }
  el('selection-scope').addEventListener('change', () => { scope = el<HTMLSelectElement>('selection-scope').value; sync();host.scopeChanged(); });
  el('block-style').addEventListener('change', () => { const value = el<HTMLSelectElement>('block-style').value; if (value) change(block => { block.styleId = value; }); });
  input('block-indent').addEventListener('change', () => property('paragraph', 'indentEm', input('block-indent').value === '' ? undefined : Number(input('block-indent').value)));
  iconChoices(el('block-quick-style'), 'block-align', '揃え', alignmentOptions, undefined, value => property('paragraph', 'alignment', value || undefined));
  iconChoices(el('block-quick-style'), 'block-weight', '文字の太さ', weightOptions, undefined, value => property('character', 'fontWeight', value ? Number(value) : undefined));
  el('block-keep').addEventListener('change', () => property('paragraph', 'keepWithNext', el<HTMLSelectElement>('block-keep').value ? el<HTMLSelectElement>('block-keep').value === 'true' : undefined));
  el('reset-block-style').addEventListener('click', () => change(block => { delete block.localStyle; }));
  return { select, sync, align(value: 'start' | 'center' | 'end') { property('paragraph', 'alignment', value); }, target() {return {scope,label:scope==='book'?'すべての文章':scope==='chapter'?'この章全体':scope==='until'?'ここから章末まで':'選択範囲',count:targets().size};}, clear() { selectedIds = []; panel.hidden = true; } };
}
