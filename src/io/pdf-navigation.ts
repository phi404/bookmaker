import type { BookNavigation } from '../domain/navigation.js';

interface PDFDictionary { set(key: unknown, value: unknown): void }
export interface NavigationPDF { context: { obj(value: Record<string, unknown>): PDFDictionary; register(value: unknown): unknown }; catalog: PDFDictionary }
export interface NavigationPDFPage { ref: unknown; node: { addAnnot(value: unknown): void } }
export interface NavigationPDFLibrary { PDFName: { of(name: string): unknown }; PDFNumber: { of(n: number): unknown }; PDFHexString: { fromText(text: string): unknown } }
interface OutlineNode { level: number; reference: unknown; dictionary: PDFDictionary; children: OutlineNode[] }
/** Add destinations to the pages already drawn; no second pagination or external actions. */
export function addPDFNavigation(pdf: NavigationPDF, pages: ReadonlyMap<number, NavigationPDFPage>, navigation: BookNavigation, heightMm: number, binding: 'left' | 'right', lib: NavigationPDFLibrary): void {
  const name = (s: string) => lib.PDFName.of(s), set = (dict: PDFDictionary, key: string, value: unknown) => dict.set(name(key), value);
  set(pdf.catalog, 'ViewerPreferences', pdf.context.obj({ Direction: binding === 'right' ? 'R2L' : 'L2R' }));
  const root = pdf.context.obj({ Type: 'Outlines' }), rootRef = pdf.context.register(root), children: OutlineNode[] = [], stack: OutlineNode[] = [];
  for (const heading of navigation.headings) {
    const page = pages.get(heading.pageNumber); if (!page) continue;
    while (stack.length && stack.at(-1)!.level >= heading.level) stack.pop();
    const parent = stack.at(-1), dict = pdf.context.obj({ Title: lib.PDFHexString.fromText(heading.title), Parent: parent?.reference ?? rootRef, Dest: [page.ref, 'Fit'] });
    const node: OutlineNode = { level: heading.level, reference: pdf.context.register(dict), dictionary: dict, children: [] };
    (parent?.children ?? children).push(node); stack.push(node);
  }
  const connect = (siblings: OutlineNode[], parent: PDFDictionary): number => {
    if (!siblings.length) return 0;
    set(parent, 'First', siblings[0]!.reference); set(parent, 'Last', siblings.at(-1)!.reference);
    let count = siblings.length;
    for (const [i, node] of siblings.entries()) {
      if (i) set(node.dictionary, 'Prev', siblings[i - 1]!.reference);
      if (i + 1 < siblings.length) set(node.dictionary, 'Next', siblings[i + 1]!.reference);
      const descendants = connect(node.children, node.dictionary); count += descendants;
      if (descendants) set(node.dictionary, 'Count', lib.PDFNumber.of(descendants));
    }
    return count;
  };
  const count = connect(children, root);
  if (count) { set(root, 'Count', lib.PDFNumber.of(count)); set(pdf.catalog, 'Outlines', rootRef); }
  const pt = 72 / 25.4;
  for (const link of navigation.links) {
    const source = pages.get(link.pageNumber), target = pages.get(link.targetPageNumber); if (!source || !target) continue;
    const annotation = pdf.context.obj({ Type: 'Annot', Subtype: 'Link', P: source.ref, Border: [0, 0, 0], Rect: [link.xMm * pt, (heightMm - link.yMm - link.heightMm) * pt, (link.xMm + link.widthMm) * pt, (heightMm - link.yMm) * pt], Dest: [target.ref, 'Fit'] });
    source.node.addAnnot(pdf.context.register(annotation));
  }
}
