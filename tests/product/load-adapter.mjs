import { access } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { absolute, readJson } from '../../scripts/lib.mjs';

export function validateAdapter(adapter, phase = 'slice-1') {
  const required = ['parse', 'defaultStyle', 'paginate', 'renderSvg'];
  if (phase === 'mvp') required.push('serialize', 'restore');
  for (const name of required) {
    if (typeof adapter?.[name] !== 'function') throw new Error(`INVALID_ADAPTER: ${name}がありません。空の実装で検証を回避しないでください。`);
  }
  return adapter;
}
export async function loadAdapter(requestedPath) {
  const config = await readJson('harness/config.json');
  const adapterPath = requestedPath ?? config.adapterPath;
  const file = absolute(adapterPath);
  try { await access(file); } catch { throw new Error('PRODUCT_NOT_IMPLEMENTED: tests/product/adapter.mjsがありません。ハーネス成功はアプリ完成ではありません。'); }
  return validateAdapter((await import(pathToFileURL(file).href)).adapter, config.phase);
}
