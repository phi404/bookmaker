import type { BookPage, BookStyle } from './contracts.js';
import type { PrintSettings, Publication } from './model.js';
import { object } from './validation.js';

export const screenPDF: Readonly<PrintSettings> = Object.freeze({ purpose: 'screen', bleedMm: 0, marks: 'none', dpi: 300, color: 'rgb', pdfSource: 'raster' });
export const monoPDF: Readonly<PrintSettings> = Object.freeze({ purpose: 'print', bleedMm: 3, marks: 'none', dpi: 600, color: 'gray', pdfSource: 'raster' });
export const colorPDF: Readonly<PrintSettings> = Object.freeze({ purpose: 'print', bleedMm: 3, marks: 'none', dpi: 350, color: 'rgb', pdfSource: 'raster' });
export const printSettings = (book: Pick<Publication, 'printSettings'>): PrintSettings => ({ ...(book.printSettings ?? screenPDF) });
export function validatePrintSettings(value: unknown): PrintSettings {
  object(value, ['purpose', 'bleedMm', 'marks', 'dpi', 'color', 'pdfSource'], 'PDFの設定');
  if (typeof value.purpose !== 'string' || !['screen', 'print'].includes(value.purpose) || typeof value.bleedMm !== 'number' || !Number.isFinite(value.bleedMm) || value.bleedMm < 0 || value.bleedMm > 10 ||
      typeof value.marks !== 'string' || !['none', 'corners', 'all'].includes(value.marks) || ![300, 350, 600].includes(Number(value.dpi)) || typeof value.dpi !== 'number' ||
      typeof value.color !== 'string' || !['rgb', 'gray'].includes(value.color) || typeof value.pdfSource !== 'string' || !['raster', 'preserve'].includes(value.pdfSource)) throw new Error('PDFの塗り足し・トンボ・解像度・色を確認してください。');
  if (value.purpose === 'screen' && Object.entries(screenPDF).some(([key, expected]) => key !== 'pdfSource' && value[key] !== expected)) throw new Error('閲覧用PDFは標準の出力設定を使います。印刷用の設定を選んでください。');
  return { purpose: value.purpose, bleedMm: value.bleedMm, marks: value.marks, dpi: value.dpi, color: value.color, pdfSource: value.pdfSource } as PrintSettings;
}
export interface PrintLine { x1: number; y1: number; x2: number; y2: number }
export function printGeometry(style: Pick<BookStyle, 'page'>, settings: PrintSettings) {
  validatePrintSettings(settings);
  const { widthMm: w, heightMm: h } = style.page, b = settings.bleedMm;
  const gap = 1, length = 5, margin = b + (settings.marks === 'none' ? 0 : gap + length + 1);
  const marks: PrintLine[] = [];
  if (settings.marks !== 'none') for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const x = sx < 0 ? 0 : w, y = sy < 0 ? 0 : h;
    for (const distance of b ? [0, b] : [0]) {
      marks.push({ x1: x + sx * (b + gap), y1: y + sy * distance, x2: x + sx * (b + gap + length), y2: y + sy * distance });
      marks.push({ x1: x + sx * distance, y1: y + sy * (b + gap), x2: x + sx * distance, y2: y + sy * (b + gap + length) });
    }
  }
  if (settings.marks === 'all') {
    for (const sy of [-1, 1]) {
      const y = sy < 0 ? 0 : h, cy = y + sy * (b + gap + length / 2);
      marks.push({ x1: w / 2, y1: y + sy * (b + gap), x2: w / 2, y2: y + sy * (b + gap + length) }, { x1: w / 2 - 2, y1: cy, x2: w / 2 + 2, y2: cy });
    }
    for (const sx of [-1, 1]) {
      const x = sx < 0 ? 0 : w, cx = x + sx * (b + gap + length / 2);
      marks.push({ x1: x + sx * (b + gap), y1: h / 2, x2: x + sx * (b + gap + length), y2: h / 2 }, { x1: cx, y1: h / 2 - 2, x2: cx, y2: h / 2 + 2 });
    }
  }
  return { trim: { x: margin, y: margin, width: w, height: h }, bleed: { x: margin - b, y: margin - b, width: w + 2 * b, height: h + 2 * b }, media: { width: w + 2 * margin, height: h + 2 * margin }, margin, marks };
}
export function printRasterSize(style: Pick<BookStyle, 'page'>, settings: PrintSettings) {
  const width = Math.round((style.page.widthMm + 2 * settings.bleedMm) / 25.4 * settings.dpi), height = Math.round((style.page.heightMm + 2 * settings.bleedMm) / 25.4 * settings.dpi);
  if (width * height > 40_000_000) throw new Error('この判型と解像度では画像が大きすぎます。PDFの解像度を下げるか判型を小さくしてください。');
  return { width, height };
}
export function printIssues(pages: readonly BookPage[], style: BookStyle, settings: PrintSettings, book?: Publication): { message: string; pageNumber?: number; elementId?: string; blockId?: string }[] {
  if (settings.purpose !== 'print') return [];
  const issues: { message: string; pageNumber?: number; elementId?: string; blockId?: string }[] = [];
  for (const page of pages) {
    const { widthMm: w, heightMm: h } = page.style?.page ?? style.page;
    for (const e of page.elements ?? []) {
      const touches = [e.xMm <= 0 && e.xMm + e.widthMm > 0, e.xMm < w && e.xMm + e.widthMm >= w, e.yMm <= 0 && e.yMm + e.heightMm > 0, e.yMm < h && e.yMm + e.heightMm >= h];
      const reaches = [e.xMm <= -settings.bleedMm + .001, e.xMm + e.widthMm >= w + settings.bleedMm - .001, e.yMm <= -settings.bleedMm + .001, e.yMm + e.heightMm >= h + settings.bleedMm - .001];
      if (settings.bleedMm && touches.some((v, i) => v && !reaches[i])) issues.push({ message: `端の要素が塗り足し${settings.bleedMm}mmまで届いていません。素材や配置を確認`, pageNumber: page.number, elementId: e.id, ...(e.blockId ? { blockId: e.blockId } : {}) });
    }
    const vectorSources = new Set((book?.assets ?? []).filter(a => ['application/pdf', 'image/svg+xml'].includes(a.mediaType)).map(a => a.id));
    const images = (page.elements ?? []).filter(e => e.kind === 'image');
    const nativeOnly = images.length > 0 && images.every(e => vectorSources.has(e.sourceAssetId ?? ''));
    const infos = nativeOnly ? [] : page.kind === 'flow' ? page.imageInfo ?? [] : page.imageInfo ? [page.imageInfo] : [];
    for (const info of infos) if (info.effectiveDpi < (settings.color === 'gray' ? 300 : 250)) issues.push({ message: `素材の実効解像度は約${Math.round(info.effectiveDpi)}dpiです。PDFの解像度を上げても元画像の細部は増えません`, pageNumber: page.number });
  }
  return issues;
}
