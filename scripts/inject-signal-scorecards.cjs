const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const pagesDir = path.join(root, 'pages');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const holdings = Array.isArray(state.holdings) ? state.holdings : [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

function n(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
function clamp(value, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value));
}
function has(value) {
  return value !== null && value !== undefined && value !== '';
}
function status(score) {
  if (score >= 70) return 'supportive';
  if (score >= 45) return 'mixed';
  return 'weak';
}
function scoreTrend(h) {
  const day = n(h.dayChangePct);
  const perf5d = n(h.perf5dPct);
  const perf1m = n(h.perf1mPct);
  const perf3m = n(h.perf3mPct);
  const values = [day, perf5d, perf1m, perf3m].filter(Number.isFinite);
  if (!values.length) return { score: 40, status: 'mixed', finding: 'Trend data missing; do not overread signal.' };
  const weighted = (day || 0) * .12 + (perf5d || 0) * .22 + (perf1m || 0) * .33 + (perf3m || 0) * .33;
  const score = clamp(50 + weighted * 2.4);
  return { score, status: status(score), finding: `Day ${fmtPct(day)}, 5D ${fmtPct(perf5d)}, 1M ${fmtPct(perf1m)}, 3M ${fmtPct(perf3m)}.` };
}
function scoreValuation(h) {
  const fpe = n(h.dataContract?.forwardPE ?? h.forwardPE ?? h.finviz?.parsed?.forwardPE ?? h.finviz?.metrics?.['Forward P/E']);
  const fcf = n(h.dataContract?.fcfYield ?? h.fcfYield);
  if (!Number.isFinite(fpe) && !Number.isFinite(fcf)) return { score: 35, status: 'weak', finding: 'Forward PE and FCF yield are missing; valuation confidence is weak.' };
  let score = 50;
  if (Number.isFinite(fpe)) score += fpe < 18 ? 20 : fpe < 30 ? 8 : fpe < 50 ? -5 : -18;
  if (Number.isFinite(fcf)) score += fcf > 5 ? 18 : fcf > 2 ? 8 : fcf > 0 ? -4 : -12;
  score = clamp(score);
  return { score, status: status(score), finding: `Forward PE ${Number.isFinite(fpe) ? fpe.toFixed(2) : 'missing'}; FCF yield ${Number.isFinite(fcf) ? fcf.toFixed(2) + '%' : 'missing'}.` };
}
function scoreConcentration(h) {
  const weight = n(h.portfolioWeightPct);
  if (!Number.isFinite(weight)) return { score: 45, status: 'mixed', finding: 'Portfolio weight missing; concentration cannot be verified.' };
  const speculative = /lever|speculative|tactical|crypto|option/i.test(`${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''} ${h.ticker || ''}`);
  const cap = speculative ? 5 : 15;
  const score = clamp(100 - Math.max(0, weight - cap) * 12 - (weight / cap) * 25);
  return { score, status: status(score), finding: `${weight.toFixed(2)}% position versus ${cap}% ${speculative ? 'speculative/levered' : 'single non-index'} budget.` };
}
function scoreEventRisk(h) {
  const earnings = h.dataContract?.nextEarningsDate || h.nextEarningsDate || h.earningsDate;
  if (!earnings) return { score: 42, status: 'mixed', finding: 'Next earnings date missing; event-risk watch is incomplete.' };
  const days = tradingDaysUntil(new Date(earnings));
  const score = days == null ? 45 : days <= 5 ? 35 : days <= 15 ? 55 : 75;
  return { score, status: status(score), finding: days == null ? `Earnings date ${earnings}; timing unclear.` : `Next earnings in ${days} trading days.` };
}
function scoreLiquidity(h) {
  const p = h.finviz?.parsed || {};
  const rel = n(p.relVolume);
  const avg = n(p.avgVolume);
  const shortFloat = n(p.shortFloat);
  if (!Number.isFinite(rel) && !Number.isFinite(avg)) return { score: 45, status: 'mixed', finding: 'Volume data missing; liquidity confidence is limited.' };
  let score = 55;
  if (Number.isFinite(avg)) score += avg > 10000000 ? 20 : avg > 1000000 ? 10 : -10;
  if (Number.isFinite(rel)) score += rel > 1.2 ? 8 : rel < .6 ? -8 : 0;
  if (Number.isFinite(shortFloat)) score += shortFloat > 12 ? -12 : shortFloat > 6 ? -5 : 4;
  score = clamp(score);
  return { score, status: status(score), finding: `Rel vol ${Number.isFinite(rel) ? rel.toFixed(2) + 'x' : 'missing'}; avg volume ${Number.isFinite(avg) ? avg.toLocaleString() : 'missing'}; short float ${Number.isFinite(shortFloat) ? shortFloat.toFixed(2) + '%' : 'missing'}.` };
}
function scoreMacro(h) {
  const affected = (state.strategy?.marketForces || []).filter(force => Array.isArray(force.affected) && force.affected.includes(h.ticker));
  if (!affected.length) return { score: 55, status: 'mixed', finding: 'No explicit macro force mapped; sensitivity is not classified.' };
  const intensity = affected.reduce((sum, force) => sum + Number(force.intensity || 0), 0) / affected.length;
  const negatives = affected.filter(force => /pressure|drag|risk|tight|higher|stress|negative/i.test(`${force.direction || ''} ${force.interpretation || ''}`)).length;
  const score = clamp(65 - negatives * 12 - intensity * 4 + Math.max(0, affected.length - negatives) * 4);
  return { score, status: status(score), finding: affected.map(force => `${force.name}: ${force.direction}`).join(' · ') };
}
function scoreThesis(h) {
  const text = `${h.thesis || ''} ${h.actionRationale || ''} ${h.watch || ''}`.trim();
  let score = text.length > 220 ? 72 : text.length > 90 ? 60 : 38;
  if (/invalidat|watch|trim|exit|risk|below|above|if/i.test(text)) score += 8;
  score = clamp(score);
  return { score, status: status(score), finding: text.length ? 'Thesis/rationale exists; review whether it includes an explicit invalidation condition.' : 'No thesis/rationale loaded.' };
}
function scoreData(h) {
  const fields = ['forwardPE', 'fcfYield', 'nextEarningsDate'];
  const complete = fields.filter(field => has(h.dataContract?.[field])).length;
  const priceAvailable = has(h.livePrice);
  const score = clamp((complete / fields.length) * 70 + (priceAvailable ? 20 : 0));
  return { score, status: status(score), finding: `${complete}/${fields.length} contract fields complete; price ${priceAvailable ? 'available' : 'missing'}.` };
}
function fmtPct(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : 'missing';
}
function tradingDaysUntil(target) {
  if (!(target instanceof Date) || !Number.isFinite(target.getTime())) return null;
  const today = new Date();
  today.setHours(0,0,0,0);
  target.setHours(0,0,0,0);
  if (target < today) return null;
  let days = 0;
  const cursor = new Date(today);
  while (cursor < target) {
    cursor.setDate(cursor.getDate() + 1);
    const d = cursor.getDay();
    if (d !== 0 && d !== 6) days += 1;
  }
  return days;
}
function scorecard(h) {
  const factors = [
    ['Price trend', scoreTrend(h)],
    ['Valuation', scoreValuation(h)],
    ['Portfolio concentration', scoreConcentration(h)],
    ['Earnings / event risk', scoreEventRisk(h)],
    ['Liquidity / flow', scoreLiquidity(h)],
    ['Macro sensitivity', scoreMacro(h)],
    ['Thesis confidence', scoreThesis(h)],
    ['Data completeness', scoreData(h)]
  ];
  const weighted = factors.reduce((sum, [, item]) => sum + item.score, 0) / factors.length;
  const weakest = factors.slice().sort((a, b) => a[1].score - b[1].score)[0];
  const strongest = factors.slice().sort((a, b) => b[1].score - a[1].score)[0];
  return { factors, weighted: Math.round(weighted), weakest, strongest };
}
function scorecardHtml(h) {
  const card = scorecard(h);
  return `<section class="section scorecard-section"><div class="section-head"><div><p class="eyebrow">Signal Scorecard</p><h2>Why this signal exists</h2></div></div><div class="score-summary"><article><span>Composite</span><b class="${status(card.weighted)}">${card.weighted}</b><p>Rule-based diagnostic score. It explains the signal; it does not override the portfolio signal.</p></article><article><span>Strongest support</span><b>${esc(card.strongest[0])}</b><p>${esc(card.strongest[1].finding)}</p></article><article><span>Weakest link</span><b>${esc(card.weakest[0])}</b><p>${esc(card.weakest[1].finding)}</p></article></div><div class="score-grid">${card.factors.map(([label, item]) => `<article class="score-factor ${item.status}"><div><span>${esc(label)}</span><b>${Math.round(item.score)}</b></div><i><em style="width:${Math.round(item.score)}%"></em></i><p>${esc(item.finding)}</p></article>`).join('')}</div><p class="bodyline"><b>Interpretation discipline:</b> low factor scores should create review questions before adding capital. They do not automatically force selling unless they align with action bands, thesis invalidation, or portfolio risk budget.</p></section>`;
}

