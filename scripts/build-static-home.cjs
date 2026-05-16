const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const reportPath = path.join(root, 'outputs', 'live-capital-radar.md');
const reportMarkdown = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = value => Array.isArray(value) ? value : [];
const fmt = n => typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'n/a';
const pct = n => typeof n === 'number' ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : 'n/a';
const tone = n => typeof n !== 'number' ? '' : n >= 0 ? 'good' : 'bad';

function inlineReportHtml(){
  if (!reportMarkdown.trim()) return '<p class="muted">Live markdown report not found.</p>';
  return `<pre class="inline-report">${esc(reportMarkdown)}</pre>`;
}

function spark(values){
  if (!values?.length) return '';
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v,i)=>`${(i/(values.length-1 || 1))*100},${46-((v-min)/span)*40+3}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#d7a84c" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="0" y1="48" x2="100" y2="48" stroke="#312b20"/></svg>`;
}
function marketRegimeHtml(){
  const r = state.marketRegime || {};
  const cycle = state.kostolanyCycle || {};
  const keys = [['Posture', r.posture], ['Growth', r.growth], ['Inflation', r.inflation], ['Policy', r.policy], ['Liquidity', r.liquidity], ['Risk appetite', r.riskAppetite], ['Most important macro signal', r.mostImportantMacroSignal], ['Confidence', r.confidence]];
  return `<div class="market-md-stack"><section class="market-md-block"><div class="section-head compact"><div><p class="eyebrow">Regime</p><h3>Market Regime</h3></div></div><div class="market-regime-strip">${keys.map(([label, value]) => `<article class="market-pill"><span>${esc(label)}</span><b>${esc(value || '—')}</b></article>`).join('')}</div></section><section class="market-md-block"><article class="kostolany-callout"><span>Kostolany cycle position</span><h3>${esc(cycle.phase || 'Phase not available')}</h3><p>${esc(Array.isArray(cycle.evidence) ? cycle.evidence.join(' · ') : cycle.interpretation || 'Evidence not available.')}</p></article></section></div>`;
}
function holdingsHtml(){
  return list(state.holdings).map(h => {
    const ticker = String(h.ticker || '').toUpperCase();
    const isThesisRequired = ['BMNR', 'TSNF'].includes(ticker) || String(h.computedSignal || h.signal || '').includes('INVESTIGATE');
    return `<article class="card" data-thesis-card data-thesis-ticker="${esc(ticker)}">
    <div class="ticker"><div><b>${esc(h.ticker)}</b><br><small>${esc(h.exposureBucket || h.role || 'Holding')}</small></div><div style="text-align:right"><b>$${fmt(h.livePrice)}</b><br><small class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</small></div></div>
    ${spark(h.sparkline)}
    <span class="signal ${h.computedSignal?.includes('EXIT')||h.computedSignal?.includes('TRIM')?'bad':h.computedSignal?.includes('WATCH')||h.computedSignal?.includes('INVEST')?'warn':'good'}">${esc(h.computedSignal || h.signal || 'Review')}</span>
    <div class="rows">
      <div class="row"><span>Health score</span><b>${esc(h.healthScore ?? 'n/a')}</b></div>
      <div class="row"><span>Weight</span><b>${fmt(h.portfolioWeightPct)}%</b></div>
      <div class="row"><span>Market value</span><b>$${fmt(h.marketValue)}</b></div>
      <div class="row"><span>1M / 3M</span><b class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</b> <b class="${tone(h.perf3mPct)}">${pct(h.perf3mPct)}</b></div>
    </div>
    <p style="margin-top:12px">${esc(h.actionRationale || '')}</p>
    <div class="holding-thesis">
      <div class="thesis-head"><span>Editable thesis</span><small data-thesis-status>Empty</small></div>
      <textarea data-thesis-input rows="4" placeholder="Write a 2–4 sentence thesis for ${esc(ticker)}. What must remain true? What would invalidate the position?"></textarea>
      <p class="thesis-warning" data-thesis-warning ${isThesisRequired ? '' : 'hidden'}>Thesis required for INVESTIGATE-stage holding.</p>
    </div>
    <a class="detail-link" href="pages/${esc(String(h.ticker || '').toLowerCase())}.html">Open ${esc(h.ticker)} workspace →</a>
  </article>`;
  }).join('') || '<p class="muted">No holdings loaded.</p>';
}
function exposureHtml(){
  const exposure = list(state.strategy?.exposureMap);
  const max = Math.max(...exposure.map(x=>x.weightPct || 0), 1);
  return exposure.map(x => `<div class="bar"><label>${esc(x.bucket)}</label><div class="bar-track"><div class="bar-fill" style="width:${((x.weightPct || 0)/max)*100}%"></div></div><strong>${fmt(x.weightPct)}%</strong></div>`).join('') || '<p class="muted">No exposure map loaded.</p>';
}
function forcesHtml(){
  const rows = list(state.strategy?.marketForces);
  return rows.map(f => `<article class="force"><div class="force-top"><b>${esc(f.name)}</b><span>${esc(f.direction)}</span></div><div class="intensity"><i style="width:${Math.min(100, (f.intensity || 1) * 20)}%"></i></div><p>${esc(f.interpretation)}</p><p class="muted">Affected: ${esc(list(f.affected).join(', ') || 'n/a')}</p></article>`).join('') || '<p class="muted">No market force map loaded.</p>';
}
function marketBoardHtml(){
  const bySymbol = Object.fromEntries(list(state.liveMarket).map(x => [x.symbol, x]));
  const byRate = Object.fromEntries(list(state.liveRatesCredit).map(x => [x.id || x.Series, x]));
  const cards = [
    { label: 'Volatility', value: bySymbol['^VIX']?.price, read: state.marketRegime?.riskLevel, watch: 'Above 22 = reduce speculative/levered risk review threshold.' },
    { label: '10Y Treasury', value: byRate.DGS10?.value != null ? `${byRate.DGS10.value}%` : byRate.DGS10?.Value, read: byRate.DGS10?.latestDate || byRate.DGS10?.['Latest date'], watch: 'Higher long-end rates pressure AI/cloud multiples and valuation tolerance.' },
    { label: 'Credit spread', value: byRate.BAMLH0A0HYM2?.value || byRate.BAMLH0A0HYM2?.Value, read: 'HY OAS', watch: 'Widening spreads while equities rise = fragile risk appetite.' },
    { label: 'QQQ trend', value: pct(bySymbol.QQQ?.perf5dPct), read: '5D performance', watch: 'Confirms or rejects risk-on appetite for tech-heavy exposure.' }
  ];
  return cards.map(c => `<article class="board-card"><span>${esc(c.label)}</span><strong>${esc(c.value ?? 'n/a')}</strong><p>${esc(c.read || '')}</p><small>${esc(c.watch)}</small></article>`).join('');
}
function opportunitiesHtml(){
  return list(state.strategy?.opportunityScout || state.opportunityScout).map(o => `<article class="card opportunity research-card"><div class="ticker"><div><b>${esc(o.ticker || o.score || '—')}</b><br><small>${esc(o.name || 'Suggested ticker')}</small></div><span class="signal ${String(o.signal || '').includes('ADD')?'good':'warn'}">${esc(o.signal || 'Watch')}</span></div><h3>${esc(o.theme || 'Research candidate')}</h3><p>${esc(o.thesis || o.whyNow || o.rationale || 'No thesis loaded.')}</p><p class="muted">Type: ${esc(o.candidateType || 'Research')} · Score ${esc(o.score ?? 'n/a')}</p></article>`).join('') || '<p class="muted">No opportunity queue loaded.</p>';
}
function marketTableHtml(){
  return `<div class="section-head compact"><div><p class="eyebrow">Evidence Appendix</p><h3>Market Tape</h3></div></div><div class="table-wrap"><table class="table"><thead><tr><th>Symbol</th><th>Price</th><th>Day%</th><th>5D%</th><th>1M%</th><th>3M%</th><th>As of</th></tr></thead><tbody>${list(state.liveMarket).map(m => `<tr><td>${esc(m.symbol)}</td><td>$${fmt(m.price)}</td><td class="${tone(m.changePct)}">${pct(m.changePct)}</td><td>${pct(m.perf5dPct)}</td><td>${pct(m.perf1mPct)}</td><td>${pct(m.perf3mPct)}</td><td>${esc(m.priceAsOf || m.asOf || '—')}</td></tr>`).join('') || '<tr><td colspan="7">No market tape loaded.</td></tr>'}</tbody></table></div>`;
}
function ratesHtml(){
  const desired = ['DGS2', 'DGS10', 'DGS30', 'T10YIE', 'BAMLH0A0HYM2', 'BAMLC0A0CM', 'DFF', 'FEDFUNDS'];
  const rates = list(state.liveRatesCredit);
  const filtered = desired.map(id => rates.find(row => row.id === id || row.Series === id)).filter(Boolean);
  const useRows = filtered.length ? filtered : rates;
  return `<div class="section-head compact"><div><p class="eyebrow">Rates / Credit / Liquidity</p><h3>Macro pressure strip</h3></div></div><div class="rates-strip">${useRows.map(r => `<article class="rate-card"><span>${esc(r.id || r.Series || '—')}</span><b>${esc(r.value ?? r.Value ?? '—')}</b><small>${esc(r.name || r.Name || '')}<br>${esc(r.latestDate || r['Latest date'] || '')}</small></article>`).join('') || '<p class="muted">No rates data loaded.</p>'}</div>`;
}
function sourcesHtml(){
  return list(state.globalInstitutionSources).map(s => `<article class="source"><h3>${esc(s.institution)}</h3><p>${esc(s.use)}</p><p class="muted">${esc(s.geography)} · ${esc(s.status)}</p></article>`).join('') || '<p class="muted">No source roadmap loaded.</p>';
}

