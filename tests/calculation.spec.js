// @ts-check
// Free, in-browser parts of the calculator. The paid final result is covered
// by payment.spec.js (browser flow) and tests/unit/calc.test.js (formulas).
const { test, expect } = require('@playwright/test');
const { mockConfig, dismissDialogs, fillAndBlur, fillForm, expectAbout } = require('./helpers');

test.beforeEach(async ({ page }) => {
  dismissDialogs(page);
  await mockConfig(page, { stripe: true });
  await page.goto('/calculator.html');
});

test('running totals update as fields change', async ({ page }) => {
  await fillForm(page, {
    mInc: 7000, mDed: 1675.58, fInc: 5000, fDed: 1017.17, t1: 1237,
    mIns: 150, fIns: 0, mSplit: 50, fSplit: 50, type: 'basic-calc',
  });
  await expect(page.locator('#mother-net-income')).toHaveValue(/^5324\.42?$/);
  await expect(page.locator('#father-net-income')).toHaveValue(/^3982\.83$/);
  await expectAbout(page, '#combined-net-income', 9307);
  await expectAbout(page, '#mother-percentage-contribution', 57);
  await expectAbout(page, '#father-percentage-contribution', 43);
  await expectAbout(page, '#total-obligation', 1387);
  await expectAbout(page, '#mother-monthly-share', 793);
  await expectAbout(page, '#father-monthly-share', 594);
  // Final results stay empty until paid for.
  await expect(page.locator('#mother-child-support')).toHaveText('');
});

test.describe('Table 1 Calculator', () => {
  const lookups = [
    ['exact row',                 6000, '2', 1369],
    ['rounds to nearest $50 row', 6020, '2', 1369],
    ['below the table floor',      100, '1',   50],
  ];
  for (const [name, income, kids, expected] of lookups) {
    test(`${name}: $${income}, ${kids} child(ren) → $${expected}`, async ({ page }) => {
      await fillAndBlur(page, '#monthly-income', income);
      await page.locator('#num-children').selectOption(kids);
      await page.locator('#calculate-support').click();
      await expectAbout(page, '#support-amount', expected);
    });
  }
});
