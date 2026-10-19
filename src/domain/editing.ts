import type { BookModel, LocalStyle, PageElement, SpecialRole, Publication, TreeBlock } from './model.js';
import { checkBook, updateSpecialPage, addSpecialPage, convertToFree } from './book.js';
import { flattenDocument, sourceOf } from './publication.js';
import { validateLocal } from './styles.js';
import { templateElements } from './templates.js';

export function editTextBlocks(project: Publication, ids: ReadonlySet<string>, edit: (block: TreeBlock) => void): Publication {
  if (project.sourceDraft !== undefined) throw new Error('原稿の指定を完成させてから書式を変更してください。');
  const document = structuredClone(project.document);
  for (const block of flattenDocument(document)) if (ids.has(block.id) && 'inlines' in block) { edit(block); if (block.localStyle) validateLocal(block.localStyle); }
  return { ...project, document };
}

export function rangeBlocks(book: BookModel, ids: readonly string[]): string[] {
  const blocks = flattenDocument(book.document), positions = ids.map(id => blocks.findIndex(b => b.id === id));
  if (!positions.length || positions.some(n => n < 0)) throw new Error('選択範囲の文章が見つかりません。');
  return blocks.slice(Math.min(...positions), Math.max(...positions) + 1).filter(b => 'inlines' in b).map(b => b.id);
}
export function editRangeStyle(book: BookModel, ids: readonly string[], patch: LocalStyle, reset = false): BookModel {
  if (book.sourceDraft !== undefined) throw new Error('原稿の指定を完成させてから書式を変更してください。');
  validateLocal(patch); const selected = new Set(rangeBlocks(book, ids)), next = { ...book, document: structuredClone(book.document) };
  for (const block of flattenDocument(next.document)) if (selected.has(block.id)) {
    if (reset) delete block.localStyle;
    else block.localStyle = { ...block.localStyle, ...patch, paragraph: { ...block.localStyle?.paragraph, ...patch.paragraph }, character: { ...block.localStyle?.character, ...patch.character }, page: { ...block.localStyle?.page, ...patch.page, ...(block.localStyle?.page?.margins || patch.page?.margins ? { margins: { ...block.localStyle?.page?.margins, ...patch.page?.margins } } : {}) } };
    if (block.localStyle) for (const key of ['paragraph', 'character', 'page'] as const) if (!Object.keys(block.localStyle[key] ?? {}).length) delete block.localStyle[key];
  }
  return checkBook(next);
}

/** Chapters move with their content. Page references move between structural insertion points. */
export function reorderBookItem(book: BookModel, id: string, targetId: string, placement: 'before' | 'after'): BookModel {
  if (book.sourceDraft !== undefined) throw new Error('入力途中の原稿を確定してから構成を移動してください。');
  if (id === targetId) return book;
  const next = { ...book, document: structuredClone(book.document) }, tree = next.document;
  const chapter = tree.children.find(s => s.id === id);
  const targetChapter = tree.children.find(s => s.id === targetId), targetOwner = targetChapter ?? tree.children.find(s => s.children.some(b => b.kind === 'specialPage' && b.pageId === targetId));
  if (!targetOwner) throw new Error('移動先が見つかりません。');
  if (chapter) {
    if (chapter === targetOwner || targetOwner.role === 'body') return book;
    tree.children.splice(tree.children.indexOf(chapter), 1);
    tree.children.splice(tree.children.indexOf(targetOwner) + (placement === 'after' ? 1 : 0), 0, chapter);
  } else {
    const owner = tree.children.find(s => s.children.some(b => b.kind === 'specialPage' && b.pageId === id)), ref = owner?.children.find(b => b.kind === 'specialPage' && b.pageId === id);
    if (!owner || !ref) throw new Error('移動するページが見つかりません。');
    owner.children.splice(owner.children.indexOf(ref), 1);
    if (targetChapter && placement === 'before') {
      const prior = tree.children[tree.children.indexOf(targetChapter) - 1];
      if (prior) prior.children.push(ref);
      else tree.children.unshift({ kind: 'section', id: `s-${tree.nextId++}`, role: 'body', children: [ref] });
    } else {
      const at = targetChapter ? targetOwner.children.length : targetOwner.children.findIndex(b => b.kind === 'specialPage' && b.pageId === targetId) + (placement === 'after' ? 1 : 0);
      targetOwner.children.splice(at, 0, ref);
    }
    tree.children = tree.children.filter(s => s.children.length);
  }
  next.source = sourceOf(tree, next.syntax); return checkBook(next);
}
export function createLayoutPage(book: BookModel, template: 'blank' | 'title' | 'chapter-title' | 'colophon', name: string, afterId?: string): { book: BookModel; id: string } {
  const role: SpecialRole = template === 'blank' ? 'free' : template;
  const added = addSpecialPage(book, role, afterId);
  const page = added.book.specialPages.find(p => p.id === added.id)!;
  const fields = { ...page.fields, title: name || page.fields.title || 'タイトル' };
  let next = updateSpecialPage(added.book, added.id, { fields, name: name || page.name });
  if (template !== 'blank') next = convertToFree(next, added.id, templateElements({ ...page, fields }, next.style));
  return { book: checkBook(next), id: added.id };
}
export function editPageElement(book: BookModel, pageId: string, elementId: string, action: 'duplicate' | 'delete' | 'front' | 'back' | 'forward' | 'backward' | 'lock'): { book: BookModel; elementId?: string } {
  const page = book.specialPages.find(p => p.id === pageId), index = page?.elements.findIndex(e => e.id === elementId) ?? -1;
  if (!page || page.representation !== 'layout' || index < 0) throw new Error('自由ページの要素を選んでください。');
  const elements = structuredClone(page.elements), element = elements[index]!;
  const next = { ...book, document: structuredClone(book.document) };
  if (action === 'duplicate') {
    if (elements.length >= 50) throw new Error('自由ページは50要素以内にしてください。');
    const copy: PageElement = { ...element, id: `el-${next.document.nextId++}`, xMm: Math.min(element.xMm + 3, Math.max(0, book.style.page.widthMm - element.widthMm)), yMm: Math.min(element.yMm + 3, Math.max(0, book.style.page.heightMm - element.heightMm)) };
    elements.splice(index + 1, 0, copy); return { book: updateSpecialPage(next, pageId, { elements }), elementId: copy.id };
  }
  if (action === 'delete') { if (element.locked) throw new Error('要素の固定を解除してから削除してください。'); elements.splice(index, 1); }
  else if (action === 'lock') { if (element.locked) delete element.locked; else element.locked = true; }
  else { elements.splice(index, 1); const to = action === 'front' ? elements.length : action === 'back' ? 0 : action === 'forward' ? Math.min(elements.length, index + 1) : Math.max(0, index - 1); elements.splice(to, 0, element); }
  return { book: updateSpecialPage(next, pageId, { elements }), ...(action === 'delete' ? {} : { elementId }) };
}
export function resizePageElement(book: BookModel, pageId: string, elementId: string, width: number, height: number): BookModel {
  const page = book.specialPages.find(p => p.id === pageId), e = page?.elements.find(e => e.id === elementId);
  if (!page || page.representation !== 'layout' || !e || e.locked) throw new Error('大きさを変更できる要素を選んでください。');
  if (![width, height].every(Number.isFinite)) throw new Error('大きさを確認してください。');
  return updateSpecialPage(book, pageId, { elements: page.elements.map(item => item.id === elementId ? { ...item, widthMm: Math.max(.1, Math.min(book.style.page.widthMm - e.xMm, width)), heightMm: Math.max(.1, Math.min(book.style.page.heightMm - e.yMm, height)) } : item) });
}

