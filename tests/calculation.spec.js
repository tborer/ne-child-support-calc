// @ts-check
const { test, expect } = require('@playwright/test');
const { mockConfig, markPaid, dismissDialogs, fillAndBlur, fillForm, expectAbout } = require('./helpers');

// Stripe is on and this session has already paid, so Finalize runs the math.
test.beforeEach(async ({ page }) => {
  dismissDialogs(page);
  await mockConfig(page, { stripe: true });
  await markPaid(page);
  await page.goto('/calculator.html');
});

// ---------------------------------------------------------------------------
// Joint Physical Custody. One case per distinct code path in calculateJPC():
// who pays insurance (none / equal / mother / father / both, unequal), which
// parent ends up owing, and the edges of the 30–70% time split.
// Expected values come from the original, hand-verified 139-case suite.
// Columns: id | mInc | mDed | fInc | fDed | t1 | mIns | fIns | mSplit | fSplit | mOwes | fOwes
// ---------------------------------------------------------------------------
const JPC_CASES = [
  ['50/50, no insurance',                 7000, 1675.58,  5000, 1017.17, 1237,   0,   0, 50.00, 50.00,  134,    0],
  ['50/50, mother pays insurance',        7000, 1675.58,  5000, 1017.17, 1237, 150,   0, 50.00, 50.00,   70,    0],
  ['50/50, father pays insurance',        7000, 1675.58,  5000, 1017.17, 1237,   0, 150, 50.00, 50.00,  220,    0],
  ['both pay unequal insurance',          7000, 1675.58,  5000, 1017.17, 1237,  40, 125, 40.00, 60.00,  374,    0],
  ['split flips payer to father',         7000, 1675.58,  5000, 1017.17, 1237, 150,   0, 60.00, 40.00,    0,  116],
  ['30% edge of time split',              7000, 1675.58,  5000, 1017.17, 1237, 150,   0, 29.86, 70.14,  443,    0],
  ['70% edge, low-income father',         7000, 1675.58,  2500,  425.92, 1043, 150,   0, 70.14, 29.86,    0,   13],
  ['higher-earning father, $15k income',  5000, 1017.17, 15000, 4416.81, 1741, 150,   0, 50.00, 50.00,    0,  701],
];

test.describe('Joint Physical Custody', () => {
  for (const [name, mInc, mDed, fInc, fDed, t1, mIns, fIns, mSplit, fSplit, mOwes, fOwes] of JPC_CASES) {
    test(`${name} → M=${mOwes} F=${fOwes}`, async ({ page }) => {
      await fillForm(page, { mInc, mDed, fInc, fDed, t1, mIns, fIns, mSplit, fSplit, type: 'joint-calc' });
      await page.locator('#finalize-calculation').click();
      await expectAbout(page, '#mother-child-support', mOwes);
      await expectAbout(page, '#father-child-support', fOwes);
    });
  }
});

test.describe('Basic Net Income (Worksheet 1)', () => {
  test('splits the obligation by income share and applies the insurance credit', async ({ page }) => {
    // Net: 5,324.42 / 3,982.83 → 57.21% / 42.79%. Obligation 1,237 + 150 = 1,387.
    // Mother's share 793.49 − 150 credit = 643; father's share 593.51.
    await fillForm(page, {
      mInc: 7000, mDed: 1675.58, fInc: 5000, fDed: 1017.17, t1: 1237,
      mIns: 150, fIns: 0, mCredit: 150, mSplit: 50, fSplit: 50, type: 'basic-calc',
    });
    await page.locator('#finalize-calculation').click();
    await expectAbout(page, '#mother-child-support', 643);
    await expectAbout(page, '#father-child-support', 594);
  });
});

test.describe('Running totals', () => {
  test('net income, percentages, obligation and shares update as fields change', async ({ page }) => {
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
  });
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
