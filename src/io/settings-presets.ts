import { validateBookSettingsPreset, type BookSettingsPreset } from '../domain/settings-preset.js';
import { object } from '../domain/validation.js';

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>;
const KEY = 'bookmaker-settings-presets-v1';
export function readSettingsPresets(storage: StorageAccess = localStorage): BookSettingsPreset[] {
  const raw = storage.getItem(KEY); if (raw === null) return [];
  try {
    const value: unknown = JSON.parse(raw); object(value, ['schemaVersion', 'presets'], '保存した設定');
    if (value.schemaVersion !== 1 || !Array.isArray(value.presets) || value.presets.length > 20) throw new Error();
    const presets = value.presets.map(validateBookSettingsPreset), names = new Set(presets.map(preset => preset.name));
    if (names.size !== presets.length) throw new Error(); return presets;
  } catch { throw new Error('保存した設定を読み込めません。元データを保護しています。ファイルからの読み込みは利用できます。'); }
}
export function saveSettingsPreset(preset: BookSettingsPreset, storage: StorageAccess = localStorage): void {
  const valid = validateBookSettingsPreset(preset), presets = readSettingsPresets(storage), at = presets.findIndex(item => item.name === valid.name);
  if (at >= 0) presets[at] = valid; else presets.push(valid);
  if (presets.length > 20) throw new Error('保存する設定は20件以内にしてください。不要な設定をファイルに保存してから削除できます。');
  write(presets, storage);
}
export function removeSettingsPreset(name: string, storage: StorageAccess = localStorage): void { write(readSettingsPresets(storage).filter(item => item.name !== name), storage); }
function write(presets: BookSettingsPreset[], storage: StorageAccess): void {
  const raw = JSON.stringify({ schemaVersion: 1, presets });
  if (new TextEncoder().encode(raw).length > 2 * 1024 * 1024) throw new Error('保存する設定が2MBを超えました。設定ファイルを利用してください。');
  try { storage.setItem(KEY, raw); } catch { throw new Error('端末へ設定を保存できません。設定ファイルへ書き出してください。'); }
}
