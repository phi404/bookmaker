import type { AssetImage, BookAsset } from '../domain/model.js';
import { bundledResources } from './resources.js';

const MAX_FILE = 16 * 1024 * 1024;
async function encode(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('素材を読み込めません。')); reader.readAsDataURL(blob); });
}
/** Reject active/external SVG content before any image decode; preserve the original. */
export function checkSVG(text: string): void {
  if (/<!DOCTYPE|<!ENTITY/iu.test(text)) throw new Error('外部定義を含むSVGには対応していません。');
  const svg = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (svg.querySelector('parsererror') || svg.documentElement.localName !== 'svg') throw new Error('SVGを読み込めません。');
  for (const node of Array.from(svg.getElementsByTagName('*'))) {
    if (['script', 'foreignObject', 'iframe', 'style', 'animate', 'animateMotion', 'animateTransform', 'set', 'image', 'feImage'].includes(node.localName)) throw new Error('スクリプト・外部素材・動的な要素を含むSVGには対応していません。');
    for (const attribute of Array.from(node.attributes)) {
      const key = attribute.localName, value = attribute.value;
      if (/^on/iu.test(key) || /(?:javascript:|@import)/iu.test(value) || /url\(\s*["']?(?!#)/iu.test(value) || ['href', 'src'].includes(key) && !value.startsWith('#')) throw new Error('外部参照を含むSVGには対応していません。');
    }
  }
}
async function decodeImage(dataUrl: string): Promise<HTMLImageElement> {
  const image = new Image(); image.decoding = 'async'; image.src = dataUrl;
  try { await image.decode(); } catch { throw new Error('画像を読み込めません。PNG・JPEG・静的なSVGを選んでください。'); }
  if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 16_000_000 || image.naturalWidth > 10000 || image.naturalHeight > 10000) throw new Error('画像は1600万画素・一辺10000px以内にしてください。');
  return image;
}
export async function importAsset(file: File, id: string, signal: AbortSignal, progress: (message: string) => void): Promise<BookAsset> {
  if (!file.size || file.size > MAX_FILE) throw new Error('素材は16MB以内にしてください。');
  const ext = file.name.split('.').at(-1)?.toLowerCase(), mime = ext === 'png' ? 'image/png' : ['jpg', 'jpeg'].includes(ext ?? '') ? 'image/jpeg' : ext === 'svg' ? 'image/svg+xml' : ext === 'pdf' ? 'application/pdf' : undefined;
  if (!mime) throw new Error('PNG、JPEG、SVG、PDFを選んでください。');
  if (mime === 'image/svg+xml') checkSVG(await file.text());
  signal.throwIfAborted(); const original = await encode(new Blob([await file.arrayBuffer()], { type: mime })), images: AssetImage[] = [];
  if (mime === 'application/pdf') {
    progress('PDFのページを準備しています…');
    const lib = await import('../vendor/pdfjs/pdf.mjs'); lib.GlobalWorkerOptions.workerSrc = bundledResources.pdfWorker;
    const task = lib.getDocument({ ...bundledResources.pdfOptions, data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false });
    const abort = () => { void task.destroy(); }; signal.addEventListener('abort', abort, { once: true });
    try {
      const doc = await task.promise; if (doc.numPages > 20) throw new Error('外部PDFは20ページ以内にしてください。'); let size = 0;
      for (let i = 1; i <= doc.numPages; i++) {
        signal.throwIfAborted(); const page = await doc.getPage(i), natural = page.getViewport({ scale: 1 });
        const scale = Math.min(300 / 72, 2500 / Math.max(natural.width, natural.height)), viewport = page.getViewport({ scale });
        const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
        try {
          const context = canvas.getContext('2d'); if (!context) throw new Error('PDFの画像を作れません。');
          await page.render({ canvasContext: context, canvas, viewport, background: 'rgb(255,255,255)' }).promise;
          const dataUrl = canvas.toDataURL('image/png'); size += dataUrl.length; if (size > 48 * 1024 * 1024) throw new Error('PDFの展開画像が48MBを超えました。ページを分けて読み込んでください。');
          images.push({ dataUrl, width: canvas.width, height: canvas.height, widthMm: natural.width * 25.4 / 72, heightMm: natural.height * 25.4 / 72 });
          progress(`${i} / ${doc.numPages} ページを準備しました。`); await new Promise(resolve => setTimeout(resolve, 0));
        } finally { canvas.width = 0; canvas.height = 0; page.cleanup(); }
      }
    } finally { signal.removeEventListener('abort', abort); await task.destroy(); }
  } else {
    progress('画像を準備しています…'); const image = await decodeImage(original); signal.throwIfAborted();
    if (mime === 'image/svg+xml') {
      const canvas = document.createElement('canvas'), scale = Math.min(300 / 96, 2500 / Math.max(image.naturalWidth, image.naturalHeight)); canvas.width = Math.ceil(image.naturalWidth * scale); canvas.height = Math.ceil(image.naturalHeight * scale);
      try { canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height); images.push({ dataUrl: canvas.toDataURL('image/png'), width: canvas.width, height: canvas.height }); }
      finally { canvas.width = 0; canvas.height = 0; }
    } else images.push({ dataUrl: original, width: image.naturalWidth, height: image.naturalHeight });
  }
  signal.throwIfAborted(); return { id, name: file.name.slice(0, 200), mediaType: mime, original, bytes: file.size, images };
}
