let library: Promise<typeof import('../vendor/fflate.js')> | undefined;
function load() { return library ??= import('../vendor/fflate.js').catch(() => { library = undefined; throw new Error('ZIP処理を読み込めませんでした。'); }); }
export async function zipBlobs(files: Record<string, Uint8Array>): Promise<Blob> {
  const lib = await load(); return new Blob([lib.zipSync(files, { level: 0 })], { type: 'application/zip' });
}
/** Inspect central-directory sizes before decompressing. No archive paths are written to disk. */
export async function readWordXML(bytes: Uint8Array): Promise<Record<string, string>> {
  const lib = await load(); let size = 0;
  const files = lib.unzipSync(bytes, { filter(file) {
    if (!['word/document.xml', 'word/styles.xml'].includes(file.name)) return false;
    size += file.originalSize;
    if (file.originalSize > 8 * 1024 * 1024 || size > 12 * 1024 * 1024) throw new Error('DOCXの本文が大きすぎます。原稿を分けてください。');
    return true;
  } });
  if (!files['word/document.xml']) throw new Error('DOCXの本文がありません。暗号化されていない.docxを選んでください。');
  return Object.fromEntries(Object.entries(files).map(([name, data]) => [name, new TextDecoder('utf-8', { fatal: true }).decode(data)]));
}
