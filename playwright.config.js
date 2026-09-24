// @ts-check
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.js', // tests/unit/*.test.js run under node --test
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
  // Local server for the site + /api functions, with an in-memory fake Stripe
  webServer: {
    command: 'node scripts/dev-server.js',
    env: { STRIPE_SECRET_KEY: '', PORT: '3000' },
    port: 3000,
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
