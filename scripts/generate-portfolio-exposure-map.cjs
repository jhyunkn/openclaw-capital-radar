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
function classify(h) {
  const ticker = String(h.ticker || '').toUpperCase();
  if (ticker === 'SPY') return ['index_market_beta', 'Index / market beta', 'Broad market index exposure used as portfolio beta and ballast.', 55];
  if (ticker === 'AMZN') return ['ecommerce_cloud', 'E-commerce / cloud infrastructure', 'Amazon-specific exposure: e-commerce, AWS, advertising, logistics, and operating leverage.', 20];
  if (ticker === 'MSFT') return ['cloud_software_ai', 'Cloud / software / AI platform', 'Enterprise software, cloud, and AI platform exposure.', 25];
  if (ticker === 'META') return ['digital_ads_ai_platform', 'Digital ads / AI platform', 'Advertising, social platform, AI infrastructure, and metaverse optionality exposure.', 15];
  if (ticker === 'CEG') return ['power_energy_infrastructure', 'Power / energy infrastructure', 'Power generation and grid-adjacent infrastructure exposure.', 15];
  if (ticker === 'MA') return ['payments_financial_infrastructure', 'Payments / financial infrastructure', 'Global payment network and transaction infrastructure exposure.', 15];
  if (ticker === 'NFLX') return ['streaming_media', 'Streaming / media', 'Subscription entertainment and media platform exposure.', 15];
  if (ticker === 'BMNR') return ['speculative_crypto_infrastructure', 'Speculative crypto infrastructure', 'High-volatility crypto/mining/infrastructure optionality requiring explicit thesis review.', 5];
  if (ticker === 'TSNF') return ['speculative_single_name', 'Speculative single-name equity', 'Speculative or thesis-uncertain single-name equity exposure.', 5];
  if (['TSLT','CONL','TMF','TQQQ','SQQQ','SOXL','SOXS','BITX'].includes(ticker)) return ['levered_tactical', 'Levered / tactical products', 'Daily-reset or levered tactical exposure where volatility path and decay matter.', 5];
  return ['other_single_name', 'Other single-name equity', 'Single-name equity exposure requiring explicit classification.', 15];
}
function bucketFromGroup(group) {
  const members = group.members.map(h => {
    const interp = interpretations.get(String(h.ticker || '').toUpperCase()) || {};
    return { ticker: h.ticker, weight: n(h.portfolioWeightPct), signal: h.computedSignal || h.signal || 'Review', urgency: interp.urgency?.level || 'Monitor', actionPermission: interp.actionPermission?.status || 'Review' };
  });
  const weight = members.reduce((sum, item) => sum + item.weight, 0);
  const capPct = group.capPct;
  const pressure = weight >= capPct ? 'over-cap' : weight >= capPct * 0.8 ? 'near-cap' : weight > 0 ? 'inside-cap' : 'empty';
  const reviewItems = members.filter(m => ['Now','This week','Soon'].includes(m.urgency) || /No add|Trim|Exit|verify|Hold only/i.test(m.actionPermission));
  return { id: group.id, label: group.label, description: group.description, capPct, weightPct: Number(weight.toFixed(2)), pressure, members, reviewItems, interpretation: interpretBucket(group.label, weight, capPct, pressure, reviewItems) };
}
function interpretBucket(label, weight, cap, pressure, reviewItems){
  if (!weight) return `${label} has no current mapped exposure.`;
  if (pressure === 'over-cap') return `${label} exposure is over its ${cap}% review cap; capital additions should be blocked until rebalanced or explicitly approved.`;
  if (pressure === 'near-cap') return `${label} exposure is near its ${cap}% review cap; additions require stronger confirmation and substitution logic.`;
  if (reviewItems.length) return `${label} exposure is inside cap but contains ${reviewItems.length} review-sensitive holding(s).`;
  return `${label} exposure is inside cap with no immediate mapped pressure.`;
}
const groups = new Map();
for (const h of holdings) {
  const [id, label, description, capPct] = classify(h);
  if (!groups.has(id)) groups.set(id, { id, label, description, capPct, members: [] });
  groups.get(id).members.push(h);
}
const buckets = Array.from(groups.values()).map(bucketFromGroup).sort((a, b) => b.weightPct - a.weightPct);
const totalWeightPct = Number(buckets.reduce((sum, b) => sum + b.weightPct, 0).toFixed(2));
const weakDataMembers = holdings.filter(h => (interpretations.get(String(h.ticker || '').toUpperCase())?.dataConfidence?.tone || '') !== 'positive').map(h => ({ ticker: h.ticker, weight: n(h.portfolioWeightPct) }));
const weakDataExposurePct = Number(weakDataMembers.reduce((sum, h) => sum + h.weight, 0).toFixed(2));
const topPressures = buckets.filter(b => ['over-cap','near-cap'].includes(b.pressure) || b.reviewItems.length).sort((a,b) => (b.weightPct - a.weightPct));
const whyTodayMatters = [];
for (const bucket of topPressures.slice(0,4)) whyTodayMatters.push(bucket.interpretation);
if (weakDataExposurePct > 30) whyTodayMatters.push(`Weak-data exposure is ${weakDataExposurePct}%; fix fundamentals/event data before adding capital.`);
for (const item of strategy.homepage?.actNow || []) whyTodayMatters.push(`${item.ticker} requires immediate review: ${item.urgency?.reason || item.actionPermission?.reason || 'urgent flag.'}`);
const result = {
  generatedAt: new Date().toISOString(),
  taxonomy: 'exclusive_business_exposure_v1',
  totalWeightPct,
  reconciliation: Math.abs(totalWeightPct - 100) <= 0.15 ? 'PASS' : 'CHECK',
  buckets,
  diagnostics: {
    weakDataExposurePct,
    weakDataMembers,
    note: 'Weak-data exposure is a diagnostic overlay, not an exposure bucket; exclusive business buckets reconcile to portfolio weight.'
  },
  topPressures,
  whyTodayMatters: [...new Set(whyTodayMatters)].slice(0,8)
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated portfolio exposure map with ${buckets.length} exclusive buckets; total ${totalWeightPct}%`);
