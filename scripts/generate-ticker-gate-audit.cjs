const fs = require('fs');
const path = require('path');
const { numericLevels, strategyFor } = require('./capital-radar-strategy-rules.cjs');
const root = path.join(__dirname, '..');
const read = rel => fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : null;
const list = v => Array.isArray(v) ? v : [];
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const now = new Date().toISOString();
const state = read('data/report-state.live.json') || {};
const reactions = read('outputs/live-reaction-state.json') || { all: [] };
const candidates = read('outputs/research-candidate-map.json') || { allCandidates: [] };
const packets = read('outputs/opportunity-evidence-packets.json') || { packets: [] };
const filings = Object.fromEntries(list(state.companyFilingEvidence).map(x => [String(x.symbol).toUpperCase(), x]));
const live = Object.fromEntries(list(state.liveMarket).map(x => [String(x.symbol).toUpperCase(), x]));
const reactionByTicker = Object.fromEntries(list(reactions.all).map(x => [String(x.ticker).toUpperCase(), x]));
const candidateByTicker = Object.fromEntries(list(candidates.allCandidates).map(x => [String(x.ticker).toUpperCase(), x]));
const packetByTicker = Object.fromEntries(list(packets.packets).map(x => [String(x.ticker).toUpperCase(), x]));
const holdingByTicker = Object.fromEntries(list(state.holdings).map(x => [String(x.ticker).toUpperCase(), x]));
const etpPrimary = {
  SPY: { status:'PASS', sourceType:'issuer/ETF structure', source:'SPDR S&P 500 ETF Trust; market proxy instrument', note:'ETF primary issuer/prospectus evidence should be refreshed in Phase 3, but SPY is treated as benchmark/core proxy.' },
  CONL: { status:'PASS', sourceType:'issuer product page fetched', sourceUrl:'https://graniteshares.com/etfs/conl/', source:'GraniteShares 2x Long COIN Daily ETF (CONL)', fetchedAt:'2026-05-18T21:44:33.300Z', note:'Issuer page located via direct fetch. Leveraged ETF still requires prospectus/full risk text before add permission; primary identity gate passes only.' },
  TSLT: { status:'PASS', sourceType:'issuer product page fetched', sourceUrl:'https://www.rexshares.com/tslt/', source:'TSLT - T-REX 2X Long Tesla ETF | 2X TSLA Daily', fetchedAt:'2026-05-18T21:44:30.935Z', note:'Issuer page located via direct fetch. Leveraged ETF still requires prospectus/full risk text before add permission; primary identity gate passes only.' },
  TSNF: { status:'BLOCK', sourceType:'issuer/prospectus/security identity required', source:null, note:'Instrument identity/liquidity/issuer evidence must be verified before promotion. Direct REX TSNF URL and Yahoo quote page returned 404/stale-or-moved during degraded run.' },
  IBIT: { status:'PASS', sourceType:'issuer product page fetched', sourceUrl:'https://www.ishares.com/us/products/333011/ishares-bitcoin-trust-etf', source:'iShares Bitcoin Trust ETF | IBIT', fetchedAt:'2026-05-18T21:44:35.612Z', note:'Issuer page located via direct fetch. Trust prospectus/NAV tracking evidence still required before promotion; primary identity gate passes only.' }
};
const allTickers = [...new Set([
  ...Object.keys(holdingByTicker),
  ...Object.keys(candidateByTicker),
  ...Object.keys(packetByTicker)
])].sort();
function roleFor(ticker) {
  const h = holdingByTicker[ticker];
  const c = candidateByTicker[ticker];
  const p = packetByTicker[ticker];
  if (h?.thesis || h?.role) return h.thesis || h.role;
  if (p?.portfolioRole) return p.portfolioRole;
  if (c?.portfolioFit) return c.portfolioFit;
  return strategyFor(ticker).posture || 'portfolio role requires manual definition';
}
function riskBudget(ticker) {
  const h = holdingByTicker[ticker];
  const c = candidateByTicker[ticker];
  const p = packetByTicker[ticker];
  const weight = num(h?.weightPct ?? h?.weight);
  const isHolding = Boolean(h);
  const speculative = /spec|lever|crypto|optional|small|tactical|verification/i.test(`${strategyFor(ticker).posture} ${p?.portfolioRole||''} ${c?.thesis||''}`);
  if (isHolding && weight != null) {
    return { status:'PASS', budgetType:'current-position-risk', maxPositionPct: weight, maxLossPct: speculative ? 0.5 : 1.5, rule: speculative ? 'Do not add; cap incremental loss tightly until thesis verified.' : 'Core/watch holding; size governed by portfolio weight and invalidation.' };
  }
  if (speculative) return { status:'PASS', budgetType:'starter/speculative', maxPositionPct: 0.5, maxLossPct: 0.25, rule:'Research-only. If promoted, start tiny; max loss must be pre-accepted.' };
  return { status:'PASS', budgetType:'starter/research', maxPositionPct: 1.0, maxLossPct: 0.5, rule:'Research-only. If promoted, starter size only until primary thesis and price zone confirmed.' };
}
function priceZone(ticker) {
  const r = reactionByTicker[ticker];
  const c = candidateByTicker[ticker];
  const price = num(r?.price) ?? num(c?.price) ?? num(live[ticker]?.price);
  if (r?.levels) return { status:'PASS', basis:r.levels.basis || 'strategy rules', current:r.levels.current ?? price, entryLow:r.levels.entryLow, entryHigh:r.levels.entryHigh, addBelow:r.levels.addBelow ?? null, trimLow:r.levels.trimLow, trimHigh:r.levels.trimHigh, stop:r.levels.stop, hardExit:r.levels.hardExit, target:r.levels.target, note:r.reaction?.read || null };
  if (price != null) {
    const levels = numericLevels(ticker, price, {});
    return { status:'PASS', basis:levels.basis || 'candidate dynamic band', current:levels.current, entryLow:levels.entryLow, entryHigh:levels.entryHigh, addBelow:levels.addBelow ?? null, trimLow:levels.trimLow, trimHigh:levels.trimHigh, stop:levels.stop, hardExit:levels.hardExit, target:levels.target, note:'Candidate zone is provisional until primary evidence and technical structure are attached.' };
  }
  return { status:'BLOCK', basis:'missing price', note:'No current/provisional price available; cannot define price zone.' };
}
function invalidation(ticker) {
  const strat = strategyFor(ticker);
  const c = candidateByTicker[ticker];
  const p = packetByTicker[ticker];
  const risks = list(c?.keyRisks).length ? list(c.keyRisks) : list(p?.invalidationQuestions);
  const text = strat.invalidation && strat.invalidation !== 'Unknown.' ? strat.invalidation : risks.length ? risks.join(' | ') : null;
  if (text) return { status:'PASS', rule:text, source: strat.invalidation && strat.invalidation !== 'Unknown.' ? 'strategy rules' : 'candidate packet risks' };
  return { status:'BLOCK', rule:null, source:null, note:'No invalidation rule available.' };
}
function primaryEvidence(ticker) {
  const f = filings[ticker];
  if (f) {
    return { status:'PASS', sourceType:'SEC submissions JSON', sourceUrl:f.sourceUrl, entityName:f.entityName, cik:f.cik, recentMaterialFilings:list(f.recentMaterialFilings).slice(0,3).map(x => ({ form:x.form, filingDate:x.filingDate, accessionNumber:x.accessionNumber })), note:list(f.recentMaterialFilings).length ? 'Primary filing metadata attached. Phase 3 should fetch full filing text/companyfacts for claim-level evidence.' : 'SEC entity/CIK attached but no recent material filings loaded in local snapshot; full filing/companyfacts fetch still required before promotion.' };
  }
  if (etpPrimary[ticker]) return etpPrimary[ticker];
  return { status:'BLOCK', sourceType:'primary evidence required', sourceUrl:null, note:'No SEC/issuer/company primary evidence attached in local state.' };
}
function portfolioRole(ticker) {
  const role = roleFor(ticker);
  if (role && !/requires manual/i.test(role)) return { status:'PASS', role, concentrationCheck: holdingByTicker[ticker] ? 'current holding' : 'candidate; must check overlap before promotion' };
  return { status:'BLOCK', role, concentrationCheck:'manual definition required' };
}
function verdict(gates) {
  const blocked = Object.values(gates).filter(g => g.status !== 'PASS').map(g => g.name || g.gate || 'gate');
  const primaryOk = gates.primaryEvidence.status === 'PASS';
  const allPass = Object.values(gates).every(g => g.status === 'PASS');
  if (allPass) return { gateStatus:'PASS', promotionPermission:'ELIGIBLE_FOR_HUMAN_REVIEW_ONLY', reason:'All five gates populated/passed from local state. Still requires human review; no automatic trade execution.' };
  return { gateStatus:'BLOCKED', promotionPermission:'NO_PROMOTION', reason:`Missing/blocking gates: ${blocked.join(', ')}.` };
}
const rows = allTickers.map(ticker => {
  const gates = {
    primaryEvidence: { gate:'primaryEvidence', ...primaryEvidence(ticker) },
    priceZone: { gate:'priceZone', ...priceZone(ticker) },
    invalidation: { gate:'invalidation', ...invalidation(ticker) },
    riskBudget: { gate:'riskBudget', ...riskBudget(ticker) },
    portfolioRole: { gate:'portfolioRole', ...portfolioRole(ticker) }
  };
  return {
    ticker,
    universe: holdingByTicker[ticker] && candidateByTicker[ticker] ? 'holding+candidate' : holdingByTicker[ticker] ? 'holding' : 'candidate',
    generatedAt: now,
    ...verdict(gates),
    gates,
    actionBoundary: 'Gate pass means eligible for human review only. It is not a buy/add instruction.'
  };
});
const output = {
  generatedAt: now,
  runMode:'LOCAL_TICKER_GATE_AUDIT_NO_WEB_SEARCH',
  status: rows.length ? 'ACTIVE' : 'EMPTY',
  policy:'Every ticker must carry primary evidence, price zone, invalidation, risk budget, and portfolio role before promotion. Degraded/local mode blocks missing primary evidence rather than inventing it.',
  counts:{ tickers: rows.length, pass: rows.filter(r=>r.gateStatus==='PASS').length, blocked: rows.filter(r=>r.gateStatus!=='PASS').length, holdings: rows.filter(r=>r.universe.includes('holding')).length, candidates: rows.filter(r=>r.universe.includes('candidate')).length },
  blockedByGate: ['primaryEvidence','priceZone','invalidation','riskBudget','portfolioRole'].reduce((acc,g)=>{ acc[g]=rows.filter(r=>r.gates[g].status!=='PASS').map(r=>r.ticker); return acc; },{}),
  rows
};
for (const rel of ['outputs/ticker-gate-audit.json','public/outputs/ticker-gate-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, JSON.stringify(output,null,2));
}
console.log(JSON.stringify({ wrote:'outputs/ticker-gate-audit.json', counts: output.counts, blockedByGate: output.blockedByGate }, null, 2));
