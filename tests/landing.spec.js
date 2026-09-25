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

test('landing page sells the one-time price', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/\$9\.99, No Subscription/);
  await expect(page.locator('#pricing .price-amount')).toHaveText('$9.99');
  await expect(page.locator('#pricing .price-terms')).toContainText('No subscription');

  const json = await page.locator('script[type="application/ld+json"]').textContent();
  const graph = JSON.parse(json || '')['@graph'];
  const app = graph.find((node) => node['@type'] === 'WebApplication');
  expect(app.offers).toMatchObject({ '@type': 'Offer', price: '9.99', priceCurrency: 'USD' });

  // Every FAQ answer in the structured data is also visible on the page.
  const faq = graph.find((node) => node['@type'] === 'FAQPage');
  await expect(page.locator('.faq details')).toHaveCount(faq.mainEntity.length);

  await page.getByRole('link', { name: 'What $9.99 Gets You' }).click();
  await expect(page.locator('#pricing')).toBeInViewport();
});
