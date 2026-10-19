import { readFile, writeFile } from 'node:fs/promises';
import { absolute } from './lib.mjs';

// Read only the sfnt tables needed for the bundled font's ASCII horizontal widths.
const font = await readFile(absolute('public/fonts/NotoSerifJP-Regular.otf'));
const tables = new Map();
for (let i = 0; i < font.readUInt16BE(4); i++) {
  const offset = 12 + i * 16;
  tables.set(font.toString('ascii', offset, offset + 4), font.readUInt32BE(offset + 8));
}
const cmap = tables.get('cmap'), head = tables.get('head'), hhea = tables.get('hhea'), hmtx = tables.get('hmtx');
if ([cmap, head, hhea, hmtx].some(value => value === undefined)) throw new Error('Missing font metric table');
let subtable;
for (let i = 0; i < font.readUInt16BE(cmap + 2); i++) {
  const offset = cmap + font.readUInt32BE(cmap + 4 + i * 8 + 4);
  if (font.readUInt16BE(offset) === 4) subtable = offset;
}
if (!subtable) throw new Error('The bundled font requires a format-4 cmap');
const segments = font.readUInt16BE(subtable + 6) / 2;
const ends = subtable + 14, starts = ends + segments * 2 + 2, deltas = starts + segments * 2, ranges = deltas + segments * 2;
const em = font.readUInt16BE(head + 18), metricCount = font.readUInt16BE(hhea + 34);
const widths = {};
for (let code = 32; code < 127; code++) {
  let glyph;
  for (let i = 0; i < segments; i++) {
    const start = font.readUInt16BE(starts + i * 2), end = font.readUInt16BE(ends + i * 2);
    if (code < start || code > end) continue;
    const delta = font.readInt16BE(deltas + i * 2), range = font.readUInt16BE(ranges + i * 2);
    glyph = range ? font.readUInt16BE(ranges + i * 2 + range + (code - start) * 2) : code;
    if (glyph) glyph = (glyph + delta) & 0xffff;
    break;
  }
  if (!glyph) throw new Error(`ASCII glyph missing: ${code}`);
  widths[String.fromCharCode(code)] = font.readUInt16BE(hmtx + Math.min(glyph, metricCount - 1) * 4) / em;
}
await writeFile(absolute('src/domain/font-metrics.ts'), '/** Generated from the bundled Noto Serif JP Regular (OFL); scripts/font-metrics.mjs. */\nexport const ASCII_ADVANCES: Readonly<Record<string, number>> = Object.freeze(' + JSON.stringify(widths, null, 2) + ');\n');
console.log('Generated 95 font advances.');
