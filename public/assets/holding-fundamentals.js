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
    return parseNumericMetric(
      holding?.dataContract?.forwardPE ??
      holding?.forwardPE ??
      holding?.forwardPe ??
      holding?.finviz?.metrics?.['Forward P/E']
    );
  }

  function fcfYieldFor(holding) {
    const contractValue = parseNumericMetric(holding?.dataContract?.fcfYield);
    if (Number.isFinite(contractValue)) return contractValue;
    const direct = parseNumericMetric(holding?.fcfYield ?? holding?.freeCashFlowYield ?? holding?.finviz?.metrics?.['FCF Yield']);
    if (Number.isFinite(direct)) return direct;
    const pfcf = parseNumericMetric(holding?.finviz?.metrics?.['P/FCF']);
    return Number.isFinite(pfcf) && pfcf > 0 ? 100 / pfcf : null;
  }

  function confidenceLabel(holding, field) {
    return text(holding?.dataContract?.confidence?.[field] || 'missing');
  }

  function sourceLabel(holding, field) {
    const source = text(holding?.dataContract?.source?.[field]);
    const asOf = text(holding?.dataContract?.sourceAsOf?.[field]);
    if (!source && !asOf) return '';
    return `${source || 'source unknown'}${asOf ? ` · ${asOf}` : ''}`;
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

  function addRow(rows, label, value, confidence, source) {
    if (!rows || rows.querySelector(`[data-fundamental-row="${label}"]`)) return;
    const row = document.createElement('div');
    row.className = 'row';
    row.dataset.fundamentalRow = label;
    if (source) row.title = source;
    row.innerHTML = `<span>${label}${confidence ? ` <em class="data-confidence">${confidence}</em>` : ''}</span><b>${value}</b>`;
    rows.appendChild(row);
  }

  function render(state) {
    const holdings = Object.fromEntries((state?.holdings || []).map(h => [text(h.ticker).toUpperCase(), h]));
    document.querySelectorAll('[data-thesis-card]').forEach(card => {
      const ticker = text(card.dataset.thesisTicker).toUpperCase();
      const holding = holdings[ticker];
      const rows = card.querySelector('.rows');
      if (!holding || !rows) return;
      addRow(rows, 'Forward PE', fmtNumber(forwardPeFor(holding)), confidenceLabel(holding, 'forwardPE'), sourceLabel(holding, 'forwardPE'));
      addRow(rows, 'FCF Yield', fmtNumber(fcfYieldFor(holding), '%'), confidenceLabel(holding, 'fcfYield'), sourceLabel(holding, 'fcfYield'));
    });
  }

  loadState().then(render);
})();
