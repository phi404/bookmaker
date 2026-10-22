import { mkdir, writeFile } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { absolute, fingerprint } from '../../scripts/lib.mjs';
import { BookUI } from './ui-driver.mjs';

const manuscript = '# 第一章\n　｜薔薇《ばら》が咲いた。*静かな言葉*――コーヒー。\n---\n第二のページ。\n---\n第三のページ。';
test('@flow simple/spread navigation, uniform margins and progressively revealed folios', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto('/'); const ui = new BookUI(page); await ui.paste(manuscript);
  await expect(page.locator('#settings-toggle')).toHaveCount(0); await expect(page.locator('#detail-folio')).not.toHaveAttribute('open');
  await expect(page.locator('#next-arrow')).toHaveAttribute('data-icon', 'chevron-left'); await page.getByRole('button', { name: '次のページ', exact: true }).click();
  await expect(page.getByTestId('page-select')).toHaveValue('2'); await expect(ui.preview().locator('[data-side=left][data-page-number]')).toHaveAttribute('data-page-number', '3');
  await page.getByTestId('view-single').click(); await expect(page.locator('#page-navigation')).toHaveAttribute('data-direction', 'vertical');
  await expect(ui.preview().locator('.paper')).toHaveCount(1); await expect(page.locator('#next-arrow')).toHaveAttribute('data-icon', 'chevron-down');
  await page.getByTestId('page-layout').selectOption('uniform'); await ui.ready();
  const positions = await page.getByTestId('folio-position').evaluate(select => [...select.options].filter(option => !option.hidden).map(option => option.text));
  expect(positions).toHaveLength(6); expect(new Set(positions).size).toBe(6);
  await expect(page.getByTestId('folio-position')).toHaveValue('bottom-left');
  await expect(page.getByTestId('folio-enabled')).toBeChecked(); await expect(ui.preview().getByTestId('folio')).toHaveText('2');
  await page.locator('#detail-folio summary').first().click(); await page.getByTestId('folio-enabled').uncheck(); await ui.ready();
  await expect(ui.preview().getByTestId('folio')).toHaveCount(0);
  const firstX = await ui.preview().locator('[data-body=text]').first().getAttribute('x');
  await page.getByRole('button', { name: '次のページ', exact: true }).click(); expect(await ui.preview().locator('[data-body=text]').first().getAttribute('x')).toBe(firstX);
  await page.getByTestId('folio-enabled').check(); await page.getByTestId('folio-from').fill('2'); await page.getByTestId('folio-from').blur(); await page.getByTestId('folio-start').fill('42'); await page.getByTestId('folio-start').blur();
  await page.getByTestId('folio-position').selectOption('bottom-center'); await ui.ready();
  await expect(ui.preview().getByTestId('folio')).toHaveText('43'); await page.getByRole('button', { name: '前のページ', exact: true }).click(); await expect(ui.preview().getByTestId('folio')).toHaveText('42');
  await page.locator('#detail-folio .nested-details summary').click(); await page.locator('#add-folio-rule').click();
  const rule = page.locator('#folio-rules .rule-fields'); await rule.getByLabel('範囲の開始ページ', { exact: true }).fill('3'); await rule.getByLabel('範囲の開始ページ', { exact: true }).blur(); await ui.ready();
  await page.getByRole('button', { name: '次のページ', exact: true }).click(); await expect(ui.preview().getByTestId('folio')).toHaveCount(0);
  await page.getByRole('button', { name: '前のページ', exact: true }).click(); await expect(ui.preview().getByTestId('folio')).toHaveText('42');
  await page.locator('#detail-heads > summary').click(); await page.getByText('通しページで指定する（旧形式）', { exact: true }).click(); await page.locator('#add-head-rule').click();
  const headPosition = page.getByLabel('柱の位置', { exact: true });
  expect(await headPosition.evaluate(select => [...select.options].filter(option => !option.hidden).length)).toBe(3);
  await expect(headPosition).toHaveValue('top-left');
});

