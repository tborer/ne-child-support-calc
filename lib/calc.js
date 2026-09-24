// Final child support calculation (Worksheet 1 and Joint Physical Custody).
//
// This runs on the server (api/calculate.js) so the result is only released
// after a verified payment. The running totals shown while the form is being
// filled in (net incomes, percentages, monthly shares) are still computed in
// the browser by js/calculator.js; the formulas here must stay in step with
// those.

const CALC_TYPES = ['joint-calc', 'basic-calc'];

// Input fields, in the fixed order used for hashing (see lib/payments.js).
const FIELDS = [
  'motherIncome', 'motherDeductions',
  'fatherIncome', 'fatherDeductions',
  'table1',
  'motherInsurance', 'fatherInsurance',
  'motherCredit', 'fatherCredit',
  'motherSplit', 'fatherSplit',
];

const MAX_AMOUNT = 10_000_000;

/**
 * Check and normalize raw inputs. Returns { inputs } or { error }.
 * Percent splits are 0–100; money fields are finite and within ±MAX_AMOUNT.
 */
function validateInputs(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Missing calculation inputs.' };
  if (!CALC_TYPES.includes(raw.calcType)) return { error: 'Choose a calculation type.' };

  const inputs = { calcType: raw.calcType };
  for (const field of FIELDS) {
    const value = raw[field];
    if (typeof value !== 'number' || !Number.isFinite(value) || Math.abs(value) > MAX_AMOUNT) {
      return { error: `Invalid value for ${field}.` };
    }
    inputs[field] = value;
  }
  for (const field of ['motherSplit', 'fatherSplit']) {
    if (inputs[field] < 0 || inputs[field] > 100) {
      return { error: `${field} must be between 0 and 100.` };
    }
  }
  return { inputs };
}

/** Shared intermediate values, matching the browser's running totals. */
function intermediates(i) {
  const motherNet = i.motherIncome - i.motherDeductions;
  const fatherNet = i.fatherIncome - i.fatherDeductions;
  const combinedNet = motherNet + fatherNet;
  const pct = (net) => {
    const value = (net / combinedNet) * 100;
    return Number.isNaN(value) ? 0 : value;
  };
  const motherPct = pct(motherNet);
  const fatherPct = pct(fatherNet);
  const totalObligation = i.motherInsurance + i.fatherInsurance + i.table1;
  return {
    motherPct,
    fatherPct,
    motherShare: (motherPct / 100) * totalObligation,
    fatherShare: (fatherPct / 100) * totalObligation,
  };
}

function basicSupport(i, m) {
  return {
    mother: m.motherShare - i.motherCredit,
    father: m.fatherShare - i.fatherCredit,
  };
}

function jointCustody(i, m) {
  const motherSplit = i.motherSplit / 100;
  const fatherSplit = i.fatherSplit / 100;
  const motherCalc = (m.motherPct / 100) * (i.table1 * 1.5) * fatherSplit;
  const fatherCalc = (m.fatherPct / 100) * (i.table1 * 1.5) * motherSplit;
  const totalPremium = i.motherInsurance + i.fatherInsurance;
  const motherShareOfPremium = (m.motherPct * totalPremium) / 100;
  const fatherShareOfPremium = (m.fatherPct * totalPremium) / 100;

  // No insurance, or both parents pay the same: offset the two obligations.
  if ((i.motherInsurance === 0 && i.fatherInsurance === 0) || i.motherInsurance === i.fatherInsurance) {
    return motherCalc > fatherCalc
      ? { mother: motherCalc - fatherCalc, father: 0 }
      : { mother: 0, father: fatherCalc - motherCalc };
  }

  // Different insurance amounts: net the support owed against insurance owed.
  const supportParent = motherCalc > fatherCalc ? 'mother' : 'father';
  const supportOwed = Math.abs(motherCalc - fatherCalc);

  let insuranceParent = '';
  let insuranceOwed = 0;
  if (motherShareOfPremium - i.motherInsurance > 0) {
    insuranceParent = 'mother';
    insuranceOwed = motherShareOfPremium - i.motherInsurance;
  } else if (fatherShareOfPremium - i.fatherInsurance > 0) {
    insuranceParent = 'father';
    insuranceOwed = fatherShareOfPremium - i.fatherInsurance;
  }

  const result = { mother: 0, father: 0 };
  if (!insuranceParent) return result;
  if (supportParent === insuranceParent) {
    result[supportParent] = supportOwed + insuranceOwed;
  } else if (insuranceOwed > supportOwed) {
    result[insuranceParent] = insuranceOwed - supportOwed;
  } else {
    result[supportParent] = supportOwed - insuranceOwed;
  }
  return result;
}

/**
 * Compute what each parent owes per month, rounded to whole dollars the same
 * way the page displays it (Number.prototype.toFixed(0)).
 */
function calculateSupport(inputs) {
  const m = intermediates(inputs);
  const raw = inputs.calcType === 'joint-calc' ? jointCustody(inputs, m) : basicSupport(inputs, m);
  return {
    mother: Number(raw.mother.toFixed(0)),
    father: Number(raw.father.toFixed(0)),
  };
}

module.exports = { CALC_TYPES, FIELDS, validateInputs, calculateSupport };
