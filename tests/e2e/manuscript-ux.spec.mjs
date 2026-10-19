import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { absolute } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';

const capture = async (page, name) => {
  const dir = `output/ux/${process.env.BOOKMAKER_UX_CAPTURE === 'before' ? 'before' : 'after'}`;
  await mkdir(absolute(dir), { recursive: true }); await page.screenshot({ path: absolute(`${dir}/${name}.png`) });
};
for (const width of [1440, 1024, 375]) test(`@flow manuscript first, readable wrapping and local pane controls ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 375 ? 812 : 900 }); await page.goto('/'); const ui = new BookUI(page); await ui.ready();
  await capture(page, `01-entry-${width}`);
  await expect(ui.manuscript()).toBeVisible(); await expect(page.locator('#tab-source')).toHaveText('原稿');
  await expect(ui.manuscript()).toHaveValue(''); await expect(page.getByText('ソース', { exact: true })).toHaveCount(0);
  const long = 'これは途中で改行を入力しない長い原稿です。'.repeat(30) + 'https://example.invalid/' + 'a'.repeat(120);
  await ui.manuscript().fill(long); await ui.ready();
  await expect(page.locator('#source-lines')).toHaveCount(0);
  const metrics = await ui.manuscript().evaluate(e => ({ width: e.clientWidth, overflow: e.scrollWidth - e.clientWidth, size: parseFloat(globalThis.getComputedStyle(e).fontSize), height: e.clientHeight }));
  await writeFile(absolute(`output/ux/after/editor-metrics-${width}.json`), JSON.stringify(metrics, null, 2));
  expect(metrics.overflow).toBeLessThanOrEqual(2); expect(metrics.size).toBeGreaterThanOrEqual(16); expect(metrics.height).toBeGreaterThan(400);
  if (width === 1440) {
    expect(metrics.width).toBeGreaterThanOrEqual(370); await page.locator('#expand-manuscript').click();
    expect((await ui.manuscript().boundingBox()).width).toBeGreaterThan(metrics.width + 140); await expect(ui.preview()).toBeVisible();
    await page.locator('#expand-manuscript').click(); await page.locator('#close-left').click(); await expect(page.locator('#toggle-left')).toBeVisible();
    await expect(page.locator('header #toggle-left')).toHaveCount(0); await page.locator('#toggle-left').click(); await expect(ui.manuscript()).toHaveValue(long);
    await page.locator('#close-right').click(); await expect(page.locator('#toggle-right')).toBeVisible(); await page.locator('#toggle-right').click();
    await expect(page.locator('#book-settings')).toBeVisible(); await expect(page.locator('header #toggle-right')).toHaveCount(0);
  }
  await capture(page, `02-editor-${width}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
  if (width === 1440) {
    await page.locator('#expand-manuscript').click(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); await page.reload(); await ui.ready();
    await expect(page.locator('#expand-manuscript')).toHaveAttribute('aria-pressed', 'true'); await expect(ui.manuscript()).toHaveValue(long);
    await page.locator('#expand-manuscript').click(); await expect(page.locator('#book-settings')).toBeVisible(); expect((await ui.manuscript().boundingBox()).width).toBe(metrics.width);
  }
});

test('@visual manuscript entry and expanded editing keep the paper visible', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page); await ui.ready();
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await expect.soft(page).toHaveScreenshot('manuscript-entry-desktop.png', { animations: 'disabled', maxDiffPixels: 0 });
  await ui.paste('# 雨のあと\n' + '　｜薔薇《ばら》は、*静かに*咲いていた。\n　――長い文章にも、読みやすい余白がある。\n'.repeat(14)); expect(await ui.pageCount()).toBeGreaterThanOrEqual(3);
  await page.getByTestId('page-select').fill('2'); await page.locator('#expand-manuscript').click(); await ui.manuscript().press('ControlOrMeta+Home');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); await capture(page, '05-expanded-editor');
  await expect.soft(page).toHaveScreenshot('manuscript-expanded-desktop.png', { animations: 'disabled', maxDiffPixels: 0 });
  await page.setViewportSize({ width: 375, height: 812 }); await page.reload(); await ui.ready();
  await expect(ui.manuscript()).toBeVisible(); await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved');
  await capture(page, '06-restored-manuscript-mobile');
  await expect.soft(page).toHaveScreenshot('manuscript-restored-mobile.png', { animations: 'disabled', maxDiffPixels: 0 });
});

test('@flow body settings remain primary and local settings require an explicit action', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.paste('# 第一章\n　この段落の設定だけを変える。\n　次の段落。'); await page.getByTestId('view-single').click();
  await ui.preview().locator('[data-body]').last().click(); await capture(page, '03-paper-selection');
  await expect(page.locator('#book-settings')).toBeVisible(); await expect(page.locator('#block-inspector')).toBeHidden();
  await page.locator('#edit-selection').click(); await expect(page.locator('#block-inspector')).toBeVisible(); await expect(page.locator('#inspector-scope')).toContainText('原稿にも反映');
  await expect(page.locator('#block-local-details')).not.toHaveAttribute('open', '');
  await page.locator('#inspect-book').click(); await expect(page.locator('#book-settings')).toBeVisible(); await expect(page.locator('#block-inspector')).toBeHidden();
  await page.locator('#inspect-selection').click(); await expect(page.locator('#block-selection-label')).toContainText('次の段落');
  await capture(page, '04-local-settings');
  await ui.manuscript().fill('# 第一章\n　この段落の設定だけを変える。'); await ui.ready();
  await expect(page.locator('#book-settings')).toBeVisible(); await expect(page.locator('#inspect-selection')).toBeDisabled(); await expect(page.locator('#block-inspector')).toBeHidden();
  await page.locator('#project-home').click(); await page.locator('#edit-project-information').click(); await expect(page.locator('#book-title')).toBeFocused(); await expect(page.locator('#book-title')).toBeInViewport();
});