for (const width of [1440, 375]) test(`@flow DOCX/Markdown/JSON, structure, fine settings and scoped heads ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: width === 1440 ? 1000 : 812 }); await page.goto('/'); const ui = new BookUI(page);
  await ui.importTxt(absolute('fixtures/imports/semantic.docx'));
  await ui.tab('原稿');
  const source = await ui.manuscript().inputValue(); expect(source).toContain('# 第一章'); expect(source).toContain('｜薔薇《ばら》'); expect(source).toContain('*静かな言葉*'); expect(source).toContain('---'); expect(source).toContain('\\[未知の指定]');
  await ui.tab('プレビュー'); expect(await ui.pageCount()).toBeGreaterThan(1); await expect(ui.preview().locator('[data-ruby]')).not.toHaveCount(0); await expect(ui.preview().locator('[data-emphasis]')).not.toHaveCount(0); await expect(ui.preview().locator('[data-dash]')).not.toHaveCount(0);
  await ui.importTxt(absolute('fixtures/imports/semantic.md')); await ui.tab('原稿'); expect(await ui.manuscript().inputValue()).toContain('## 第二章');
  await expect(page.getByTestId('source-syntax')).toHaveCount(0);
  await ui.paste(manuscript); await ui.tab('設定'); await page.getByTestId('page-size').selectOption('b6');
  await page.locator('#detail-layout summary').click(); await page.getByTestId('grid-chars').fill('25'); await page.getByTestId('grid-chars').blur();
  await page.locator('#detail-heads > summary').click(); await page.getByText('通しページで指定する（旧形式）', { exact: true }).click(); await page.locator('#add-head-rule').click();
  const head = page.locator('#head-rules .rule-fields'); await head.getByLabel('範囲の開始ページ', { exact: true }).fill('2'); await head.getByLabel('範囲の開始ページ', { exact: true }).blur(); await head.getByLabel('柱の文字', { exact: true }).fill('静かな章');
  await ui.tab('プレビュー'); await ui.ready(); expect(await ui.preview().locator('[data-running-head]').count()).toBe(0);
  await page.getByTestId('page-select').fill('2'); await expect(ui.preview().locator('[data-running-head]').first()).toHaveText('静かな章');
  await mkdir(absolute('output/project'), { recursive: true }); await ui.download('export-project', absolute(`output/project/roundtrip-${width}.json`));
  await ui.paste('別の原稿。'); await ui.importTxt(absolute(`output/project/roundtrip-${width}.json`)); await ui.tab('原稿'); await expect(ui.manuscript()).toHaveValue(manuscript);
  await ui.tab('設定'); await expect(page.getByTestId('page-size')).toHaveValue('b6'); await expect(page.getByTestId('grid-chars')).toHaveValue('25');
  await ui.tab('プレビュー'); await ui.ready(); await expect(page.getByTestId('page-select')).toHaveValue('2');
  await expect(page.getByTestId('save-state')).toHaveAttribute('data-state', 'saved'); await page.reload(); await ui.ready(); await expect(page.getByTestId('page-select')).toHaveValue('2');
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  await mkdir(absolute('output/qa'), { recursive: true }); await page.screenshot({ path: absolute(`output/qa/scoped-${width}.png`) });
});

test('@flow actual B6 uniform PNG/range PDF/range ZIP have matching physical pages', async ({ page }) => {
  await page.goto('/'); const ui = new BookUI(page); await ui.paste(manuscript); await page.getByTestId('page-layout').selectOption('uniform'); await page.getByTestId('page-size').selectOption('b6'); await ui.ready();
  await page.locator('#detail-folio summary').first().click(); await page.getByTestId('folio-enabled').check();
  await page.getByTestId('folio-from').fill('2'); await page.getByTestId('folio-from').blur(); await page.getByTestId('folio-start').fill('42'); await page.getByTestId('folio-start').blur(); await page.getByTestId('folio-position').selectOption('bottom-center');
  await page.locator('#detail-heads > summary').click(); await page.getByText('通しページで指定する（旧形式）', { exact: true }).click(); await page.locator('#add-head-rule').click();
  const head = page.locator('#head-rules .rule-fields'); await head.getByLabel('範囲の開始ページ', { exact: true }).fill('2'); await head.getByLabel('範囲の開始ページ', { exact: true }).blur(); await head.getByLabel('柱の文字', { exact: true }).fill('SNS本文サンプル'); await ui.ready();
  await page.getByTestId('page-select').fill('2'); await mkdir(absolute('output/exports-b6'), { recursive: true });
  await ui.download('export-png', absolute('output/exports-b6/page-002.png'));
  await page.getByTestId('open-export').click(); await page.getByTestId('export-scope').selectOption('range'); await page.getByTestId('export-from').fill('2'); await page.getByTestId('export-to').fill('3');
  await ui.download('export-pdf', absolute('output/exports-b6/book.pdf')); await ui.download('export-png-all', absolute('output/exports-b6/pages.zip')); await ui.download('export-spread', absolute('output/exports-b6/spread.png'));
  await writeFile(absolute('output/exports-b6/manifest.json'), JSON.stringify({ schemaVersion: 1, phase: 'mvp', sourceFingerprint: await fingerprint(), pageMm: [128, 182], expectedPages: 2, logicalPages: [2, 3], pngPageNumber: 1, dpi: 300, png: 'page-002.png', pdf: 'book.pdf', zip: 'pages.zip', spread: 'spread.png', spreadPages: { left: 2, right: 1 } }, null, 2));
});

test('@flow Word import rejects changes/entities, and literal notation is safe', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const { wordSource } = await import('/io/import.js');
    const wrap = content => `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${content}</w:body></w:document>`;
    const errors = [];
    for (const xml of ['<!DOCTYPE x [<!ENTITY s SYSTEM "https://example.invalid/leak">]>' + wrap('<w:p/>'), wrap('<w:p><w:ins><w:r><w:t>変更</w:t></w:r></w:ins></w:p>')]) { try { wordSource(xml); errors.push('accepted'); } catch (e) { errors.push(e.message); } }
    return { errors, source: wordSource(wrap('<w:p><w:r><w:t>[改ページ]｜薔薇《ばら》&lt;script&gt;</w:t></w:r></w:p>')).source };
  });
  expect(results.errors[0]).toContain('外部定義'); expect(results.errors[1]).toContain('変更履歴'); expect(results.source).toBe('\\[改ページ]\\｜薔薇《ばら》<script>');
});

test('@flow manuscript tools add semantic marks and preview zoom leaves print settings unchanged', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 }); await page.goto('/'); const ui = new BookUI(page); await ui.tab('原稿');
  await ui.manuscript().fill('薔薇'); await ui.manuscript().press('ControlOrMeta+A'); await page.getByRole('button', { name: 'ルビ', exact: true }).click();
  await expect(page.locator('#insert-base')).toHaveValue('薔薇'); await page.locator('#insert-reading').fill('ばら'); await page.locator('#apply-insert').click();
  await expect(ui.manuscript()).toHaveValue('｜薔薇《ばら》'); await ui.manuscript().press('ControlOrMeta+A'); await page.getByRole('button', { name: '圏点', exact: true }).click();
  await expect(ui.manuscript()).toHaveValue('*｜薔薇《ばら》*'); await page.getByRole('button', { name: '見出し', exact: true }).click();
  await expect(ui.manuscript()).toHaveValue('# *｜薔薇《ばら》*');
  await ui.paste(manuscript); const before = await ui.preview().locator('.paper').boundingBox();
  const dimensions = await ui.preview().locator('svg').getAttribute('viewBox'); await page.getByTestId('preview-zoom').click();
  expect((await ui.preview().locator('.paper').boundingBox()).width).toBeGreaterThan(before.width * 1.7);
  expect(await ui.preview().locator('svg').getAttribute('viewBox')).toBe(dimensions);
  await expect.poll(() => ui.preview().evaluate(element => element.scrollWidth - element.clientWidth - element.scrollLeft)).toBeLessThanOrEqual(20);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1)).toBe(false);
  await page.getByTestId('preview-zoom').click(); await mkdir(absolute('output/qa'), { recursive: true });
  await ui.tab('原稿'); await ui.manuscript().fill(manuscript);
  await page.getByTestId('open-export').click(); await page.getByLabel('ファイル名', { exact: true }).fill('組版テスト');
  await ui.ready(); await expect(page.getByLabel('ファイル名', { exact: true })).toHaveValue('組版テスト');
  await ui.download('export-png', absolute('output/qa/typography.png')); await ui.download('export-pdf', absolute('output/qa/typography.pdf'));
});
