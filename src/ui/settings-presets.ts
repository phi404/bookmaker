import type { BookModel } from '../domain/model.js';
import { applyBookSettingsPreset, createBookSettingsPreset, MAX_SETTINGS_BYTES, parseBookSettingsPreset, type BookSettingsPreset } from '../domain/settings-preset.js';
import { readSettingsPresets, saveSettingsPreset, removeSettingsPreset } from '../io/settings-presets.js';
import { el, input } from './dom.js';

interface Host { book(): BookModel; change(book: BookModel, message?: string): void; notify(message: string): void }
export function settingsPresetEditor(host: Host): void {
  const dialog = el<HTMLDialogElement>('settings-preset-dialog'), list = el('settings-preset-list'), review = el('settings-preset-review'), message = el('settings-preset-message');
  let chosen: BookSettingsPreset | undefined, stored = false, url: string | undefined, loadSerial = 0;
  const report = (error: unknown) => { message.textContent = error instanceof Error ? error.message : '設定を扱えません。'; message.hidden = false; };
  const clearMessage = () => { message.hidden = true; message.textContent = ''; };
  function refresh(): void {
    list.replaceChildren();
    try {
      const presets = readSettingsPresets(); el('settings-preset-empty').hidden = !!presets.length;
      for (const preset of presets) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'preset-list-item'; button.textContent = preset.name;
        button.addEventListener('click', () => choose(preset, true)); list.append(button);
      }
    } catch (error) { el('settings-preset-empty').hidden = true; report(error); }
  }
  function choose(preset: BookSettingsPreset, saved: boolean): void {
    chosen = preset; stored = saved; review.hidden = false; el('settings-preset-restore').hidden = true; el('settings-preset-save-form').hidden = true;
    el('settings-preset-name').textContent = preset.name;
    const s = preset.style;
    el('settings-preset-summary').textContent = s.page.widthMm + ' × ' + s.page.heightMm + ' mm · ' + s.fontPt + ' pt · ' + (s.writingMode === 'vertical-rl' ? '縦書き' : '横書き');
    el('settings-preset-delete').hidden = !stored; el('settings-preset-download').hidden = true;
    for (const id of ['settings-apply-layout', 'settings-apply-styles', 'settings-apply-decorations']) input(id).checked = true;
    clearMessage(); el('settings-preset-apply').focus();
  }
  function open(): void { chosen = undefined; review.hidden = true; el('settings-preset-save-form').hidden = true; clearMessage(); refresh(); if (!dialog.open) dialog.showModal(); }
  el('settings-presets').addEventListener('click', open);
  el('close-settings-presets').addEventListener('click', () => dialog.close());
  dialog.addEventListener('close', () => { loadSerial++; if (url) { URL.revokeObjectURL(url); url = undefined; } });
  el('settings-preset-read').addEventListener('click', () => input('settings-preset-file').click());
  input('settings-preset-file').addEventListener('change', async () => {
    const file = input('settings-preset-file').files?.[0], serial = ++loadSerial; if (!file) return;
    try {
      if (file.size > MAX_SETTINGS_BYTES) throw new Error('設定テンプレートは1MB以内にしてください。');
      const preset = parseBookSettingsPreset(await file.text()); if (serial !== loadSerial) return; choose(preset, false);
    } catch (error) { if (serial === loadSerial) report(error); } finally { input('settings-preset-file').value = ''; }
  });
  el('settings-preset-save-current').addEventListener('click', () => {
    clearMessage(); review.hidden = true; el('settings-preset-save-form').hidden = false;
    input('settings-preset-save-name').value = '本の設定'; input('settings-preset-save-name').focus(); updateSaveLabel();
  });
  function updateSaveLabel(): void {
    try { el('settings-preset-save').textContent = readSettingsPresets().some(item => item.name === input('settings-preset-save-name').value.trim()) ? '同名の設定を置き換える' : '保存'; } catch { el('settings-preset-save').textContent = '保存'; }
  }
  input('settings-preset-save-name').addEventListener('input', updateSaveLabel);
  el('settings-preset-save').addEventListener('click', () => {
    try { const preset = createBookSettingsPreset(host.book(), input('settings-preset-save-name').value); saveSettingsPreset(preset); refresh(); choose(preset, true); }
    catch (error) {
      try { chosen = createBookSettingsPreset(host.book(), input('settings-preset-save-name').value); choose(chosen, false); } catch { /* Keep the name field for correction. */ }
      report(error);
    }
  });
  input('settings-preset-save-name').addEventListener('keydown', event => { if (!event.isComposing && event.key === 'Enter') { event.preventDefault(); el('settings-preset-save').click(); } });
  el('settings-preset-apply').addEventListener('click', () => {
    if (!chosen) return;
    try {
      const next = applyBookSettingsPreset(host.book(), chosen, { layout: input('settings-apply-layout').checked, styles: input('settings-apply-styles').checked, decorations: input('settings-apply-decorations').checked });
      dialog.close(); host.change(next, '設定を適用しました。元に戻す操作で取り消せます。');
    } catch (error) { report(error); }
  });
  el('settings-preset-write').addEventListener('click', () => {
    if (!chosen) return; if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(new Blob([JSON.stringify(chosen, null, 2) + '\n'], { type: 'application/json' }));
    const link = el<HTMLAnchorElement>('settings-preset-download'); link.href = url; link.download = chosen.name.replace(/[<>:"/\\|?*\p{C}]/gu, '_').slice(0, 80) + '.bookstyle.json'; link.hidden = false; link.click();
  });
  el('settings-preset-delete').addEventListener('click', () => {
    if (!chosen || !stored) return;
    try { const removed = chosen; removeSettingsPreset(removed.name); refresh(); stored = false; el('settings-preset-delete').hidden = true; el('settings-preset-restore').hidden = false; clearMessage(); }
    catch (error) { report(error); }
  });
  el('settings-preset-restore').addEventListener('click', () => { if (!chosen) return; try { saveSettingsPreset(chosen); refresh(); stored = true; el('settings-preset-delete').hidden = false; el('settings-preset-restore').hidden = true; } catch (error) { report(error); } });
}
