// ── Global calculation variables ──────────────────────────────────
let motherNetIncome;
let fatherNetIncome;
let combinedNetIncome;
let motherPercentageContribution;
let fatherPercentageContribution;
let motherMonthlyShare;
let fatherMonthlyShare;
let totalObligation;
let motherIncome;
let fatherIncome;
let monthlySupportFromTable1;
let fatherTimeSplit;
let motherTimeSplit;
let motherPaidHealthInsurancePremium;
let fatherPaidHealthInsurancePremium;
let motherCreditForHealthInsurancePaid;
let fatherCreditForHealthInsurancePaid;
let calcType = '';

const povertyGuideline = 1255;

// ── Stripe payment ──────────────────────────────────────────────
// Finalizing is a paid, per-calculation step. The browser sends the inputs to
// /api/checkout, which starts a Stripe Checkout; after payment Stripe returns
// to this page with ?session_id=…, and /api/calculate verifies the payment
// and returns the result. The final formulas live server-side in lib/calc.js.
// See README "Stripe payments".
const STRIPE_FORM_DATA_KEY = 'ncsc_stripe_pending_form_data';
const PAID_CALC_KEY        = 'ncsc_paid_calculation';   // { sessionId, inputs }

function isStripeEnabled() {
  return !!(window.APP_CONFIG && window.APP_CONFIG.ENABLE_STRIPE === true);
}

function readPaidCalculation() {
  try {
    return JSON.parse(sessionStorage.getItem(PAID_CALC_KEY) || 'null');
  } catch (e) {
    return null;
  }
}

// ── Table 1 CSV data (loaded on page init) ────────────────────────
// Rows: [income, 1-child-amount, 2-child-amount, ..., 6-child-amount]
// Income range: $500 – $20,000 in $50 increments (391 rows)
let supportAmounts = [];

fetch('data/ne-child-support-table-1.csv')
  .then(response => response.text())
  .then(csvData => {
    const csvRows = csvData.split('\n');
    csvRows.forEach((row, index) => {
      if (index === 0) return; // skip header row
      const cols = row.trim().split(',');
      if (cols.length >= 7 && !isNaN(parseInt(cols[0]))) {
        supportAmounts.push(cols.map(Number));
      }
    });
    console.log('Table 1 loaded:', supportAmounts.length, 'rows,',
      'range $' + supportAmounts[0][0] + ' – $' + supportAmounts[supportAmounts.length - 1][0]);
  })
  .catch(error => console.error('Table 1 CSV load error:', error));

