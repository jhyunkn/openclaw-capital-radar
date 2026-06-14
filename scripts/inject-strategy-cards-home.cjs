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
function price(value){ const parsed = n(value); return Number.isFinite(parsed) ? `$${parsed.toLocaleString(undefined,{maximumFractionDigits: parsed < 1 ? 4 : 2})}` : '—'; }
function pct(value){ const parsed = n(value); return Number.isFinite(parsed) ? `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%` : '—'; }
function tone(value){ const parsed = n(value); return !Number.isFinite(parsed) ? '' : parsed >= 0 ? 'good' : 'bad'; }
function signalTone(signal){ const s = String(signal || '').toUpperCase(); if(s.includes('EXIT') || s.includes('TRIM')) return 'bad'; if(s.includes('INVESTIGATE') || s.includes('WATCH')) return 'warn'; if(s.includes('ADD')) return 'good'; return 'neutral'; }
function toneClass(value){ const t = String(value || '').toLowerCase(); if (t.includes('danger')) return 'bad'; if (t.includes('caution')) return 'warn'; if (t.includes('positive')) return 'good'; return 'neutral'; }
function shortBoundary(i){ const b = i?.nearestDecisionBoundary; if(!b || !Number.isFinite(b.distancePct)) return 'No band mapped'; return `${b.distancePct >= 0 ? '+' : ''}${b.distancePct.toFixed(2)}% to ${b.label}`; }
function oneLine(value, fallback='No interpreted reason available.'){
  return esc(String(value || fallback).replace(/\s+/g, ' ').trim());
}
function card(h){
  const ticker = String(h.ticker || '').toUpperCase();
  const i = interpretations.get(ticker) || {};
  const sig = i.signal || h.computedSignal || h.signal || 'Review';
  const action = i.actionPermission || {};
  const thesis = i.thesisStatus || {};
  const conflict = i.portfolioConflict || {};
  const conf = i.decisionConfidence || {};
  const role = i.role || h.exposureBucket || h.role || 'Holding';
  const reason = action.reason || thesis.reason || h.actionRationale;
  return `<a class="ticker-matrix-card ${signalTone(sig)}" href="pages/${esc(ticker.toLowerCase())}.html"><div class="tm-top"><div><span>${esc(role)}</span><b>${esc(ticker)}</b></div><em>${esc(sig)}</em></div><div class="tm-price"><strong>${price(h.livePrice)}</strong><span class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</span></div><div class="tm-strip"><span>5D <b class="${tone(h.perf5dPct)}">${pct(h.perf5dPct)}</b></span><span>1M <b class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</b></span><span>Wt <b>${Number.isFinite(n(h.weightPct)) ? `${n(h.weightPct).toFixed(2)}%` : '—'}</b></span></div><div class="tm-read"><span class="${toneClass(action.tone)}">${esc(action.status || 'Hold / monitor')}</span><p>${oneLine(reason)}</p></div><div class="tm-meta"><span>${esc(shortBoundary(i))}</span><span class="${toneClass(conflict.tone)}">${esc(conflict.status || 'No major conflict')}</span><span class="${toneClass(conf.tone)}">${esc(conf.level || 'Medium')} confidence</span></div></a>`;
}
const css = `<style id="ticker-matrix-css">.strategy-holdings{background:#ffffff}.strategy-intro{max-width:980px;margin:-12px 0 22px;color:var(--muted);font-size:15px;line-height:1.45}.ticker-matrix{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.ticker-matrix-card{display:flex;flex-direction:column;gap:12px;min-height:238px;padding:16px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff;text-decoration:none;color:inherit;overflow:hidden}.ticker-matrix-card:hover{background:#ffffff}.tm-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.tm-top span{display:block;color:var(--muted);font-size:11px;line-height:1.25;max-width:150px}.tm-top b{display:block;font-size:34px;line-height:.9;letter-spacing:-.06em;margin-top:7px}.tm-top em{font-style:normal;border:1px solid var(--rule);border-radius:999px;padding:6px 8px;font-size:10px;text-transform:uppercase;letter-spacing:.06em;text-align:right;max-width:116px}.ticker-matrix-card.bad .tm-top em{color:var(--red);border-color:rgba(159,63,53,.34)}.ticker-matrix-card.warn .tm-top em{color:var(--warn);border-color:rgba(138,106,44,.34)}.ticker-matrix-card.good .tm-top em{color:var(--green);border-color:rgba(47,111,78,.34)}.tm-price{display:flex;justify-content:space-between;align-items:baseline;gap:12px}.tm-price strong{font-size:24px;letter-spacing:-.04em}.tm-price span{font-size:13px}.tm-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border-top:1px solid var(--rule2);border-left:1px solid var(--rule2)}.tm-strip span{padding:8px;border-right:1px solid var(--rule2);border-bottom:1px solid var(--rule2);font-size:11px;color:var(--muted)}.tm-strip b{display:block;font-size:13px;color:var(--ink);margin-top:3px}.tm-read{border-top:1px solid var(--rule2);padding-top:10px}.tm-read span{display:inline-flex;font-size:12px;font-weight:600;margin-bottom:7px}.tm-read p{font-size:13px;line-height:1.35;color:rgba(36,35,31,.82);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}.tm-meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:auto}.tm-meta span{border:1px solid var(--rule2);border-radius:999px;padding:5px 7px;font-size:10px;color:var(--muted);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.holdings-grid.is-replaced{display:none!important}@media(max-width:640px){.ticker-matrix{grid-template-columns:1fr}.ticker-matrix-card{min-height:auto}.tm-top b{font-size:32px}}</style>`;
const html = `<section id="holdings-section" class="panel strategy-holdings"><div class="section-head"><div><p class="eyebrow">Strategic Holdings</p><h2>Front-page ticker matrix</h2></div></div><p class="strategy-intro">Compact view of each holding: price, day/5D/1M movement, portfolio weight, permission state, nearest boundary, conflict, and why the signal exists. Open the ticker page only when deeper workbench detail is needed.</p><div class="ticker-matrix">${holdings.map(card).join('')}</div></section>`;
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let index = fs.readFileSync(indexPath,'utf8');
index = index.replace(/<style id="ticker-matrix-css">[\s\S]*?<\/style>/,'');
index = index.replace(/<style>\.strategy-holdings[\s\S]*?<\/style>/,'');
index = index.replace(/<section id="holdings-section" class="panel strategy-holdings"[\s\S]*?(?=<section id="opportunities-section")/, '');
index = index.replace('</head>', `${css}</head>`);
if(index.includes('<section id="opportunities-section"')){
  index = index.replace('<section id="opportunities-section"', `${html}<section id="opportunities-section"`);
} else {
  index = index.replace('</main>', `${html}</main>`);
}
fs.writeFileSync(indexPath,index);
console.log(`injected ${holdings.length} compact front-page ticker cards`);