const finalOutput = state.finalOutput || {};
const riskOfficer = state.riskOfficer || {};
const strategy = state.strategy || {};
const regime = state.marketRegime || {};
const generated = state.meta?.generatedAt ? new Date(state.meta.generatedAt).toLocaleString() : 'Generated time unavailable';
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>OpenClaw Capital Radar</title><link rel="stylesheet" href="assets/capital-radar.css"/><link rel="stylesheet" href="assets/enhancement-overrides.css"/></head><body><main class="shell"><div class="topbar"><div class="brand"><span class="mark">◇</span><div>OpenClaw Capital Radar</div></div><nav class="nav" aria-label="Report sections"><a href="#inline-report">Report</a><a href="#brief">Brief</a><a href="#holdings-section">Holdings</a><a href="#opportunities-section">Opportunities</a><a href="#market-section">Market tape</a></nav><div id="generated">${esc(generated)} · static prerender</div></div><header class="hero"><div><p class="eyebrow">Live investing blueprint · market landscape intelligence</p><h1>Capital Radar</h1><p class="lede">A market-open decision surface for portfolio posture, risk concentration, future holdings, and macro pressure. It separates live facts from inference so the report points to review priorities — not automatic trades.</p><div class="lens-strip"><span>Fact</span><span>Inference</span><span>Uncertainty</span><span>Human review</span></div></div><aside class="status"><span>Data status</span><strong id="status">${esc(state.meta?.dataStatus || 'STATIC_PRERENDER')}</strong><span id="confidence">${esc(regime.confidence || 'Confidence unavailable')}</span><span>8:30 AM ET target · research only · no brokerage action</span></aside></header><section id="inline-report" class="panel inline-report-panel"><div class="section-head"><div><p class="eyebrow">Primary report</p><h2>Live Capital Radar Report</h2></div><a class="button" href="outputs/live-capital-radar.md">Open markdown</a></div>${inlineReportHtml()}</section><section id="brief" class="brief-grid"><article class="panel decision-card"><p class="eyebrow">Executive brief</p><h2>Today’s read</h2><p id="final-judgment" class="judgment">${esc(finalOutput.finalJudgment || regime.mostImportantMacroSignal || 'No final judgment available yet.')}</p><div id="brief-list" class="brief-list"><article class="brief-item"><span>Market posture</span><b>${esc(finalOutput.marketPosture || regime.posture || '—')}</b></article><article class="brief-item"><span>Holding update</span><b>${esc(finalOutput.mostImportantHoldingUpdate || '—')}</b></article><article class="brief-item"><span>Top trim watch</span><b>${esc(finalOutput.topTrimWatch || strategy.highestRiskPosition || '—')}</b></article><article class="brief-item"><span>Top add watch</span><b>${esc(finalOutput.topAddWatch || list(strategy.opportunityScout)[0]?.theme || '—')}</b></article></div></article><aside class="panel risk-rail"><div class="section-head compact"><div><p class="eyebrow">Risk officer</p><h2>Review before action</h2></div></div><ul id="risk-list" class="checklist">${list(riskOfficer.keyRisks).map(r => `<li>${esc(r)}</li>`).join('') || '<li>No risk notes loaded.</li>'}</ul><div id="human-review" class="review-box"><b>Human review required:</b><br>${list(riskOfficer.humanReviewRequired).map(esc).join('<br>') || 'No review flags loaded.'}</div></aside></section><section class="grid four metrics-row"><article class="metric"><span>Market posture</span><strong id="posture">${esc(regime.posture || '—')}</strong></article><article class="metric"><span>Risk level</span><strong id="risk">${esc(regime.riskLevel || '—')}</strong></article><article class="metric"><span>Strongest</span><strong id="strongest">${esc(strategy.strongestHolding || finalOutput.strongestCurrentHolding || '—')}</strong></article><article class="metric"><span>Highest risk</span><strong id="highest-risk">${esc(strategy.highestRiskPosition || riskOfficer.highestRiskPosition || '—')}</strong></article></section><section class="panel"><div class="section-head"><div><p class="eyebrow">Decision dashboard</p><h2>What matters now</h2></div><a class="button" href="outputs/live-capital-radar.md">Markdown report</a></div><div class="grid two"><article class="metric"><span>Most important macro signal</span><p id="macro">${esc(regime.mostImportantMacroSignal || '—')}</p></article><article class="metric"><span>Strategy posture</span><p id="strategy">${esc(strategy.strategyPosture || state.rebalance?.rationale || '—')}</p></article></div><div class="grid two" style="margin-top:16px"><article class="metric"><span>Weakest holding</span><strong id="weakest">${esc(strategy.weakestHolding || finalOutput.weakestCurrentHolding || '—')}</strong></article><article class="metric"><span>Watch triggers</span><ul id="triggers" class="compact-list">${list(strategy.watchTriggers).map(t=>`<li>${esc(t)}</li>`).join('') || '<li>No triggers loaded.</li>'}</ul></article></div></section><section class="grid two"><article class="panel"><div class="section-head compact"><div><p class="eyebrow">Portfolio</p><h2>Allocation pressure</h2></div></div><div id="exposure" class="bar-list">${exposureHtml()}</div></article><article class="panel"><div class="section-head compact"><div><p class="eyebrow">Future holdings</p><h2>Opportunity queue</h2></div></div><div id="future-list" class="card-list">${opportunitiesHtml()}</div></article></section><section class="panel"><div class="section-head"><div><p class="eyebrow">Market forces</p><h2>Pressure map</h2></div></div><div id="forces" class="force-grid">${forcesHtml()}</div><div id="market-board" class="market-grid" style="margin-top:16px">${marketBoardHtml()}</div></section><section id="holdings-section" class="panel"><div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Position-level map</h2></div><span class="note">Open each ticker workspace for thesis, action bands, risk, and live chart.</span></div><div id="holdings" class="holdings-grid">${holdingsHtml()}</div></section><section id="opportunities-section" class="panel"><div class="section-head"><div><p class="eyebrow">Potential additions</p><h2>Watchlist and triggers</h2></div></div><div id="opportunities" class="opportunity-grid">${opportunitiesHtml()}</div></section><section id="market-section" class="panel"><div class="section-head"><div><p class="eyebrow">Market tape</p><h2>External pressure map</h2></div></div><div id="market" class="market-grid">${marketRegimeHtml()}</div><div id="market-table">${marketTableHtml()}</div><div id="rates-table" style="margin-top:16px">${ratesHtml()}</div></section><section class="panel"><div class="section-head"><div><p class="eyebrow">Sources</p><h2>Research source map</h2></div></div><div id="sources" class="source-grid">${sourcesHtml()}</div><p id="notice" class="note">Sources: ${esc(list(state.meta?.liveDataSources).join(' · ') || 'source list unavailable')}. Public-data research system; not an automatic broker.</p></section><footer class="footer">Research and education only. No brokerage connection. Generated from local OpenClaw data pipeline.</footer></main><script src="assets/chart-integration.js" defer></script><script src="assets/search-enhancement.js" defer></script><script src="assets/holding-theses.js" defer></script><script src="assets/risk-budget.js" defer></script><script src="assets/holding-fundamentals.js" defer></script><script src="assets/earnings-flags.js" defer></script><script src="assets/data-quality-panel.js" defer></script></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`built static home from ${path.relative(root, statePath)}`);
