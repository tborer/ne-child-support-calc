$(function () {

  // ── Help icon tooltips ────────────────────────────────────────
  var $tooltip = $('#help-tooltip');

  $(document).on('mouseenter focus', '.help-icon', function (e) {
    var text = $(this).data('help-text');
    if (!text) return;
    $tooltip.text(text).addClass('visible').attr('aria-hidden', 'false');
    positionTooltip(e);
  }).on('mousemove', '.help-icon', function (e) {
    positionTooltip(e);
  }).on('mouseleave blur', '.help-icon', function () {
    $tooltip.removeClass('visible').attr('aria-hidden', 'true');
  });

  function positionTooltip(e) {
    var x = e.clientX + 12;
    var y = e.clientY + 12;
    if (x + 250 > window.innerWidth) x = e.clientX - 260;
    $tooltip.css({ left: x, top: y });
  }

  // ── Accordion ─────────────────────────────────────────────────
  $('.accordion-toggle').on('click', function () {
    var $btn = $(this);
    var expanded = $btn.attr('aria-expanded') === 'true';
    var $body = $('#' + $btn.attr('aria-controls'));
    $btn.attr('aria-expanded', !expanded);
    if (expanded) {
      $body.prop('hidden', true);
    } else {
      $body.prop('hidden', false);
    }
  });

  // ── Net income auto-calculation ───────────────────────────────
  function updateNetIncome(incomeId, deductionsId, netId, warningId, wrapId) {
    var income = parseFloat($('#' + incomeId).val()) || 0;
    var deductions = parseFloat($('#' + deductionsId).val()) || 0;
    var net = income - deductions;
    var $netInput = $('#' + netId);
    var $warn = $('#' + warningId);

    $netInput.val(net !== 0 ? net.toFixed(2) : '');

    if (net < 0) {
      $warn.text('⚠ Deductions exceed income');
      $netInput.css('color', 'var(--danger)');
    } else {
      $warn.text('');
      $netInput.css('color', '');
    }

    updateCombined();
  }

  $('#mother-income, #mother-deductions').on('input', function () {
    updateNetIncome('mother-income', 'mother-deductions', 'mother-net-income', 'mother-net-income-warning', 'mother-net-income-container');
  });

  $('#father-income, #father-deductions').on('input', function () {
    updateNetIncome('father-income', 'father-deductions', 'father-net-income', 'father-net-income-warning', 'father-net-income-container');
  });

  // ── Combined income & percentages ─────────────────────────────
  function fmt(n) {
    return '$' + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function updateCombined() {
    var motherNet = parseFloat($('#mother-net-income').val()) || 0;
    var fatherNet = parseFloat($('#father-net-income').val()) || 0;
    var combined  = motherNet + fatherNet;
    var annual    = combined * 12;

    $('#combined-net-income').text(combined !== 0 ? fmt(combined) : '');
    $('#combined-annual-net-income').text(annual !== 0 ? fmt(annual) : '');

    if (combined > 0) {
      var motherPct = (motherNet / combined * 100).toFixed(2);
      var fatherPct = (fatherNet / combined * 100).toFixed(2);
      $('#mother-percentage-contribution').text(motherPct + '%');
      $('#father-percentage-contribution').text(fatherPct + '%');
    } else {
      $('#mother-percentage-contribution, #father-percentage-contribution').text('');
    }

    updateTotalObligation();
  }

  // ── Total obligation ──────────────────────────────────────────
  function updateTotalObligation() {
    var table1   = parseFloat($('#monthly-support-from-table-1').val()) || 0;
    var motherIns = parseFloat($('#mother-paid-health-insurance-premium').val()) || 0;
    var fatherIns = parseFloat($('#father-paid-health-insurance-premium').val()) || 0;
    var total = table1 + motherIns + fatherIns;

    $('#total-obligation').text(total > 0 ? fmt(total) : '');

    updateMonthlyShares(total);
  }

  $('#monthly-support-from-table-1, #mother-paid-health-insurance-premium, #father-paid-health-insurance-premium').on('input', updateTotalObligation);

  // ── Monthly shares ────────────────────────────────────────────
  function updateMonthlyShares(total) {
    if (total === undefined) total = parseFloat($('#total-obligation').text().replace(/[^0-9.]/g, '')) || 0;
    var motherNet = parseFloat($('#mother-net-income').val()) || 0;
    var fatherNet = parseFloat($('#father-net-income').val()) || 0;
    var combined  = motherNet + fatherNet;

    if (combined > 0 && total > 0) {
      var motherShare = total * (motherNet / combined);
      var fatherShare = total * (fatherNet / combined);
      $('#mother-monthly-share').text(fmt(motherShare));
      $('#father-monthly-share').text(fmt(fatherShare));
    } else {
      $('#mother-monthly-share, #father-monthly-share').text('');
    }
  }

  // ── Deduction calculator ──────────────────────────────────────
  var $deductionInputs = $('#taxes, #fica, #retirement, #child-support-previously-ordered, #regular-support-for-other-children, #cost-to-parent-for-health-insurance, #child-tax-credit, #other');

  $deductionInputs.on('input', function () {
    var total = 0;
    $deductionInputs.each(function () {
      total += parseFloat($(this).val()) || 0;
    });
    $('#total').text(total > 0 ? fmt(total) : '');
  });

  // ── Table 1 sidebar calculator ────────────────────────────────
  // Placeholder — will be replaced with real Nebraska Table 1 data
  $('#calculate-support').on('click', function () {
    var income   = parseFloat($('#monthly-income').val()) || 0;
    var children = parseInt($('#num-children').val()) || 1;

    if (income <= 0) {
      alert('Please enter a combined monthly net income amount.');
      return;
    }

    // Stub: real Nebraska Table 1 lookup goes here
    var amount = 0;
    $('#support-amount').text(amount > 0 ? fmt(amount) : 'See NE Table 1');
  });

  // ── Finalize calculation ──────────────────────────────────────
  // Stub entry point — replace body with real joint/basic calc logic
  $('#finalize-calculation').on('click', function () {
    var calcType = $('#calc-type').val();
    if (!calcType) {
      alert('Please select a Calculation Type before finalizing.');
      return;
    }

    // Real calculation logic will go here
    $('#mother-child-support').text('');
    $('#father-child-support').text('');
    $('#calculation-messages').text('Calculation type selected: ' + calcType + '. Calculation logic pending.');
  });

  // ── Print ─────────────────────────────────────────────────────
  $('#print-calc').on('click', function () {
    window.print();
  });

});
