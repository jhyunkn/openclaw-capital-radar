const api = '/api/capital-radar';
const fallback = 'data/report-state.live.json';
const $ = id => document.getElementById(id);
const fmt = n => typeof n === 'number' ? n.toLocaleString(undefined,{maximumFractionDigits:2}) : 'n/a';
const pct = n => typeof n === 'number' ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : 'n/a';
const tone = n => typeof n !== 'number' ? '' : n >= 0 ? 'good' : 'bad';

function spark(values){
  if (!values?.length) return '';
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v,i)=>`${(i/(values.length-1))*100},${46-((v-min)/span)*40+3}`).join(' ');
  return `<svg class="spark" viewBox="0 0 100 52" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#d7a84c" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="0" y1="48" x2="100" y2="48" stroke="#312b20"/></svg>`;
}

function renderExposure(state){
  const max = Math.max(...state.strategy.exposureMap.map(x=>x.weightPct),1);
  $('exposure').innerHTML = state.strategy.exposureMap.map(x => `<div class="bar"><label>${x.bucket}</label><div class="bar-track"><div class="bar-fill" style="width:${(x.weightPct/max)*100}%"></div></div><strong>${fmt(x.weightPct)}%</strong></div>`).join('');
}

function renderHoldings(state){
  $('holdings').innerHTML = state.holdings.map(h => `<article class="card">
    <div class="ticker"><div><b>${h.ticker}</b><br><small>${h.exposureBucket}</small></div><div style="text-align:right"><b>$${fmt(h.livePrice)}</b><br><small class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</small></div></div>
    ${spark(h.sparkline)}
    <span class="signal ${h.computedSignal?.includes('EXIT')||h.computedSignal?.includes('TRIM')?'bad':h.computedSignal?.includes('WATCH')||h.computedSignal?.includes('INVEST')?'warn':'good'}">${h.computedSignal || h.signal}</span>
    <div class="rows">
      <div class="row"><span>Health score</span><b>${h.healthScore ?? 'n/a'}</b></div>
      <div class="row"><span>Weight</span><b>${fmt(h.portfolioWeightPct)}%</b></div>
      <div class="row"><span>Market value</span><b>$${fmt(h.marketValue)}</b></div>
      <div class="row"><span>1M / 3M</span><b class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</b> <b class="${tone(h.perf3mPct)}">${pct(h.perf3mPct)}</b></div>
    </div>
    <p style="margin-top:12px">${h.actionRationale}</p>
  </article>`).join('');
}

function renderMarket(state){
  const rows = state.liveMarket.map(m => `<tr><td>${m.symbol}</td><td>$${fmt(m.price)}</td><td class="${tone(m.changePct)}">${pct(m.changePct)}</td><td class="${tone(m.perf5dPct)}">${pct(m.perf5dPct)}</td><td class="${tone(m.perf1mPct)}">${pct(m.perf1mPct)}</td><td class="${tone(m.perf3mPct)}">${pct(m.perf3mPct)}</td></tr>`).join('');
  $('market-table').innerHTML = `<table class="table"><thead><tr><th>Symbol</th><th>Price</th><th>Day</th><th>5D</th><th>1M</th><th>3M</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderRates(state){
  $('rates-table').innerHTML = `<table class="table"><thead><tr><th>Series</th><th>Name</th><th>Value</th><th>Date</th></tr></thead><tbody>${state.liveRatesCredit.map(r=>`<tr><td>${r.id}</td><td>${r.name}</td><td>${fmt(r.value)}</td><td>${r.latestDate}</td></tr>`).join('')}</tbody></table>`;
}

function renderSources(state){
  $('sources').innerHTML = state.globalInstitutionSources.map(s => `<article class="source"><h3>${s.institution}</h3><p>${s.use}</p><p class="muted">${s.geography} · ${s.status}</p></article>`).join('');
}

function render(state){
  $('status').textContent = state.meta.dataStatus;
  $('generated').textContent = new Date(state.meta.generatedAt).toLocaleString();
  $('posture').textContent = state.marketRegime.posture;
  $('risk').textContent = state.marketRegime.riskLevel || '—';
  $('macro').textContent = state.marketRegime.mostImportantMacroSignal;
  $('strategy').textContent = state.strategy.strategyPosture;
  $('strongest').textContent = state.strategy.strongestHolding;
  $('weakest').textContent = state.strategy.weakestHolding;
  $('highest-risk').textContent = state.strategy.highestRiskPosition;
  $('triggers').innerHTML = state.strategy.watchTriggers.map(t=>`<li>${t}</li>`).join('');
  renderExposure(state); renderHoldings(state); renderMarket(state); renderRates(state); renderSources(state);
  $('notice').textContent = `Sources: ${(state.meta.liveDataSources||[]).join(' · ')}. Public-data research system; not an automatic broker.`;
}

fetch(api).then(r => r.ok ? r.json() : Promise.reject()).catch(()=>fetch(fallback).then(r=>r.json())).then(render).catch(err=>{document.body.innerHTML='<main class="shell"><div class="panel"><h1>Capital Radar</h1><p>Could not load live data.</p><pre>'+err+'</pre></div></main>'});