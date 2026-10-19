declare module '*pdf.mjs' {
  export const GlobalWorkerOptions: { workerSrc: string };
  export function getDocument(options: object): { promise: Promise<{ numPages: number; getPage(number: number): Promise<{ getViewport(options: { scale: number }): { width: number; height: number }; render(options: object): { promise: Promise<void> }; cleanup(): void }>; destroy(): Promise<void> }>; destroy(): Promise<void> };
}
