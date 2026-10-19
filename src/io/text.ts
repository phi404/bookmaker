import { MAX_SOURCE } from '../domain/document.js';

export function decodeText(buffer: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buffer);
  let encoding: string, text: string;
  if (bytes[0] === 0xff && bytes[1] === 0xfe) { encoding = 'UTF-16LE'; text = new TextDecoder('utf-16le', { fatal: true }).decode(bytes); }
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) { encoding = 'UTF-16BE'; text = new TextDecoder('utf-16be', { fatal: true }).decode(bytes); }
  else {
    try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); encoding = 'UTF-8'; }
    catch { text = new TextDecoder('shift_jis', { fatal: true }).decode(bytes); encoding = 'Shift_JIS'; }
  }
  if (text.length > MAX_SOURCE) throw new Error('原稿は50万文字以内で読み込んでください。');
  return { text, encoding };
}
export async function readManuscript(file: File): Promise<{ source: string; encoding: string }> {
  if (file.size > MAX_SOURCE * 4) throw new Error('ファイルが大きすぎます。原稿を分けて読み込んでください。');
  const decoded = decodeText(await file.arrayBuffer());
  return { source: decoded.text, encoding: decoded.encoding };
}
export function downloadBlob(blob: Blob, name: string): void {
  const link = document.createElement('a'), url = URL.createObjectURL(blob);
  link.href = url; link.download = name; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
