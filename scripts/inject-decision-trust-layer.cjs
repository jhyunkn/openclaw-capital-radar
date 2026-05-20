const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (rel, fallback = null) => fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : fallback;
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) { console.error('DECISION TRUST LAYER FAILED: index.html missing'); process.exit(1); }
const state = read('data/report-state.live.json', {});
const dataHealth = read('outputs/data-health.json', {});
const ledger = read('outputs/source-reliability-ledger.json', { aggregate: {} });
const opps = read('outputs/opportunity-evidence-packets.json', { packets: [], priorityQueue: [] });
const orientation = read('outputs/market-orientation-map.json', { themes: [], directionalThesis: {} });
const list = v => Array.isArray(v) ? v : [];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
function scalar(v, fallback = 'pending') {
  if (v == null) return fallback;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => scalar(x, '')).filter(Boolean).join(' · ') || fallback;
  if (typeof v === 'object') return v.status || v.level || v.label || v.score || v.value || JSON.stringify(v);
  return String(v);
}
function tone(v){ const s=String(v??'').toLowerCase(); const n=num(v); if(/block|stale|missing|fail|forbid|trim|exit|protect|weak|risk|low/.test(s)) return 'bad'; if(/watch|review|partial|medium|verify|hold|mixed|gate/.test(s)) return 'warn'; if(/fresh|pass|high|allow|intact|good|strong/.test(s)) return 'good'; if(n!==null) return n<0?'bad':'good'; return 'warn'; }
function findHealth(ticker){ const rows = list(dataHealth.holdings || dataHealth.tickers || dataHealth.items || dataHealth.rows); return rows.find(x => String(x.ticker || x.symbol || '').toUpperCase() === ticker) || {}; }
function freshness(h){ const ticker = String(h.ticker || '').toUpperCase(); const dh = findHealth(ticker); const source = dh.source || h.source || h.dataContract?.source || state.meta?.priceSource || 'market data cache'; const asOf = dh.asOf || dh.fetchedAt || h.asOf || h.dataContract?.asOf || state.meta?.generatedAt || state.finalOutput?.generatedAt || 'unknown'; const status = dh.status || dh.freshness || h.dataContract?.freshness || 'daily refresh'; const conf = scalar(dh.confidence || h.dataContract?.confidence || h.interp?.dataConfidence?.status || ledger.aggregate?.sourceReliability, 'source confidence pending'); return { source: scalar(source), asOf: scalar(asOf), status: scalar(status), conf }; }
function rulePermission(h){ const weight = num(h.portfolioWeightPct) || 0; const oneM = num(h.perf1mPct); const day = num(h.dayChangePct); const valMissing = !h.dataContract?.notApplicable && !h.forwardPE && !h.peForward && !h.trailingPE && !h.fundamentals?.forwardPE; const rules = [];
  if (weight >= 18) rules.push('concentration cap active');
  if (oneM !== null && oneM < -8) rules.push('negative 1M trend');
  if (day !== null && day < -4) rules.push('daily drawdown review');
  if (valMissing) rules.push('valuation source missing');
  if (!rules.length) rules.push('no hard rule breach');
  const permission = rules.some(r => /cap|negative|drawdown|missing/.test(r)) ? 'NO ADD / VERIFY' : 'ADD ONLY AT RULED ZONE';
  return { permission, rules };
}
function holdingTrustBlock(h){ const f = freshness(h); const r = rulePermission(h); return `<div class="trust-layer ${tone(r.permission)}"><div><span>Rule permission</span><b>${esc(r.permission)}</b><small>${esc(r.rules.join(' · '))}</small></div><div><span>Data truth</span><b>${esc(f.status)} · ${esc(f.conf)}</b><small>${esc(f.source)} · ${esc(f.asOf)}</small></div></div>`; }
function inferMacroThesis(p){
  const text = `${p.ticker || ''} ${p.lane || ''} ${p.whyInteresting || ''}`.toLowerCase();
  const themes = list(orientation.themes);
  const matched = themes.find(t => {
    const hay = `${t.title || ''} ${list(t.dependencies).join(' ')} ${t.directionalBias || ''}`.toLowerCase();
    return hay.split(/\s+/).filter(Boolean).some(w => w.length > 4 && text.includes(w));
  });
  if (matched) return matched.title;
  if (/power|grid|nuclear|electric|energy|data.?center|cooling|turbine|uranium/.test(text)) return 'Power / AI infrastructure bottleneck';
  if (/ai|chip|accelerator|cloud|compute|server/.test(text)) return 'AI compute expansion';
  if (/bitcoin|crypto|treasury|stablecoin/.test(text)) return 'Bitcoin financialization / liquidity rails';
  if (/payment|financial|network/.test(text)) return 'Payments / financial infrastructure';
  return 'Macro thesis requires classification';
}
function agentRationale(p){
  const thesis = inferMacroThesis(p);
  const score = p.opportunityScore != null ? `score ${p.opportunityScore}` : 'unscored';
  const lane = String(p.lane || 'research').replace(/_/g, ' ');
  return `Agent-selected because ${lane} aligns with ${thesis}; ${score}; ticker analysis remains blocked until evidence gates are satisfied.`;
}
function oppUnblockCard(p){ const ticker = esc(p.ticker || p.symbol || 'candidate'); const missing = list(p.missingForPromotion).slice(0,3); const sources = list(p.requiredSources || p.sourcesNeeded || p.nextSources).slice(0,3); const lane = esc(String(p.lane || 'research').replace(/_/g,' ')); const thesis = inferMacroThesis(p); return `<article class="opp-card unblock-card"><div class="opp-head"><div><b>${ticker}</b><small>agent-selected · ${lane}</small></div><strong>${esc(p.opportunityScore ?? '—')}</strong></div><p>${esc(agentRationale(p))}</p><div class="opp-detail"><span>Macro thesis link</span><b>${esc(thesis)}</b></div><div class="opp-detail"><span>Ticker analysis read</span><b>${esc(p.whyInteresting || 'Candidate requires more evidence before promotion.')}</b></div><div class="opp-detail"><span>Blocked by</span><b>${esc(missing.join(' · ') || 'promotion evidence missing')}</b></div><div class="opp-detail"><span>Unblock source</span><b>${esc(sources.join(' · ') || 'primary filing / earnings transcript / pricing evidence')}</b></div><div class="opp-detail"><span>Agent task</span><b>Fetch source, confirm catalyst, define valuation zone, write invalidation.</b></div></article>`; }
let html = fs.readFileSync(indexPath, 'utf8');
for (const h of list(state.holdings)) {
  const ticker = String(h.ticker || '').toUpperCase();
  const re = new RegExp(`(<article class="strategy-card[\\s\\S]*?<h3>${ticker}<\\/h3>[\\s\\S]*?<div class="health-verdict">[\\s\\S]*?<\\/div>)`);
  html = html.replace(re, `$1${holdingTrustBlock(h)}`);
}
const packets = list(opps.packets).slice(0,6).map(oppUnblockCard).join('');
if (packets) html = html.replace(/(<div class="opportunity-grid">)/, `$1<div class="unblock-grid">${packets}</div>`);
const css = `<style id="decision-trust-layer-css">.trust-layer{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 13px}.trust-layer>div{border:1px solid rgba(36,35,31,.11);background:rgba(255,255,255,.18);padding:9px}.trust-layer span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(36,35,31,.5)}.trust-layer b{display:block;font-size:13px;line-height:1.2;margin-top:5px}.trust-layer small{display:block;font-size:11px;line-height:1.25;margin-top:5px;color:rgba(36,35,31,.58)}.unblock-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;width:100%;grid-column:1/-1}.unblock-card{border-left:4px solid #8a6a2c;background:rgba(255,255,255,.16)}.unblock-card .opp-detail b{font-size:12px;line-height:1.32}@media(max-width:760px){.trust-layer{grid-template-columns:1fr}}</style>`;
html = html.replace(/<style id="decision-trust-layer-css">[\s\S]*?<\/style>/, '');
html = html.replace('</head>', `${css}</head>`);
fs.writeFileSync(indexPath, html);
const out = { generatedAt: new Date().toISOString(), status: 'ACTIVE', holdings: list(state.holdings).map(h => ({ ticker: h.ticker, ...rulePermission(h), dataTruth: freshness(h) })), opportunities: list(opps.packets).slice(0,6).map(p => ({ ticker:p.ticker, agentSelected:true, macroThesis:inferMacroThesis(p), agentRationale:agentRationale(p), missingForPromotion:p.missingForPromotion || [], requiredSources:p.requiredSources || p.sourcesNeeded || [] })) };
for (const rel of ['outputs/decision-trust-layer.json','public/outputs/decision-trust-layer.json']) { const p=path.join(root,rel); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p, JSON.stringify(out,null,2)); }
console.log(`decision trust layer injected: ${out.holdings.length} holdings; ${out.opportunities.length} agent-selected opportunity unblock cards`);
