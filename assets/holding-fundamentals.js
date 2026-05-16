(function () {
  const dataSources = [
    '/data/report-state.live.json',
    'data/report-state.live.json',
    '/data/report-state.sample.json',
    'data/report-state.sample.json'
  ];

  function text(value) {
    return String(value ?? '').trim();
  }

  function fmtNumber(value, suffix = '') {
    const n = Number(value);
    if (!Number.isFinite(n)) return '—';
    return `${n.toFixed(n >= 100 ? 0 : 2)}${suffix}`;
  }

  function parseNumericMetric(raw) {
    const match = text(raw).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
  }

  function forwardPeFor(holding) {
    return parseNumericMetric(holding?.forwardPE ?? holding?.forwardPe ?? holding?.finviz?.metrics?.['Forward P/E']);
  }

  function fcfYieldFor(holding) {
    const direct = parseNumericMetric(holding?.fcfYield ?? holding?.freeCashFlowYield ?? holding?.finviz?.metrics?.['FCF Yield']);
    if (Number.isFinite(direct)) return direct;
    const pfcf = parseNumericMetric(holding?.finviz?.metrics?.['P/FCF']);
    return Number.isFinite(pfcf) && pfcf > 0 ? 100 / pfcf : null;
  }

  async function loadState() {
    for (const url of dataSources) {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) continue;
        return await res.json();
      } catch (_) {}
    }
    return null;
  }

  function addRow(rows, label, value) {
    if (!rows || rows.querySelector(`[data-fundamental-row="${label}"]`)) return;
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.fundamentalRow = label;
    row.innerHTML = `<span>${label}</span><b>${value}</b>`;
    rows.appendChild(row);
  }

  function render(state) {
    const holdings = Object.fromEntries((state?.holdings || []).map(h => [text(h.ticker).toUpperCase(), h]));
    document.querySelectorAll('[data-thesis-card]').forEach(card => {
      const ticker = text(card.dataset.thesisTicker).toUpperCase();
      const holding = holdings[ticker];
      const rows = card.querySelector('.rows');
      if (!holding || !rows) return;
      addRow(rows, 'Forward PE', fmtNumber(forwardPeFor(holding)));
      addRow(rows, 'FCF Yield', fmtNumber(fcfYieldFor(holding), '%'));
    });
  }

  loadState().then(render);
})();
