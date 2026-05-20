const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const publicOutputsDir = path.join(root, 'public', 'outputs');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');

const PERMISSIONS = new Set(['ADD_ALLOWED_AT_RULED_ZONE', 'HOLD_VERIFY', 'NO_ADD_VERIFY', 'TRIM_WATCH', 'EXIT_REVIEW']);
const PROMOTION = new Set(['BLOCKED', 'RESEARCH_ONLY', 'PROMOTION_REVIEW', 'PROMOTED_TO_WATCHLIST']);

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function num(value) {
  if (value == null) return null;
  const n = Number(String(value).replace(/[$,%]/g, '').replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}
function list(value) { return Array.isArray(value) ? value : []; }
function text(value, fallback = 'Evidence unavailable') {
  const s = String(value ?? '').trim();
  return s || fallback;
}
function isoOrNull(value) {
  const d = new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}
function ageState(timestamp) {
  const iso = isoOrNull(timestamp);
  if (!iso) return 'missing';
  const hours = (Date.now() - new Date(iso).getTime()) / 36e5;
  if (hours <= 28) return 'fresh';
  if (hours <= 84) return 'aging';
  return 'stale';
}
function confidenceToText(value) {
  if (value == null || value === '') return 'missing';
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value >= 0.8 ? 'high' : value >= 0.5 ? 'medium' : 'low';
  if (typeof value === 'object') {
    const entries = Object.entries(value).map(([k, v]) => `${k}: ${confidenceToText(v)}`);
    return entries.length ? entries.join('; ') : 'missing';
  }
  return String(value);
}
function signalForPermission(signal, dayChangePct, freshness) {
  const s = String(signal || '').toUpperCase();
  if (freshness === 'stale' || freshness === 'missing') return 'NO_ADD_VERIFY';
  if (Math.abs(num(dayChangePct) ?? 0) >= 5) return 'TRIM_WATCH';
  if (s.includes('EXIT')) return 'EXIT_REVIEW';
  if (s.includes('TRIM')) return 'TRIM_WATCH';
  if (s.includes('NO ADD')) return 'NO_ADD_VERIFY';
  if (s.includes('ADD')) return 'ADD_ALLOWED_AT_RULED_ZONE';
  return 'HOLD_VERIFY';
}
function sourceForHolding(holding) {
  const dc = holding.dataContract || {};
  const confidence = confidenceToText(dc.confidence || holding.sourceConfidence || holding.confidence || holding.finviz?.confidence);
  const timestamp = holding.priceAsOf || holding.asOf || holding.finviz?.asOf || dc.sourceAsOf?.forwardPE || dc.sourceAsOf?.fcfYield || null;
  return { confidence, timestamp, freshness: ageState(timestamp) };
}
function changeMarker(previous, next, key) {
  if (!previous) return true;
  return JSON.stringify(previous[key]) !== JSON.stringify(next[key]);
}
function byTicker(array) {
  return Object.fromEntries(list(array).filter(x => x && x.ticker).map(x => [x.ticker, x]));
}
function operatingWindow(now = new Date()) {
  return {
    timezone: 'America/New_York',
    cadence: '4-hour operating cycle on market days',
    normalMarketDayRuns: [
      { timeET: '09:30', label: 'market open scan' },
      { timeET: '13:30', label: 'midday regime check' },
      { timeET: '16:15', label: 'post-close decision state' },
      { timeET: '20:00', label: 'deeper research / opportunity promotion review' }
    ],
    generatedAt: now.toISOString()
  };
}
function eventTriggers(state, holdings) {
  const tape = list(state.liveMarket);
  const row = (...symbols) => tape.find(x => symbols.includes(String(x.symbol || '').toUpperCase()));
  const checks = [
    { name: 'SPY ±1.5% intraday', actual: num(row('SPY')?.changePct), threshold: 1.5, abs: true },
    { name: 'QQQ ±1.5% intraday', actual: num(row('QQQ')?.changePct), threshold: 1.5, abs: true },
    { name: 'VIX +10%', actual: num(row('^VIX', 'VIX')?.changePct), threshold: 10, abs: false },
    { name: 'BTC ±3%', actual: num(row('BTC-USD', 'BTCUSD', 'BTC')?.changePct), threshold: 3, abs: true },
    ...holdings.map(h => ({ name: `${h.ticker} holding ±5%`, actual: num(h.dayChangePct), threshold: 5, abs: true }))
  ];
  return checks.map(check => ({
    ...check,
    triggered: Number.isFinite(check.actual) ? (check.abs ? Math.abs(check.actual) > check.threshold : check.actual > check.threshold) : false
  }));
}

const state = readJson(statePath, {});
const generatedAt = new Date().toISOString();
const previousRegime = readJson(path.join(outputsDir, 'market-regime-state.json'));
const previousPortfolio = readJson(path.join(outputsDir, 'portfolio-decision-state.json'), []);
const previousOpportunity = readJson(path.join(outputsDir, 'opportunity-promotion-state.json'), []);
const previousTruth = readJson(path.join(outputsDir, 'data-truth-state.json'));

const marketRegime = state.marketRegime || {};
const tape = list(state.liveMarket);
const rates = list(state.liveRatesCredit);
const rateMap = Object.fromEntries(rates.map(r => [r.id || r.name, r]));
const vix = tape.find(t => ['^VIX', 'VIX'].includes(String(t.symbol || '').toUpperCase()));
const btc = tape.find(t => ['BTC-USD', 'BTCUSD', 'BTC'].includes(String(t.symbol || '').toUpperCase()));
const regimeState = {
  generatedAt,
  regimePosture: text(marketRegime.posture, 'HOLD / WATCH'),
  liquidityState: text(marketRegime.liquidity || `HY OAS ${rateMap.BAMLH0A0HYM2?.value ?? 'unavailable'}`),
  ratesPressure: text(marketRegime.policy || `10Y ${rateMap.DGS10?.value ?? 'unavailable'}`),
  creditPressure: text(rateMap.BAMLH0A0HYM2?.value != null ? `HY OAS ${rateMap.BAMLH0A0HYM2.value}` : marketRegime.creditPressure, 'Credit pressure source unavailable'),
  volatilityState: text(vix ? `VIX ${vix.price ?? 'n/a'} / day ${vix.changePct ?? 'n/a'}%` : marketRegime.riskAppetite, 'Volatility source unavailable'),
  cryptoLiquidity: text(btc ? `BTC ${btc.price ?? 'n/a'} / day ${btc.changePct ?? 'n/a'}%` : 'BTC tape unavailable'),
  aiInfrastructurePressure: text(state.strategy?.aiInfrastructurePressure || 'Monitor AI capex, rates sensitivity, and power/infrastructure exposure before adds.'),
  macroSummary: text(marketRegime.mostImportantMacroSignal || state.finalOutput?.mostImportantMacroSignal),
  changedSinceLastRun: false,
  reasons: list(marketRegime.evidence).concat([marketRegime.confidence].filter(Boolean)).map(x => text(x))
};
regimeState.changedSinceLastRun = changeMarker(previousRegime, regimeState, 'regimePosture') || changeMarker(previousRegime, regimeState, 'macroSummary');

const previousPortfolioMap = byTicker(previousPortfolio);
const portfolioState = list(state.holdings).map(holding => {
  const source = sourceForHolding(holding);
  const permission = signalForPermission(holding.computedSignal || holding.signal, holding.dayChangePct, source.freshness);
  const ruleBreaches = [];
  if (source.freshness !== 'fresh') ruleBreaches.push(`data freshness ${source.freshness}`);
  if (Math.abs(num(holding.dayChangePct) ?? 0) >= 5) ruleBreaches.push('holding moved more than ±5% intraday');
  if (String(holding.signal || '').toUpperCase().includes('EXIT')) ruleBreaches.push('exit signal present');
  if (String(holding.signal || '').toUpperCase().includes('TRIM')) ruleBreaches.push('trim signal present');
  const dc = holding.dataContract || {};
  const row = {
    ticker: holding.ticker,
    price: num(holding.livePrice ?? holding.price),
    dayChangePct: num(holding.dayChangePct),
    portfolioWeightPct: num(holding.portfolioWeightPct ?? holding.weight),
    decisionPermission: permission,
    ruleBreaches,
    addZone: text(holding.addZone || holding.actionBands?.add || 'No add until ruled valuation/technical zone is verified.'),
    trimTrigger: text(holding.trimTrigger || holding.actionBands?.trim || 'Trim review if thesis weakens, concentration rises, or tactical product decay risk dominates.'),
    exitTrigger: text(holding.exitTrigger || holding.actionBands?.exit || holding.thesisInvalidation || 'Exit review if thesis invalidation or source trust breach occurs.'),
    thesisStatus: text(holding.thesisStatus || holding.health || holding.signal, 'Verify thesis'),
    thesisInvalidation: text(holding.thesisInvalidation || holding.watch || 'Explicit invalidation evidence required before capital action.'),
    nextEvidenceRequired: text(holding.nextEvidenceRequired || 'Refresh price, thesis evidence, valuation, and source confidence before changing exposure.'),
    dataFreshness: source.freshness,
    sourceConfidence: source.confidence,
    sourceTimestamp: source.timestamp,
    changedSinceLastRun: false
  };
  if (!PERMISSIONS.has(row.decisionPermission)) row.decisionPermission = 'HOLD_VERIFY';
  const prev = previousPortfolioMap[row.ticker];
  row.changedSinceLastRun = !prev || prev.decisionPermission !== row.decisionPermission || JSON.stringify(prev.ruleBreaches || []) !== JSON.stringify(row.ruleBreaches) || prev.dataFreshness !== row.dataFreshness || prev.sourceConfidence !== row.sourceConfidence;
  return row;
});

const previousOpportunityMap = byTicker(previousOpportunity);
const rawOpportunities = list(state.strategy?.opportunityScout || state.opportunityScout).filter(o => o && (o.ticker || o.symbol || o.name));
const opportunityState = rawOpportunities.map(candidate => {
  const ticker = candidate.ticker || candidate.symbol || candidate.name;
  const missingEvidence = list(candidate.missingEvidence || candidate.confirmBeforeAdd || candidate.confirm || candidate.confirmations);
  const requiredSources = list(candidate.requiredSources || candidate.sources || ['price tape', 'macro thesis evidence', 'valuation zone evidence']);
  const score = num(candidate.opportunityScore ?? candidate.score) ?? (missingEvidence.length ? 45 : 60);
  let status = candidate.promotionStatus || (score >= 75 && !missingEvidence.length ? 'PROMOTION_REVIEW' : 'RESEARCH_ONLY');
  if (!requiredSources.length || missingEvidence.length >= 3) status = 'BLOCKED';
  if (!PROMOTION.has(status)) status = 'RESEARCH_ONLY';
  const row = {
    ticker,
    macroThesis: text(candidate.macroThesis || candidate.thesis || candidate.theme || candidate.whyNow, 'Macro thesis required'),
    agentSelectionRationale: text(candidate.agentSelectionRationale || candidate.rationale || candidate.whyNow, 'Selection rationale required'),
    tickerAnalysisRead: text(candidate.tickerAnalysisRead || candidate.signal || 'Ticker read requires validation'),
    opportunityScore: score,
    asymmetryReason: text(candidate.asymmetryReason || 'Asymmetry requires valuation and catalyst evidence'),
    catalystHypothesis: text(candidate.catalystHypothesis || candidate.catalyst || 'Catalyst hypothesis required'),
    missingEvidence: missingEvidence.length ? missingEvidence : ['valuation zone', 'source-backed catalyst', 'invalidation rule'],
    requiredSources,
    valuationZoneRequired: text(candidate.valuationZoneRequired || 'Required before promotion'),
    invalidationRequired: text(candidate.invalidationRequired || 'Required before promotion'),
    promotionStatus: status,
    assignedAgentTask: text(candidate.assignedAgentTask || `Opportunity Scout: collect source-backed thesis packet for ${ticker}.`),
    changedSinceLastRun: false
  };
  const prev = previousOpportunityMap[row.ticker];
  row.changedSinceLastRun = !prev || prev.promotionStatus !== row.promotionStatus || prev.opportunityScore !== row.opportunityScore || JSON.stringify(prev.missingEvidence || []) !== JSON.stringify(row.missingEvidence);
  return row;
});

const sourceMap = {
  marketTape: tape.map(t => ({ symbol: t.symbol, source: t.source || 'market data adapter', asOf: t.asOf || t.priceAsOf || null })),
  ratesCredit: rates.map(r => ({ id: r.id, source: r.source || 'rates/credit adapter', asOf: r.latestDate || r.asOf || null })),
  holdings: portfolioState.map(h => ({ ticker: h.ticker, sourceTimestamp: h.sourceTimestamp, confidence: h.sourceConfidence }))
};
const staleSources = portfolioState.filter(h => h.dataFreshness === 'stale').map(h => h.ticker);
const blockedSources = portfolioState.filter(h => h.dataFreshness === 'missing' || h.sourceConfidence === 'missing').map(h => h.ticker);
const dataTruth = {
  generatedAt,
  sourceMap,
  staleSources,
  blockedSources,
  fallbackSourcesUsed: list(state.meta?.liveDataSources).filter(x => /public|unofficial|fallback/i.test(String(x))),
  perTickerFreshness: Object.fromEntries(portfolioState.map(h => [h.ticker, h.dataFreshness])),
  perMetricConfidence: Object.fromEntries(portfolioState.map(h => [h.ticker, h.sourceConfidence])),
  homepageSafeToRender: blockedSources.length === 0
};
dataTruth.changedSinceLastRun = changeMarker(previousTruth, dataTruth, 'homepageSafeToRender') || changeMarker(previousTruth, dataTruth, 'staleSources') || changeMarker(previousTruth, dataTruth, 'blockedSources');

const cadenceState = {
  ...operatingWindow(new Date(generatedAt)),
  eventTriggers: eventTriggers(state, portfolioState),
  shouldRunImmediately: false,
  deployOnlyIfMeaningfulStateChanged: true,
  meaningfulStateChanged: [regimeState.changedSinceLastRun, dataTruth.changedSinceLastRun, ...portfolioState.map(h => h.changedSinceLastRun), ...opportunityState.map(o => o.changedSinceLastRun)].some(Boolean),
  deployReasons: []
};
cadenceState.shouldRunImmediately = cadenceState.eventTriggers.some(x => x.triggered) || !dataTruth.homepageSafeToRender;
cadenceState.deployReasons = [
  regimeState.changedSinceLastRun ? 'macro regime changed' : null,
  dataTruth.changedSinceLastRun ? 'data health changed' : null,
  ...portfolioState.filter(h => h.changedSinceLastRun).map(h => `${h.ticker} decision/data state changed`),
  ...opportunityState.filter(o => o.changedSinceLastRun).map(o => `${o.ticker} opportunity state changed`)
].filter(Boolean);

writeJson(path.join(outputsDir, 'market-regime-state.json'), regimeState);
writeJson(path.join(outputsDir, 'portfolio-decision-state.json'), portfolioState);
writeJson(path.join(outputsDir, 'opportunity-promotion-state.json'), opportunityState);
writeJson(path.join(outputsDir, 'data-truth-state.json'), dataTruth);
writeJson(path.join(outputsDir, 'operating-cadence-state.json'), cadenceState);

for (const file of ['market-regime-state.json', 'portfolio-decision-state.json', 'opportunity-promotion-state.json', 'data-truth-state.json', 'operating-cadence-state.json']) {
  const src = path.join(outputsDir, file);
  const dest = path.join(publicOutputsDir, file);
  if (fs.existsSync(src)) writeJson(dest, readJson(src));
}

console.log(`wrote operating brain artifacts; meaningfulStateChanged=${cadenceState.meaningfulStateChanged}; homepageSafeToRender=${dataTruth.homepageSafeToRender}`);
