export function el<T extends HTMLElement = HTMLElement>(id: string): T {
  const found = document.getElementById(id); if (!found) throw new Error(`画面の要素がありません: ${id}`); return found as T;
}
export function input(id: string): HTMLInputElement { return el<HTMLInputElement>(id); }
export function setValue(id: string, value: string | number): void {
  const control = el<HTMLInputElement | HTMLSelectElement>(id); if (control.value !== String(value)) control.value = String(value);
}