export function pageElementMovement(book: BookModel, pageId: string, ids: readonly string[], dx: number, dy: number): {dx: number; dy: number} {
  const page=book.specialPages.find(p=>p.id===pageId), elements=page?.elements.filter(e=>ids.includes(e.id)&&!e.locked)??[];
  if(!page||page.representation!=='layout'||!elements.length)throw new Error('移動する要素の固定を解除してください。');
  if(![dx,dy].every(Number.isFinite))throw new Error('移動量を確認してください。');
  const minX=Math.min(...elements.map(e=>e.xMm)),minY=Math.min(...elements.map(e=>e.yMm)),maxX=Math.max(...elements.map(e=>e.xMm+e.widthMm)),maxY=Math.max(...elements.map(e=>e.yMm+e.heightMm)),step=page.snapMm??1;
  const clamp=(delta:number,min:number,max:number)=>Math.max(-min,Math.min(Math.max(-min,max),step?Math.round(delta/step)*step:delta));
  return {dx:clamp(dx,minX,book.style.page.widthMm-maxX),dy:clamp(dy,minY,book.style.page.heightMm-maxY)};
}
export function movePageElements(book: BookModel, pageId: string, ids: readonly string[], dx: number, dy: number): BookModel {
  const delta=pageElementMovement(book,pageId,ids,dx,dy),page=book.specialPages.find(p=>p.id===pageId)!;
  return updateSpecialPage(book,pageId,{elements:page.elements.map(e=>ids.includes(e.id)&&!e.locked?{...e,xMm:e.xMm+delta.dx,yMm:e.yMm+delta.dy}:e)});
}
export function editPageElements(book: BookModel, pageId: string, ids: readonly string[], action: Parameters<typeof editPageElement>[3]): {book: BookModel; ids: string[]} {
  const page=book.specialPages.find(p=>p.id===pageId),elements=page?.elements.filter(e=>ids.includes(e.id))??[];
  if(!page||!elements.length)throw new Error('自由ページの要素を選んでください。');
  if(action==='delete'&&elements.some(e=>e.locked))throw new Error('固定を解除してから削除してください。');
  if(action==='duplicate'&&page.elements.length+elements.length>50)throw new Error('自由ページは50要素以内にしてください。');
  const ordered=['back','forward'].includes(action)?[...elements].reverse():elements,locked=elements.every(e=>e.locked);let next=book;const selected:string[]=[];
  for(const element of ordered){
    if(action==='lock'&&!!element.locked!==locked){selected.push(element.id);continue;}
    const result=editPageElement(next,pageId,element.id,action);next=result.book;if(result.elementId)selected.push(result.elementId);
  }
  return {book:checkBook(next),ids:selected};
}
