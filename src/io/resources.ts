/** URLs follow the installed app directory, including a GitHub Pages project path. */
const pdfRoot = new URL('../vendor/pdfjs/', import.meta.url);
export const bundledFont = {
  family: 'Book Mincho', name: 'Noto Serif JP Regular', path: 'fonts/NotoSerifJP-Regular.otf', license: 'fonts/OFL.txt',
  sha256: '2c9a12dbd4f2408c4610c7ee84a108b62d7236c3775baed618c64d9cb44b2f04',
  url: new URL('../fonts/NotoSerifJP-Regular.otf', import.meta.url), licenseURL: new URL('../fonts/OFL.txt', import.meta.url),
} as const;
export const bundledResources = {
  font: bundledFont.url,
  pdfWorker: new URL('pdf.worker.mjs', pdfRoot).href,
  pdfOptions: {
    cMapUrl: new URL('cmaps/', pdfRoot).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', pdfRoot).href,
    wasmUrl: new URL('wasm/', pdfRoot).href,
    iccUrl: new URL('iccs/', pdfRoot).href,
    useWorkerFetch: true,
  },
};