// ── Document ready ────────────────────────────────────────────────
jQuery(document).ready(function ($) {

  function initStripeGate() {
    const urlParams = new URLSearchParams(window.location.search);
    const returnedSessionId = urlParams.get('session_id');
    const checkoutCanceled = urlParams.get('checkout') === 'canceled';

    const $button = $('#finalize-calculation');
    if (!isStripeEnabled()) {
      $button.prop('disabled', true);
      $('#finalize-disabled-note').show();
      $('#finalize-price-note').hide();
    } else {
      $button.prop('disabled', false);
      $('#finalize-disabled-note').hide();
      const price = window.APP_CONFIG.PRICE_LABEL;
      $('#finalize-price-note').text(
        (price ? 'One-time fee of ' + price + ' per calculation' : 'One-time fee per calculation') +
        ', paid securely through Stripe. Your numbers are not stored.'
      ).show();
    }

    if (!returnedSessionId && !checkoutCanceled) return;

    const restored = restoreFormDataAfterPayment();
    // Strip the query string so refreshing/sharing the URL doesn't replay it
    window.history.replaceState({}, document.title, window.location.pathname + window.location.hash);

    if (checkoutCanceled) {
      setFinalizeStatus('Checkout was canceled. Your numbers are still here whenever you are ready.');
      return;
    }
    if (!restored) {
      setFinalizeStatus('We could not find the numbers for this payment in this browser tab. ' +
        'If you were charged, contact us with your Stripe receipt.', true);
      return;
    }
    const inputs = readFinalInputs();
    if (!inputs) return;
    sessionStorage.setItem(PAID_CALC_KEY, JSON.stringify({ sessionId: returnedSessionId, inputs: inputs }));
    fetchPaidResult(returnedSessionId, inputs);
  }

  function setFinalizeStatus(message, isError) {
    $('#finalize-status')
      .text(message || '')
      .toggleClass('finalize-status--error', !!isError)
      .toggle(!!message);
  }

  function saveFormDataBeforeRedirect() {
    const fields = {};
    $('#main-calc input, #main-calc select').each(function () {
      if (this.id) fields[this.id] = $(this).val();
    });
    sessionStorage.setItem(STRIPE_FORM_DATA_KEY, JSON.stringify(fields));
  }

  function restoreFormDataAfterPayment() {
    const saved = sessionStorage.getItem(STRIPE_FORM_DATA_KEY);
    if (!saved) return false;
    sessionStorage.removeItem(STRIPE_FORM_DATA_KEY);
    let fields;
    try {
      fields = JSON.parse(saved);
    } catch (e) {
      return false;
    }
    Object.keys(fields).forEach(function (id) {
      $('#' + id).val(fields[id]);
    });
    calcType = $('#calc-type').val() || '';
    $('#mother-income, #mother-deductions, #father-income, #father-deductions, ' +
      '#monthly-support-from-table-1, #mother-time-split, #father-time-split, ' +
      '#mother-paid-health-insurance-premium, #father-paid-health-insurance-premium, ' +
      '#mother-credit-for-health-insurance-premium-paid, ' +
      '#father-credit-for-health-insurance-premium-paid').first().trigger('blur');
    return true;
  }

  // ── Initialize input defaults ───────────────────────────────────
  $('#mother-income').val(0);
  $('#mother-deductions').val(0);
  $('#father-income').val(0);
  $('#father-deductions').val(0);
  $('#mother-paid-health-insurance-premium').val(0);
  $('#father-paid-health-insurance-premium').val(0);
  $('#mother-credit-for-health-insurance-premium-paid').val(0);
  $('#father-credit-for-health-insurance-premium-paid').val(0);
  $('#mother-time-split').val(50);
  $('#father-time-split').val(50);

  // ── Calculation type listener ───────────────────────────────────
  // (kept outside blur handler to avoid registering on every keystroke)
  $('#calc-type').on('change', function () {
    calcType = $(this).val();
  });

  // ── Main input blur handler ─────────────────────────────────────
  // Mirrors original: recalculates net income, combined, percentages,
  // and obligation each time the user leaves any relevant field.
  $('#mother-income, #mother-deductions, #father-income, #father-deductions, ' +
    '#monthly-support-from-table-1, #mother-time-split, #father-time-split, ' +
    '#mother-paid-health-insurance-premium, #father-paid-health-insurance-premium, ' +
    '#mother-credit-for-health-insurance-premium-paid, ' +
    '#father-credit-for-health-insurance-premium-paid').on('blur', function () {

    // Mother net income
    motherIncome = parseFloat($('#mother-income').val());
    const motherDeductions = parseFloat($('#mother-deductions').val());
    motherNetIncome = (isNaN(motherIncome) || isNaN(motherDeductions)) ? 0 : motherIncome - motherDeductions;
    $('#mother-net-income').val(motherNetIncome.toFixed(2));

    // Father net income
    fatherIncome = parseFloat($('#father-income').val());
    const fatherDeductions = parseFloat($('#father-deductions').val());
    fatherNetIncome = (isNaN(fatherIncome) || isNaN(fatherDeductions)) ? 0 : fatherIncome - fatherDeductions;
    $('#father-net-income').val(fatherNetIncome.toFixed(2));

    // Combined monthly net income
    combinedNetIncome = motherNetIncome + fatherNetIncome;
    if (!isNaN(combinedNetIncome)) {
      $('#combined-net-income').text(combinedNetIncome.toFixed(2));
    } else {
      $('#combined-net-income').text('');
    }

    // Combined annual net income
    const combinedAnnualNetIncome = combinedNetIncome * 12;
    if (!isNaN(combinedAnnualNetIncome)) {
      $('#combined-annual-net-income').text(combinedAnnualNetIncome.toFixed(2));
    } else {
      $('#combined-annual-net-income').text('');
    }

    calculatePercentageContributions();

    const table1Val = parseFloat($('#monthly-support-from-table-1').val()) || 0;
    updateObligationCalculations(getCalculatedValues(), table1Val);
  });

  // ── Percentage contributions ────────────────────────────────────
  function calculatePercentageContributions() {
    motherPercentageContribution = (motherNetIncome / combinedNetIncome) * 100;
    if (!isNaN(motherPercentageContribution)) {
      $('#mother-percentage-contribution').text(motherPercentageContribution.toFixed(2));
    } else {
      $('#mother-percentage-contribution').text('');
      motherPercentageContribution = 0;
    }

    fatherPercentageContribution = (fatherNetIncome / combinedNetIncome) * 100;
    if (!isNaN(fatherPercentageContribution)) {
      $('#father-percentage-contribution').text(fatherPercentageContribution.toFixed(2));
    } else {
      $('#father-percentage-contribution').text('');
      fatherPercentageContribution = 0;
    }
  }

  // ── Return snapshot of calculated values ────────────────────────
  function getCalculatedValues() {
    return {
      motherNetIncome,
      fatherNetIncome,
      combinedNetIncome,
      motherPercentageContribution,
      fatherPercentageContribution,
      motherIncome,
      fatherIncome
    };
  }

  // ── Obligation, total, and monthly shares ───────────────────────
  function updateObligationCalculations(calculatedValues, table1) {
    const motherIns = parseFloat($('#mother-paid-health-insurance-premium').val()) || 0;
    const fatherIns = parseFloat($('#father-paid-health-insurance-premium').val()) || 0;

    totalObligation = motherIns + fatherIns + table1;

    if (!isNaN(totalObligation)) {
      $('#total-obligation').text(totalObligation.toFixed(2));
    } else {
      $('#total-obligation').text('');
    }

    motherMonthlyShare = (calculatedValues.motherPercentageContribution / 100) * totalObligation;
    if (!isNaN(motherMonthlyShare)) {
      $('#mother-monthly-share').text(motherMonthlyShare.toFixed(0));
    } else {
      $('#mother-monthly-share').text('');
    }

    fatherMonthlyShare = (calculatedValues.fatherPercentageContribution / 100) * totalObligation;
    if (!isNaN(fatherMonthlyShare)) {
      $('#father-monthly-share').text(fatherMonthlyShare.toFixed(0));
    } else {
      $('#father-monthly-share').text('');
    }
  }

  // ── Finalize calculation button ─────────────────────────────────
  $('#finalize-calculation').on('click', function (event) {
    event.preventDefault();
    if (!isStripeEnabled()) return;

    const inputs = readFinalInputs();
    if (!inputs) return;

    // Already paid for exactly these numbers (e.g. after a refresh)? Don't charge again.
    const paid = readPaidCalculation();
    if (paid && JSON.stringify(paid.inputs) === JSON.stringify(inputs)) {
      fetchPaidResult(paid.sessionId, inputs);
      return;
    }

    startCheckout(inputs);
  });

  // ── Read the inputs the final calculation needs ─────────────────
  // Also sets the globals the validation checks below use.
  function readFinalInputs() {
    const num = (selector) => parseFloat($(selector).val()) || 0;

    calcType = $('#calc-type').val() || '';
    if (calcType !== 'joint-calc' && calcType !== 'basic-calc') {
      alert('Please select a Calculation Type before finalizing.');
      return null;
    }

    monthlySupportFromTable1           = num('#monthly-support-from-table-1');
    motherTimeSplit                    = num('#mother-time-split') / 100;
    fatherTimeSplit                    = num('#father-time-split') / 100;
    motherPaidHealthInsurancePremium   = num('#mother-paid-health-insurance-premium');
    fatherPaidHealthInsurancePremium   = num('#father-paid-health-insurance-premium');
    motherCreditForHealthInsurancePaid = num('#mother-credit-for-health-insurance-premium-paid');
    fatherCreditForHealthInsurancePaid = num('#father-credit-for-health-insurance-premium-paid');

    return {
      calcType: calcType,
      motherIncome: num('#mother-income'),
      motherDeductions: num('#mother-deductions'),
      fatherIncome: num('#father-income'),
      fatherDeductions: num('#father-deductions'),
      table1: monthlySupportFromTable1,
      motherInsurance: motherPaidHealthInsurancePremium,
      fatherInsurance: fatherPaidHealthInsurancePremium,
      motherCredit: motherCreditForHealthInsurancePaid,
      fatherCredit: fatherCreditForHealthInsurancePaid,
      motherSplit: num('#mother-time-split'),
      fatherSplit: num('#father-time-split'),
    };
  }

  function postJson(url, body) {
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (data) {
        return { ok: response.ok, data: data };
      });
    });
  }

  // ── Start a Stripe Checkout for these inputs ────────────────────
  function startCheckout(inputs) {
    const $button = $('#finalize-calculation');
    $button.prop('disabled', true);
    setFinalizeStatus('Opening secure checkout…');
    saveFormDataBeforeRedirect();

    postJson('api/checkout', { inputs: inputs })
      .then(function (reply) {
        if (reply.ok && reply.data.url) {
          window.location.href = reply.data.url;
          return;
        }
        $button.prop('disabled', false);
        setFinalizeStatus(reply.data.message || 'Could not start checkout. Please try again.', true);
      })
      .catch(function () {
        $button.prop('disabled', false);
        setFinalizeStatus('Could not reach the server. Check your connection and try again.', true);
      });
  }

  // ── Fetch the verified result for a paid session ────────────────
  function fetchPaidResult(sessionId, inputs) {
    setFinalizeStatus('Confirming your payment…');
    postJson('api/calculate', { sessionId: sessionId, inputs: inputs })
      .then(function (reply) {
        if (!reply.ok) {
          setFinalizeStatus(reply.data.message || 'Could not verify your payment. Please try again.', true);
          return;
        }
        setFinalizeStatus('Payment confirmed. Your results are below.');
        $('#mother-child-support').text(reply.data.result.mother);
        $('#father-child-support').text(reply.data.result.father);
        runChecks();
        const results = document.getElementById('results-heading');
        if (results && results.scrollIntoView) results.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
      .catch(function () {
        setFinalizeStatus('Could not reach the server to verify your payment. Refresh the page to try again.', true);
      });
  }

  // ── Guideline checks, run once results are shown ────────────────
  function runChecks() {
    checkParentTotalTimeSplit();
    checkJPCSplitMinMax();
    checkMotherNetIncomePoverty();
    checkFatherNetIncomePoverty();
    checkMotherPaidInsurance();
    checkFatherPaidInsurance();
    checkMotherObligationAndIns();
    checkFatherObligationAndIns();
  }

  // ── Validation checks ───────────────────────────────────────────
  function checkParentTotalTimeSplit() {
    const totalSplit = motherTimeSplit + fatherTimeSplit;
    if (Math.abs(totalSplit - 1) > 0.01) {
      alert("Error: Parents' time split must add up to 100%. Please adjust the values and run again.");
    }
  }

  function checkJPCSplitMinMax() {
    if (calcType === 'joint-calc') {
      if (motherTimeSplit < 0.29 || motherTimeSplit > 0.71 ||
          fatherTimeSplit < 0.29 || fatherTimeSplit > 0.71) {
        alert("Error: When using Joint Physical Custody calculation, each parent's time split must be between 30% and 70%.");
      }
    }
  }

  function checkMotherPaidInsurance() {
    const mother3Percent = motherIncome * 0.03;
    const errorMessage   = "Error: The 1st parent's paid health insurance is greater than 3% of their gross income.";
    if (motherPaidHealthInsurancePremium > mother3Percent) {
      alert(errorMessage);
      if (!$('#calculation-messages').find('p:contains("' + errorMessage + '")').length) {
        $('#calculation-messages').append('<p>' + errorMessage + '</p>');
      }
    } else {
      $('#calculation-messages').find('p:contains("' + errorMessage + '")').remove();
    }
  }

  function checkFatherPaidInsurance() {
    const father3Percent = fatherIncome * 0.03;
    const errorMessage   = "Error: The 2nd parent's paid health insurance is greater than 3% of their gross income.";
    if (fatherPaidHealthInsurancePremium > father3Percent) {
      alert(errorMessage);
      if (!$('#calculation-messages').find('p:contains("' + errorMessage + '")').length) {
        $('#calculation-messages').append('<p>' + errorMessage + '</p>');
      }
    } else {
      $('#calculation-messages').find('p:contains("' + errorMessage + '")').remove();
    }
  }

  function checkMotherObligationAndIns() {
    const errorMessage = 'Warning: The 1st parent\'s obligation with paid health insurance is greater than poverty guideline of $' + povertyGuideline;
    if ((motherNetIncome - motherMonthlyShare) < povertyGuideline) {
      alert(errorMessage);
      if (!$('#calculation-messages').find('p:contains("' + errorMessage + '")').length) {
        $('#calculation-messages').append('<p>' + errorMessage + '</p>');
      }
    } else {
      $('#calculation-messages').find('p:contains("' + errorMessage + '")').remove();
    }
  }

  function checkFatherObligationAndIns() {
    const errorMessage = 'Warning: The 2nd parent\'s obligation with paid health insurance is greater than poverty guideline of $' + povertyGuideline;
    if ((fatherNetIncome - fatherMonthlyShare) < povertyGuideline) {
      alert(errorMessage);
      if (!$('#calculation-messages').find('p:contains("' + errorMessage + '")').length) {
        $('#calculation-messages').append('<p>' + errorMessage + '</p>');
      }
    } else {
      $('#calculation-messages').find('p:contains("' + errorMessage + '")').remove();
    }
  }

  function checkMotherNetIncomePoverty() {
    const warningMessage = 'Warning: 1st parent\'s net income is below the poverty guideline of $' + povertyGuideline;
    if (motherNetIncome < povertyGuideline) {
      alert(warningMessage);
      if (!$('#calculation-messages').find('p:contains("' + warningMessage + '")').length) {
        $('#calculation-messages').append('<p>' + warningMessage + '</p>');
      }
    } else {
      $('#calculation-messages').find('p:contains("' + warningMessage + '")').remove();
    }
  }

  function checkFatherNetIncomePoverty() {
    const warningMessage = 'Warning: 2nd parent\'s net income is below the poverty guideline of $' + povertyGuideline;
    if (fatherNetIncome < povertyGuideline) {
      alert(warningMessage);
      if (!$('#calculation-messages').find('p:contains("' + warningMessage + '")').length) {
        $('#calculation-messages').append('<p>' + warningMessage + '</p>');
      }
    } else {
      $('#calculation-messages').find('p:contains("' + warningMessage + '")').remove();
    }
  }

  // ── Deduction calculator ────────────────────────────────────────
  const $deductionInputs = $('#taxes, #fica, #retirement, ' +
    '#child-support-previously-ordered, #regular-support-for-other-children, ' +
    '#cost-to-parent-for-health-insurance, #child-tax-credit, #other');

  $deductionInputs.on('change', function () {
    let totalDeduction = 0;
    $deductionInputs.each(function () {
      totalDeduction += parseFloat($(this).val()) || 0;
    });
    if (!isNaN(totalDeduction)) {
      $('#total').text(totalDeduction.toFixed(2));
    } else {
      $('#total').text('');
    }
  });

  // ── Table 1 sidebar calculator ──────────────────────────────────
  // Looks up Nebraska Schedule of Basic Support Obligations (Table 1).
  // Income is rounded to nearest $50 to match table increments.
  // Table covers $500 – $20,000; incomes below $500 return minimum ($50).
  // Incomes above $20,000 return the maximum table value for that child count.
  $('#calculate-support').on('click', function (event) {
    event.preventDefault();

    if (supportAmounts.length === 0) {
      alert('Table 1 data is still loading. Please try again in a moment.');
      return;
    }

    const rawIncome   = parseFloat($('#monthly-income').val());
    const numChildren = parseInt($('#num-children').val());

    if (isNaN(rawIncome) || rawIncome <= 0) {
      alert('Please enter a combined monthly net income amount.');
      return;
    }

    const TABLE_MIN = supportAmounts[0][0];
    const TABLE_MAX = supportAmounts[supportAmounts.length - 1][0];

    let lookupIncome = Math.round(rawIncome / 50) * 50;
    lookupIncome = Math.max(TABLE_MIN, Math.min(TABLE_MAX, lookupIncome));

    const closestRow = supportAmounts.reduce((best, row) => {
      return Math.abs(row[0] - lookupIncome) < Math.abs(best[0] - lookupIncome) ? row : best;
    }, supportAmounts[0]);

    const amount = closestRow[numChildren]; // column index matches child count (1–6)
    if (amount !== undefined && !isNaN(amount)) {
      $('#support-amount').text('$' + amount);
      if (rawIncome > TABLE_MAX) {
        $('#support-amount').append(' <small>(table max applied)</small>');
      }
    } else {
      $('#support-amount').text('No data found');
    }
  });

  // ── Accordion ───────────────────────────────────────────────────
  $('.accordion-toggle').on('click', function () {
    var $btn     = $(this);
    var expanded = $btn.attr('aria-expanded') === 'true';
    var $body    = $('#' + $btn.attr('aria-controls'));
    $btn.attr('aria-expanded', String(!expanded));
    if (expanded) {
      $body.prop('hidden', true).attr('data-expanded', 'false');
    } else {
      $body.prop('hidden', false).attr('data-expanded', 'true');
    }
  });

  // ── Print (popup window with formatted table) ───────────────────
  // Sidebar Print button and the duplicate under Finalize Calculation
  $('#print-calc, #print-calc-bottom').on('click', function () {
    const printWindow   = window.open('', '_blank');
    const printDocument = printWindow.document;

    const tableContent = `
      <table style="width:80%;margin:0 auto;border-collapse:collapse;" border="1" cellpadding="5" cellspacing="0">
        <tr>
          <th style="background:#f0f0f0;padding:10px;border:1px solid #ddd;">Description</th>
          <th style="background:#f0f0f0;padding:10px;border:1px solid #ddd;">1st Parent</th>
          <th style="background:#f0f0f0;padding:10px;border:1px solid #ddd;">2nd Parent</th>
        </tr>
        <tr>
          <td colspan="3" style="padding:10px;border:1px solid #ddd;">
            Name/Number: ${document.getElementById('case-name').value}
          </td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Monthly Gross Income</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-income').value}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-income').value}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Total Monthly Deductions</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-deductions').value}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-deductions').value}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Monthly Net Income</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-net-income').value}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-net-income').value}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Combined Monthly Net Income</td>
          <td colspan="2" style="padding:10px;border:1px solid #ddd;text-align:center;">${document.getElementById('combined-net-income').textContent}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Combined Annual Net Income</td>
          <td colspan="2" style="padding:10px;border:1px solid #ddd;text-align:center;">${document.getElementById('combined-annual-net-income').textContent}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Parent's Percentage of Contribution</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-percentage-contribution').textContent}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-percentage-contribution').textContent}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Monthly Support From Table 1</td>
          <td colspan="2" style="padding:10px;border:1px solid #ddd;text-align:center;">${document.getElementById('monthly-support-from-table-1').value}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Paid Health Insurance / Cash Medical</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-paid-health-insurance-premium').value}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-paid-health-insurance-premium').value}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Total Obligation</td>
          <td colspan="2" style="padding:10px;border:1px solid #ddd;text-align:center;">${document.getElementById('total-obligation').textContent}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Parent's Monthly Share</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-monthly-share').textContent}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-monthly-share').textContent}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Credit for Health Insurance Premium Paid</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-credit-for-health-insurance-premium-paid').value}</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-credit-for-health-insurance-premium-paid').value}</td>
        </tr>
        <tr>
          <td style="padding:10px;border:1px solid #ddd;">Percentage of Nights with Parent</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('mother-time-split').value}%</td>
          <td style="padding:10px;border:1px solid #ddd;">${document.getElementById('father-time-split').value}%</td>
        </tr>
        <tr>
          <td style="padding:10px;border:2px solid #080808;font-weight:bold;">Calculated Support Each Parent Owes</td>
          <td style="padding:10px;border:2px solid #080808;text-align:center;">${document.getElementById('mother-child-support').textContent || 'Run Calculation'}</td>
          <td style="padding:10px;border:2px solid #080808;text-align:center;">${document.getElementById('father-child-support').textContent || 'Run Calculation'}</td>
        </tr>
      </table>
    `;

    printDocument.write(`
      <html>
        <head><title>Nebraska Child Support Calculation</title></head>
        <body style="font-family:Arial,sans-serif;padding:20px;">
          <h2 style="text-align:center;">Nebraska Child Support Calculation</h2>
          ${tableContent}
        </body>
      </html>
    `);
    printDocument.close();
  });

  // ── Stripe: handle return from payment + set up button state ─────
  // Runs last: after the input defaults above (so a restored form isn't
  // overwritten) and after the blur handler is bound (so the blur that
  // restoreFormDataAfterPayment() triggers recalculates the totals).
  initStripeGate();

}); // end document ready
