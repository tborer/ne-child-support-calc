// @ts-check
// End-to-end payment flow against the real /api handlers with a fake Stripe
// (see scripts/dev-server.js and tests/support/fake-stripe.js).
const { test, expect } = require('@playwright/test');
const { mockConfig, dismissDialogs, fillAndBlur, fillForm, goToCheckout, expectAbout } = require('./helpers');

const JPC = {
  mInc: 7000, mDed: 1675.58, fInc: 5000, fDed: 1017.17, t1: 1237,
  mIns: 150, fIns: 0, mSplit: 50, fSplit: 50, type: 'joint-calc',
};

test.beforeEach(({ page }) => dismissDialogs(page));

test('Finalize is disabled with a note when payments are off', async ({ page }) => {
  await mockConfig(page, { stripe: false });
  await page.goto('/calculator.html');
  await expect(page.locator('#finalize-calculation')).toBeDisabled();
  await expect(page.locator('#finalize-disabled-note')).toBeVisible();
  await expect(page.locator('#finalize-price-note')).toBeHidden();
});

test.describe('with payments on', () => {
  test.beforeEach(async ({ page }) => {
    await mockConfig(page, { stripe: true });
    await page.goto('/calculator.html');
  });

  test('shows the price next to Finalize', async ({ page }) => {
    await expect(page.locator('#finalize-price-note')).toContainText('One-time fee of $9.99 per calculation');
  });

  test('paying shows the Joint Physical Custody result', async ({ page }) => {
    await fillForm(page, JPC);
    await goToCheckout(page);
    await page.locator('#pay').click();

    await page.waitForURL(/\/calculator\.html$/);
    await expect(page.locator('#finalize-status')).toHaveText('Payment confirmed. Your results are below.');
    await expectAbout(page, '#mother-child-support', 70);
    await expectAbout(page, '#father-child-support', 0);
    await expect(page.locator('#mother-income')).toHaveValue('7000');
    await expect(page.locator('#calc-type')).toHaveValue('joint-calc');
  });

  test('paying shows the Worksheet 1 result', async ({ page }) => {
    await fillForm(page, { ...JPC, mCredit: 150, type: 'basic-calc' });
    await goToCheckout(page);
    await page.locator('#pay').click();
    await expectAbout(page, '#mother-child-support', 643);
    await expectAbout(page, '#father-child-support', 594);
  });

  test('no result without paying; canceling keeps the numbers', async ({ page }) => {
    await fillForm(page, JPC);
    await goToCheckout(page);
    await page.locator('#cancel').click();

    await page.waitForURL(/\/calculator\.html$/);
    await expect(page.locator('#finalize-status')).toContainText('Checkout was canceled');
    await expect(page.locator('#mother-income')).toHaveValue('7000');
    await expect(page.locator('#mother-child-support')).toHaveText('');
  });

  test('a made-up session id does not unlock a result', async ({ page }) => {
    await fillForm(page, JPC);
    await goToCheckout(page); // saves the form, as a real checkout would
    await page.goto('/calculator.html?session_id=cs_test_forged1234567890');
    await expect(page.locator('#finalize-status')).toHaveText('That payment session was not found.');
    await expect(page.locator('#mother-child-support')).toHaveText('');
  });

  test('same numbers again are free; changed numbers need a new payment', async ({ page }) => {
    await fillForm(page, JPC);
    await goToCheckout(page);
    await page.locator('#pay').click();
    await expectAbout(page, '#mother-child-support', 70);

    // Same inputs: re-fetched from the server, no new checkout.
    await page.locator('#mother-child-support').evaluate((el) => { el.textContent = ''; });
    await page.locator('#finalize-calculation').click();
    await expectAbout(page, '#mother-child-support', 70);
    await expect(page).toHaveURL(/\/calculator\.html$/);

    // Different inputs: a new checkout.
    await fillAndBlur(page, '#mother-income', 7100);
    await goToCheckout(page);
  });

  test('both Print buttons open the same printable summary with the result', async ({ page, context }) => {
    await page.locator('#case-name').fill('Smith v. Smith');
    await fillForm(page, JPC);
    await goToCheckout(page);
    await page.locator('#pay').click();
    await expectAbout(page, '#mother-child-support', 70);

    const printFrom = async (selector) => {
      const [popup] = await Promise.all([context.waitForEvent('page'), page.locator(selector).click()]);
      await popup.waitForLoadState();
      const html = await popup.locator('body').innerHTML();
      await popup.close();
      return html;
    };

    await expect(page.locator('#print-calc-bottom')).toBeVisible();
    const bottom = await printFrom('#print-calc-bottom');
    const sidebar = await printFrom('#print-calc');
    expect(bottom).toBe(sidebar);
    expect(bottom).toContain('Smith v. Smith');
    expect(bottom).toMatch(/Calculated Support Each Parent Owes[\s\S]*>70</);
  });

  test('returning without saved numbers explains instead of failing silently', async ({ page }) => {
    await page.goto('/calculator.html?session_id=cs_test_forged1234567890');
    await expect(page.locator('#finalize-status')).toContainText('could not find the numbers for this payment');
  });
});

test('the API refuses to calculate for an unpaid session', async ({ page, request }) => {
  await mockConfig(page, { stripe: true });
  await page.goto('/calculator.html');
  await fillForm(page, JPC);
  await goToCheckout(page); // session exists but is unpaid
  const sessionId = page.url().split('/').pop();

  const reply = await request.post('/api/calculate', {
    data: {
      sessionId,
      inputs: {
        calcType: 'joint-calc', motherIncome: 7000, motherDeductions: 1675.58,
        fatherIncome: 5000, fatherDeductions: 1017.17, table1: 1237,
        motherInsurance: 150, fatherInsurance: 0, motherCredit: 0, fatherCredit: 0,
        motherSplit: 50, fatherSplit: 50,
      },
    },
  });
  expect(reply.status()).toBe(402);
  expect((await reply.json()).result).toBeUndefined();
});
