import type { BookPage, BookStyle } from '../domain/contracts.js';
import type { PrintSettings } from '../domain/model.js';
import { printGeometry } from '../domain/print.js';
import { renderPageSVG } from './svg.js';
/** A proof of the same sheet geometry used by PDF; guides never enter the book model. */
export function renderPrintProof(page: BookPage, style: BookStyle, settings: PrintSettings): string {
  const sheet = printGeometry(style, settings), b = settings.bleedMm;
  const svg = renderPageSVG(page, style, undefined, false, { bleedMm: b, blackText: settings.purpose === 'print', idPrefix: 'export-proof' });
  const image = svg.replace('<svg ', `<svg x="${sheet.margin - b}" y="${sheet.margin - b}" `);
  const lines = sheet.marks.map(l => `<line x1="${l.x1 + sheet.margin}" y1="${l.y1 + sheet.margin}" x2="${l.x2 + sheet.margin}" y2="${l.y2 + sheet.margin}"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sheet.media.width}mm" height="${sheet.media.height}mm" viewBox="0 0 ${sheet.media.width} ${sheet.media.height}" role="img" aria-label="PDFの用紙とトンボの見本"><rect width="100%" height="100%" fill="white"/><g${settings.color === 'gray' ? ' style="filter:grayscale(1)"' : ''}>${image}</g><g stroke="black" stroke-width="${.25 * 25.4 / 72}">${lines}</g></svg>`;
}
