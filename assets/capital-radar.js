const api = '/api/capital-radar';
const fallback = 'data/report-state.live.json';
const $ = id => document.getElementById(id);
const fmt = n => typeof n === 'number' ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : 'n/a';
const pct = n => typeof n === 'number' ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : 'n/a';
const tone = n => typeof n !== 'number' ? '' : n >= 0 ? 'good' : 'bad';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const list = value => Array.isArray(value) ? value : [];

function spark(values){
  if (!values?.length) return '';
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v,i)=>`${(i/(values.length-1 || 1))*100},${46-((v-min)/span)*40+3}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 52" preserveAspectRatio="none" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="#d7a84c" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="0" y1="48" x2="100" y2="48" stroke="#312b20"/></svg>`;
}

function renderBrief(state){
  const finalOutput = state.finalOutput || {};
  const riskOfficer = state.riskOfficer || {};
  $('final-judgment').textContent = finalOutput.finalJudgment || state.marketRegime?.mostImportantMacroSignal || 'No final judgment available yet.';
  const items = [
    ['Market posture', finalOutput.marketPosture || state.marketRegime?.posture],
    ['Holding update', finalOutput.mostImportantHoldingUpdate],
    ['Top trim watch', finalOutput.topTrimWatch || state.strategy?.highestRiskPosition],
    ['Top add watch', finalOutput.topAddWatch || list(state.strategy?.opportunityScout)[0]?.theme]
  ].filter(([,v]) => v);
  $('brief-list').innerHTML = items.map(([k,v]) => `<article class="brief-item"><span>${esc(k)}</span><b>${esc(v)}</b></article>`).join('');
  $('risk-list').innerHTML = list(riskOfficer.keyRisks).map(r => `<li>${esc(r)}</li>`).join('') || '<li>No risk notes loaded.</li>';
  $('human-review').innerHTML = `<b>Human review required:</b><br>${list(riskOfficer.humanReviewRequired).map(esc).join('<br>') || 'No review flags loaded.'}`;
}

function renderExposure(state){
  const exposure = list(state.strategy?.exposureMap);
  if (!exposure.length) { $('exposure').innerHTML = '<p class="muted">No exposure map loaded.</p>'; return; }
  const max = Math.max(...exposure.map(x=>x.weightPct || 0),1);
  $('exposure').innerHTML = exposure.map(x => `<div class="bar"><label>${esc(x.bucket)}</label><div class="bar-track"><div class="bar-fill" style="width:${((x.weightPct || 0)/max)*100}%"></div></div><strong>${fmt(x.weightPct)}%</strong></div>`).join('');
}

function renderForces(state){
  $('forces').innerHTML = list(state.strategy?.marketForces).map(f => `<article class="force">
    <div class="force-top"><b>${esc(f.name)}</b><span>${esc(f.direction)}</span></div>
    <div class="intensity"><i style="width:${Math.min(100, (f.intensity || 1) * 20)}%"></i></div>
    <p>${esc(f.interpretation)}</p>
    <p class="muted">Affected: ${esc(list(f.affected).join(', ') || 'n/a')}</p>
  </article>`).join('') || '<p class="muted">No market force map loaded.</p>';
}

