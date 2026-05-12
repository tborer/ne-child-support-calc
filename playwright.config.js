// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  timeout: 30_000,
  reporter: [
    ['list'],
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
  ],
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
  },
  // Spin up Python's built-in HTTP server so fetch() works (needed for CSV load)
  webServer: {
    command: 'python3 -m http.server 3000',
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
