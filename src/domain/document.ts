import type { Document, Block, Inline, Emphasis } from './contracts.js';
import { validateCharacter } from './styles.js';
import { identifier } from './validation.js';

export const MAX_SOURCE = 500_000;
/** Only explicit, balanced notation is structural. Unknown and incomplete notation stays literal. */
export function parseInlines(text: string, emphasis?: Emphasis, markdown = false): Inline[] {
  const runs: Inline[] = [], buffer: string[] = [];
  const flush = () => { if (buffer.length) { runs.push({ kind: 'text', text: buffer.join(''), ...(emphasis ? { emphasis } : {}) }); buffer.length = 0; } };
  for (let i = 0; i < text.length;) {
    const char = text[i]!;
    if (char === '\\' && (markdown ? /[\\[|｜*#>:`=\-]/u : /[\\[|｜]/u).test(text[i + 1] ?? '')) { buffer.push(text[i + 1]!); i += 2; continue; }
    if (char === '|' || char === '｜') {
      const ruby = /^[|｜]([^|｜《\n]+)《([^》\n]+)》/u.exec(text.slice(i));
      if (ruby) { flush(); runs.push({ kind: 'ruby', base: ruby[1]!, reading: ruby[2]!, ...(emphasis ? { emphasis } : {}) }); i += ruby[0].length; continue; }
    }
    if (char === '[') {
      const attribute = markdown ? /^\[([^\]\n]+)\]\{([^{}\n]+)\}/u.exec(text.slice(i)) : null;
      if (attribute && !attribute[2]!.startsWith('.')) {
        try {
          const pairs = [...attribute[2]!.matchAll(/([a-zA-Z]+)="([^"]*)"/gu)], style: Record<string, unknown> = {}; let styleId: string | undefined;
          if (!pairs.length || attribute[2]!.replace(/([a-zA-Z]+)="([^"]*)"/gu, '').trim()) throw new Error('属性');
          for (const pair of pairs) { if (pair[1] === 'style') { identifier(pair[2]); styleId = pair[2]; } else style[pair[1]!] = ['fontWeight', 'fontPt', 'letterSpacingEm'].includes(pair[1]!) ? Number(pair[2]) : pair[2]; }
          validateCharacter(style); flush(); runs.push(...parseInlines(attribute[1]!, emphasis, markdown).map(run => ({ ...run, ...(styleId ? { styleId } : {}), ...(Object.keys(style).length ? { localStyle: style } : {}) }))); i += attribute[0].length; continue;
        } catch { buffer.push(attribute[0]); i += attribute[0].length; continue; }
      }
      const mark = /^\[圏点(?::(丸))?\]/u.exec(text.slice(i));
      if (mark) {
        const end = text.indexOf('[/圏点]', i + mark[0].length);
        if (end !== -1) { flush(); runs.push(...parseInlines(text.slice(i + mark[0].length, end), mark[1] ? 'dot' : 'sesame', markdown)); i = end + 5; continue; }
      }
    }
    if (markdown && text.startsWith('***', i)) {
      const end = text.indexOf('***', i + 3);
      if (end > i + 3 && text[end - 1] !== '\\') { flush(); runs.push(...parseInlines(text.slice(i + 3, end), emphasis ?? 'sesame', markdown).map(r => ({ ...r, strong: true }))); i = end + 3; continue; }
    }
    if (markdown && text.startsWith('**', i)) {
      let end = i + 2;
      while ((end = text.indexOf('**', end)) >= 0 && text[end - 1] === '\\') end += 2;
      if (end > i + 2) { flush(); runs.push(...parseInlines(text.slice(i + 2, end), emphasis, markdown).map(r => ({ ...r, strong: true }))); i = end + 2; continue; }
    }
    if (markdown && char === '*' && text[i + 1] !== '*') {
      let end = i + 1;
      while (end < text.length) {
        end = text.indexOf('*', end); if (end < 0) break;
        if (text[end - 1] === '\\') { end++; continue; }
        const count = /^\*+/u.exec(text.slice(end))![0].length;
        if (count % 2 === 0) { end += count; continue; }
        break;
      }
      if (end > i + 1) { flush(); runs.push(...parseInlines(text.slice(i + 1, end), emphasis ?? 'sesame', markdown)); i = end + 1; continue; }
    }
    if (markdown && char === '[') {
      const mark = /^\[([^\]\n]+)\]\{\.(dot|circle|triangle)\}/u.exec(text.slice(i));
      if (mark) { flush(); runs.push(...parseInlines(mark[1]!, mark[2] as Emphasis, markdown)); i += mark[0].length; continue; }
    }
    const glyph = String.fromCodePoint(text.codePointAt(i)!); buffer.push(glyph); i += glyph.length;
  }
  flush(); return runs;
}
/** Escape literal text when converting another document format to editable source. */
export function escapeSourceText(text: string): string { return text.replace(/[\\[|｜]/gu, '\\$&'); }
export function parseDocument(source: string): Document {
  if (typeof source !== 'string' || source.length > MAX_SOURCE) throw new Error('原稿は50万文字以内で読み込んでください。');
  const normalized = source.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
  const blocks: Block[] = normalized.split('\n').map((text, index): Block => {
    const id = `p-${index}`;
    const control = /^\[(改ページ|右ページ|左ページ)\]\s*$/u.exec(text);
    if (control) return { id, kind: 'pageBreak', start: control[1] === '右ページ' ? 'right' : control[1] === '左ページ' ? 'left' : 'next' };
    const heading = /^\[見出し(?::([1-3]))?\][　 ]?(.*)$/u.exec(text);
    if (heading) return { id, kind: 'heading', level: Number(heading[1] ?? 1), keepWithNext: true, inlines: parseInlines(heading[2]!) };
    return { id, kind: 'paragraph', indent: 'auto', inlines: parseInlines(text) };
  });
  return { schemaVersion: 1, title: '本文', blocks };
}
