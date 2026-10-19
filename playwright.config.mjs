import { defineConfig } from '@playwright/test';
import { readJson } from './scripts/lib.mjs';

const config = await readJson('harness/config.json');
export default defineConfig({
  testDir: './tests/e2e', timeout: 45000, expect: { timeout: 10000 }, fullyParallel: false, workers: 1,
  forbidOnly: true, retries: 0, reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: config.appUrl, browserName: 'chromium', locale: 'ja-JP', timezoneId: 'Asia/Tokyo', colorScheme: 'light', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
});
