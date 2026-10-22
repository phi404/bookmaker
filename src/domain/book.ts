import type { BookModel, Publication, SpecialPageDefinition, SpecialRole, TreeBlock, PageElement } from './model.js';
import { createPublication, flattenDocument, sourceOf, updateSource, validatePublication, validateDocumentReferences } from './publication.js';
import { sourceBlocks } from './source.js';
import { rawSourceOffsets } from './source-map.js';
import { newSpecialPage } from './special.js';
import { identifier } from './validation.js';

/** Book operations share the current publication model. */
export function asBook(project: Publication): BookModel { return project as BookModel; }
export const createBook = (source: string) => asBook(createPublication(source, 'markdown'));
export function movePageElement(book: BookModel, pageId: string, elementId: string, x: number, y: number, snapMm?: number): BookModel {
  const p = book.specialPages.find(p => p.id === pageId), e = p?.elements.find(e => e.id === elementId);
  if (!p || p.representation !== 'layout' || !e || e.locked) throw new Error('固定を解除した自由ページの要素だけ移動できます。');
  const step = snapMm ?? p.snapMm ?? 1;
  if (![x, y, step].every(Number.isFinite) || step < 0 || step > 10) throw new Error('位置とスナップを確認してください。');
  const round = (n: number, max: number) => Math.max(0, Math.min(Math.max(0, max), step ? Math.round(n / step) * step : n));
  return updateSpecialPage(book, pageId, { elements: p.elements.map(item => item.id === elementId ? { ...item, xMm: round(x, book.style.page.widthMm - e.widthMm), yMm: round(y, book.style.page.heightMm - e.heightMm) } : item) });
}
export function alignPageElement(book: BookModel, pageId: string, elementId: string, alignment: 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom'): BookModel {
  const p = book.specialPages.find(p => p.id === pageId), e = p?.elements.find(e => e.id === elementId);
  if (!p || p.representation !== 'layout' || !e) throw new Error('整列は自由ページの要素だけ変更できます。');
  const x = alignment === 'left' ? 0 : alignment === 'center-x' ? (book.style.page.widthMm - e.widthMm) / 2 : alignment === 'right' ? book.style.page.widthMm - e.widthMm : e.xMm;
  const y = alignment === 'top' ? 0 : alignment === 'center-y' ? (book.style.page.heightMm - e.heightMm) / 2 : alignment === 'bottom' ? book.style.page.heightMm - e.heightMm : e.yMm;
  return movePageElement(book, pageId, elementId, x, y, 0);
}
export function editBookSource(book: BookModel, source: string, syntax = book.syntax): { book: BookModel; error?: string } {
  try {
    if (syntax === 'markdown') {
      const refs = new Set<string>(); let fence = false;
      for (const line of source.split(/\r?\n/u)) {
        if (/^```/u.test(line)) { fence = !fence; continue; } if (fence) continue;
        if (/^:::(?:title|chapter-title|toc|colophon|illustration|free|external)(?:\s|$)/u.test(line)) {
          const match = /^:::[a-z-]+ id="([a-zA-Z0-9][a-zA-Z0-9_-]{0,99})"\s*$/u.exec(line);
          if (!match) throw new Error('特殊ページの参照を入力中です。id="…" の形で指定してください。紙面は最後の確定状態を表示しています。');
          if (refs.has(match[1]!)) throw new Error('同じ特殊ページIDを二度配置できません。複製には別のIDを使ってください。'); refs.add(match[1]!);
        }
      }
    }
    const next = asBook(updateSource(book, source, syntax)); delete next.sourceDraft;
    for (const ref of flattenDocument(next.document)) if (ref.kind === 'specialPage' && next.specialPages.find(p => p.id === ref.pageId)?.role !== ref.role) throw new Error('同じIDのページ種別が変わっています。別のIDを使うか、選択箇所の設定から表現を変更してください。');
    validateDocumentReferences(next.document, next.styles);
    return { book: next };
  } catch (error) { return { book: { ...book, sourceDraft: source }, error: error instanceof Error ? error.message : '原稿を確認してください。' }; }
}
function mutable(book: BookModel): BookModel {
  if (book.sourceDraft !== undefined) throw new Error('原稿の参照指定を完成させてから、構成や書式を変更してください。入力途中の内容は保存されています。');
  return { ...book, document: structuredClone(book.document), specialPages: structuredClone(book.specialPages), pageOverrides: structuredClone(book.pageOverrides), assets: book.assets };
}
function projectSource(book: BookModel): BookModel { book.source = sourceOf(book.document, book.syntax); return book; }
export function addSpecialPage(book: BookModel, role: SpecialRole, afterId?: string): { book: BookModel; id: string } {
  const next = mutable(book);
  const id = `page-${next.document.nextId++}`, definition = newSpecialPage(id, role);
  if (role === 'title' || role === 'colophon' || role === 'chapter-title') { definition.fields.title = next.document.title === '本文' ? '' : next.document.title; definition.fields.author = next.document.author; }
  next.specialPages.push(definition);
  const ref: TreeBlock = { kind: 'specialPage', id: `b-${next.document.nextId++}`, role, pageId: id };
  const section = next.document.children.find(s => s.id === afterId || s.children.some(b => b.id === afterId)) ?? next.document.children.at(-1)!;
  const index = section.children.findIndex(b => b.id === afterId);
  section.children.splice(index >= 0 ? index + 1 : section.children.length, 0, ref);
  return { book: projectSource(next), id };
}
export function removeBookItem(book: BookModel, id: string): BookModel {
  const next = mutable(book), section = next.document.children.find(s => s.id === id);
  if (section) next.document.children = next.document.children.filter(s => s !== section);
  else for (const s of next.document.children) s.children = s.children.filter(b => b.id !== id && (b.kind !== 'specialPage' || b.pageId !== id));
  next.document.children = next.document.children.filter(s => s.children.length);
  if (!next.document.children.length) next.document.children = [{ kind: 'section', id: `s-${next.document.nextId++}`, role: 'body', children: [{ kind: 'paragraph', id: `b-${next.document.nextId++}`, indent: 'auto', inlines: [] }] }];
  // Unreferenced page definitions/assets survive deletion for undo and reinsertion.
  return projectSource(next);
}
export function moveBookItem(book: BookModel, id: string, direction: -1 | 1): BookModel {
  const next = mutable(book), si = next.document.children.findIndex(s => s.id === id);
  if (si >= 0) {
    const target = si + direction;
    if (target < 0 || target >= next.document.children.length || next.document.children[si]!.role === 'body' || next.document.children[target]!.role === 'body') return book;
    const [section] = next.document.children.splice(si, 1); next.document.children.splice(target, 0, section!);
  } else {
    const flat = flattenDocument(next.document), index = flat.findIndex(b => b.kind === 'specialPage' && b.pageId === id);
    if (index < 0) return book;
    const ref = flat[index]!;
    const candidates = direction === -1 ? flat.slice(0, index).reverse() : flat.slice(index + 1);
    const target = candidates.find(b => b.kind === 'specialPage' || b.kind === 'heading' && b.level === 1); if (!target) return book;
    const owner = next.document.children.find(s => s.children.includes(ref))!; owner.children.splice(owner.children.indexOf(ref), 1);
    const destination = next.document.children.find(s => s.children.includes(target))!;
    if (direction === -1 && target.kind === 'heading') {
      const prior = next.document.children[next.document.children.indexOf(destination) - 1];
      if (prior) prior.children.push(ref);
      else next.document.children.unshift({ kind: 'section', id: `s-${next.document.nextId++}`, role: 'body', children: [ref] });
    } else {
      const at = direction === 1 && target.kind === 'heading' ? destination.children.length : destination.children.indexOf(target) + (direction === 1 ? 1 : 0); destination.children.splice(at, 0, ref);
    }
    next.document.children = next.document.children.filter(s => s.children.length);
  }
  return projectSource(next);
}
export function updateSpecialPage(book: BookModel, id: string, change: Partial<SpecialPageDefinition>): BookModel {
  const next = mutable(book), page = next.specialPages.find(p => p.id === id); if (!page) throw new Error('特殊ページが見つかりません。');
  Object.assign(page, change, { id: page.id, role: page.role }); return next;
}
export function duplicateSpecialPage(book: BookModel, id: string): { book: BookModel; id: string } {
  const page = book.specialPages.find(p => p.id === id); if (!page) throw new Error('ページが見つかりません。');
  const sourceRef = flattenDocument(book.document).find(b => b.kind === 'specialPage' && b.pageId === id), inserted = addSpecialPage(book, page.role, sourceRef?.id);
  const copy = structuredClone(page); copy.id = inserted.id; copy.name = copy.name.slice(0, 97) + 'の複製';
  for (const e of copy.elements) e.id = `el-${inserted.book.document.nextId++}`;
  return { book: updateSpecialPage(inserted.book, inserted.id, copy), id: inserted.id };
}
export function convertToFree(book: BookModel, id: string, elements: readonly PageElement[]): BookModel {
  const p = book.specialPages.find(p => p.id === id); if (!p || p.representation !== 'template') throw new Error('テンプレート型ページを選んでください。');
  return updateSpecialPage(book, id, { representation: 'layout', elements: structuredClone([...elements]), originalTemplate: { template: p.template, fields: structuredClone(p.fields) } });
}
export function addChapter(book: BookModel, title: string): BookModel {
  const next = mutable(book); const b = `b-${next.document.nextId++}`;
  next.document.children.push({ kind: 'section', id: `s-${next.document.nextId++}`, role: 'chapter', headingId: b, children: [
    { kind: 'heading', id: b, level: 1, keepWithNext: true, inlines: [{ kind: 'text', text: title || '新しい章' }] },
    { kind: 'paragraph', id: `b-${next.document.nextId++}`, indent: 'auto', inlines: [] }
  ] }); return projectSource(next);
}
export function sourceRangeFor(book: BookModel, id: string): { from: number; to: number } | undefined {
  const blocks = flattenDocument(book.document), index = blocks.findIndex(b => b.id === id || b.kind === 'specialPage' && b.pageId === id);
  const range = sourceBlocks(book.source, book.syntax)[index], raw = rawSourceOffsets(book.source);
  return range ? { from: raw[range.from]!, to: raw[range.to]! } : undefined;
}
export function checkBook(book: BookModel): BookModel { return validatePublication({ ...book, source: sourceOf(book.document, book.syntax) }) as BookModel; }
export function renameChapter(book: BookModel, sectionId: string, title: string): BookModel {
  const next = mutable(book), s = next.document.children.find(s => s.id === sectionId), heading = s?.children.find(b => b.id === s.headingId);
  if (heading?.kind === 'heading') heading.inlines = [{ kind: 'text', text: title }]; return projectSource(next);
}
export function newElement(book: BookModel, kind: PageElement['kind']): PageElement {
  const id = `el-${book.document.nextId++}`, common = { id, xMm: 15, yMm: 25, widthMm: Math.max(10, book.style.page.widthMm - 30), heightMm: 20 };
  identifier(id);
  return kind === 'text' ? { ...common, kind, text: 'テキスト', fontPt: 12, fontWeight: 400, alignment: 'start', direction: 'horizontal' }
    : kind === 'image' ? { ...common, kind, assetId: book.assets[0]?.id ?? 'unassigned', assetPage: 1, fit: 'contain' }
    : { ...common, kind, heightMm: kind === 'line' ? .2 : 20, color: '#333333', strokeMm: .2 };
}

/** Clone a whole chapter with fresh structural IDs; assets and named styles remain shared. */
export function duplicateBookItem(book: BookModel, id: string): { book: BookModel; id: string } {
  const section = book.document.children.find(s => s.id === id);
  if (!section) return duplicateSpecialPage(book, id);
  if (section.role !== 'chapter') throw new Error('章または特殊ページを選んでください。');
  const next = mutable(book), clone = structuredClone(section), ids = new Map<string, string>();
  const used = new Set([...next.document.children.flatMap(s => [s.id, ...s.children.map(b => b.id)]), ...next.specialPages.flatMap(p => [p.id, ...p.elements.map(e => e.id)]), ...next.overrides.map(r => r.id), ...next.runningElements.map(r => r.id)]);
  const fresh = (old: string, prefix: string) => { let value: string; do { value = `${prefix}-${next.document.nextId++}`; } while (used.has(value)); used.add(value); if (prefix === 's' || prefix === 'b') ids.set(old, value); return value; };
  clone.id = fresh(section.id, 's');
  for (const block of clone.children) {
    block.id = fresh(block.id, 'b');
    if (block.kind === 'specialPage') {
      const original = next.specialPages.find(p => p.id === block.pageId); if (!original) throw new Error('複製元のページが見つかりません。');
      const page = structuredClone(original); page.id = fresh(page.id, 'page');
      for (const element of page.elements) element.id = fresh(element.id, 'el');
      next.specialPages.push(page); block.pageId = page.id;
    }
  }
  if (clone.headingId) clone.headingId = ids.get(clone.headingId)!;
  const heading = clone.children.find(b => b.id === clone.headingId);
  if (heading && 'inlines' in heading) heading.inlines = [...heading.inlines, { kind: 'text', text: 'の複製' }];
  next.document.children.splice(next.document.children.findIndex(s => s.id === id) + 1, 0, clone);
  const cloneScope = (scope: import('./model.js').Scope): import('./model.js').Scope | undefined => {
    if (scope.kind === 'section' && ids.has(scope.sectionId)) return { ...scope, sectionId: ids.get(scope.sectionId)! };
    if (scope.kind === 'block' && ids.has(scope.blockId)) return { ...scope, blockId: ids.get(scope.blockId)! };
    if (scope.kind === 'blockRange' && ids.has(scope.fromId) && ids.has(scope.toId)) return { ...scope, fromId: ids.get(scope.fromId)!, toId: ids.get(scope.toId)! };
    if (scope.kind === 'untilSection' && ids.has(scope.fromId)) return { ...scope, fromId: ids.get(scope.fromId)! };
    return undefined;
  };
  next.overrides = [...next.overrides, ...book.overrides.flatMap(rule => { const scope = cloneScope(rule.scope); return scope ? [{ ...structuredClone(rule), id: fresh(rule.id, 'override'), scope }] : []; })];
  next.runningElements = [...next.runningElements, ...book.runningElements.flatMap(rule => { const scope = cloneScope(rule.scope); return scope ? [{ ...structuredClone(rule), id: fresh(rule.id, 'running'), scope }] : []; })];
  return { book: checkBook(projectSource(next)), id: clone.id };
}
