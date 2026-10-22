declare module '*vendor/linebreak/index.js' {
  export class Rules { breaks(text: string): Generator<{ position: number; required: boolean }>; }
}
