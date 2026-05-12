// Tab navigation
document.querySelectorAll('.section-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.section-tab').forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
    document.getElementById('tab-' + target).classList.add('active');
  });
});

// Reset
document.getElementById('btn-reset').addEventListener('click', () => {
  document.querySelectorAll('input[type="number"]').forEach(i => { i.value = ''; });
  document.querySelectorAll('input[type="radio"]').forEach(r => { r.checked = r.defaultChecked; });
  document.querySelectorAll('select').forEach(s => { s.selectedIndex = 0; });
  document.getElementById('result-placeholder').classList.remove('hidden');
  document.getElementById('result-output').classList.add('hidden');
});

// Print
document.getElementById('btn-print').addEventListener('click', () => window.print());

// Calculate — placeholder logic; replace with real guidelines schedule
document.getElementById('btn-calculate').addEventListener('click', () => {
  const val = id => parseFloat(document.getElementById(id).value) || 0;

  const cpGross = val('cp-gross-income');
  const ncpGross = val('ncp-gross-income');

  const cpNet = cpGross - val('cp-fica') - val('cp-federal-tax') - val('cp-state-tax') - val('cp-prior-support');
  const ncpNet = ncpGross - val('ncp-fica') - val('ncp-federal-tax') - val('ncp-state-tax') - val('ncp-prior-support');
  const combined = Math.max(cpNet, 0) + Math.max(ncpNet, 0);

  if (combined <= 0) { alert('Please enter income information first.'); return; }

  const ncpShare = combined > 0 ? Math.max(ncpNet, 0) / combined : 0;

  // Placeholder basic support lookup — will be replaced by real schedule
  const basicSupport = combined * 0.20;
  const healthAdj = val('health-cost') * ncpShare;
  const childcareAdj = (val('childcare-cost') - val('childcare-tax-credit')) * ncpShare;

  const total = basicSupport * ncpShare + healthAdj + childcareAdj;

  const fmt = n => '$' + Math.max(n, 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  document.getElementById('result-amount-value').textContent = fmt(total);
  document.getElementById('rb-combined').textContent = fmt(combined);
  document.getElementById('rb-basic').textContent = fmt(basicSupport);
  document.getElementById('rb-ncp-share').textContent = (ncpShare * 100).toFixed(1) + '%';
  document.getElementById('rb-health').textContent = fmt(healthAdj);
  document.getElementById('rb-childcare').textContent = fmt(childcareAdj);

  document.getElementById('result-placeholder').classList.add('hidden');
  document.getElementById('result-output').classList.remove('hidden');
});

function id(s) { return document.getElementById(s); }
