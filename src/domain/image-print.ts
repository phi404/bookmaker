import type { LayoutImage } from './layout-input.js';
import type { ImagePrintInfo } from './contracts.js';
export function imagePrintInfo(image: LayoutImage, widthMm: number, heightMm: number, fit: 'contain' | 'cover', placement: ImagePrintInfo['placement'], bleedMm = 0): ImagePrintInfo {
  const x=widthMm/image.width,y=heightMm/image.height,scale=fit==='contain'?Math.min(x,y):Math.max(x,y);
  return {placement,effectiveDpi:25.4/scale,trimMm:[widthMm,heightMm],bleedMm,sourcePixels:[image.width,image.height],...(image.widthMm&&image.heightMm?{originalMm:[image.widthMm,image.heightMm] as [number,number]}:{})};
}
