import type { BookStyle, Document, FlowPage, RenderedPages, Project } from '../../src/domain/contracts.ts';

/** Implement in adapter.mjs, translating production interfaces without changing expectations. */
export interface ProductAdapter {
  parse(source: string): Document;
  defaultStyle(): BookStyle;
  paginate(document: Document, style: BookStyle): RenderedPages;
  renderSvg(page: FlowPage, style: BookStyle): string;
  serialize?(project: Project): string;
  restore?(json: string): Project;
}
export interface MvpProductAdapter extends ProductAdapter {
  serialize(project: Project): string;
  restore(json: string): Project;
}
export const adapter: ProductAdapter;
