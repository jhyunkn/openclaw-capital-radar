const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const outPath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const strategy = fs.existsSync(interpPath) ? JSON.parse(fs.readFileSync(interpPath, 'utf8')) : { interpretations: [] };
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const interpretations = new Map((strategy.interpretations || []).map(x => [String(x.ticker || '').toUpperCase(), x]));
const n = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
function text(h){ return `${h.ticker || ''} ${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''} ${h.actionRationale || ''}`; }
function match(h, regex){ return regex.test(text(h)); }
function bucket(id, label, description, predicate, capPct){
  const members = holdings.filter(predicate).map(h => {
    const interp = interpretations.get(String(h.ticker || '').toUpperCase()) || {};
    return { ticker: h.ticker, weight: n(h.portfolioWeightPct), signal: h.computedSignal || h.signal || 'Review', urgency: interp.urgency?.level || 'Monitor', actionPermission: interp.actionPermission?.status || 'Review' };
  });
  const weight = members.reduce((sum, item) => sum + item.weight, 0);
  const pressure = weight >= capPct ? 'over-cap' : weight >= capPct * 0.8 ? 'near-cap' : weight > 0 ? 'inside-cap' : 'empty';
  const reviewItems = members.filter(m => ['Now','This week','Soon'].includes(m.urgency) || /No add|Trim|Exit|verify|Hold only/i.test(m.actionPermission));
  return { id, label, description, capPct, weightPct: Number(weight.toFixed(2)), pressure, members, reviewItems, interpretation: interpretBucket(label, weight, capPct, pressure, reviewItems) };
}
function interpretBucket(label, weight, cap, pressure, reviewItems){
  if (!weight) return `${label} has no current mapped exposure.`;
  if (pressure === 'over-cap') return `${label} exposure is over its ${cap}% review cap; capital additions should be blocked until rebalanced or explicitly approved.`;
  if (pressure === 'near-cap') return `${label} exposure is near its ${cap}% review cap; additions require stronger confirmation and substitution logic.`;
  if (reviewItems.length) return `${label} exposure is inside cap but contains ${reviewItems.length} review-sensitive holding(s).`;
  return `${label} exposure is inside cap with no immediate mapped pressure.`;
}
const buckets = [
  bucket('ai_infrastructure', 'AI / infrastructure concentration', 'Cloud, AI, semiconductors, data center, infrastructure compounders.', h => match(h, /AI|infrastructure|cloud|semiconductor|data center|datacenter|MSFT|AMZN|META|CEG|NVDA|AVGO|VRT/i), 55),
  bucket('single_name_equity', 'Single-name equity concentration', 'Non-index, non-levered single-name equity exposure.', h => {
    const ticker = String(h.ticker || '').toUpperCase();
    return !['SPY','QQQ','IWM','DIA','VTI','VOO','IBIT','BITO','ETHE','TSLT','CONL','TMF','TQQQ','SQQQ','SOXL','SOXS','BITX'].includes(ticker);
  }, 75),
  bucket('levered_decay', 'Levered / decay exposure', 'Daily-reset or levered tactical products where decay and volatility path matter.', h => match(h, /levered|decay|daily reset|2x|3x|TSLT|CONL|TMF|TQQQ|SQQQ|SOXL|SOXS|BITX/i), 5),
  bucket('crypto_liquidity', 'Crypto / liquidity beta', 'Crypto-linked holdings that depend heavily on liquidity regime and risk appetite.', h => match(h, /crypto|bitcoin|ethereum|IBIT|BITO|ETHE/i), 10),
  bucket('market_beta', 'Index / market beta', 'Broad index or market beta exposure used as ballast or general market participation.', h => match(h, /index|ETF basket|broad market|SPY|QQQ|IWM|DIA|VTI|VOO/i), 35),
  bucket('weak_data', 'Weak-data exposure', 'Holdings where strategy is constrained by missing fundamentals, event dates, or source confidence.', h => (interpretations.get(String(h.ticker || '').toUpperCase())?.dataConfidence?.tone || '') !== 'positive', 20)
];
const topPressures = buckets.filter(b => ['over-cap','near-cap'].includes(b.pressure) || b.reviewItems.length).sort((a,b) => (b.weightPct - a.weightPct));
const whyTodayMatters = [];
for (const bucket of topPressures.slice(0,4)) whyTodayMatters.push(bucket.interpretation);
for (const item of strategy.homepage?.actNow || []) whyTodayMatters.push(`${item.ticker} requires immediate review: ${item.urgency?.reason || item.actionPermission?.reason || 'urgent flag.'}`);
for (const item of strategy.homepage?.weakData || []) whyTodayMatters.push(`${item.ticker} is constrained by weak data: ${item.dataConfidence?.reason || 'missing fields.'}`);
const result = { generatedAt: new Date().toISOString(), buckets, topPressures, whyTodayMatters: [...new Set(whyTodayMatters)].slice(0,8) };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated portfolio exposure map with ${buckets.length} buckets`);
