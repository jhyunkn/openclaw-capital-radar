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
const stress = read('outputs/market-stress-brief.json', {});
const list = v => Array.isArray(v) ? v : [];
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const pct = v => num(v) == null ? '—' : `${num(v) >= 0 ? '+' : ''}${num(v).toFixed(2)}%`;
function scalar(v, fallback = 'pending') {
  if (v == null) return fallback;
  if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
  if (Array.isArray(v)) return v.map(x => scalar(x, '')).filter(Boolean).join(' · ') || fallback;
  if (typeof v === 'object') return v.status || v.level || v.label || v.score || v.value || v.summary || v.reason || JSON.stringify(v);
  return String(v);
}
function tone(v){ const s=String(v??'').toLowerCase(); const n=num(v); if(/block|stale|missing|fail|forbid|trim|exit|protect|weak|risk|low|worried|shock/.test(s)) return 'bad'; if(/watch|review|partial|medium|verify|hold|mixed|gate|shift|unclear/.test(s)) return 'warn'; if(/fresh|pass|high|allow|intact|good|strong|focused|supported/.test(s)) return 'good'; if(n!==null) return n<0?'bad':'good'; return 'warn'; }
function byTicker(rows){ return Object.fromEntries(list(rows).map(x => [String(x.ticker || x.symbol || '').toUpperCase(), x])); }
const tapeBy = byTicker(state.liveMarket);
const rateBy = Object.fromEntries(list(state.liveRatesCredit).map(r => [r.id, r]));
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
function themeText(t){ return scalar(t.title || t.name || t.thesis || t.directionalBias || t.summary, 'unclassified theme'); }
function topThemes(){ const themes = list(orientation.themes).map(themeText).filter(Boolean); if (themes.length) return themes.slice(0,4); return ['AI infrastructure / compute demand', 'power and grid bottlenecks', 'liquidity and rates pressure', 'digital Treasury / crypto rails']; }
function inferMacroThesis(p){
  const text = `${p.ticker || ''} ${p.lane || ''} ${p.whyInteresting || ''}`.toLowerCase();
  const matched = list(orientation.themes).find(t => {
    const hay = `${t.title || ''} ${list(t.dependencies).join(' ')} ${t.directionalBias || ''}`.toLowerCase();
    return hay.split(/\s+/).filter(Boolean).some(w => w.length > 4 && text.includes(w));
  });
  if (matched) return themeText(matched);
  if (/power|grid|nuclear|electric|energy|data.?center|cooling|turbine|uranium/.test(text)) return 'Power / AI infrastructure bottleneck';
  if (/ai|chip|accelerator|cloud|compute|server/.test(text)) return 'AI compute expansion';
  if (/bitcoin|crypto|treasury|stablecoin/.test(text)) return 'Bitcoin financialization / liquidity rails';
  if (/payment|financial|network/.test(text)) return 'Payments / financial infrastructure';
  return 'Macro thesis requires classification';
}
function marketWorries(){ const worries = [];
  if (num(tapeBy['^VIX']?.changePct) > 5 || num(tapeBy['^VIX']?.price) > 18) worries.push('volatility repricing');
  if (num(rateBy.DGS10?.value) > 4.3) worries.push('higher-for-longer rates');
  if (num(tapeBy['BTC-USD']?.changePct) < -2) worries.push('crypto liquidity fade');
  worries.push('AI capex durability', 'energy/logistics shock risk', 'China–US policy friction');
  return worries.slice(0,5);
}
function financeShift(){ return ['Treasury-backed digital rails', 'AI capex moving into power/grid constraints', 'private credit and sovereign debt absorption', 'geopolitical supply-chain repricing']; }
function landscapeBrief(){
  const themes = topThemes();
  const worry = marketWorries();
  const shift = financeShift();
  const headline = scalar(orientation.directionalThesis?.summary || stress.headline || state.marketRegime?.mostImportantMacroSignal, 'Market direction requires institutional evidence refresh.');
  return `<section id="brief" data-section="1"><div class="section-label">01 / Market Landscape</div><div class="brief-layout landscape-lens"><div><h1>Market Landscape</h1><p class="brief-text">${esc(headline)}</p><p class="brief-subtext">Brief is the market-direction engine: it explains where capital is focused, what it is worried about, and what structural finance shift may be forming before the portfolio or opportunity sections act on it.</p></div><div class="landscape-grid"><article class="landscape-card good"><span>Market focused on</span><b>${esc(themes.join(' · '))}</b></article><article class="landscape-card bad"><span>Market worried about</span><b>${esc(worry.join(' · '))}</b></article><article class="landscape-card warn"><span>Global finance shift</span><b>${esc(shift.join(' · '))}</b></article><article class="landscape-card"><span>Evidence required</span><b>Fed / Treasury / IMF-BIS / energy agencies / bank strategy notes / earnings calls</b></article></div></div></section>`;
}
function agentRationale(p){ const thesis = inferMacroThesis(p); const score = p.opportunityScore != null ? `score ${p.opportunityScore}` : 'unscored'; const lane = String(p.lane || 'research').replace(/_/g, ' '); return `Next-bet candidate because ${lane} may be a second-order expression of ${thesis}; ${score}; remains blocked until evidence gates are satisfied.`; }
function oppUnblockCard(p){ const ticker = esc(p.ticker || p.symbol || 'candidate'); const missing = list(p.missingForPromotion).slice(0,3); const sources = list(p.requiredSources || p.sourcesNeeded || p.nextSources).slice(0,3); const lane = esc(String(p.lane || 'research').replace(/_/g,' ')); const thesis = inferMacroThesis(p); return `<article class="opp-card unblock-card"><div class="opp-head"><div><span>Next narrative candidate</span><b>${ticker}</b><small>${lane}</small></div><strong>${esc(p.opportunityScore ?? '—')}</strong></div><p>${esc(agentRationale(p))}</p><div class="opp-detail"><span>Derived from brief</span><b>${esc(thesis)}</b></div><div class="opp-detail"><span>Asymmetry read</span><b>${esc(p.whyInteresting || 'Candidate requires ticker evidence before promotion.')}</b></div><div class="opp-detail"><span>Blocked by</span><b>${esc(missing.join(' · ') || 'promotion evidence missing')}</b></div><div class="opp-detail"><span>Unblock source</span><b>${esc(sources.join(' · ') || 'primary filing / earnings transcript / pricing evidence')}</b></div><div class="opp-detail"><span>Promotion gate</span><b>Macro direction confirmed · ticker asymmetry proven · valuation zone defined · invalidation written</b></div></article>`; }
function opportunityIntro(){ return `<div class="opportunity-thesis"><span>Opportunity logic</span><b>Brief identifies market direction. Opportunity searches the next underpriced expression.</b><p>Agents should scope where capital may rotate next, not merely list popular tickers. Candidates remain research-only until macro thesis, ticker asymmetry, source proof, valuation zone, and invalidation are complete.</p></div>`; }
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<section id="brief"[\s\S]*?<section id="holdings"/, `${landscapeBrief()}<section id="holdings"`);
html = html.replace(/<div class="section-head"><h2>Macro Wave → Candidate → Promotion Gate<\/h2>[\s\S]*?<\/div><div class="opportunity-grid">/, `<div class="section-head"><h2>Next Narrative / Asymmetry</h2><p>Opportunity is downstream of the Brief: if the market is moving in a direction, this section asks what the next bet could be before it becomes consensus.</p></div>${opportunityIntro()}<div class="opportunity-grid">`);
for (const h of list(state.holdings)) {
  const ticker = String(h.ticker || '').toUpperCase();
  const re = new RegExp(`(<article class="strategy-card[\\s\\S]*?<h3>${ticker}<\\/h3>[\\s\\S]*?<div class="health-verdict">[\\s\\S]*?<\\/div>)`);
  html = html.replace(re, `$1${holdingTrustBlock(h)}`);
}
const packets = list(opps.packets).slice(0,6).map(oppUnblockCard).join('');
if (packets) html = html.replace(/(<div class="opportunity-grid">)/, `$1<div class="unblock-grid">${packets}</div>`);
html = html.replace(/\[object Object\]/g, 'structured confidence available');
const css = `<style id="decision-trust-layer-css">.trust-layer{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:0 0 13px}.trust-layer>div,.landscape-card,.opportunity-thesis{border:1px solid rgba(36,35,31,.11);background:rgba(255,255,255,.18);padding:12px}.trust-layer span,.landscape-card span,.opportunity-thesis span{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:rgba(36,35,31,.5)}.trust-layer b,.landscape-card b,.opportunity-thesis b{display:block;font-size:13px;line-height:1.25;margin-top:6px}.trust-layer small{display:block;font-size:11px;line-height:1.25;margin-top:5px;color:rgba(36,35,31,.58)}.landscape-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.landscape-card{border-radius:14px}.landscape-card b{font-size:14px}.opportunity-thesis{margin:0 0 14px;border-radius:16px}.opportunity-thesis p{font-size:13px;line-height:1.35;margin:8px 0 0;color:rgba(36,35,31,.62)}.unblock-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:12px;width:100%;grid-column:1/-1}.unblock-card{border-left:4px solid #8a6a2c;background:rgba(255,255,255,.16)}.unblock-card .opp-detail b{font-size:12px;line-height:1.32}@media(max-width:760px){.trust-layer,.landscape-grid{grid-template-columns:1fr}}</style>`;
html = html.replace(/<style id="decision-trust-layer-css">[\s\S]*?<\/style>/, '');
html = html.replace('</head>', `${css}</head>`);
fs.writeFileSync(indexPath, html);
const out = { generatedAt: new Date().toISOString(), status: 'ACTIVE', briefLogic: 'market-landscape-direction-engine', opportunityLogic: 'brief-derived-next-narrative-asymmetry-engine', marketFocusedOn: topThemes(), marketWorriedAbout: marketWorries(), globalFinanceShift: financeShift(), holdings: list(state.holdings).map(h => ({ ticker: h.ticker, ...rulePermission(h), dataTruth: freshness(h) })), opportunities: list(opps.packets).slice(0,6).map(p => ({ ticker:p.ticker, agentSelected:true, derivedFromBrief:inferMacroThesis(p), agentRationale:agentRationale(p), missingForPromotion:p.missingForPromotion || [], requiredSources:p.requiredSources || p.sourcesNeeded || [] })) };
for (const rel of ['outputs/decision-trust-layer.json','public/outputs/decision-trust-layer.json']) { const p=path.join(root,rel); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p, JSON.stringify(out,null,2)); }
console.log(`decision trust layer injected: market landscape brief; ${out.holdings.length} holdings; ${out.opportunities.length} brief-derived opportunity cards`);
