declare module '*fflate.js' {
  export function zipSync(files: Record<string, Uint8Array>, options?: { level: number }): Uint8Array<ArrayBuffer>;
  export function unzipSync(data: Uint8Array, options?: { filter(file: { name: string; size: number; originalSize: number }): boolean }): Record<string, Uint8Array>;
}