const scorecardCss = `.scorecard-section{background:#ffffff}.score-summary{display:grid;grid-template-columns:.7fr 1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:22px}.score-summary article{padding:22px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff}.score-summary span,.score-factor span{display:block;color:var(--muted);font-size:14px;margin-bottom:10px}.score-summary b{display:block;font-size:clamp(30px,3.2vw,56px);font-weight:500;letter-spacing:-.055em;line-height:.95;margin-bottom:12px}.score-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.score-factor{padding:18px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff;min-height:182px}.score-factor div{display:flex;justify-content:space-between;gap:12px;align-items:start}.score-factor b{font-size:34px;line-height:.95;font-weight:500;letter-spacing:-.05em}.score-factor i{display:block;height:7px;border-radius:999px;background:var(--rule2);overflow:hidden;margin:16px 0}.score-factor i em{display:block;height:100%;border-radius:999px;background:var(--muted)}.score-factor.supportive i em,.supportive{color:var(--green)!important}.score-factor.supportive i em{background:var(--green)}.score-factor.mixed i em,.mixed{color:var(--warn)!important}.score-factor.mixed i em{background:var(--warn)}.score-factor.weak i em,.weak{color:var(--red)!important}.score-factor.weak i em{background:var(--red)}.score-factor p{font-size:14px;color:rgba(36,35,31,.82)}@media(max-width:1100px){.score-summary,.score-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.score-summary,.score-grid{grid-template-columns:1fr}}`;

for (const h of holdings) {
  const pagePath = path.join(pagesDir, `${String(h.ticker).toLowerCase()}.html`);
  if (!fs.existsSync(pagePath)) continue;
  let html = fs.readFileSync(pagePath, 'utf8');
  html = html.replace(/<section class="section scorecard-section">[\s\S]*?<p class="bodyline"><b>Interpretation discipline:<\/b>[\s\S]*?<\/section>/, '');
  if (!html.includes('.scorecard-section')) {
    html = html.replace('</style>', `${scorecardCss}</style>`);
  }
  const insertion = scorecardHtml(h);
  const marker = '<section class="section"><div class="section-head"><div><p class="eyebrow">Action bands</p><h2>Numbers to act around</h2></div></div>';
  if (html.includes(marker)) {
    html = html.replace(marker, `${insertion}${marker}`);
  } else {
    html = html.replace('</header>', `</header>${insertion}`);
  }
  fs.writeFileSync(pagePath, html);
}
console.log(`injected signal scorecards into ${holdings.length} ticker workspaces`);
