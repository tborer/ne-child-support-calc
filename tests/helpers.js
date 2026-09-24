// @ts-check
const { expect } = require('@playwright/test');
const path = require('path');

/**
 * Serve jQuery from node_modules instead of code.jquery.com so the suite
 * doesn't depend on the CDN being reachable. The version is pinned in
 * package.json to match the <script> tag in calculator.html.
 */
async function serveLocalJquery(page) {
  await page.route('https://code.jquery.com/**', (route) =>
    route.fulfill({ path: path.join(__dirname, '..', 'node_modules', 'jquery', 'dist', 'jquery.min.js') }));
}

/**
 * Serve a test js/config.js (payments on or off) instead of whatever the
 * server has, and serve jQuery locally.
 */
async function mockConfig(page, { stripe }) {
  await serveLocalJquery(page);
  const body = `window.APP_CONFIG = ${JSON.stringify({ ENABLE_STRIPE: stripe, PRICE_LABEL: '$9.99' })};`;
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body }));
}

/** Dismiss the calculator's alert() warnings so they don't block the test. */
function dismissDialogs(page) {
  page.on('dialog', (dialog) => dialog.dismiss());
}

/**
 * Fill an input and blur it so the calculator's blur handler recalculates.
 */
async function fillAndBlur(page, selector, value) {
  const loc = page.locator(selector);
  await loc.fill(String(value));
  await loc.blur();
}

/** Fill every Section 1–5 input from a test-case object. */
async function fillForm(page, tc) {
  await fillAndBlur(page, '#mother-income', tc.mInc);
  await fillAndBlur(page, '#mother-deductions', tc.mDed);
  await fillAndBlur(page, '#father-income', tc.fInc);
  await fillAndBlur(page, '#father-deductions', tc.fDed);
  await fillAndBlur(page, '#monthly-support-from-table-1', tc.t1);
  await fillAndBlur(page, '#mother-paid-health-insurance-premium', tc.mIns);
  await fillAndBlur(page, '#father-paid-health-insurance-premium', tc.fIns);
  await fillAndBlur(page, '#mother-credit-for-health-insurance-premium-paid', tc.mCredit ?? 0);
  await fillAndBlur(page, '#father-credit-for-health-insurance-premium-paid', tc.fCredit ?? 0);
  await fillAndBlur(page, '#mother-time-split', tc.mSplit);
  await fillAndBlur(page, '#father-time-split', tc.fSplit);
  await page.locator('#calc-type').selectOption(tc.type);
}

/** Click Finalize and land on the (fake) Stripe Checkout page. */
async function goToCheckout(page) {
  await page.locator('#finalize-calculation').click();
  await page.waitForURL(/\/__fake-stripe\/checkout\/cs_test_/);
}

/**
 * Assert that an element's numeric text is within $1 of the expected amount
 * (intermediate floating-point rounding can shift the result by one).
 */
async function expectAbout(page, selector, expected) {
  const loc = page.locator(selector);
  await expect(loc).not.toHaveText('');
  const text = (await loc.textContent()) || '';
  const actual = parseFloat(text.replace(/[^0-9.-]/g, ''));
  expect(actual, `${selector} contained "${text}"`).not.toBeNaN();
  expect(Math.abs(actual - expected), `${selector}: expected ≈${expected}, got ${actual}`)
    .toBeLessThanOrEqual(1);
}

module.exports = { mockConfig, dismissDialogs, fillAndBlur, fillForm, goToCheckout, expectAbout };
