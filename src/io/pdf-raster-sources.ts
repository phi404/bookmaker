import type { BookPage, RenderElement } from '../domain/contracts.js';
import type { Publication, PrintSettings } from '../domain/model.js';
import { bundledResources } from './resources.js';
import { originalBytes } from './bundle.js';
import { checkSVG } from './assets.js';

type LoadingTask = ReturnType<typeof import('../vendor/pdfjs/pdf.mjs').getDocument>;
/** Temporary output images from originals. Never replace the book's preview or source assets. */
export function printRasterSources(book: Publication | undefined, settings: PrintSettings, signal: AbortSignal) {
  const assets = new Map((book?.assets ?? []).map(a => [a.id, a])), tasks = new Map<string, LoadingTask>();
  const cancel = () => { for (const task of tasks.values()) void task.destroy().catch(() => undefined); };
  signal.addEventListener('abort', cancel, { once: true });
  async function prepare(page: BookPage): Promise<BookPage> {
    if (settings.purpose !== 'print') return page;
    let bytes = 0;
    const elements: RenderElement[] = [];
    for (const element of page.elements ?? []) {
      signal.throwIfAborted();
      const asset = element.sourceAssetId ? assets.get(element.sourceAssetId) : undefined;
      if (element.kind !== 'image' || !asset || !['application/pdf', 'image/svg+xml'].includes(asset.mediaType)) { elements.push(element); continue; }
      if (asset.mediaType === 'image/svg+xml') { checkSVG(new TextDecoder().decode(originalBytes(asset.original))); elements.push({ ...element, dataUrl: asset.original }); continue; }
      if (settings.pdfSource === 'preserve') { elements.push(element); continue; }
      const lib = await import('../vendor/pdfjs/pdf.mjs'); lib.GlobalWorkerOptions.workerSrc = bundledResources.pdfWorker;
      let task = tasks.get(asset.id);
      if (!task) { task = lib.getDocument({ ...bundledResources.pdfOptions, data: originalBytes(asset.original), isEvalSupported: false }); tasks.set(asset.id, task); }
      const pdfSource = await task.promise, source = await pdfSource.getPage(element.sourceAssetPage ?? 1), natural = source.getViewport({ scale: 1 });
      const targetW = element.widthMm * settings.dpi / 25.4, targetH = element.heightMm * settings.dpi / 25.4;
      const scale = element.fit === 'cover' ? Math.max(targetW / natural.width, targetH / natural.height) : Math.min(targetW / natural.width, targetH / natural.height), viewport = source.getViewport({ scale });
      const width = Math.max(1, Math.round(viewport.width)), height = Math.max(1, Math.round(viewport.height));
      if (width * height > 40_000_000) { source.cleanup(); throw new Error('素材PDFの展開画像が大きすぎます。配置を小さくするかPDFの解像度を下げてください。'); }
      const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
      try {
        const context = canvas.getContext('2d'); if (!context) throw new Error('素材PDFの画像を生成できません。');
        await source.render({ canvasContext: context, canvas, viewport, background: 'rgb(255,255,255)' }).promise;
        signal.throwIfAborted(); const dataUrl = canvas.toDataURL('image/png'); bytes += dataUrl.length;
        if (bytes > 128 * 1024 * 1024) throw new Error('このページの素材画像が大きすぎます。素材か解像度を減らしてください。');
        elements.push({ ...element, dataUrl });
      } finally { canvas.width = 0; canvas.height = 0; source.cleanup(); }
    }
    return { ...page, elements };
  }
  return { prepare, async close(): Promise<void> { signal.removeEventListener('abort', cancel); await Promise.allSettled([...tasks.values()].map(t => t.destroy())); tasks.clear(); } };
}
