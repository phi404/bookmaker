export function object(value: unknown, keys: readonly string[], label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${label}を読み込めません。`);
  if (Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${label}に未対応の項目があります。元のファイルを保管してください。`);
}
export function identifier(value: unknown): asserts value is string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/u.test(value)) throw new Error('参照IDを確認してください。');
}
export function textValue(value: unknown, limit: number, label: string): asserts value is string {
  if (typeof value !== 'string' || value.length > limit) throw new Error(`${label}を確認してください。`);
}
