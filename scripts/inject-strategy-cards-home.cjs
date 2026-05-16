const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const notesDir = path.join(root, 'agent-notes', 'tickers');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = value => Array.isArray(value) ? value : [];
function n(value){ const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function fmt(value, digits=2){ const parsed = n(value); return Number.isFinite(parsed) ? parsed.toLocaleString(undefined,{maximumFractionDigits:digits}) : '—'; }
function price(value){ const parsed = n(value); return Number.isFinite(parsed) ? `$${parsed.toLocaleString(undefined,{maximumFractionDigits: parsed < 1 ? 4 : 2})}` : '—'; }
function pct(value){ const parsed = n(value); return Number.isFinite(parsed) ? `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%` : '—'; }
function tone(value){ const parsed = n(value); return !Number.isFinite(parsed) ? '' : parsed >= 0 ? 'good' : 'bad'; }
function signalTone(signal){ const s = String(signal || '').toUpperCase(); if(s.includes('EXIT') || s.includes('TRIM')) return 'bad'; if(s.includes('INVESTIGATE') || s.includes('WATCH')) return 'warn'; if(s.includes('ADD')) return 'blue'; return 'good'; }
function readNote(ticker){ const f = path.join(notesDir, `${String(ticker).toLowerCase()}.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f,'utf8')) : null; }
function exposureType(h){
  const ticker = String(h.ticker || '').toUpperCase();
  const text = `${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''}`.toLowerCase();
  if (['TSLT','CONL','TMF','TQQQ','SQQQ','SOXL','SOXS','BITX'].includes(ticker)) return 'levered';
  if (/levered|decay product|daily reset|2x|3x|option/i.test(text)) return 'levered';
  if (['IBIT','BITO','ETHE'].includes(ticker) || /crypto|bitcoin|ethereum/i.test(text)) return 'crypto';
  if (['SPY','QQQ','IWM','DIA','VTI','VOO'].includes(ticker) || /index|etf basket|broad market/i.test(text)) return 'index';
  return 'equity';
}
function riskCap(h){ return exposureType(h) === 'levered' || exposureType(h) === 'crypto' ? 5 : 15; }
function valuationRelevant(h){ return exposureType(h) === 'equity'; }
function cleanMetric(value, relevant=true){ const parsed = n(value); if(!relevant) return 'Not applicable'; if(!Number.isFinite(parsed) || parsed === 0) return 'Unavailable'; return fmt(parsed); }
function distance(current, target){ if(!(current > 0) || !(target > 0)) return null; return ((target-current)/current)*100; }
function nearest(current, values){ const nums = list(values).filter(v => typeof v === 'number' && Number.isFinite(v)); if(!nums.length || !(current > 0)) return null; return nums.map(v => ({ value:v, distancePct: distance(current,v) })).sort((a,b)=>Math.abs(a.distancePct)-Math.abs(b.distancePct))[0]; }
function actionDistances(h,note){ const current = n(h.livePrice); const map = note?.technicalMap || {}; const bands = [ ['add zone', nearest(current, map.buyZone), 'good'], ['support', nearest(current, map.supportLevels), 'good'], ['trim zone', nearest(current, map.trimZone), 'warn'], ['resistance', nearest(current, map.resistanceLevels), 'warn'], ['review line', nearest(current, map.stopZone), 'bad'] ].filter(([,item])=>item && Number.isFinite(item.distancePct)); return bands.sort((a,b)=>Math.abs(a[1].distancePct)-Math.abs(b[1].distancePct)); }
function canAdd(h, pressure){ const sig = String(h.computedSignal || h.signal || '').toUpperCase(); if (pressure.cls === 'bad' || pressure.cls === 'warn') return false; if (sig.includes('TRIM') || sig.includes('EXIT') || sig.includes('INVESTIGATE')) return false; return true; }
function nextTrigger(h,note,pressure){
  const nearestBand = actionDistances(h,note)[0];
  const signal = String(h.computedSignal || h.signal || '').toUpperCase();
  if(signal.includes('TRIM')) return 'Do not add. Watch for trim/rebalance if exposure or underlying volatility worsens.';
  if(signal.includes('EXIT')) return 'Do not add. Review exit conditions and thesis invalidation first.';
  if(signal.includes('INVESTIGATE')) return 'Do not act until thesis/data gap is resolved.';
  if(nearestBand){
    const [label,item] = nearestBand;
    if(label === 'add zone' && !canAdd(h, pressure)) return `Near add zone, but adding is blocked by ${pressure.label.toLowerCase()}.`;
    return `${label.toUpperCase()} is ${item.distancePct >= 0 ? '+' : ''}${item.distancePct.toFixed(2)}% away at ${price(item.value)}.`;
  }
  return note?.strategyProtocol?.doNothingIf?.[0] || 'Do nothing unless price enters an action band or thesis changes.';
}
function strategicReason(h,note){
  const signal = h.computedSignal || h.signal || 'Review';
  const weight = n(h.portfolioWeightPct);
  const cap = riskCap(h);
  const nearCap = Number.isFinite(weight) && weight >= cap * .85;
  const dataMissing = !h.dataContract || h.dataContract?.confidence?.forwardPE === 'missing' || h.dataContract?.confidence?.fcfYield === 'missing';
  const parts = [];
  if(nearCap) parts.push(`near ${cap}% risk cap`); else if(Number.isFinite(weight)) parts.push(`inside ${cap}% risk cap`);
  if(h.perf1mPct > 0 && h.perf3mPct > 0) parts.push('trend supportive'); else if(h.perf1mPct < 0 && h.perf3mPct < 0) parts.push('trend deteriorating'); else parts.push('trend mixed');
  if(dataMissing) parts.push('data gap exists');
  if(exposureType(h) === 'levered') parts.push('levered/decay risk dominates valuation');
  return `${signal}: ${parts.join(' · ')}.`;
}
function pressureLabel(h){ const weight = n(h.portfolioWeightPct); const cap = riskCap(h); if(!Number.isFinite(weight)) return { label:'Unknown pressure', detail:'Weight missing', cls:'warn' }; const ratio = weight / cap; if(ratio >= 1) return { label:'Over budget', detail:`${fmt(weight)}% / ${cap}% cap`, cls:'bad' }; if(ratio >= .85) return { label:'Near cap', detail:`${fmt(weight)}% / ${cap}% cap`, cls:'warn' }; return { label:'Inside budget', detail:`${fmt(weight)}% / ${cap}% cap`, cls:'good' }; }
function decisionBand(h,note,pressure){
  const current = n(h.livePrice);
  const map = note?.technicalMap || {};
  const add = nearest(current,map.buyZone);
  const trim = nearest(current,map.trimZone);
  const stop = nearest(current,map.stopZone);
  const items = [
    ['Do not add if', pressure.cls !== 'good' ? pressure.label : (note?.strategyProtocol?.doNothingIf?.[0] || 'outside mapped setup'), pressure.cls !== 'good' ? 'bad' : 'neutral'],
    ['Add only if', add ? `${price(add.value)} zone + risk budget clear` : 'add zone confirmed', canAdd(h, pressure) ? 'good' : 'neutral'],
    ['Trim if', trim ? `${price(trim.value)} or risk expands` : 'trim zone / risk expands', 'warn'],
    ['Review if', stop ? `${price(stop.value)} breaks` : 'thesis/data breaks', 'bad']
  ];
  return `<div class="strategy-decision-band">${items.map(([label,value,cls]) => `<span class="${cls}"><b>${esc(label)}</b><em>${esc(value)}</em></span>`).join('')}</div>`;
}
function constraintLine(h, pressure){
  const type = exposureType(h);
  if (pressure.cls !== 'good') return `${pressure.label}: adding is blocked until exposure is reduced or risk budget changes.`;
  if (type === 'levered') return 'Levered product: tactical only; valuation metrics are not the decision basis.';
  if (type === 'crypto') return 'Crypto-linked exposure: position sizing and liquidity regime dominate valuation.';
  return 'Eligible for hold/add review only if thesis, valuation, and action band agree.';
}
function card(h){
  const note = readNote(h.ticker);
  const sig = h.computedSignal || h.signal || 'Review';
  const pressure = pressureLabel(h);
  const relevantValuation = valuationRelevant(h);
  const fpe = h.dataContract?.forwardPE ?? h.forwardPE ?? h.finviz?.metrics?.['Forward P/E'];
  const fcf = h.dataContract?.fcfYield ?? h.fcfYield;
  const nearestBand = actionDistances(h,note)[0];
  return `<article class="strategy-card ${signalTone(sig)}"><div class="strategy-card-top"><div><span class="strategy-role">${esc(h.exposureBucket || h.role || 'Holding')}</span><h3>${esc(h.ticker)}</h3></div><div class="strategy-price"><b>${price(h.livePrice)}</b><span class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</span></div></div><div class="strategy-signal-row"><strong>${esc(sig)}</strong><em class="${pressure.cls}">${esc(pressure.label)}</em></div><p class="strategy-reason">${esc(strategicReason(h,note))}</p>${decisionBand(h,note,pressure)}<div class="strategy-grid"><div><span>Next trigger</span><b>${esc(nextTrigger(h,note,pressure))}</b></div><div><span>Nearest decision boundary</span><b>${nearestBand ? `${nearestBand[1].distancePct >= 0 ? '+' : ''}${nearestBand[1].distancePct.toFixed(2)}% to ${nearestBand[0]}` : 'No band mapped'}</b></div><div><span>Strategic constraint</span><b>${esc(constraintLine(h, pressure))}</b></div><div><span>Position pressure</span><b>${esc(pressure.detail)}</b></div><div><span>Momentum</span><b><span class="${tone(h.perf5dPct)}">${pct(h.perf5dPct)}</span> / <span class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</span></b></div><div><span>Valuation read</span><b>${relevantValuation ? `PE ${cleanMetric(fpe)} · FCF ${cleanMetric(fcf)}${cleanMetric(fcf) === 'Unavailable' ? '' : '%'}` : 'Not applicable to this exposure'}</b></div><div><span>Data confidence</span><b>${esc(h.dataContract?.confidence?.forwardPE || 'missing')} / ${esc(h.dataContract?.confidence?.nextEarningsDate || 'missing')}</b></div></div><p class="strategy-next">${esc(note?.strategyProtocol?.doNothingIf?.[0] || h.watch || 'Wait for a mapped trigger before reacting.')}</p><a class="detail-link" href="pages/${esc(String(h.ticker).toLowerCase())}.html">Open strategy workbench →</a></article>`;
}
const css = `<style>.strategy-holdings{background:rgba(251,250,246,.1)}.strategy-intro{max-width:920px;margin:-14px 0 26px;color:var(--muted);font-size:16px}.strategy-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.strategy-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18);padding:20px;min-height:0;overflow:hidden}.strategy-card *{box-sizing:border-box;min-width:0}.strategy-card-top{display:flex;justify-content:space-between;gap:16px}.strategy-role{display:block;color:var(--muted);font-size:13px;line-height:1.25;overflow-wrap:anywhere}.strategy-card h3{font-size:44px;line-height:.9;letter-spacing:-.06em;font-weight:500;margin:8px 0 0}.strategy-price{text-align:right;flex:0 0 auto}.strategy-price b{display:block;font-size:28px;line-height:1;font-weight:500;letter-spacing:-.04em}.strategy-price span{font-size:13px}.strategy-signal-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:22px 0 12px}.strategy-signal-row strong{font-size:20px;line-height:1;border:1px solid var(--rule);border-radius:999px;padding:9px 12px;background:rgba(251,250,246,.44)}.strategy-signal-row em{font-style:normal;font-size:13px;text-align:right}.strategy-card.bad .strategy-signal-row strong{color:var(--red);border-color:rgba(159,63,53,.32)}.strategy-card.warn .strategy-signal-row strong{color:var(--warn);border-color:rgba(138,106,44,.32)}.strategy-card.good .strategy-signal-row strong{color:var(--green);border-color:rgba(47,111,78,.32)}.strategy-reason{font-size:16px;line-height:1.4;margin:0 0 16px;overflow-wrap:anywhere}.strategy-decision-band{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--rule2);border-left:1px solid var(--rule2);margin:16px 0}.strategy-decision-band span{border-right:1px solid var(--rule2);border-bottom:1px solid var(--rule2);padding:10px 8px;min-height:82px;overflow:hidden}.strategy-decision-band b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:500}.strategy-decision-band em{display:block;font-style:normal;font-size:12px;line-height:1.35;margin-top:8px;overflow-wrap:anywhere}.strategy-decision-band .good em{color:var(--green)}.strategy-decision-band .warn em{color:var(--warn)}.strategy-decision-band .bad em{color:var(--red)}.strategy-grid{display:grid;gap:0;border-top:1px solid var(--rule2)}.strategy-grid div{display:grid;grid-template-columns:minmax(100px,.75fr) minmax(0,1.25fr);gap:12px;border-bottom:1px solid var(--rule2);padding:9px 0;align-items:start}.strategy-grid span{color:var(--muted);font-size:13px}.strategy-grid b{text-align:right;font-size:13px;font-weight:600;overflow-wrap:anywhere;line-height:1.35}.strategy-next{margin-top:14px;color:var(--muted);font-size:14px;line-height:1.42;overflow-wrap:anywhere}.strategy-card .detail-link{margin-top:18px}.holdings-grid.is-replaced{display:none!important}@media(max-width:760px){.strategy-card{min-height:auto}.strategy-card h3{font-size:36px}.strategy-decision-band{grid-template-columns:1fr 1fr}.strategy-grid div{grid-template-columns:1fr}.strategy-grid b{text-align:left;margin-top:2px}}</style>`;
const html = `<section id="holdings-section" class="panel strategy-holdings"><div class="section-head"><div><p class="eyebrow">Strategic Holdings</p><h2>Decision cards, not data cards</h2></div></div><p class="strategy-intro">Each holding is organized around the decision: current posture, reason, next trigger, nearest decision boundary, strategic constraint, risk-budget pressure, valuation relevance, and data confidence. Raw facts are kept only when they support a strategic reaction.</p><div class="strategy-card-grid">${holdings.map(card).join('')}</div></section>`;
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let index = fs.readFileSync(indexPath,'utf8');
index = index.replace(/<style>\.strategy-holdings[\s\S]*?<\/style>/,'');
index = index.replace(/<section id="holdings-section" class="panel strategy-holdings"[\s\S]*?<section id="opportunities-section"/, '<section id="opportunities-section"');
index = index.replace('</head>', `${css}</head>`);
if(index.includes('<section id="holdings-section"')){
  index = index.replace(/<section id="holdings-section"[\s\S]*?<section id="opportunities-section"/, `${html}<section id="opportunities-section"`);
} else {
  index = index.replace('<section id="opportunities-section"', `${html}<section id="opportunities-section"`);
}
fs.writeFileSync(indexPath,index);
console.log(`injected ${holdings.length} strategic holding decision cards`);
