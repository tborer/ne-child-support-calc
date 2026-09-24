// @ts-check
const { expect } = require('@playwright/test');
const path = require('path');

const PAYMENT_LINK = 'https://buy.stripe.com/test_link';
const PAID_KEY = 'ncsc_stripe_paid_session';

/**
 * Serve a test js/config.js instead of the checked-in one, so tests don't
 * depend on how the deployed site's Stripe variables are set.
 */
async function mockConfig(page, { stripe }) {
  await serveLocalJquery(page);
  const body = `window.APP_CONFIG = ${JSON.stringify({
    ENABLE_STRIPE: stripe,
    STRIPE_PAYMENT_LINK_URL: stripe ? PAYMENT_LINK : '',
  })};`;
  await page.route('**/js/config.js', (route) =>
    route.fulfill({ contentType: 'application/javascript', body }));
  // Never hit the real Stripe; stand in a blank page for the Payment Link.
  await page.route('https://buy.stripe.com/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Stripe</title>' }));
}

/**
 * Serve jQuery from node_modules instead of code.jquery.com so the suite
 * doesn't depend on the CDN being reachable. The version is pinned in
 * package.json to match the <script> tag in calculator.html.
 */
async function serveLocalJquery(page) {
  await page.route('https://code.jquery.com/**', (route) =>
    route.fulfill({ path: path.join(__dirname, '..', 'node_modules', 'jquery', 'dist', 'jquery.min.js') }));
}

/** Mark the browser session as already paid before any page script runs. */
async function markPaid(page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, '1'), PAID_KEY);
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

module.exports = {
  PAYMENT_LINK, PAID_KEY,
  mockConfig, markPaid, dismissDialogs, fillAndBlur, fillForm, expectAbout,
};