function renderMarketBoard(state){
  const bySymbol = Object.fromEntries(list(state.liveMarket).map(x => [x.symbol, x]));
  const byRate = Object.fromEntries(list(state.liveRatesCredit).map(x => [x.id, x]));
  const cards = [
    { label: 'Volatility', value: bySymbol['^VIX']?.price, read: state.marketRegime?.riskLevel, watch: 'Above 22 = reduce speculative/levered risk review threshold.' },
    { label: '10Y Treasury', value: byRate.DGS10?.value != null ? `${byRate.DGS10.value}%` : null, read: byRate.DGS10?.latestDate, watch: 'Higher long-end rates pressure AI/cloud multiples and valuation tolerance.' },
    { label: 'Credit spread', value: byRate.BAMLH0A0HYM2?.value, read: 'HY OAS', watch: 'Widening spreads while equities rise = fragile risk appetite.' },
    { label: 'Inflation expectation', value: byRate.T10YIE?.value != null ? `${byRate.T10YIE.value}%` : null, read: '10Y breakeven', watch: 'Re-acceleration can lift rates and pressure consumer/long-duration holdings.' },
    { label: 'QQQ trend', value: pct(bySymbol.QQQ?.perf5dPct), read: '5D performance', watch: 'Confirms or rejects risk-on appetite for tech-heavy exposure.' },
    { label: 'Bitcoin liquidity beta', value: pct(bySymbol['BTC-USD']?.perf1mPct), read: 'BTC 1M', watch: 'Important for CONL/crypto-beta risk; positive trend still needs drawdown control.' }
  ];
  $('market-board').innerHTML = cards.map(c => `<article class="board-card"><span>${esc(c.label)}</span><strong>${esc(c.value ?? 'n/a')}</strong><p>${esc(c.read || '')}</p><small>${esc(c.watch)}</small></article>`).join('');
}

function renderOpportunities(state){
  const opportunities = list(state.strategy?.opportunityScout || state.opportunityScout);
  $('opportunities').innerHTML = opportunities.map(o => `<article class="card opportunity research-card">
    <div class="ticker"><div><b>${esc(o.ticker || o.score || '—')}</b><br><small>${esc(o.name || 'Suggested ticker')}</small></div><span class="signal ${String(o.signal || '').includes('ADD')?'good':'warn'}">${esc(o.signal || 'Watch')}</span></div>
    <h3>${esc(o.theme || 'Research candidate')}</h3>
    <p>${esc(o.thesis || o.whyNow || o.rationale || 'No thesis loaded.')}</p>
    <div class="evidence-box"><span>Data support</span><ul>${list(o.dataSupport).map(d => `<li>${esc(d)}</li>`).join('') || '<li>Evidence not loaded yet.</li>'}</ul></div>
    <details>
      <summary>Why / confirm / risk</summary>
      <p><b>Why now:</b> ${esc(o.whyNow || 'No timing rationale loaded.')}</p>
      <p><b>Confirm before add:</b></p>
      <ul>${list(o.confirmBeforeAdd).map(x => `<li>${esc(x)}</li>`).join('') || '<li>Confirmation checklist not loaded.</li>'}</ul>
      <p><b>Key risks:</b></p>
      <ul>${list(o.keyRisks).map(x => `<li>${esc(x)}</li>`).join('') || '<li>Risk list not loaded.</li>'}</ul>
    </details>
    <p class="muted">Type: ${esc(o.candidateType || 'Research')} · Score ${esc(o.score ?? 'n/a')}</p>
  </article>`).join('') || '<p class="muted">No opportunity queue loaded.</p>';
}

function renderHoldings(state){
  $('holdings').innerHTML = list(state.holdings).map(h => `<article class="card">
    <div class="ticker"><div><b>${esc(h.ticker)}</b><br><small>${esc(h.exposureBucket)}</small></div><div style="text-align:right"><b>$${fmt(h.livePrice)}</b><br><small class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</small></div></div>
    ${spark(h.sparkline)}
    <span class="signal ${h.computedSignal?.includes('EXIT')||h.computedSignal?.includes('TRIM')?'bad':h.computedSignal?.includes('WATCH')||h.computedSignal?.includes('INVEST')?'warn':'good'}">${esc(h.computedSignal || h.signal || 'Review')}</span>
    <div class="rows">
      <div class="row"><span>Health score</span><b>${esc(h.healthScore ?? 'n/a')}</b></div>
      <div class="row"><span>Weight</span><b>${fmt(h.portfolioWeightPct)}%</b></div>
      <div class="row"><span>Market value</span><b>$${fmt(h.marketValue)}</b></div>
      <div class="row"><span>1M / 3M</span><b class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</b> <b class="${tone(h.perf3mPct)}">${pct(h.perf3mPct)}</b></div>
    </div>
    <p style="margin-top:12px">${esc(h.actionRationale)}</p>
    <a class="detail-link" data-ticker-workspace-card-link="true" href="pages/${esc(String(h.ticker || '').toLowerCase())}.html">Open ${esc(h.ticker)} rating + chart →</a>
  </article>`).join('') || '<p class="muted">No holdings loaded.</p>';
}

