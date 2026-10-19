import type { BookStyle, BookPage } from '../domain/contracts.js';
import { rasterize } from './raster.js';

interface RawStream { getContentsSize(): number }
interface PDFPage { node: { newXObject(tag: string, reference: unknown): unknown }; pushOperators(...operators: unknown[]): void }
interface PDFDocument {
  context: { flateStream(bytes: Uint8Array, dictionary: Record<string, string | number>): RawStream; register(stream: RawStream): unknown };
  addPage(size: [number, number]): PDFPage;
  setTitle(title: string): void;
  setProducer(name: string): void;
  save(): Promise<Uint8Array>;
}
interface PDFLibrary {
  PDFDocument: { create(): Promise<PDFDocument> };
  pushGraphicsState(): unknown;
  popGraphicsState(): unknown;
  concatTransformationMatrix(a: number, b: number, c: number, d: number, e: number, f: number): unknown;
  drawObject(name: unknown): unknown;
}
let library: Promise<PDFLibrary> | undefined;
async function loadLibrary(): Promise<PDFLibrary> {
  return library ??= import('../vendor/pdf-lib.js').then(module => module as unknown as PDFLibrary).catch(() => { library = undefined; throw new Error('PDFライブラリを読み込めません。'); });
}
/** Retain compressed RGB streams, not an uncompressed image for every book page. */
export async function exportPDF(pages: readonly BookPage[], style: BookStyle, title: string, signal: AbortSignal, progress: (count: number) => void): Promise<Blob> {
  const lib = await loadLibrary(), pdf = await lib.PDFDocument.create();
  const width = style.page.widthMm * 72 / 25.4, height = style.page.heightMm * 72 / 25.4;
  let total = 0;
  pdf.setTitle(title); pdf.setProducer('Bookmaker / local prototype');
  for (let index = 0; index < pages.length; index++) {
    signal.throwIfAborted();
    const canvas = await rasterize(pages[index]!, style);
    try {
      const context = canvas.getContext('2d'); if (!context) throw new Error('画像を生成できません。');
      const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data;
      const rgb = new Uint8Array(canvas.width * canvas.height * 3);
      for (let source = 0, target = 0; source < rgba.length; source += 4) { rgb[target++] = rgba[source]!; rgb[target++] = rgba[source + 1]!; rgb[target++] = rgba[source + 2]!; }
      const stream = pdf.context.flateStream(rgb, { Type: 'XObject', Subtype: 'Image', Width: canvas.width, Height: canvas.height, ColorSpace: 'DeviceRGB', BitsPerComponent: 8 });
      total += stream.getContentsSize();
      if (total > 128 * 1024 * 1024) throw new Error('PDFの画像が128MBを超えました。原稿を分けて書き出してください。');
      const reference = pdf.context.register(stream), page = pdf.addPage([width, height]);
      const name = page.node.newXObject('BookPage', reference);
      page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(width, 0, 0, height, 0, 0), lib.drawObject(name), lib.popGraphicsState());
      progress(index + 1);
    } finally { canvas.width = 0; canvas.height = 0; }
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  signal.throwIfAborted();
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
