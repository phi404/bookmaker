import type { Project } from '../domain/contracts.js';
import type { Publication, SourceSyntax } from '../domain/model.js';
import { createPublication } from '../domain/publication.js';
import { escapeSourceText, MAX_SOURCE, parseDocument } from '../domain/document.js';
import { restoreProject } from '../domain/project.js';
import { decodeText, readManuscript } from './text.js';
import { readWordXML } from './zip.js';
import { MAX_PROJECT_BYTES } from '../domain/special.js';

export interface Imported { source: string; format: string; warnings: readonly string[]; syntax?: SourceSyntax; project?: Project | Publication }
export function markdownSource(text: string): Imported {
  const warnings: string[] = [];
  if (/^\s*(?:```|[-*+]\s|\|)|!\[|\[[^\]]+\]\(/mu.test(text)) warnings.push('Markdownのリスト・リンク・表・画像・コードは本文に残します。');
  createPublication(text, 'markdown'); return { source: text, syntax: 'markdown', format: 'Markdown', warnings };
}
const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const children = (node: Element, name: string) => Array.from(node.getElementsByTagNameNS(W, name));
const val = (node?: Element) => node?.getAttributeNS(W, 'val') ?? '';
function xmlDocument(xml: string): globalThis.Document {
  if (/<!DOCTYPE|<!ENTITY/iu.test(xml)) throw new Error('外部定義を含むXMLには対応していません。');
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length) throw new Error('DOCXのXMLを読み込めません。'); return doc;
}
export function wordSource(xml: string, stylesXML?: string): Imported {
  const doc = xmlDocument(xml), body = doc.getElementsByTagNameNS(W, 'body')[0];
  if (!body) throw new Error('DOCXの本文がありません。');
  if (children(body, 'del').length || children(body, 'ins').length || children(body, 'moveFrom').length || children(body, 'moveTo').length) throw new Error('DOCXに変更履歴があります。Wordで承諾または却下してから読み込んでください。');
  const warnings = ['DOCXの文字サイズ・余白・フォントは取り込まず、このアプリで組み直します。'];
  if (children(body, 'drawing').length || children(body, 'pict').length) warnings.push('画像・図形は読み込んでいません。元のDOCXを保管してください。');
  if (children(body, 'tbl').length) warnings.push('表の文字は段落として読み込み、表の配置は再現しません。');
  if (children(body, 'footnoteReference').length || children(body, 'endnoteReference').length) warnings.push('注の参照は本文に残しますが、注本文は読み込んでいません。');
  if (children(body, 'fldChar').length || children(body, 'fldSimple').length) warnings.push('目次・フィールドは表示されている文字だけを読み込みます。');
  const headingStyles = new Map<string, number>();
  if (stylesXML) for (const s of Array.from(xmlDocument(stylesXML).getElementsByTagNameNS(W, 'style'))) {
    const name = val(children(s, 'name')[0]), outline = val(children(s, 'outlineLvl')[0]);
    if (/^(heading\s*\d|見出し|title|表題)/iu.test(name) || (outline && Number(outline) < 9)) headingStyles.set(s.getAttributeNS(W, 'styleId') ?? '', Math.min(3, (outline ? Number(outline) : Number(name.match(/\d/u)?.[0] ?? 1) - 1) + 1));
  }
  const walk = (node: Element): string => {
    if (node.namespaceURI !== W) return Array.from(node.children).map(walk).join('');
    switch (node.localName) {
      case 'pPr': case 'rPr': case 'instrText': case 'lastRenderedPageBreak': case 'drawing': case 'pict': return '';
      case 't': return escapeSourceText(node.textContent ?? '');
      case 'tab': return '\t';
      case 'br': return node.getAttributeNS(W, 'type') === 'page' ? '\n[改ページ]\n' : '\n';
      case 'cr': return '\n';
      case 'ruby': {
        const b = children(node, 'rubyBase')[0], r = children(node, 'rt')[0];
        const base = b ? children(b, 't').map(t => t.textContent ?? '').join('') : '', reading = r ? children(r, 't').map(t => t.textContent ?? '').join('') : '';
        if (base && reading && !/[|｜《\n]/u.test(base) && !/[》\n]/u.test(reading)) return `｜${base}《${reading}》`;
        warnings.push('特殊なルビを「親文字（読み）」として読み込みました。'); return `${escapeSourceText(base)}（${escapeSourceText(reading)}）`;
      }
      case 'footnoteReference': case 'endnoteReference': return `［注${node.getAttributeNS(W, 'id') ?? ''}］`;
      case 'r': {
        const content = Array.from(node.children).map(walk).join(''), em = val(children(node, 'em')[0]);
        return em && em !== 'none' && !content.includes('\n') ? `[圏点${em === 'dot' ? ':丸' : ''}]${content}[/圏点]` : content;
      }
      default: return Array.from(node.children).map(walk).join('');
    }
  };
  const paragraphs = children(body, 'p').filter(p => { for (let parent = p.parentElement; parent && parent !== body; parent = parent.parentElement) if (parent.namespaceURI === W && ['drawing', 'pict'].includes(parent.localName)) return false; return true; }).map(p => {
    const pPr = Array.from(p.children).find(n => n.namespaceURI === W && n.localName === 'pPr'), outline = pPr ? val(children(pPr, 'outlineLvl')[0]) : '';
    const styleId = pPr ? val(children(pPr, 'pStyle')[0]) : '', level = outline && Number(outline) < 9 ? Math.min(3, Number(outline) + 1) : headingStyles.get(styleId) ?? (/^Heading[1-6]$/iu.test(styleId) ? Math.min(3, Number(styleId.at(-1))) : undefined);
    const before = pPr ? children(pPr, 'pageBreakBefore')[0] : undefined;
    const content = walk(p), prefix = before && !['false', '0', 'off'].includes(val(before)) ? '[改ページ]\n' : '';
    return prefix + (level ? `[見出し:${level}] ` : '') + content;
  });
  const source = paragraphs.join('\n'); parseDocument(source);
  return { source, format: 'DOCX', warnings: [...new Set(warnings)] };
}
export async function importFile(file: File): Promise<Imported> {
  const extension = file.name.split('.').at(-1)?.toLowerCase();
  if (extension === 'docx') {
    if (file.size > 32 * 1024 * 1024) throw new Error('DOCXは32MB以内にしてください。');
    const xml = await readWordXML(new Uint8Array(await file.arrayBuffer())); return wordSource(xml['word/document.xml']!, xml['word/styles.xml']);
  }
  if (extension === 'json') {
    if (file.size > MAX_PROJECT_BYTES + MAX_SOURCE * 12) throw new Error('プロジェクトが大きすぎます。');
    const project = restoreProject(await file.text()); return { source: project.source, format: 'プロジェクト', warnings: [], project };
  }
  if (extension === 'md' || extension === 'markdown') {
    if (file.size > MAX_SOURCE * 4) throw new Error('原稿が大きすぎます。');
    return markdownSource(decodeText(await file.arrayBuffer()).text);
  }
  if (extension !== 'txt') throw new Error('TXT、Markdown、DOCX、作業用JSONを選んでください。');
  const result = await readManuscript(file); return { source: result.source, format: result.encoding, warnings: [] };
}
