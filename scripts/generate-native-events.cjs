const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : null;
const list = v => Array.isArray(v) ? v : [];
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const now = new Date().toISOString();
const state = read('data/report-state.live.json') || {};
const stress = read('outputs/market-stress-brief.json') || {};
const reactions = read('outputs/live-reaction-state.json') || {};
const candidates = read('outputs/research-candidate-map.json') || {};
const sources = read('data/research/source-registry.json') || [];
const events = [];
let seq = 1;
function event(e) {
  events.push({
    eventId: `native-${now.slice(0,10).replace(/-/g,'')}-${String(seq++).padStart(3,'0')}`,
    detectedAt: now,
    freshness: e.freshness || 'recent',
    severity: e.severity || 'medium',
    sourceId: e.sourceId || 'capital-radar-live-state',
    eventType: e.eventType,
    ticker: e.ticker ?? null,
    theme: e.theme ?? null,
    summary: e.summary,
    evidenceRefs: list(e.evidenceRefs),
    portfolioImplication: e.portfolioImplication || null,
    actionPermission: e.actionPermission || 'watch',
    nextResearchQuestion: e.nextResearchQuestion || null,
    confidence: e.confidence || 'medium'
  });
}
if (stress.headline) {
  const broad = stress.readings?.broadAvgDayChangePct;
  event({
    eventType: 'market_stress',
    severity: num(broad) != null && broad <= -1 ? 'high' : num(broad) != null && broad <= -0.5 ? 'medium' : 'low',
    sourceId: 'yahoo-chart-public',
    theme: 'broad tape / risk appetite',
    summary: `${stress.headline}; broad index average ${num(broad) == null ? 'n/a' : broad + '%'}.`,
    evidenceRefs: ['outputs/market-stress-brief.json', 'data/report-state.live.json'],
    portfolioImplication: stress.actionPermission?.portfolio || 'HOLD / WATCH; no broad risk increase from a red day alone.',
    actionPermission: 'watch',
    nextResearchQuestion: 'Is weakness broad, sector-specific, or concentrated in crowded high-beta themes?',
    confidence: 'medium'
  });
}
for (const row of list(stress.readings?.worstDecliners).slice(0, 8)) {
  const day = num(row.dayChangePct);
  if (day == null || day > -4) continue;
  event({
    eventType: 'price_move',
    severity: day <= -8 ? 'high' : 'medium',
    sourceId: 'yahoo-chart-public',
    ticker: row.symbol,
    theme: 'downside anomaly / dislocation screen',
    summary: `${row.symbol} down ${day.toFixed(2)}% in watched basket.`,
    evidenceRefs: ['outputs/market-stress-brief.json'],
    portfolioImplication: 'Screen for thesis damage vs dislocation; do not promote without confirmation and invalidation.',
    actionPermission: 'research',
    nextResearchQuestion: `Is ${row.symbol} selling off on company-specific evidence, sector pressure, or crowded-theme de-risking?`,
    confidence: 'medium'
  });
}
for (const row of list(stress.readings?.relativeStrength).slice(0, 5)) {
  const day = num(row.dayChangePct);
  if (day == null || day < 1.5) continue;
  event({
    eventType: 'relative_strength',
    severity: 'medium',
    sourceId: 'yahoo-chart-public',
    ticker: row.symbol,
    theme: 'relative strength during weak tape',
    summary: `${row.symbol} positive ${day.toFixed(2)}% while broad tape is weak.`,
    evidenceRefs: ['outputs/market-stress-brief.json'],
    portfolioImplication: 'Potential odd-opportunity lead; investigate source evidence and whether move is sustainable.',
    actionPermission: 'research',
    nextResearchQuestion: `What evidence explains ${row.symbol}'s relative strength, and does it map to a durable theme?`,
    confidence: 'medium'
  });
}
for (const row of list(reactions.actionNow)) {
  event({
    eventType: 'portfolio_permission',
    severity: String(row.permission || '').includes('EXIT') || String(row.state || '').includes('HARD') ? 'high' : 'medium',
    sourceId: 'capital-radar-live-state',
    ticker: row.ticker,
    theme: 'current holding action gate',
    summary: `${row.ticker}: ${row.state} / ${row.permission}. ${row.read || ''}`.trim(),
    evidenceRefs: ['outputs/live-reaction-state.json'],
    portfolioImplication: row.permission || 'review',
    actionPermission: 'human_review_required',
    nextResearchQuestion: `Does ${row.ticker} require risk reduction, thesis review, or merely confirmation wait?`,
    confidence: 'high'
  });
}
const allCandidates = list(candidates.allCandidates).slice(0, 16);
for (const c of allCandidates.slice(0, 8)) {
  event({
    eventType: 'watchlist_discovery',
    severity: c.category === 'ticker_of_moment' ? 'medium' : 'low',
    sourceId: 'capital-radar-live-state',
    ticker: c.ticker,
    theme: c.theme || c.category || 'opportunity scout',
    summary: `${c.ticker}: ${c.thesis || c.name || 'Opportunity Scout candidate'}`,
    evidenceRefs: ['outputs/research-candidate-map.json', 'data/report-state.live.json'],
    portfolioImplication: c.portfolioFit || 'Research-only candidate; no buy permission.',
    actionPermission: 'research',
    nextResearchQuestion: `Build evidence packet for ${c.ticker}: why now, invalidation, confirmation, price zone, and portfolio role.`,
    confidence: 'low'
  });
}
const counts = events.reduce((acc, e) => { acc[e.eventType] = (acc[e.eventType] || 0) + 1; return acc; }, {});
const output = {
  generatedAt: now,
  runMode: 'NATIVE_RESEARCH_ENGINE_LOCAL_NO_WEB_SEARCH',
  status: events.length ? 'ACTIVE' : 'EMPTY',
  caveat: 'Generated from local/public adapters and internal state only. No web_search or fresh news causality claimed.',
  sourceCoverage: {
    registeredSources: sources.length,
    primarySources: sources.filter(s => s.trustTier === 'primary').length,
    marketDataSources: sources.filter(s => s.sourceType === 'market_data').length,
    filingSources: sources.filter(s => s.sourceType === 'filing').length
  },
  counts,
  events,
  immediateResearchQueue: events.filter(e => ['high','medium'].includes(e.severity) && ['research','human_review_required'].includes(e.actionPermission)).slice(0, 10),
  operationalGates: {
    canExplainBroadTape: Boolean(stress.headline),
    canDetectPriceAnomalies: list(stress.readings?.worstDecliners).length > 0,
    canDetectPortfolioPermissions: list(reactions.actionNow).length > 0 || list(reactions.reviewSoon).length > 0,
    canGenerateScoutLeads: allCandidates.length > 0,
    canClaimFreshNewsCausality: false
  },
  nextRequiredForPhase2: [
    'source reliability ledger',
    'document/evidence store',
    'candidate evidence packets',
    'source diff fetchers for curated IR/RSS pages',
    'outcome ledger'
  ]
};
for (const rel of ['outputs/native-events.json', 'public/outputs/native-events.json']) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ wrote: 'outputs/native-events.json', status: output.status, events: events.length, counts }, null, 2));
