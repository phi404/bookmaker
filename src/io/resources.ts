/** URLs follow the installed app directory, including a GitHub Pages project path. */
const pdfRoot = new URL('../vendor/pdfjs/', import.meta.url);
export const bundledResources = {
  font: new URL('../fonts/NotoSerifJP-Regular.otf', import.meta.url),
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
