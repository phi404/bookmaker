export type IconOption = readonly [value: string, label: string, icon: string];
export const alignmentOptions: readonly IconOption[] = [['', '書式を継承', 'rotate-ccw'], ['start', '先頭揃え', 'align-left'], ['center', '中央揃え', 'align-center'], ['end', '末尾揃え', 'align-right']];
export const weightOptions: readonly IconOption[] = [['', '書式を継承', 'rotate-ccw'], ['400', '標準の太さ', 'type'], ['700', '太字', 'bold']];
export function iconElement(name: string): HTMLSpanElement {
  const icon = document.createElement('span'); icon.className = 'icon'; icon.dataset.icon = name; icon.setAttribute('aria-hidden', 'true'); return icon;
}
export function setIconChoice(group: HTMLElement, value: unknown, mixed = false): void {
  group.dataset.value = mixed ? '__mixed__' : value === undefined ? '' : String(value);
  group.dataset.valueState = mixed ? 'mixed' : value === undefined || value === '' ? 'inherited' : 'local';
  for (const b of group.querySelectorAll<HTMLButtonElement>('button[data-choice-value]')) b.setAttribute('aria-pressed', String(!mixed && b.dataset.choiceValue === group.dataset.value));
  const state = group.querySelector<HTMLElement>('.choice-state'); if (state) { state.textContent = mixed ? '混在' : ''; state.hidden = !mixed; }
}
export function iconChoices(parent: HTMLElement, id: string, label: string, options: readonly IconOption[], value: unknown, choose: (value: string) => void, vertical = false): HTMLFieldSetElement {
  const field = document.createElement('fieldset'); field.className = 'icon-choice'; field.id = id; field.dataset.choiceField = 'true'; field.dataset.testid = id; field.dataset.alignment = String(id.endsWith('alignment') || id.endsWith('align')); field.dataset.vertical = String(vertical);
  const legend = document.createElement('legend'); legend.textContent = label; field.append(legend);
  const buttons = document.createElement('div'); buttons.className = 'choice-options'; field.append(buttons);
  for (const [v, text, icon] of options) {
    const button = document.createElement('button'); button.type = 'button'; button.id = id + '-' + (v || 'inherit'); button.dataset.choiceValue = v; button.setAttribute('aria-label', text); button.title = text; button.append(iconElement(icon));
    button.addEventListener('click', () => { setIconChoice(field, v); choose(v); });
    buttons.append(button);
  }
  const state = document.createElement('span'); state.className = 'choice-state'; state.setAttribute('aria-live', 'polite'); field.append(state);
  parent.append(field); setIconChoice(field, value); return field;
}
