import type { RenderedPages } from '../domain/contracts.js';
import type { Publication } from '../domain/model.js';
import { typesetPublication } from '../typesetting/publication.js';

type Input = { revision: number; project: Publication };
type Reply = { revision: number; result?: RenderedPages; error?: string };
const scope = globalThis as unknown as { onmessage: (event: MessageEvent<Input>) => void; postMessage: (data: Reply) => void };
scope.onmessage = event => {
  const { revision, project } = event.data;
  try { scope.postMessage({ revision, result: typesetPublication(project) }); }
  catch (error) { scope.postMessage({ revision, error: error instanceof Error ? error.message : '組版に失敗しました。' }); }
};
