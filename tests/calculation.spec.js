// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Fill an input field and trigger blur so the calculator's blur handler fires.
 * The blur handler reads ALL field values, so the order of calls matters:
 * fill every field before the blur that finalises intermediate state.
 */
async function fillAndBlur(page, selector, value) {
  const loc = page.locator(selector);
  await loc.fill(String(value));
  await loc.blur();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Support Obligation Calculations', () => {

  test.beforeEach(async ({ page }) => {
    // Dismiss any alert() dialogs automatically so they don't block the test.
    page.on('dialog', async (dialog) => {
      console.warn(`[dialog] ${dialog.type()}: ${dialog.message()}`);
      await dialog.dismiss();
    });

    await page.goto('/');
  });

  // ─── TC-001 ──────────────────────────────────────────────────────────────
  // Joint Physical Custody, 50/50 parenting time, Mother carries insurance.
  //
  // Inputs:
  //   Mother income $7,000 | deductions $1,675.58 → net $5,324.42 (57.21%)
  //   Father income $5,000 | deductions $1,017.17 → net $3,982.83 (42.79%)
  //   Table 1 = $1,237  |  Mother ins $150  |  Father ins $0
  //   Time split 50% / 50%  |  calc type: Joint Physical Custody
  //
  // Expected: Mother owes $70, Father owes $0
  // ---------------------------------------------------------------------------
  test('TC-001: JPC 50/50 — Mother owes $70, Father owes $0', async ({ page }) => {
    // Section 1 — Income
    await fillAndBlur(page, '#mother-income',      '7000');
    await fillAndBlur(page, '#mother-deductions',  '1675.58');
    await fillAndBlur(page, '#father-income',      '5000');
    await fillAndBlur(page, '#father-deductions',  '1017.17');

    // Section 3 — Table 1 amount (entered directly; sidebar lookup not required)
    await fillAndBlur(page, '#monthly-support-from-table-1', '1237');

    // Section 4 — Health insurance premiums
    await fillAndBlur(page, '#mother-paid-health-insurance-premium', '150');
    await fillAndBlur(page, '#father-paid-health-insurance-premium', '0');

    // Section 5 — Credits (unused in this scenario)
    await fillAndBlur(page, '#mother-credit-for-health-insurance-premium-paid', '0');
    await fillAndBlur(page, '#father-credit-for-health-insurance-premium-paid', '0');

    // Section 5 — Parenting time (percentage; must sum to 100)
    await fillAndBlur(page, '#mother-time-split', '50');
    await fillAndBlur(page, '#father-time-split', '50');

    // Section 5 — Calculation type
    await page.locator('#calc-type').selectOption('joint-calc');

    // Finalize
    await page.locator('#finalize-calculation').click();

    // Assert results
    await expect(page.locator('#mother-child-support')).toHaveText('70');
    await expect(page.locator('#father-child-support')).toHaveText('0');
  });

});
