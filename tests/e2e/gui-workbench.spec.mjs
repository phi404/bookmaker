import { test, expect } from '@playwright/test';
import { BookUI } from './ui-driver.mjs';

test('@flow workbench entry keeps empty output clear and preserves the manuscript through commands', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  const ui = new BookUI(page); await ui.ready();
  await expect(page.locator('#preview-empty')).toBeVisible();
  await page.getByTestId('open-export').click();
  await expect(page.getByTestId('export-pdf')).toBeDisabled();
  await expect(page.getByTestId('export-project')).toBeEnabled();
  await page.getByTestId('close-export').click();
  const source = '# 第一章\n　｜薔薇《ばら》と*静かな余白*。\n　次の段落。';
  await ui.paste(source); await expect(page.locator('#preview-empty')).toBeHidden();
  await ui.manuscript().press('ControlOrMeta+k');
  await expect(page.getByRole('combobox', { name: '操作を検索' })).toBeFocused();
  await page.getByRole('combobox', { name: '操作を検索' }).fill('ページ番号');
  await page.getByRole('combobox', { name: '操作を検索' }).press('Enter');
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#folio-enabled')).toBeVisible();
  await expect(page.locator('#detail-folio')).toHaveAttribute('open', '');
  await expect(ui.manuscript()).toHaveValue(source);
  await page.locator('#open-command').click();
  await page.getByRole('combobox', { name: '操作を検索' }).fill('存在しない操作');
  await expect(page.locator('#command-empty')).toBeVisible();
  await page.getByRole('combobox', { name: '操作を検索' }).press('Escape');
  await expect(page.locator('#command-dialog')).not.toBeVisible();
  await expect(page.locator('#open-command')).toBeFocused();
});

test('@flow dropping a manuscript uses reversible import and rejects multiple files', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page);
  const original = '# 元の章\n　保存しておく原稿。'; await ui.paste(original);
  const imported = '# 新しい章\n　｜薔薇《ばら》と*圏点*。\n---\n　改ページの後。';
  const transfer = await page.evaluateHandle(text => {
    const files = new globalThis.DataTransfer(); files.items.add(new globalThis.File([text], '新しい原稿.md', { type: 'text/markdown' })); return files;
  }, imported);
  await page.locator('#left-source').dispatchEvent('drop', { dataTransfer: transfer }); await ui.ready();
  await expect(ui.manuscript()).toHaveValue(imported); await expect(page.locator('#undo-import')).toBeVisible();
  await page.locator('#undo-import').click(); await ui.ready(); await expect(ui.manuscript()).toHaveValue(original);
  const multiple = await page.evaluateHandle(() => {
    const files = new globalThis.DataTransfer(); for (const name of ['a.md', 'b.md']) files.items.add(new globalThis.File(['本文'], name)); return files;
  });
  await page.locator('#left-source').dispatchEvent('drop', { dataTransfer: multiple });
  await expect(page.locator('#notice-text')).toHaveText('原稿ファイルは一つずつ読み込んでください。');
  await expect(ui.manuscript()).toHaveValue(original); await transfer.dispose(); await multiple.dispose();
});

test('@visual workbench dark appearance and command search', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste('# 朝の余白\n　｜薔薇《ばら》と*静かな紙面*。\n'.repeat(10));
  await page.locator('#toggle-theme').click(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await expect.soft(page).toHaveScreenshot('workbench-dark.png', { animations: 'disabled', maxDiffPixels: 0 });
  await page.locator('#open-command').click(); await page.getByRole('combobox', { name: '操作を検索' }).fill('ページ');
  await expect.soft(page).toHaveScreenshot('workbench-command.png', { animations: 'disabled', maxDiffPixels: 0 });
});

test('@flow keyboard command navigation, focus and appearance preserve book and panel state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/');
  const ui = new BookUI(page), source = '# 雨のあと\n　原稿と版面を保ったまま表示を変える。\n'.repeat(8);
  await ui.paste(source); const paper = await ui.preview().locator('svg').first().getAttribute('viewBox');
  await page.locator('#open-command').click();
  await page.getByRole('combobox', { name: '操作を検索' }).fill('表示');
  await page.getByRole('combobox', { name: '操作を検索' }).press('ArrowDown');
  await expect(page.locator('#command-results button[data-active=true]')).toHaveText(/単ページ/u);
  await page.getByRole('combobox', { name: '操作を検索' }).press('Enter');
  await expect(page.getByTestId('view-single')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#close-right').click();
  await page.locator('#focus-preview').click();
  await expect(page.locator('#workspace')).toHaveAttribute('data-left-open', 'false');
  await expect(page.locator('#focus-preview')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#focus-preview').click();
  await expect(page.locator('#workspace')).toHaveAttribute('data-left-open', 'true');
  await expect(page.locator('#workspace')).toHaveAttribute('data-right-open', 'false');
  await page.locator('#toggle-theme').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(ui.manuscript()).toHaveValue(source);
  expect(await ui.preview().locator('svg').first().getAttribute('viewBox')).toBe(paper);
  await page.reload(); await ui.ready();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(ui.manuscript()).toHaveValue(source);
});

test('@flow mobile command dialog fits and returns to the requested workspace', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 740 }); await page.goto('/');
  const ui = new BookUI(page); await ui.paste('　小さな画面からも本を仕上げる。'.repeat(25));
  await page.locator('#open-command').click();
  await page.getByRole('combobox', { name: '操作を検索' }).fill('構成');
  await page.getByRole('combobox', { name: '操作を検索' }).press('Enter');
  await expect(page.locator('#left-structure')).toBeVisible();
  await expect(page.locator('#tab-structure')).toHaveAttribute('aria-selected', 'true');
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  await page.locator('#open-command').click();
  await page.getByRole('combobox', { name: '操作を検索' }).fill('書き出し');
  await page.getByRole('combobox', { name: '操作を検索' }).press('Enter');
  await expect(page.locator('#export-dialog')).toBeVisible();
  await page.getByTestId('close-export').click(); await expect(page.locator('#left-structure')).toBeVisible();
});
