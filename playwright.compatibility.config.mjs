import { defineConfig } from '@playwright/test';
import config from './playwright.config.mjs';

export default defineConfig({
  ...config,
  testDir: './tests/compatibility',
  timeout: 90000,
  projects: ['firefox', 'webkit'].map(browserName => ({ name: browserName, use: { browserName } })),
});
