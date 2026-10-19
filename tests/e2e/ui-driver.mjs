import { expect } from '@playwright/test';

/** Update selectors here if the UI changes; keep observable behavior assertions intact. */
export class BookUI {
  constructor(page) { this.page = page; }
  manuscript() { return this.page.getByRole('textbox', { name: '原稿', exact: true }); }
  preview() { return this.page.getByTestId('book-preview'); }
  async tab(label) {
    const button = this.page.locator('.mobile-tabs').getByRole('tab', { name: label, exact: true });
    if (await button.isVisible()) await button.click();
    if (label === '設定' && await this.page.locator('#toggle-right').isVisible()) await this.page.locator('#toggle-right').click();
    if (label === '原稿') {
      if ((await this.page.locator('#toggle-left').getAttribute('aria-expanded')) === 'false' && await this.page.locator('#toggle-left').isVisible()) await this.page.locator('#toggle-left').click();
      if (await this.page.locator('#tab-source').isVisible()) await this.page.locator('#tab-source').click();
    }
  }
  async ready() {
    await this.page.evaluate(async () => { await document.fonts.ready; });
    await expect(this.preview()).toHaveAttribute('data-input-revision', /^\d+$/u);
    await expect.poll(async () => (await this.preview().getAttribute('data-input-revision')) === (await this.preview().getAttribute('data-layout-revision'))).toBe(true);
    await expect(this.preview()).toHaveAttribute('data-layout-state', 'ready');
  }
  async paste(source) { await this.tab('原稿'); await this.manuscript().fill(source); await this.tab('プレビュー'); await this.ready(); }
  async importTxt(file) { await this.tab('原稿'); await this.page.getByTestId('manuscript-file').setInputFiles(file); await this.tab('プレビュー'); await this.ready(); }
  async pageCount() {
    const count = Number((await this.page.getByTestId('page-count').textContent()).match(/\d+/u)?.[0]);
    expect(count).toBeGreaterThan(0); return count;
  }
  async control(id, value) {
    await this.tab('設定');
    const typography = ['font-size', 'line-height'].includes(id);
    if (typography) { await this.page.locator('#inspect-styles').click(); await this.page.locator('#typography-target').selectOption('all'); }
    else if (!(await this.page.locator('#book-settings').isVisible())) await this.page.locator('#inspect-book').click();
    await this.page.getByTestId(id).evaluate((input, nextValue) => {
      input.value = String(nextValue);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
    await this.tab('プレビュー'); await this.ready();
  }
  async download(id, file) {
    if (!(await this.page.locator('#export-dialog').isVisible())) await this.page.getByTestId('open-export').click();
    if (['export-png-all', 'export-spread'].includes(id) && !(await this.page.getByTestId(id).isVisible())) await this.page.locator('#more-image-exports summary').click();
    if (id === 'export-project' && !(await this.page.getByTestId(id).isVisible())) await this.page.getByText('作業ファイルと原稿', { exact: true }).click();
    const pending = this.page.waitForEvent('download');
    await this.page.getByTestId(id).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    await download.saveAs(file);
    await this.page.getByTestId('close-export').click();
  }
}
