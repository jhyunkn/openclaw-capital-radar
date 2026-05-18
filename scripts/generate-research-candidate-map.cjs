const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const exposurePath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const outPath = path.join(root, 'outputs', 'research-candidate-map.json');
const publicOutPath = path.join(root, 'public', 'outputs', 'research-candidate-map.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const exposure = fs.existsSync(exposurePath) ? JSON.parse(fs.readFileSync(exposurePath, 'utf8')) : { buckets: [] };
const candidates = Array.isArray(state.strategy?.opportunityScout)
  ? state.strategy.opportunityScout
  : Array.isArray(state.opportunityScout?.candidates)
    ? state.opportunityScout.candidates
    : [];
const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
function text(c){ return `${c.ticker || ''} ${c.name || ''} ${c.thesis || ''} ${(c.confirmBeforeAdd || []).join(' ')} ${(c.keyRisks || []).join(' ')}`; }
function pct(v){ const x = n(v); return x == null ? 0 : x; }
function pctFromSupport(c, label) {
  const support = (c.dataSupport || []).join(' ');
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = support.match(new RegExp(`${escaped}\\s+(-?\\d+(?:\\.\\d+)?)%`, 'i'));
  return m ? Number(m[1]) : null;
}
function priceFromSupport(c) {
  const m = (c.dataSupport || []).join(' ').match(/Price\s+\$?(-?\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : c.price;
}
function momentumScore(c){ return Math.max(0, Math.min(40, (pct(c.dayChangePct) > 2 ? 10 : 0) + (pct(c.perf5dPct) > 5 ? 10 : 0) + (pct(c.perf1mPct) > 10 ? 10 : 0) + (pct(c.perf3mPct) > 20 ? 10 : 0))); }
function setupScore(c){ const t = text(c); return Math.max(0, Math.min(30, (/earnings|breakout|volume|relative strength|inflection|contract|approval|catalyst|guidance|surprise/i.test(t) ? 15 : 0) + ((c.confirmBeforeAdd || []).length >= 3 ? 8 : 0) + ((c.keyRisks || []).length >= 3 ? 7 : 0))); }
function macroFitScore(c){ const t = text(c); return Math.max(0, Math.min(40, (/rates|duration|defensive|cash flow|dividend|energy|utility|healthcare|industrial|infrastructure|credit|inflation|liquidity|recession|quality|balance/i.test(t) ? 18 : 0) + (/AI|power|grid|data center|semiconductor|cloud|cyber|defense/i.test(t) ? 10 : 0) + ((c.confirmBeforeAdd || []).length >= 3 ? 6 : 0) + ((c.keyRisks || []).length >= 3 ? 6 : 0))); }
function diversificationFit(c){
  const t = text(c);
  const aiBucket = (exposure.buckets || []).find(b => ['cloud_software_ai','ecommerce_cloud','digital_ads_ai_platform','power_energy_infrastructure'].includes(b.id));
  const leveredBucket = (exposure.buckets || []).find(b => b.id === 'levered_tactical');
  let score = 20;
  let reason = 'Candidate does not obviously worsen a dominant current exposure.';
  if (/AI|semiconductor|cloud|data center|power|grid/i.test(t) && aiBucket && aiBucket.pressure !== 'inside-cap') { score -= 8; reason = 'Candidate may add to already pressured AI/infrastructure-adjacent exposure; require substitution logic.'; }
  if (/levered|2x|3x|daily reset/i.test(t) && leveredBucket && leveredBucket.weightPct > 0) { score -= 12; reason = 'Candidate worsens levered/decay exposure; treat as tactical only.'; }
  if (/healthcare|consumer staples|utility|bond|treasury|cash flow|dividend|low beta|quality/i.test(t)) { score += 8; reason = 'Candidate may diversify portfolio factor exposure away from high-beta AI/liquidity concentration.'; }
  return { score: Math.max(0, Math.min(30, score)), reason };
}
function classify(c){
  c = { ...c, price: priceFromSupport(c), dayChangePct: c.dayChangePct ?? pctFromSupport(c, 'day'), perf1mPct: c.perf1mPct ?? pctFromSupport(c, '1M'), perf3mPct: c.perf3mPct ?? pctFromSupport(c, '3M') };
  const div = diversificationFit(c);
  const nearTermScore = momentumScore(c) + setupScore(c) + Math.min(15, div.score / 2) + (/ADD WATCH|WATCH/i.test(c.signal || '') ? 5 : 0);
  const longTermScore = macroFitScore(c) + div.score + ((c.thesis || '').length > 120 ? 10 : 0);
  const base = { ticker: c.ticker, name: c.name || c.ticker, price: c.price, dayChangePct: c.dayChangePct, signal: c.signal || 'INVESTIGATE', thesis: c.thesis || '', confirmBeforeAdd: c.confirmBeforeAdd || [], keyRisks: c.keyRisks || [], portfolioFit: div.reason };
  return { ...base, nearTermScore: Number(nearTermScore.toFixed(1)), longTermScore: Number(longTermScore.toFixed(1)), category: nearTermScore >= longTermScore ? 'ticker_of_the_moment' : 'long_term_macro_fit' };
}
const mapped = candidates.filter(c => c && c.ticker && c.thesis && !/^TBD/i.test(String(c.ticker))).map(classify);
const tickerOfMoment = mapped.filter(x => x.nearTermScore >= 45 || x.category === 'ticker_of_the_moment').sort((a,b) => b.nearTermScore - a.nearTermScore).slice(0,5);
const longTermMacroFit = mapped.filter(x => x.longTermScore >= 45 || x.category === 'long_term_macro_fit').sort((a,b) => b.longTermScore - a.longTermScore).slice(0,5);
const result = {
  generatedAt: new Date().toISOString(),
  purpose: 'Split research candidates into near-term tactical setups and long-term macro/portfolio-balance candidates.',
  operatingRule: 'Candidates are research objects, not buy instructions. Promotion requires source evidence, add zone, invalidation, portfolio role, and risk budget.',
  lanes: {
    tickerOfMoment: {
      label: 'Short-term / tactical',
      requiredBeforePromotion: ['fresh price', 'setup/reclaim trigger', 'invalidation', 'time stop', 'volume/liquidity confirmation', 'risk budget']
    },
    longTermMacroFit: {
      label: 'Long-term / structural',
      requiredBeforePromotion: ['business thesis', 'valuation/expectation gap', 'sector or secular tailwind', 'bear case', 'add zone', 'portfolio role']
    }
  },
  emptyState: 'No candidate mapped today.',
  tickerOfMoment,
  longTermMacroFit,
  allCandidates: mapped
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
fs.mkdirSync(path.dirname(publicOutPath), { recursive: true });
fs.writeFileSync(publicOutPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated research candidate map: ${tickerOfMoment.length} moment / ${longTermMacroFit.length} long-term`);
