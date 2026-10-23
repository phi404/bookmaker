import { ASCII_ADVANCES } from './font-metrics.js';
/** Dash lengths are semantic; hyphens, minus signs and the prolonged mark stay distinct. */
const DASH_ADVANCES: Readonly<Record<string,number>> = {'‒':ASCII_ADVANCES['0']!,'–':.5,'—':1,'―':1,'⸺':2,'⸻':3,'︱':1,'︲':.5};
export const dashAdvance=(value:string):number|undefined=>DASH_ADVANCES[value];
export const isDashText=(value:string):boolean=>value.length>0&&Array.from(value).every(g=>dashAdvance(g)!==undefined);
