import { once } from 'node:events';
import { mkdir } from 'node:fs/promises';
import { test, expect } from '@playwright/test';
import { absolute } from '../../scripts/lib.mjs';
import { createStaticServer } from '../../scripts/static-server.mjs';
import { BookUI } from './ui-driver.mjs';

test('@flow project-prefix deployment loads local resources, edits and exports', async ({ page }) => {
  const server = await createStaticServer(absolute('dist'), { basePath: '/bookmaker/' });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const base = `http://127.0.0.1:${server.address().port}/bookmaker/`, failures = [], requests = [];
  page.on('response', response => { if (response.status() >= 400) failures.push(response.url()); });
  page.on('request', request => { if (/^https?:/u.test(request.url())) requests.push(request.url()); });
  try {
    await page.goto(base, { waitUntil: 'networkidle' });
    await expect(page).toHaveTitle('Folaxis');
    await expect(page.getByRole('link', { name: 'Folaxis', exact: true })).toBeVisible();
    expect(failures, 'All app resources must resolve inside the project path').toEqual([]);
    const ui = new BookUI(page);
    await ui.paste('# 配下URLの確認\n｜薔薇《ばら》と*圏点*。\n次の文章。');
    expect(await page.evaluate(() => document.fonts.check('16px "Book Mincho"'))).toBe(true);
    const { PDFDocument } = await import('../../public/vendor/pdf-lib.js');
    const localPDF = await PDFDocument.create(); localPDF.addPage([200, 280]).drawText('LOCAL PDF');
    await page.locator('#tab-assets').click();
    await page.locator('#asset-file').setInputFiles({ name: 'local.pdf', mimeType: 'application/pdf', buffer: Buffer.from(await localPDF.save()) });
    await expect(page.locator('.asset-card')).toHaveCount(1);
    await page.locator('.asset-card').getByRole('button', { name: 'ページとして挿入' }).click(); await ui.ready();
    await mkdir(absolute('output/deployment'), { recursive: true });
    await ui.download('export-png-all', absolute('output/deployment/pages.zip'));
    await ui.download('export-pdf', absolute('output/deployment/book.pdf'));
    expect(failures).toEqual([]);
    expect(requests.length).toBeGreaterThan(5);
    expect(requests.some(url => url.endsWith('/vendor/pdfjs/pdf.worker.mjs'))).toBe(true);
    expect(requests.every(url => url.startsWith(base)), 'No external or origin-root resource requests').toBe(true);
    await page.reload(); await ui.ready(); await ui.tab('原稿');
    await expect(ui.manuscript()).toHaveValue(/薔薇/u);
    await page.screenshot({ path: absolute('output/deployment/project-prefix.png') });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});
