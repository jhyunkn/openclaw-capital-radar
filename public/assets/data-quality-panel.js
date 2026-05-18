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

  function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
  }

  function pct(count, total) {
    return total ? `${Math.round((count / total) * 100)}%` : '0%';
  }

  function missingTickers(holdings, field) {
    return holdings
      .filter(holding => !hasValue(holding?.dataContract?.[field]))
      .map(holding => text(holding.ticker))
      .filter(Boolean);
  }

  function confidenceCounts(holdings, field) {
    return holdings.reduce((acc, holding) => {
      const key = text(holding?.dataContract?.confidence?.[field] || 'missing');
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
  }

  function render(state) {
    const holdings = Array.isArray(state?.holdings) ? state.holdings : [];
    if (!holdings.length || document.getElementById('data-quality-panel')) return;

    const fields = ['forwardPE', 'fcfYield', 'nextEarningsDate'];
    const cards = fields.map(field => {
      const complete = holdings.filter(holding => hasValue(holding?.dataContract?.[field])).length;
      const missing = missingTickers(holdings, field);
      const confidence = confidenceCounts(holdings, field);
      const label = field === 'forwardPE' ? 'Forward PE' : field === 'fcfYield' ? 'FCF Yield' : 'Next earnings date';
      return `<article class="data-quality-card">
        <span>${label}</span>
        <strong>${complete}/${holdings.length}</strong>
        <p>${pct(complete, holdings.length)} complete · ${Object.entries(confidence).map(([k, v]) => `${k}: ${v}`).join(' · ')}</p>
        <small>${missing.length ? `Missing: ${missing.join(', ')}` : 'No missing tickers'}</small>
      </article>`;
    }).join('');

    const panel = document.createElement('section');
    panel.id = 'data-quality-panel';
    panel.className = 'panel data-quality-panel';
    panel.innerHTML = `<div class="section-head"><div><p class="eyebrow">Data Quality</p><h2>Holding contract completeness</h2></div><a class="button" href="data/report-state.live.json">Open JSON</a></div><div class="data-quality-grid">${cards}</div><p class="note">Missing values remain explicit nulls. The system does not invent fundamentals or earnings dates.</p>`;

    const holdingsSection = document.getElementById('holdings-section');
    if (holdingsSection) holdingsSection.insertAdjacentElement('beforebegin', panel);
    else document.querySelector('main')?.appendChild(panel);
  }

  loadState().then(render);
})();
