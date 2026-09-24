// Unit tests for the server-side calculation (lib/calc.js).
const test = require('node:test');
const assert = require('node:assert');
const { validateInputs, calculateSupport } = require('../../lib/calc');

function inputs(overrides) {
  return {
    calcType: 'joint-calc',
    motherIncome: 7000, motherDeductions: 1675.58,
    fatherIncome: 5000, fatherDeductions: 1017.17,
    table1: 1237,
    motherInsurance: 0, fatherInsurance: 0,
    motherCredit: 0, fatherCredit: 0,
    motherSplit: 50, fatherSplit: 50,
    ...overrides,
  };
}

// Joint Physical Custody: one case per code path. Expected values come from
// the original hand-verified 139-case browser suite (±$1 rounding tolerance).
const JPC_CASES = [
  // name, overrides, mother owes, father owes
  ['50/50, no insurance', {}, 134, 0],
  ['50/50, mother pays insurance', { motherInsurance: 150 }, 70, 0],
  ['50/50, father pays insurance', { fatherInsurance: 150 }, 220, 0],
  ['both pay unequal insurance', { motherInsurance: 40, fatherInsurance: 125, motherSplit: 40, fatherSplit: 60 }, 374, 0],
  ['split flips payer to father', { motherInsurance: 150, motherSplit: 60, fatherSplit: 40 }, 0, 116],
  ['30% edge of time split', { motherInsurance: 150, motherSplit: 29.86, fatherSplit: 70.14 }, 443, 0],
  ['70% edge, low-income father',
    { fatherIncome: 2500, fatherDeductions: 425.92, table1: 1043, motherInsurance: 150, motherSplit: 70.14, fatherSplit: 29.86 }, 0, 13],
  ['higher-earning father, $15k income',
    { motherIncome: 5000, motherDeductions: 1017.17, fatherIncome: 15000, fatherDeductions: 4416.81, table1: 1741, motherInsurance: 150 }, 0, 701],
  ['equal insurance offsets like none', { motherInsurance: 75, fatherInsurance: 75 }, 134, 0],
];

for (const [name, overrides, mother, father] of JPC_CASES) {
  test(`JPC: ${name}`, () => {
    const result = calculateSupport(inputs(overrides));
    assert.ok(Math.abs(result.mother - mother) <= 1, `mother: expected ≈${mother}, got ${result.mother}`);
    assert.ok(Math.abs(result.father - father) <= 1, `father: expected ≈${father}, got ${result.father}`);
  });
}

test('Worksheet 1: shares by income percentage minus insurance credit', () => {
  // Net 5,324.42 / 3,982.83 → 57.21% / 42.79% of (1,237 + 150).
  const result = calculateSupport(inputs({ calcType: 'basic-calc', motherInsurance: 150, motherCredit: 150 }));
  assert.deepStrictEqual(result, { mother: 643, father: 594 });
});

test('zero combined income does not produce NaN', () => {
  const result = calculateSupport(inputs({
    motherIncome: 0, motherDeductions: 0, fatherIncome: 0, fatherDeductions: 0,
  }));
  assert.deepStrictEqual(result, { mother: 0, father: 0 });
});

test('validateInputs rejects bad input', () => {
  assert.ok(validateInputs(null).error);
  assert.ok(validateInputs(inputs({ calcType: 'other' })).error);
  assert.ok(validateInputs(inputs({ motherIncome: '7000' })).error);
  assert.ok(validateInputs(inputs({ table1: NaN })).error);
  assert.ok(validateInputs(inputs({ motherSplit: 120 })).error);
  assert.ok(validateInputs(inputs({ fatherIncome: 1e9 })).error);
});

test('validateInputs drops unknown fields', () => {
  const { inputs: clean } = validateInputs({ ...inputs(), extra: 'x' });
  assert.strictEqual(clean.extra, undefined);
});
