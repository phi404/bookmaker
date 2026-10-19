import type { BookAsset, BookModel } from './model.js';
import { addSpecialPage, checkBook, updateSpecialPage } from './book.js';
import { flattenDocument } from './publication.js';

export function assetReferences(book: BookModel, assetId: string): {pageId: string; page: number}[] {
  return book.specialPages.flatMap(p => [...(p.representation === 'asset' && p.assetId === assetId ? [{pageId:p.id,page:p.assetPage}] : []), ...p.elements.flatMap(e => e.kind === 'image' && e.assetId === assetId ? [{pageId:p.id,page:e.assetPage}] : [])]);
}
export function insertAssetPages(book: BookModel, assetId: string, from: number, to: number, afterId?: string): {book: BookModel; ids: string[]} {
  const asset = book.assets.find(a => a.id === assetId);
  if (!asset || !Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < from || to > asset.images.length) throw new Error('素材内のページ範囲を確認してください。');
  let next = book, anchor = afterId; const ids: string[] = [];
  for (let number = from; number <= to; number++) {
    const added = addSpecialPage(next,asset.mediaType === 'application/pdf' ? 'external' : 'illustration',anchor);
    next = updateSpecialPage(added.book,added.id,{assetId,assetPage:number,name:`${asset.name}${asset.images.length>1?` · ${number}`:''}`.slice(0,100)}); ids.push(added.id);
    anchor = flattenDocument(next.document).find(b => b.kind === 'specialPage' && b.pageId === added.id)!.id;
  }
  return {book:checkBook(next),ids};
}
export function replaceBookAsset(book: BookModel, assetId: string, asset: BookAsset): BookModel {
  if (book.sourceDraft !== undefined) throw new Error('原稿の指定を完成させてから素材を差し替えてください。');
  if (!book.assets.some(a => a.id === assetId)) throw new Error('差し替える素材が見つかりません。');
  const required = Math.max(0,...assetReferences(book,assetId).map(r => r.page));
  if (required > asset.images.length) throw new Error(`${required}ページ目を使っています。差し替え先にもそのページが必要です。`);
  return checkBook({...book,assets:book.assets.map(a => a.id === assetId ? {...asset,id:assetId} : a)});
}
export function removeUnusedAsset(book: BookModel, assetId: string): BookModel {
  if (book.sourceDraft !== undefined) throw new Error('原稿の指定を完成させてから素材を削除してください。');
  if (assetReferences(book,assetId).length) throw new Error('ページから参照されている素材は削除できません。');
  return checkBook({...book,assets:book.assets.filter(a => a.id !== assetId)});
}
