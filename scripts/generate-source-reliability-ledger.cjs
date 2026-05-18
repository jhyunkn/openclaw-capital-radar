const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : null;
const list = v => Array.isArray(v) ? v : [];
const now = new Date().toISOString();
const registry = read('data/research/source-registry.json') || [];
const events = read('outputs/native-events.json') || { events: [] };
const candidates = read('outputs/research-candidate-map.json') || { allCandidates: [] };
const tierBase = { primary: 90, high: 78, medium: 62, low: 42, sentiment_only: 25 };
const typeModifier = { filing: 8, macro: 6, market_data: -3, internal: 0, ir: 5, news: -8, social: -18, analyst: -6, transcript: 4, press_release: 0 };
const sourceUsage = {};
for (const e of list(events.events)) {
  if (!e.sourceId) continue;
  const u = sourceUsage[e.sourceId] ||= { eventRefs: 0, highSeverityRefs: 0, researchRefs: 0, tickers: new Set(), eventTypes: new Set() };
  u.eventRefs += 1;
  if (e.severity === 'high') u.highSeverityRefs += 1;
  if (['research', 'human_review_required'].includes(e.actionPermission)) u.researchRefs += 1;
  if (e.ticker) u.tickers.add(e.ticker);
  if (e.eventType) u.eventTypes.add(e.eventType);
}
const sourceById = Object.fromEntries(registry.map(s => [s.sourceId, s]));
function clamp(n, lo=0, hi=100){ return Math.max(lo, Math.min(hi, Math.round(n))); }
function needsCrossCheck(source) {
  if (source.trustTier === 'primary' && ['filing','macro','internal'].includes(source.sourceType)) return false;
  return true;
}
const sources = registry.map(source => {
  const usage = sourceUsage[source.sourceId] || { eventRefs: 0, highSeverityRefs: 0, researchRefs: 0, tickers: new Set(), eventTypes: new Set() };
  const base = tierBase[source.trustTier] ?? 50;
  const mod = typeModifier[source.sourceType] ?? 0;
  const penalty = source.failureMode && /stale|blocked|unofficial|low-quality|causality/i.test(source.failureMode) ? 7 : 0;
  const score = clamp(base + mod - penalty);
  const reliabilityClass = score >= 85 ? 'primary-evidence' : score >= 70 ? 'strong-context' : score >= 55 ? 'usable-with-cross-check' : score >= 35 ? 'weak-context-only' : 'sentiment-only';
  return {
    sourceId: source.sourceId,
    name: source.name,
    sourceType: source.sourceType,
    trustTier: source.trustTier,
    reliabilityScore: score,
    reliabilityClass,
    allowedUses: source.allowedUses,
    refreshCadence: source.refreshCadence,
    storagePolicy: source.storagePolicy,
    failureMode: source.failureMode,
    requiresCrossCheck: needsCrossCheck(source),
    usage: {
      eventRefs: usage.eventRefs || 0,
      highSeverityRefs: usage.highSeverityRefs || 0,
      researchRefs: usage.researchRefs || 0,
      tickers: [...(usage.tickers || [])],
      eventTypes: [...(usage.eventTypes || [])]
    },
    promotionPolicy: reliabilityClass === 'primary-evidence'
      ? 'Can support facts and action-gate inputs when fresh.'
      : reliabilityClass === 'strong-context'
        ? 'Can support context; promotion still needs primary evidence or independent confirmation.'
        : reliabilityClass === 'usable-with-cross-check'
          ? 'Can generate research questions and market signals only; never sole basis for promotion.'
          : 'Do not use for promotion; sentiment/background only.'
  };
});
const evidenceRefs = [];
for (const c of list(candidates.allCandidates)) {
  evidenceRefs.push({
    ticker: c.ticker,
    candidateCategory: c.category,
    requiredPrimaryEvidence: ['SEC filings/company facts', 'company IR or earnings source', 'fresh market data with timestamp'],
    currentEvidenceStatus: 'market_signal_only',
    blocker: 'No candidate has enough primary-source thesis evidence for ADD permission in degraded/no-search mode.'
  });
}
const output = {
  generatedAt: now,
  runMode: 'LOCAL_SOURCE_RELIABILITY_NO_WEB_SEARCH',
  status: sources.length ? 'ACTIVE' : 'EMPTY',
  policy: 'Sources can discover opportunities, but candidate promotion requires primary evidence, freshness, invalidation, price zone, risk budget, and portfolio role.',
  sources,
  evidenceStatusByCandidate: evidenceRefs,
  aggregate: {
    sourceCount: sources.length,
    primaryEvidenceSources: sources.filter(s => s.reliabilityClass === 'primary-evidence').length,
    crossCheckRequiredSources: sources.filter(s => s.requiresCrossCheck).length,
    eventRefs: sources.reduce((sum,s)=>sum+s.usage.eventRefs,0),
    candidatesBlockedFromPromotion: evidenceRefs.filter(e => e.currentEvidenceStatus !== 'primary_evidence_ready').length
  },
  nextRequired: ['document evidence store', 'candidate primary-source fetch/diff adapters', 'outcome ledger', 'promotion/rejection history']
};
for (const rel of ['outputs/source-reliability-ledger.json', 'public/outputs/source-reliability-ledger.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ wrote: 'outputs/source-reliability-ledger.json', status: output.status, sources: sources.length, primary: output.aggregate.primaryEvidenceSources }, null, 2));
