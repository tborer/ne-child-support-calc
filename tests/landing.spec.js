// @ts-check
const { test, expect } = require('@playwright/test');
const { mockConfig } = require('./helpers');

test('landing page links to the calculator', async ({ page }) => {
  await mockConfig(page, { stripe: true });
  await page.goto('/');
  await expect(page).toHaveTitle(/Nebraska Child Support Calculator/);
  await expect(page.locator('h1')).toHaveText('Nebraska Child Support Calculator');

  await page.locator('.hero-actions a', { hasText: 'Start Your Calculation' }).click();
  await expect(page).toHaveURL(/\/calculator\.html$/);
  await expect(page.locator('#finalize-calculation')).toBeVisible();
});

test('landing page structured data is valid JSON', async ({ page }) => {
  await page.goto('/');
  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const data = JSON.parse(json || '');
  const types = data['@graph'].map((node) => node['@type']);
  expect(types).toEqual(expect.arrayContaining(['WebSite', 'WebApplication', 'FAQPage']));
});
