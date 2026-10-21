import { MAX_SOURCE } from './document.js';
export interface SourceMatch { from: number; to: number }
export interface SourceSearch { query: string; caseSensitive?: boolean; range?: SourceMatch }
/** Literal search. User text cannot become a regular expression or replacement directive. */
export function findSourceMatches(source: string, options: SourceSearch): SourceMatch[] {
  if (!options.query) return [];
  const expression = new RegExp(options.query.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'), options.caseSensitive ? 'gu' : 'giu'), result: SourceMatch[] = [];
  const from = options.range?.from ?? 0, to = options.range?.to ?? source.length;
  if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < from || to > source.length) throw new Error('検索範囲が変わっています。選択し直してください。');
  expression.lastIndex = from;
  for (let match = expression.exec(source); match && match.index + match[0].length <= to; match = expression.exec(source)) result.push({ from: match.index, to: match.index + match[0].length });
  return result;
}
export function replaceSourceMatches(source: string, matches: readonly SourceMatch[], replacement: string): { source: string; delta: number } {
  let end = 0, length = source.length; const pieces: string[] = [];
  for (const match of matches) {
    if (!Number.isInteger(match.from) || !Number.isInteger(match.to) || match.from < end || match.to <= match.from || match.to > source.length) throw new Error('置換する位置が変わっています。検索し直してください。');
    length += replacement.length - (match.to - match.from); if (length > MAX_SOURCE) throw new Error('置換後の原稿が50万文字を超えます。');
    pieces.push(source.slice(end, match.from), replacement); end = match.to;
  }
  pieces.push(source.slice(end)); return { source: pieces.join(''), delta: length - source.length };
}
