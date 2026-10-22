import type { BookStyle, BookPage } from '../domain/contracts.js';
import type { BookNavigation } from '../domain/navigation.js';
import type { Publication, PrintSettings } from '../domain/model.js';
import { printGeometry, printRasterSize, screenPDF, validatePrintSettings } from '../domain/print.js';
import { preservedPDFPages, type VectorDocument, type VectorLibrary, type VectorPage } from './pdf-vectors.js';
import { addPDFNavigation, type NavigationPDF, type NavigationPDFPage, type NavigationPDFLibrary } from './pdf-navigation.js';
import { printRasterSources } from './pdf-raster-sources.js';
import { rasterize } from './raster.js';

interface RawStream { getContentsSize(): number }
interface PDFPage extends NavigationPDFPage, VectorPage {
  node: NavigationPDFPage['node'] & VectorPage['node'];
  setTrimBox(x: number, y: number, width: number, height: number): void;
  setBleedBox(x: number, y: number, width: number, height: number): void;
  drawLine(options: { start: { x: number; y: number }; end: { x: number; y: number }; thickness: number; color: unknown }): void;
}
interface PDFDocument extends NavigationPDF, VectorDocument {
  context: NavigationPDF['context'] & VectorDocument['context'] & { flateStream(bytes: Uint8Array, dictionary: Record<string, string | number>): RawStream; register(stream: RawStream): unknown };
  addPage(size: [number, number]): PDFPage;
  setTitle(title: string): void; setCreator(name: string): void; setProducer(name: string): void; save(): Promise<Uint8Array>;
}
interface PDFLibrary extends NavigationPDFLibrary, VectorLibrary {
  PDFDocument: VectorLibrary['PDFDocument'] & { create(): Promise<PDFDocument> };
  grayscale(value: number): unknown;
}
let library: Promise<PDFLibrary> | undefined;
async function loadLibrary(): Promise<PDFLibrary> {
  return library ??= import('../vendor/pdf-lib.js').then(module => module as unknown as PDFLibrary).catch(() => { library = undefined; throw new Error('PDFライブラリを読み込めません。'); });
}
/** Draw the fixed book pages into a separate physical sheet; never repaginate for printing. */
export async function exportPDF(pages: readonly BookPage[], style: BookStyle, title: string, signal: AbortSignal, progress: (count: number) => void, navigation: BookNavigation = { headings: [], links: [] }, book?: Publication, options: PrintSettings = { ...screenPDF }): Promise<Blob> {
  const settings = validatePrintSettings(options), sheet = printGeometry(style, settings), pt = 72 / 25.4;
  printRasterSize(style, settings);
  if (settings.color === 'gray' && settings.pdfSource === 'preserve') throw new Error('グレースケールで出力する場合は、素材PDFを「画像として出力」にしてください。');
  const lib = await loadLibrary(), pdf = await lib.PDFDocument.create(), destinations = new Map<number, PDFPage>();
  let total = 0;
  const usedBytes = (bytes: number) => { total += bytes; if (total > 128 * 1024 * 1024) throw new Error('PDFが128MBを超えました。範囲を分けて書き出してください。'); };
  const raster = { dpi: settings.dpi, bleedMm: settings.bleedMm, blackText: settings.purpose === 'print' };
  const vectorPage = settings.pdfSource === 'preserve' && book ? preservedPDFPages(pdf, lib, book, style, signal, usedBytes, raster) : undefined;
  const originals = printRasterSources(book, settings, signal);
  pdf.setTitle(title); pdf.setCreator('Compholio'); pdf.setProducer('Compholio');
  try {
  for (const [index, originalPage] of pages.entries()) {
    const content = await originals.prepare(originalPage);
    signal.throwIfAborted();
    const page = pdf.addPage([sheet.media.width * pt, sheet.media.height * pt]);
    page.setTrimBox(sheet.trim.x * pt, sheet.trim.y * pt, sheet.trim.width * pt, sheet.trim.height * pt);
    page.setBleedBox(sheet.bleed.x * pt, sheet.bleed.y * pt, sheet.bleed.width * pt, sheet.bleed.height * pt);
    destinations.set(content.number, page);
    if (vectorPage?.hasPDF(content)) {
      const b = settings.bleedMm * pt;
      page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(1, 0, 0, 1, sheet.margin * pt, sheet.margin * pt), lib.rectangle(-b, -b, (style.page.widthMm + 2 * settings.bleedMm) * pt, (style.page.heightMm + 2 * settings.bleedMm) * pt), lib.clip(), lib.endPath());
      await vectorPage.draw(content, page);
      page.pushOperators(lib.popGraphicsState());
    } else {
      const canvas = await rasterize(content, style, false, raster);
      try {
        signal.throwIfAborted();
        const context = canvas.getContext('2d'); if (!context) throw new Error('画像を生成できません。');
        const rgba = context.getImageData(0, 0, canvas.width, canvas.height).data, channels = settings.color === 'gray' ? 1 : 3, pixels = new Uint8Array(canvas.width * canvas.height * channels);
        for (let source = 0, target = 0; source < rgba.length; source += 4) {
          if (channels === 1) pixels[target++] = Math.round(.2126 * rgba[source]! + .7152 * rgba[source + 1]! + .0722 * rgba[source + 2]!);
          else { pixels[target++] = rgba[source]!; pixels[target++] = rgba[source + 1]!; pixels[target++] = rgba[source + 2]!; }
        }
        const stream = pdf.context.flateStream(pixels, { Type: 'XObject', Subtype: 'Image', Width: canvas.width, Height: canvas.height, ColorSpace: channels === 1 ? 'DeviceGray' : 'DeviceRGB', BitsPerComponent: 8 }); usedBytes(stream.getContentsSize());
        const reference = pdf.context.register(stream), name = page.node.newXObject('BookPage', reference);
        page.pushOperators(lib.pushGraphicsState(), lib.concatTransformationMatrix(sheet.bleed.width * pt, 0, 0, sheet.bleed.height * pt, sheet.bleed.x * pt, sheet.bleed.y * pt), lib.drawObject(name), lib.popGraphicsState());
      } finally { canvas.width = 0; canvas.height = 0; }
    }
    for (const line of sheet.marks) page.drawLine({ start: { x: (line.x1 + sheet.margin) * pt, y: (style.page.heightMm - line.y1 + sheet.margin) * pt }, end: { x: (line.x2 + sheet.margin) * pt, y: (style.page.heightMm - line.y2 + sheet.margin) * pt }, thickness: .25, color: lib.grayscale(0) });
    progress(index + 1); await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  } finally { await originals.close(); }
  signal.throwIfAborted();
  // Print files contain no interactive annotations. Screen navigation is unchanged.
  if (settings.purpose === 'screen') addPDFNavigation(pdf, destinations, navigation, style.page.heightMm, style.binding, lib);
  return new Blob([new Uint8Array(await pdf.save())], { type: 'application/pdf' });
}
