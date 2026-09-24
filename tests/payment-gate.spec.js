// @ts-check
const { test, expect } = require('@playwright/test');
const { PAYMENT_LINK, PAID_KEY, mockConfig, dismissDialogs, fillForm, expectAbout } = require('./helpers');

const CASE = {
  mInc: 7000, mDed: 1675.58, fInc: 5000, fDed: 1017.17, t1: 1237,
  mIns: 150, fIns: 0, mSplit: 50, fSplit: 50, type: 'joint-calc',
};

test.beforeEach(({ page }) => dismissDialogs(page));

test('Finalize is disabled with a note when Stripe is not configured', async ({ page }) => {
  await mockConfig(page, { stripe: false });
  await page.goto('/calculator.html');
  await expect(page.locator('#finalize-calculation')).toBeDisabled();
  await expect(page.locator('#finalize-disabled-note')).toBeVisible();
});

test('unpaid Finalize sends the user to the Stripe Payment Link', async ({ page }) => {
  await mockConfig(page, { stripe: true });
  await page.goto('/calculator.html');
  await expect(page.locator('#finalize-calculation')).toBeEnabled();
  await expect(page.locator('#finalize-disabled-note')).toBeHidden();

  await fillForm(page, CASE);
  await page.locator('#finalize-calculation').click();
  await page.waitForURL(PAYMENT_LINK);
});

test('returning from Stripe restores the form and unlocks the calculation', async ({ page }) => {
  await mockConfig(page, { stripe: true });
  await page.goto('/calculator.html');
  await fillForm(page, CASE);
  await page.locator('#finalize-calculation').click();
  await page.waitForURL(PAYMENT_LINK);

  // Stripe redirects back to the site root; the landing page forwards to the calculator.
  await page.goto('/?session_id=cs_test_123');
  await page.waitForURL(/\/calculator\.html$/);

  await expect(page.locator('#mother-income')).toHaveValue('7000');
  await expect(page.locator('#father-time-split')).toHaveValue('50');
  await expect(page.locator('#calc-type')).toHaveValue('joint-calc');
  expect(await page.evaluate((k) => sessionStorage.getItem(k), PAID_KEY)).toBe('1');

  await page.locator('#finalize-calculation').click();
  await expect(page).toHaveURL(/\/calculator\.html$/); // no second trip to Stripe
  await expectAbout(page, '#mother-child-support', 70);
  await expectAbout(page, '#father-child-support', 0);
});
