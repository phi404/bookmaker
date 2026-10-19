import type { Scope, DocumentTree } from './model.js';
import { integer } from './style.js';
import { identifier, object } from './validation.js';

export interface ScopeContext { sectionId?: string; blockId?: string; blockOrder: readonly string[]; sectionByBlock?: Readonly<Record<string, string>>; pageNumber?: number }
export function validateScope(value: unknown): asserts value is Scope {
  object(value, ['kind', 'sectionId', 'blockId', 'fromId', 'toId', 'from', 'to'], '適用範囲');
  const keys: Record<string, string[]> = { book: ['kind'], section: ['kind', 'sectionId'], block: ['kind', 'blockId'], blockRange: ['kind', 'fromId', 'toId'], untilSection: ['kind', 'fromId'], pages: ['kind', 'from', 'to'] };
  const allowed = keys[value.kind as string]; if (!allowed) throw new Error('未対応の適用範囲です。'); object(value, allowed, '適用範囲');
  if (value.kind === 'section') identifier(value.sectionId);
  if (value.kind === 'block') identifier(value.blockId);
  if (value.kind === 'blockRange') { identifier(value.fromId); identifier(value.toId); }
  if (value.kind === 'untilSection') identifier(value.fromId);
  if (value.kind === 'pages') { const from = integer(value.from, '開始ページ'); if (value.to !== null) integer(value.to, '終了ページ', from); }
}
export const scopePriority = (scope: Scope): number => ({ book: 0, section: 10, untilSection: 20, blockRange: 20, pages: 30, block: 40 })[scope.kind];
export function matchesScope(scope: Scope, context: ScopeContext): boolean {
  switch (scope.kind) {
    case 'book': return true;
    case 'section': return scope.sectionId === context.sectionId;
    case 'block': return scope.blockId === context.blockId;
    case 'pages': return context.pageNumber !== undefined && context.pageNumber >= scope.from && (scope.to === null || context.pageNumber <= scope.to);
    case 'untilSection': return context.sectionByBlock?.[scope.fromId] !== undefined && context.sectionByBlock[scope.fromId] === context.sectionId && context.blockId !== undefined && context.blockOrder.indexOf(context.blockId) >= context.blockOrder.indexOf(scope.fromId);
    case 'blockRange': {
      const from = context.blockOrder.indexOf(scope.fromId), to = context.blockOrder.indexOf(scope.toId), at = context.blockOrder.indexOf(context.blockId ?? '');
      return from >= 0 && to >= from && at >= from && at <= to;
    }
  }
}
export function scopeExists(scope: Scope, tree: DocumentTree): boolean {
  if (scope.kind === 'book' || scope.kind === 'pages') return true;
  if (scope.kind === 'section') return tree.children.some(s => s.id === scope.sectionId);
  const ids = tree.children.flatMap(s => s.children.map(b => b.id));
  if (scope.kind === 'block') return ids.includes(scope.blockId);
  if (scope.kind === 'untilSection') return ids.includes(scope.fromId);
  return ids.indexOf(scope.fromId) >= 0 && ids.indexOf(scope.toId) >= ids.indexOf(scope.fromId);
}