function renderMarket(state){
  const rows = list(state.liveMarket).map(m => `<tr><td>${esc(m.symbol)}</td><td>$${fmt(m.price)}</td><td class="${tone(m.changePct)}">${pct(m.changePct)}</td><td class="${tone(m.perf5dPct)}">${pct(m.perf5dPct)}</td><td class="${tone(m.perf1mPct)}">${pct(m.perf1mPct)}</td><td class="${tone(m.perf3mPct)}">${pct(m.perf3mPct)}</td></tr>`).join('');
  $('market-table').innerHTML = `<table class="table"><thead><tr><th>Symbol</th><th>Price</th><th>Day</th><th>5D</th><th>1M</th><th>3M</th></tr></thead><tbody>${rows || '<tr><td colspan="6">No market tape loaded.</td></tr>'}</tbody></table>`;
}

function renderRates(state){
  const rows = list(state.liveRatesCredit).map(r=>`<tr><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td>${fmt(r.value)}</td><td>${esc(r.latestDate)}</td></tr>`).join('');
  $('rates-table').innerHTML = `<table class="table"><thead><tr><th>Series</th><th>Name</th><th>Value</th><th>Date</th></tr></thead><tbody>${rows || '<tr><td colspan="4">No rates data loaded.</td></tr>'}</tbody></table>`;
}

function renderSources(state){
  $('sources').innerHTML = list(state.globalInstitutionSources).map(s => `<article class="source"><h3>${esc(s.institution)}</h3><p>${esc(s.use)}</p><p class="muted">${esc(s.geography)} · ${esc(s.status)}</p></article>`).join('') || '<p class="muted">No source roadmap loaded.</p>';
}

function render(state){
  const marketRegime = state.marketRegime || {};
  const strategy = state.strategy || {};
  $('status').textContent = state.meta?.dataStatus || 'Unknown';
  $('generated').textContent = state.meta?.generatedAt ? new Date(state.meta.generatedAt).toLocaleString() : 'Generated time unavailable';
  $('confidence').textContent = marketRegime.confidence || 'Confidence unavailable';
  $('posture').textContent = marketRegime.posture || '-';
  $('risk').textContent = marketRegime.riskLevel || '-';
  $('macro').textContent = marketRegime.mostImportantMacroSignal || '-';
  $('strategy').textContent = strategy.strategyPosture || state.rebalance?.rationale || '-';
  $('strongest').textContent = strategy.strongestHolding || state.finalOutput?.strongestCurrentHolding || '-';
  $('weakest').textContent = strategy.weakestHolding || state.finalOutput?.weakestCurrentHolding || '-';
  $('highest-risk').textContent = strategy.highestRiskPosition || state.riskOfficer?.highestRiskPosition || '-';
  $('triggers').innerHTML = list(strategy.watchTriggers).map(t=>`<li>${esc(t)}</li>`).join('') || '<li>No triggers loaded.</li>';
  renderBrief(state); renderExposure(state); renderForces(state); renderMarketBoard(state); renderOpportunities(state); renderHoldings(state); renderMarket(state); renderRates(state); renderSources(state);
  $('notice').textContent = `Sources: ${list(state.meta?.liveDataSources).join(' · ') || 'source list unavailable'}. Public-data research system; not an automatic broker.`;
}

fetch(api).then(r => r.ok ? r.json() : Promise.reject()).catch(()=>fetch(fallback).then(r=>r.json())).then(render).catch(err=>{document.body.innerHTML='<main class="shell"><div class="panel"><h1>Capital Radar</h1><p>Could not load live data.</p><pre>'+esc(err)+'</pre></div></main>'});