import type { Inline } from '../domain/contracts.js';
import { graphemes } from '../domain/style.js';
import { Rules } from '../vendor/linebreak/index.js';

const rules = new Rules();
const noStart = new Set(graphemes('、。，．・：；？！ー〜～ゝゞ々ヽヾぁぃぅぇぉっゃゅょァィゥェォッャュョ）〕］｝〉》」』】〙〗’”)]},.!?:;'));
const noEnd = new Set(graphemes('（〔［｛〈《「『【〘〖‘“([{'));
const pairs = new Set(['―', '—', '…', '‥']);
const textOf = (run: Inline) => run.kind === 'text' ? run.text : run.base;

/** Unicode 17 opportunities, tightened by Japanese punctuation and whole ruby atoms. */
export function wrapRuns<T extends Inline & { advanceEm: number }>(atoms: readonly T[], capacity: number, firstIndent: number, warn: () => void): { indentEm: number; runs: T[] }[] {
  if (!atoms.length) return [];
  const text = atoms.map(textOf).join(''), may = new Uint8Array(atoms.length + 1), required = new Uint8Array(atoms.length + 1);
  const breaks = rules.breaks(text); let nextBreak = breaks.next(), offset = 0;
  const edge = (atom: T | undefined, last: boolean): string => {
    const value = atom ? textOf(atom) : '';
    if (value.length <= 1 || /^[\x20-\x7E]+$/u.test(value)) return (last ? value.at(-1) : value[0]) ?? '';
    const chars = graphemes(value); return (last ? chars.at(-1) : chars[0]) ?? '';
  };
  for (let at = 1; at <= atoms.length; at++) {
    offset += textOf(atoms[at - 1]!).length;
    while (!nextBreak.done && nextBreak.value.position < offset) nextBreak = breaks.next();
    if (!nextBreak.done && nextBreak.value.position === offset) {
      required[at] = Number(nextBreak.value.required);
      const previous = edge(atoms[at - 1], true), next = edge(atoms[at], false);
      may[at] = Number(required[at] || !noEnd.has(previous) && !noStart.has(next) && !(previous === next && pairs.has(previous)));
    }
  }
  const lines: { indentEm: number; runs: T[] }[] = []; let start = 0;
  while (start < atoms.length) {
    const indentEm = lines.length ? 0 : firstIndent; let end = start, used = indentEm;
    while (end < atoms.length && used + atoms[end]!.advanceEm <= capacity + .00001) { used += atoms[end++]!.advanceEm; if (required[end]) break; }
    if (end === start) { end++; warn(); }
    if (end < atoms.length && !required[end]) {
      const fitted = end; while (end > start && !may[end]) end--;
      // A unit longer than the entire line must progress; preserve every character and diagnose it.
      if (end === start) { end = fitted; warn(); }
    }
    lines.push({ indentEm, runs: atoms.slice(start, end) }); start = end;
  }
  return lines;
}
