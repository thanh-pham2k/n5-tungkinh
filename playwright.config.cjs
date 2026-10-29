const fs = require('node:fs');
const { defineConfig } = require('@playwright/test');
const defaultChannel =
  process.platform === 'darwin' && !fs.existsSync('/Applications/Microsoft Edge.app')
    ? 'chrome'
    : 'msedge';
module.exports = defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    browserName: 'chromium',
    channel: process.env.PLAYWRIGHT_CHANNEL || defaultChannel,
    viewport: { width: 390, height: 844 },
    headless: true,
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'node scripts/serve-browser-tests.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
  },
});
