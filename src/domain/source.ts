import type { Inline } from './contracts.js';
import type { SourceSyntax, TreeBlock } from './model.js';
import { MAX_SOURCE, escapeSourceText, parseDocument, parseInlines } from './document.js';
import { SPECIAL_ROLES } from './special.js';
import type { SpecialRole } from './model.js';
import { formatAttributes, readFormat, readSection } from './source-format.js';
import type { LocalStyle, Section } from './model.js';

export interface SourceBlock { block: TreeBlock; from: number; to: number; contentFrom?: number; literal?: boolean; section?: Pick<Section, 'start' | 'styleId' | 'localStyle'> }
export function normalizedSource(source: string): string {
  if (typeof source !== 'string' || source.length > MAX_SOURCE) throw new Error('原稿は50万文字以内で読み込んでください。');
  return source.replace(/^\uFEFF/u, '').replace(/\r\n?/gu, '\n');
}
/** Deliberately a small, explicit Markdown subset, not a CommonMark renderer. */
const markdownInlines = (text: string): Inline[] => parseInlines(text, undefined, true);
export function sourceBlocks(source: string, syntax: SourceSyntax): SourceBlock[] {
  const normalized = normalizedSource(source), lines = normalized.split('\n'), out: SourceBlock[] = [];
  const legacy = syntax === 'legacy' ? parseDocument(normalized).blocks : undefined;
  let offset = 0, fence = false, section: SourceBlock['section'];
  const formats: { localStyle?: LocalStyle; styleId?: string }[] = [];
  for (const [index, line] of lines.entries()) {
    const from = offset; offset += line.length + 1;
    if (legacy) { const prefix = /^\[見出し(?::[1-3])?\][　 ]?/u.exec(line)?.[0].length ?? 0; out.push({ block: legacy[index]!, from, to: offset - 1, contentFrom: from + prefix }); continue; }
    if (/^```/u.test(line)) fence = !fence;
    const open = !fence ? /^:::(center|end|format)(?:\s+(.*))?\s*$/u.exec(line) : null;
    if (open) { formats.push(open[1] === 'format' ? readFormat(open[2] ?? '') : { localStyle: { paragraph: { alignment: open[1] as 'center' | 'end' } } }); continue; }
    if (!fence && formats.length && /^:::\s*$/u.test(line)) { formats.pop(); continue; }
    const sectionLine = !fence ? /^:::section\s+(.*)$/u.exec(line) : null;
    if (sectionLine) { section = readSection(sectionLine[1]!); continue; }
    if (!fence && /^:::section(?:\s|$)/u.test(line)) throw new Error('章の書式を入力中です。属性と次の章見出しを確認してください。');
    let block: TreeBlock, contentFrom = from, literal = false;
    const special = !fence ? /^:::(title|chapter-title|toc|colophon|illustration|free|external) id="([a-zA-Z0-9][a-zA-Z0-9_-]{0,99})"\s*$/u.exec(line) : null;
    const heading = !fence ? /^(#{1,6})[ \t]+(.+)$/u.exec(line) : null;
    const pageDirective = !fence ? /^:::page-break(?: side="(left|right)")?\s*$/u.exec(line) : null;
    if (!fence && /^:::page-break(?:\s|$)/u.test(line) && !pageDirective) throw new Error('改ページの指定を入力中です。side="left" または side="right" を確認してください。');
    if (special && SPECIAL_ROLES.includes(special[1] as SpecialRole)) block = { id: `p-${index}`, kind: 'specialPage', role: special[1] as SpecialRole, pageId: special[2]! };
    else if (pageDirective) block = { id: `p-${index}`, kind: 'pageBreak', start: (pageDirective[1] ?? 'next') as 'left' | 'right' | 'next' };
    else if (!fence && /^:::recto\s*$/u.test(line)) block = { id: `p-${index}`, kind: 'pageBreak', start: 'recto' };
    else if (!fence && /^(?:===|---+|\*\*\*+)\s*$/u.test(line)) block = { id: `p-${index}`, kind: 'pageBreak', start: 'next' };
    else if (heading) { contentFrom += line.length - heading[2]!.length; block = { id: `p-${index}`, kind: 'heading', level: heading[1]!.length, keepWithNext: true, inlines: markdownInlines(heading[2]!) }; }
    else {
      const quote = !fence ? /^>[ ]?(.*)$/u.exec(line) : null;
      contentFrom += quote ? line.length - quote[1]!.length : 0; literal = fence || /^```/u.test(line);
      block = { id: `p-${index}`, kind: 'paragraph', indent: 'auto', inlines: fence || /^```/u.test(line) ? [{ kind: 'text', text: line }] : markdownInlines(quote?.[1] ?? line), ...(quote ? { role: 'quote' as const } : {}) };
    }
    if (block.kind !== 'pageBreak' && block.kind !== 'specialPage') for (const format of formats) {
      if (format.styleId) block.styleId = format.styleId;
      if (format.localStyle) block.localStyle = { ...block.localStyle, ...format.localStyle, paragraph: { ...block.localStyle?.paragraph, ...format.localStyle.paragraph }, character: { ...block.localStyle?.character, ...format.localStyle.character }, page: { ...block.localStyle?.page, ...format.localStyle.page, ...(block.localStyle?.page?.margins || format.localStyle.page?.margins ? { margins: { ...block.localStyle?.page?.margins, ...format.localStyle.page?.margins } } : {}) } };
    }
    if (block.localStyle) for (const family of ['paragraph', 'character', 'page'] as const) if (!Object.keys(block.localStyle[family] ?? {}).length) delete block.localStyle[family];
    out.push({ block, from, to: offset - 1, contentFrom, ...(literal ? { literal } : {}), ...(section ? { section } : {}) }); section = undefined;
  }
  if (formats.length || section) throw new Error('書式の囲みを入力中です。閉じ行 ::: と、その後の本文を確認してください。');
  return out;
}
export function inlineSource(inlines: readonly Inline[], syntax: SourceSyntax): string {
  const escape = (text: string) => syntax === 'markdown' ? escapeSourceText(text).replace(/\*/gu, '\\$&') : escapeSourceText(text);
  // One annotation span can contain both text and ruby; adjacent delimiter runs are ambiguous.
  const groups: Inline[][] = [];
  for (const run of inlines) { const previous = groups.at(-1); if (previous && previous[0]!.emphasis === run.emphasis && Boolean(previous[0]!.strong) === Boolean(run.strong) && previous[0]!.styleId === run.styleId && JSON.stringify(previous[0]!.localStyle) === JSON.stringify(run.localStyle)) previous.push(run); else groups.push([run]); }
  return groups.map(group => {
    const run = group[0]!;
    let value = group.map(r => r.kind === 'ruby' ? `｜${r.base}《${r.reading}》` : escape(r.text)).join('');
    if (run.emphasis && run.emphasis !== 'none') value = syntax === 'markdown' ? run.emphasis !== 'sesame' ? `[${value}]{.${run.emphasis}}` : `*${value}*` : `[圏点${run.emphasis === 'dot' ? ':丸' : ''}]${value}[/圏点]`;
    if (run.strong) { if (syntax !== 'markdown') throw new Error('強調を含む文書の原稿形式はMarkdownにしてください。'); value = `**${value}**`; }
    if (run.styleId || run.localStyle && Object.keys(run.localStyle).length) { if (syntax !== 'markdown') throw new Error('文字の向き・局所書式はMarkdownの原稿形式で保存してください。'); const attrs = { ...(run.styleId ? { style: run.styleId } : {}), ...run.localStyle }; value = `[${value}]{${Object.entries(attrs).map(([key, value]) => `${key}="${value}"`).join(' ')}}`; }
    return value;
  }).join('');
}
export function blockSource(block: TreeBlock, syntax: SourceSyntax, wrap = true): string {
  if (block.kind === 'specialPage') return `:::${block.role} id="${block.pageId}"`;
  if (block.kind === 'pageBreak') return syntax === 'markdown' ? block.start === 'recto' ? ':::recto' : block.start === 'next' ? '---' : `:::page-break side="${block.start}"` : `[${block.start === 'right' ? '右ページ' : block.start === 'left' ? '左ページ' : '改ページ'}]`;
  const value = inlineSource(block.inlines, syntax);
  let line = block.kind === 'heading' ? syntax === 'markdown' ? `${'#'.repeat(block.level)} ${value}` : `[見出し:${block.level}] ${value}` : `${syntax === 'markdown' && block.role === 'quote' ? '> ' : ''}${value}`;
  if (syntax === 'markdown' && block.kind === 'paragraph' && block.role !== 'quote' && /^(?:#{1,6}[ \t]+|>|:::|```|===\s*$|---+\s*$)/u.test(line)) line = `\\${line}`;
  const attrs = formatAttributes({ ...block.localStyle, ...(block.sourceStyle ? { paragraph: { ...block.sourceStyle, ...block.localStyle?.paragraph } } : {}) }, block.styleId);
  if (wrap && syntax === 'markdown' && attrs) line = `:::format ${attrs}\n${line}\n:::`;
  return line;
}
/** Adjacent text runs may be split differently by source escaping; compare semantic content. */
export function contentKey(block: TreeBlock): string {
  if (block.kind === 'specialPage') return JSON.stringify({ kind: block.kind, pageId: block.pageId, role: block.role });
  if (block.kind === 'pageBreak') return JSON.stringify({ kind: block.kind, start: block.start });
  const runs: Inline[] = [];
  for (const run of block.inlines) {
    const plain = { ...run }; delete plain.fontWeight;
    const previous = runs.at(-1);
    if (previous?.kind === 'text' && plain.kind === 'text' && previous.emphasis === plain.emphasis && previous.strong === plain.strong && previous.styleId === plain.styleId && JSON.stringify(previous.localStyle) === JSON.stringify(plain.localStyle)) previous.text += plain.text;
    else runs.push(plain);
  }
  return JSON.stringify({ kind: block.kind, ...(block.kind === 'heading' ? { level: block.level } : {}), role: block.role === 'quote' ? 'quote' : 'body', format: formatAttributes({ ...block.localStyle, ...(block.sourceStyle ? { paragraph: { ...block.sourceStyle, ...block.localStyle?.paragraph } } : {}) }, block.styleId), inlines: runs });
}
/** Format edits must not create new identities for unchanged text. */
export function identityKey(block: TreeBlock): string { const plain = { ...block }; delete plain.localStyle; delete plain.styleId; delete plain.sourceStyle; return contentKey(plain); }
