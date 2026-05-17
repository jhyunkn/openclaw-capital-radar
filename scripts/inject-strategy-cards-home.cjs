const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const strategy = fs.existsSync(interpPath) ? JSON.parse(fs.readFileSync(interpPath, 'utf8')) : { interpretations: [] };
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const interpretations = new Map((strategy.interpretations || []).map(x => [String(x.ticker || '').toUpperCase(), x]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function n(value){ const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; }
function fmt(value, digits=2){ const parsed = n(value); return Number.isFinite(parsed) ? parsed.toLocaleString(undefined,{maximumFractionDigits:digits}) : '—'; }
function price(value){ const parsed = n(value); return Number.isFinite(parsed) ? `$${parsed.toLocaleString(undefined,{maximumFractionDigits: parsed < 1 ? 4 : 2})}` : '—'; }
function pct(value){ const parsed = n(value); return Number.isFinite(parsed) ? `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%` : '—'; }
function tone(value){ const parsed = n(value); return !Number.isFinite(parsed) ? '' : parsed >= 0 ? 'good' : 'bad'; }
function signalTone(signal){ const s = String(signal || '').toUpperCase(); if(s.includes('EXIT') || s.includes('TRIM')) return 'bad'; if(s.includes('INVESTIGATE') || s.includes('WATCH')) return 'warn'; if(s.includes('ADD')) return 'blue'; return 'good'; }
function toneClass(value){ const tone = String(value || '').toLowerCase(); if (tone.includes('danger')) return 'bad'; if (tone.includes('caution')) return 'warn'; if (tone.includes('positive')) return 'good'; return 'neutral'; }
function valuationRelevant(i){ return i?.exposureType === 'equity'; }
function cleanMetric(value, relevant=true){ const parsed = n(value); if(!relevant) return 'Not applicable'; if(!Number.isFinite(parsed) || parsed === 0) return 'Unavailable'; return fmt(parsed); }
function shortBoundary(i){ const b = i?.nearestDecisionBoundary; if(!b || !Number.isFinite(b.distancePct)) return 'No band mapped'; return `${b.distancePct >= 0 ? '+' : ''}${b.distancePct.toFixed(2)}% to ${b.label}`; }
function decisionBand(i){
  const items = [
    ['Action permission', i?.actionPermission?.status || 'Hold / monitor', toneClass(i?.actionPermission?.tone)],
    ['Urgency', i?.urgency?.level || 'Monitor', toneClass(i?.urgency?.tone)],
    ['Thesis', i?.thesisStatus?.status || 'Unverified', toneClass(i?.thesisStatus?.tone)],
    ['Confidence', `${i?.decisionConfidence?.level || 'Medium'}${Number.isFinite(i?.decisionConfidence?.score) ? ` / ${i.decisionConfidence.score}` : ''}`, toneClass(i?.decisionConfidence?.tone)]
  ];
  return `<div class="strategy-decision-band">${items.map(([label,value,cls]) => `<span class="${cls}"><b>${esc(label)}</b><em>${esc(value)}</em></span>`).join('')}</div>`;
}
function factList(title, items, cls=''){
  const safe = Array.isArray(items) && items.length ? items : ['No material item detected.'];
  return `<div class="strategy-fact-list ${cls}"><b>${esc(title)}</b><ul>${safe.slice(0,3).map(item => `<li>${esc(item)}</li>`).join('')}</ul></div>`;
}
function card(h){
  const i = interpretations.get(String(h.ticker || '').toUpperCase()) || {};
  const sig = i.signal || h.computedSignal || h.signal || 'Review';
  const relevantValuation = valuationRelevant(i);
  const fpe = h.dataContract?.forwardPE ?? h.forwardPE ?? h.finviz?.metrics?.['Forward P/E'];
  const fcf = h.dataContract?.fcfYield ?? h.fcfYield;
  const pressure = i.positionPressure || {};
  const action = i.actionPermission || {};
  const thesis = i.thesisStatus || {};
  const conflict = i.portfolioConflict || {};
  return `<article class="strategy-card ${signalTone(sig)}"><div class="strategy-card-top"><div><span class="strategy-role">${esc(i.role || h.exposureBucket || h.role || 'Holding')}</span><h3>${esc(h.ticker)}</h3></div><div class="strategy-price"><b>${price(h.livePrice)}</b><span class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</span></div></div><div class="strategy-signal-row"><strong>${esc(sig)}</strong><em class="${toneClass(action.tone)}">${esc(action.status || 'Hold / monitor')}</em></div><p class="strategy-reason">${esc(action.reason || thesis.reason || h.actionRationale || 'No interpreted action reason available.')}</p>${decisionBand(i)}${factList('New information processed', i.newInformation, 'new-info')}<div class="strategy-grid"><div><span>Role</span><b>${esc(i.role || 'Unclassified')}</b></div><div><span>Nearest boundary</span><b>${esc(shortBoundary(i))}</b></div><div><span>Portfolio conflict</span><b class="${toneClass(conflict.tone)}">${esc(conflict.status || 'No major conflict')}</b></div><div><span>Position pressure</span><b class="${toneClass(pressure.tone)}">${esc(pressure.reason || 'Position pressure unavailable')}</b></div><div><span>Momentum</span><b><span class="${tone(h.perf5dPct)}">${pct(h.perf5dPct)}</span> / <span class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</span></b></div><div><span>Valuation read</span><b>${relevantValuation ? `PE ${cleanMetric(fpe)} · FCF ${cleanMetric(fcf)}${cleanMetric(fcf) === 'Unavailable' ? '' : '%'}` : 'Not applicable to this exposure'}</b></div><div><span>Data confidence</span><b class="${toneClass(i.dataConfidence?.tone)}">${esc(i.dataConfidence?.status || 'Unknown')}</b></div></div>${factList('Signal changes if', i.signalChangeConditions, 'change-conditions')}<a class="detail-link" href="pages/${esc(String(h.ticker).toLowerCase())}.html">Open strategy workbench →</a></article>`;
}
const css = `<style>.strategy-holdings{background:rgba(251,250,246,.1)}.strategy-intro{max-width:920px;margin:-14px 0 26px;color:var(--muted);font-size:16px}.strategy-card-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(330px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.strategy-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18);padding:20px;min-height:0;overflow:hidden}.strategy-card *{box-sizing:border-box;min-width:0}.strategy-card-top{display:flex;justify-content:space-between;gap:16px}.strategy-role{display:block;color:var(--muted);font-size:13px;line-height:1.25;overflow-wrap:anywhere}.strategy-card h3{font-size:44px;line-height:.9;letter-spacing:-.06em;font-weight:500;margin:8px 0 0}.strategy-price{text-align:right;flex:0 0 auto}.strategy-price b{display:block;font-size:28px;line-height:1;font-weight:500;letter-spacing:-.04em}.strategy-price span{font-size:13px}.strategy-signal-row{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:22px 0 12px}.strategy-signal-row strong{font-size:20px;line-height:1;border:1px solid var(--rule);border-radius:999px;padding:9px 12px;background:rgba(251,250,246,.44)}.strategy-signal-row em{font-style:normal;font-size:13px;text-align:right}.strategy-card.bad .strategy-signal-row strong{color:var(--red);border-color:rgba(159,63,53,.32)}.strategy-card.warn .strategy-signal-row strong{color:var(--warn);border-color:rgba(138,106,44,.32)}.strategy-card.good .strategy-signal-row strong{color:var(--green);border-color:rgba(47,111,78,.32)}.strategy-reason{font-size:16px;line-height:1.4;margin:0 0 16px;overflow-wrap:anywhere}.strategy-decision-band{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--rule2);border-left:1px solid var(--rule2);margin:16px 0}.strategy-decision-band span{border-right:1px solid var(--rule2);border-bottom:1px solid var(--rule2);padding:10px 8px;min-height:74px;overflow:hidden}.strategy-decision-band b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:500}.strategy-decision-band em{display:block;font-style:normal;font-size:12px;line-height:1.35;margin-top:8px;overflow-wrap:anywhere}.strategy-decision-band .good em,.strategy-grid .good{color:var(--green)}.strategy-decision-band .warn em,.strategy-grid .warn{color:var(--warn)}.strategy-decision-band .bad em,.strategy-grid .bad{color:var(--red)}.strategy-fact-list{border-top:1px solid var(--rule2);padding:12px 0}.strategy-fact-list b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);font-weight:500;margin-bottom:7px}.strategy-fact-list ul{margin:0;padding-left:16px}.strategy-fact-list li{font-size:12px;line-height:1.36;margin:4px 0;overflow-wrap:anywhere}.strategy-grid{display:grid;gap:0;border-top:1px solid var(--rule2)}.strategy-grid div{display:grid;grid-template-columns:minmax(100px,.75fr) minmax(0,1.25fr);gap:12px;border-bottom:1px solid var(--rule2);padding:9px 0;align-items:start}.strategy-grid span{color:var(--muted);font-size:13px}.strategy-grid b{text-align:right;font-size:13px;font-weight:600;overflow-wrap:anywhere;line-height:1.35}.strategy-card .detail-link{margin-top:18px}.holdings-grid.is-replaced{display:none!important}@media(max-width:760px){.strategy-card{min-height:auto}.strategy-card h3{font-size:36px}.strategy-decision-band{grid-template-columns:1fr 1fr}.strategy-grid div{grid-template-columns:1fr}.strategy-grid b{text-align:left;margin-top:2px}}</style>`;
const html = `<section id="holdings-section" class="panel strategy-holdings"><div class="section-head"><div><p class="eyebrow">Strategic Holdings</p><h2>Interpreted decision cards</h2></div></div><p class="strategy-intro">Each holding now passes through a Strategy Interpreter layer before rendering. The card separates raw market facts from interpreted action permission, urgency, thesis status, portfolio conflict, data confidence, and signal-change conditions.</p><div class="strategy-card-grid">${holdings.map(card).join('')}</div></section>`;
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
console.log(`injected ${holdings.length} interpreted strategic holding cards`);
