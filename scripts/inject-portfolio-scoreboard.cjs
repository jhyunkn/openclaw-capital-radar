const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const outputPath = path.join(root, 'outputs', 'portfolio-scoreboard.json');
const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
const holdings = Array.isArray(state.holdings) ? state.holdings : [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const n = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const has = value => value !== null && value !== undefined && value !== '';
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const list = value => Array.isArray(value) ? value : [];
function status(score) {
  if (score >= 70) return 'supportive';
  if (score >= 45) return 'mixed';
  return 'weak';
}
function fmtPct(value) {
  return Number.isFinite(value) ? `${value >= 0 ? '+' : ''}${value.toFixed(2)}%` : 'missing';
}
function scoreTrend(h) {
  const day = n(h.dayChangePct), perf5d = n(h.perf5dPct), perf1m = n(h.perf1mPct), perf3m = n(h.perf3mPct);
  const values = [day, perf5d, perf1m, perf3m].filter(Number.isFinite);
  if (!values.length) return { score: 40, finding: 'Trend data missing.' };
  const weighted = (day || 0) * .12 + (perf5d || 0) * .22 + (perf1m || 0) * .33 + (perf3m || 0) * .33;
  const score = clamp(50 + weighted * 2.4);
  return { score, finding: `Day ${fmtPct(day)}, 5D ${fmtPct(perf5d)}, 1M ${fmtPct(perf1m)}, 3M ${fmtPct(perf3m)}.` };
}
function scoreValuation(h) {
  const fpe = n(h.dataContract?.forwardPE ?? h.forwardPE ?? h.finviz?.parsed?.forwardPE ?? h.finviz?.metrics?.['Forward P/E']);
  const fcf = n(h.dataContract?.fcfYield ?? h.fcfYield);
  if (!Number.isFinite(fpe) && !Number.isFinite(fcf)) return { score: 35, finding: 'Forward PE and FCF yield missing.' };
  let score = 50;
  if (Number.isFinite(fpe)) score += fpe < 18 ? 20 : fpe < 30 ? 8 : fpe < 50 ? -5 : -18;
  if (Number.isFinite(fcf)) score += fcf > 5 ? 18 : fcf > 2 ? 8 : fcf > 0 ? -4 : -12;
  return { score: clamp(score), finding: `Forward PE ${Number.isFinite(fpe) ? fpe.toFixed(2) : 'missing'}; FCF yield ${Number.isFinite(fcf) ? fcf.toFixed(2) + '%' : 'missing'}.` };
}
function scoreConcentration(h) {
  const weight = n(h.portfolioWeightPct);
  if (!Number.isFinite(weight)) return { score: 45, finding: 'Portfolio weight missing.' };
  const speculative = /lever|speculative|tactical|crypto|option/i.test(`${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''} ${h.ticker || ''}`);
  const cap = speculative ? 5 : 15;
  const score = clamp(100 - Math.max(0, weight - cap) * 12 - (weight / cap) * 25);
  return { score, finding: `${weight.toFixed(2)}% versus ${cap}% ${speculative ? 'speculative/levered' : 'single non-index'} budget.` };
}
function tradingDaysUntil(value) {
  if (!value) return null;
  const target = new Date(value);
  if (!Number.isFinite(target.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
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
function scoreEventRisk(h) {
  const earnings = h.dataContract?.nextEarningsDate || h.nextEarningsDate || h.earningsDate;
  if (!earnings) return { score: 42, finding: 'Next earnings date missing.' };
  const days = tradingDaysUntil(earnings);
  const score = days == null ? 45 : days <= 5 ? 35 : days <= 15 ? 55 : 75;
  return { score, finding: days == null ? `Earnings date ${earnings}; timing unclear.` : `Next earnings in ${days} trading days.` };
}
function scoreLiquidity(h) {
  const p = h.finviz?.parsed || {};
  const rel = n(p.relVolume), avg = n(p.avgVolume), shortFloat = n(p.shortFloat);
  if (!Number.isFinite(rel) && !Number.isFinite(avg)) return { score: 45, finding: 'Volume data missing.' };
  let score = 55;
  if (Number.isFinite(avg)) score += avg > 10000000 ? 20 : avg > 1000000 ? 10 : -10;
  if (Number.isFinite(rel)) score += rel > 1.2 ? 8 : rel < .6 ? -8 : 0;
  if (Number.isFinite(shortFloat)) score += shortFloat > 12 ? -12 : shortFloat > 6 ? -5 : 4;
  return { score: clamp(score), finding: `Rel vol ${Number.isFinite(rel) ? rel.toFixed(2) + 'x' : 'missing'}; avg volume ${Number.isFinite(avg) ? avg.toLocaleString() : 'missing'}; short float ${Number.isFinite(shortFloat) ? shortFloat.toFixed(2) + '%' : 'missing'}.` };
}
function scoreMacro(h) {
  const affected = list(state.strategy?.marketForces).filter(force => list(force.affected).includes(h.ticker));
  if (!affected.length) return { score: 55, finding: 'No explicit macro force mapped.' };
  const intensity = affected.reduce((sum, force) => sum + Number(force.intensity || 0), 0) / affected.length;
  const negatives = affected.filter(force => /pressure|drag|risk|tight|higher|stress|negative/i.test(`${force.direction || ''} ${force.interpretation || ''}`)).length;
  const score = clamp(65 - negatives * 12 - intensity * 4 + Math.max(0, affected.length - negatives) * 4);
  return { score, finding: affected.map(force => `${force.name}: ${force.direction}`).join(' · ') };
}
function scoreThesis(h) {
  const text = `${h.thesis || ''} ${h.actionRationale || ''} ${h.watch || ''}`.trim();
  let score = text.length > 220 ? 72 : text.length > 90 ? 60 : 38;
  if (/invalidat|watch|trim|exit|risk|below|above|if/i.test(text)) score += 8;
  return { score: clamp(score), finding: text.length ? 'Thesis/rationale exists; check invalidation specificity.' : 'No thesis/rationale loaded.' };
}
function scoreData(h) {
  const fields = ['forwardPE', 'fcfYield', 'nextEarningsDate'];
  const complete = fields.filter(field => has(h.dataContract?.[field])).length;
  const priceAvailable = has(h.livePrice);
  return { score: clamp((complete / fields.length) * 70 + (priceAvailable ? 20 : 0)), finding: `${complete}/${fields.length} contract fields complete; price ${priceAvailable ? 'available' : 'missing'}.` };
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
  ].map(([name, item]) => ({ name, score: Math.round(item.score), status: status(item.score), finding: item.finding }));
  const composite = Math.round(factors.reduce((sum, item) => sum + item.score, 0) / factors.length);
  const weakest = factors.slice().sort((a, b) => a.score - b.score)[0];
  const strongest = factors.slice().sort((a, b) => b.score - a.score)[0];
  return { ticker: h.ticker, signal: h.computedSignal || h.signal || 'Review', composite, weakest, strongest, factors };
}
const scorecards = holdings.map(scorecard);
const warnings = scorecards
  .flatMap(card => card.factors.filter(factor => factor.score < 45).map(factor => ({ ticker: card.ticker, signal: card.signal, factor: factor.name, score: factor.score, finding: factor.finding })))
  .sort((a, b) => a.score - b.score);
const reviewQueue = scorecards.slice().sort((a, b) => a.composite - b.composite).slice(0, 5);
const strongest = scorecards.slice().sort((a, b) => b.composite - a.composite).slice(0, 3);
const dataGaps = warnings.filter(item => item.factor === 'Data completeness' || item.factor === 'Valuation' || item.factor === 'Earnings / event risk').slice(0, 6);
const concentration = warnings.filter(item => item.factor === 'Portfolio concentration').slice(0, 4);

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, JSON.stringify({ generatedAt: new Date().toISOString(), reviewQueue, strongest, warnings, dataGaps, concentration, scorecards }, null, 2));

function cardHtml(item, label) {
  return `<article class="portfolio-score-card"><span>${esc(label)}</span><div><b>${esc(item.ticker)}</b><em class="${item.composite >= 70 ? 'good' : item.composite >= 45 ? 'warn' : 'bad'}">${item.composite}</em></div><p>${esc(item.weakest?.name || item.factor)}: ${esc(item.weakest?.finding || item.finding || '')}</p><a href="pages/${esc(String(item.ticker).toLowerCase())}.html">Open workspace →</a></article>`;
}
function warningHtml(item) {
  return `<article class="portfolio-warning"><div><b>${esc(item.ticker)}</b><span>${esc(item.factor)}</span><em class="bad">${item.score}</em></div><p>${esc(item.finding)}</p></article>`;
}
const html = `<section id="portfolio-scoreboard" class="panel portfolio-scoreboard"><div class="section-head"><div><p class="eyebrow">Portfolio Intelligence</p><h2>Review queue from signal scorecards</h2></div><a class="button" href="outputs/portfolio-scoreboard.json">Open score JSON</a></div><div class="portfolio-score-grid">${reviewQueue.map(item => cardHtml(item, 'Review priority')).join('')}${strongest.map(item => cardHtml(item, 'Strong support')).join('')}</div><div class="section-head compact portfolio-warning-head"><div><p class="eyebrow">Weakest factor warnings</p><h3>Questions before capital moves</h3></div></div><div class="portfolio-warning-grid">${warnings.slice(0, 8).map(warningHtml).join('') || '<p class="muted">No weak factor warnings.</p>'}</div><div class="portfolio-score-foot"><article><span>Data gaps</span><b>${dataGaps.length}</b><p>${dataGaps.slice(0, 3).map(item => `${item.ticker}: ${item.factor}`).join(' · ') || 'No major data gaps.'}</p></article><article><span>Concentration flags</span><b>${concentration.length}</b><p>${concentration.slice(0, 3).map(item => `${item.ticker}: ${item.finding}`).join(' · ') || 'No major concentration flags.'}</p></article></div></section>`;
const css = `<style>.portfolio-scoreboard{background:rgba(251,250,246,.1)}.portfolio-score-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.portfolio-score-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:20px;background:rgba(251,250,246,.18);min-height:210px}.portfolio-score-card span,.portfolio-warning span,.portfolio-score-foot span{display:block;color:var(--muted);font-size:13px;margin-bottom:10px}.portfolio-score-card div{display:flex;align-items:flex-start;justify-content:space-between;gap:14px}.portfolio-score-card b{font-size:34px;line-height:.95;letter-spacing:-.05em;font-weight:500}.portfolio-score-card em{font-style:normal;font-size:34px;line-height:.95;letter-spacing:-.05em}.portfolio-score-card p{margin:16px 0 0}.portfolio-score-card a{display:inline-block;margin-top:16px;text-decoration:none;font-size:14px;font-weight:500}.portfolio-score-card a:hover{text-decoration:underline;text-underline-offset:4px}.portfolio-warning-head{margin-top:28px}.portfolio-warning-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.portfolio-warning{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:rgba(251,250,246,.16)}.portfolio-warning div{display:grid;grid-template-columns:64px 1fr auto;gap:12px;align-items:start}.portfolio-warning b{font-size:20px;line-height:1;letter-spacing:-.03em}.portfolio-warning em{font-style:normal;font-weight:600}.portfolio-warning p{margin-top:12px;font-size:14px}.portfolio-score-foot{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.portfolio-score-foot article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.16)}.portfolio-score-foot b{font-size:44px;line-height:.9;letter-spacing:-.05em;font-weight:500}@media(max-width:760px){.portfolio-warning div{grid-template-columns:1fr}.portfolio-score-foot{grid-template-columns:1fr}}</style>`;

if (!fs.existsSync(indexPath)) throw new Error('index.html not found; run build-static-home first');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.portfolio-scoreboard[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="portfolio-scoreboard"[\s\S]*?<section id="holdings-section"/, '<section id="holdings-section"');
if (!index.includes('portfolio-scoreboard')) {
  index = index.replace('</head>', `${css}</head>`);
  index = index.replace('<section id="holdings-section"', `${html}<section id="holdings-section"`);
}
fs.writeFileSync(indexPath, index);
console.log(`Injected portfolio scoreboard: ${reviewQueue.length} review priorities, ${warnings.length} weak warnings`);
