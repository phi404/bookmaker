import type { BookModel } from './model.js';
import { flattenDocument } from './publication.js';
import { normalizedSource, sourceBlocks } from './source.js';
import { parseInlinesWithMap, type InlineSourceSpan } from './document.js';

export interface TextSourceSpan extends InlineSourceSpan { blockId: string }
/** Generated UTF-16 positions. BOM/CRLF stay in the original manuscript. */
export function rawSourceOffsets(source: string, dropBom = true): Uint32Array {
  const offsets: number[] = []; let at = dropBom && source.startsWith('\uFEFF') ? 1 : 0;
  for (; at < source.length; at++) { offsets.push(at); if (source[at] === '\r' && source[at + 1] === '\n') at++; }
  offsets.push(source.length); return Uint32Array.from(offsets);
}
export function editorOffset(offsets: Uint32Array, raw: number): number {
  let from = 0, to = offsets.length - 1;
  while (from < to) { const mid = Math.floor((from + to) / 2); if (offsets[mid]! < raw) from = mid + 1; else to = mid; }
  return from;
}
export function bookSourceMap(book: BookModel): TextSourceSpan[] {
  if (book.sourceDraft !== undefined) return [];
  const source = normalizedSource(book.source), raw = rawSourceOffsets(book.source), blocks = flattenDocument(book.document), result: TextSourceSpan[] = [];
  sourceBlocks(book.source, book.syntax).forEach((entry, index) => {
    const block = blocks[index]; if (!block || !('inlines' in block)) return;
    const at = entry.contentFrom ?? entry.from, value = source.slice(at, entry.to);
    let spans: InlineSourceSpan[];
    if (entry.literal) { let offset = 0; spans = Array.from(value, glyph => { const from = offset; offset += glyph.length; return { from, to: offset, sourceFrom: from, sourceTo: offset, part: 'text' }; }); }
    else spans = parseInlinesWithMap(value, book.syntax === 'markdown').spans;
    for (const span of spans) result.push({ ...span, blockId: block.id, sourceFrom: raw[at + span.sourceFrom]!, sourceTo: raw[at + span.sourceTo]! });
  }); return result;
}
export function textSourceRange(spans: readonly TextSourceSpan[], blockId: string, from: number, to: number, part: 'text' | 'reading' = 'text'): { from: number; to: number } | undefined {
  const matches = spans.filter(s => s.blockId === blockId && s.part === part && s.to > from && s.from < to);
  if (!matches.length) return undefined;
  return { from: Math.min(...matches.map(s => s.sourceFrom)), to: Math.max(...matches.map(s => s.sourceTo)) };
}
export function sourceTextRanges(spans: readonly TextSourceSpan[], from: number, to: number): { blockId: string; from: number; to: number }[] {
  const result: { blockId: string; from: number; to: number }[] = [];
  for (const span of spans) if (span.sourceTo > from && span.sourceFrom < to) {
    const previous = result.at(-1); if (previous?.blockId === span.blockId && span.from <= previous.to) previous.to = Math.max(previous.to, span.to);
    else result.push({ blockId: span.blockId, from: span.from, to: span.to });
  } return result;
}
