const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => fs.existsSync(path.join(root, rel)) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : null;
const list = v => Array.isArray(v) ? v : [];
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const now = new Date().toISOString();
const state = read('data/report-state.live.json') || {};
const candidates = read('outputs/research-candidate-map.json') || { allCandidates: [] };
const events = read('outputs/native-events.json') || { events: [] };
const ledger = read('outputs/source-reliability-ledger.json') || { sources: [] };
const stress = read('outputs/market-stress-brief.json') || {};
const sourceById = Object.fromEntries(list(ledger.sources).map(s => [s.sourceId, s]));
const eventByTicker = {};
for (const e of list(events.events)) if (e.ticker) (eventByTicker[e.ticker] ||= []).push(e);
const liveBySymbol = Object.fromEntries(list(state.liveMarket).map(x => [x.symbol, x]));
function clamp(n, lo=0, hi=100){ return Math.max(lo, Math.min(hi, Math.round(n))); }
function pct(v){ return num(v) == null ? null : Number(v.toFixed(2)); }
function lane(c){ return c.category === 'ticker_of_the_moment' ? 'tactical_dislocation' : c.category === 'long_term_macro_fit' ? 'structural_candidate' : 'research_intake'; }
function role(c) {
  const t = `${c.ticker} ${c.name} ${c.thesis}`.toLowerCase();
  if (/bitcoin|crypto|coin|ibit/.test(t)) return 'risk-substitution / crypto beta hygiene';
  if (/grid|power|electrical|data-center|infrastructure|vertiv|eaton|quanta|nextracker|vernova/.test(t)) return 'power/grid infrastructure opportunity lane';
  if (/nuclear|uranium|oklo|cameco|smr/.test(t)) return 'energy scarcity optionality lane';
  if (/space|rocket/.test(t)) return 'speculative industrial-space optionality';
  if (/health|transmedics|hims/.test(t)) return 'non-correlated health/medical infrastructure lane';
  if (/alphabet|google|quality/.test(t)) return 'quality platform / valuation reset candidate';
  if (/nvidia|broadcom|semiconductor|ai/.test(t)) return 'AI infrastructure benchmark / center-stack exposure';
  return 'opportunity scout research candidate';
}
function stageFromScore(score, evidenceStatus, eventsForTicker) {
  if (evidenceStatus !== 'market_signal_plus_internal_thesis') return 'INTAKE_ONLY';
  if (score >= 75 && eventsForTicker.some(e => e.eventType === 'relative_strength')) return 'PRIORITY_RESEARCH';
  if (score >= 70) return 'BUILD_EVIDENCE_PACKET';
  if (score >= 60) return 'WATCH_AND_COMPARE';
  return 'LOW_PRIORITY_WATCH';
}
function opportunityScore(c, eventsForTicker) {
  const day = num(c.dayChangePct) ?? num(liveBySymbol[c.ticker]?.changePct) ?? 0;
  const near = num(c.nearTermScore) ?? 0;
  const long = num(c.longTermScore) ?? 0;
  const eventBoost = eventsForTicker.reduce((sum,e) => sum + (e.eventType === 'relative_strength' ? 12 : e.eventType === 'price_move' ? 7 : e.eventType === 'watchlist_discovery' ? 4 : 0), 0);
  const dislocationBoost = day <= -8 ? 13 : day <= -5 ? 9 : day >= 5 ? 10 : day >= 2 ? 5 : 0;
  const thesisDepth = String(c.thesis || '').length > 140 ? 8 : 3;
  const gates = list(c.confirmBeforeAdd).length >= 3 && list(c.keyRisks).length >= 3 ? 8 : 2;
  return clamp((near * 0.28) + (long * 0.34) + eventBoost + dislocationBoost + thesisDepth + gates);
}
function derivePriceFrame(c) {
  const price = num(c.price) ?? num(liveBySymbol[c.ticker]?.price);
  const day = num(c.dayChangePct) ?? num(liveBySymbol[c.ticker]?.changePct);
  if (price == null) return { currentPrice: null, priceRead: 'missing price; action blocked', provisionalZone: null };
  if (day <= -8) return { currentPrice: price, priceRead: 'sharp downside dislocation; require cause check before any add-zone work', provisionalZone: 'watch for stabilization/reclaim after selloff' };
  if (day <= -4) return { currentPrice: price, priceRead: 'meaningful pullback; possible research entry setup only after evidence and support confirmation', provisionalZone: 'prepare lower-risk zone, do not chase' };
  if (day >= 5) return { currentPrice: price, priceRead: 'relative strength / momentum; avoid chasing until base or catalyst confirmed', provisionalZone: 'wait for controlled pullback or confirmed breakout retest' };
  return { currentPrice: price, priceRead: 'neutral price context; compare against thesis and valuation evidence', provisionalZone: 'not defined yet' };
}
function evidenceRefs(c, eventsForTicker) {
  const refs = [
    { sourceId: 'capital-radar-live-state', use: 'internal candidate thesis and current quote context', reliabilityClass: sourceById['capital-radar-live-state']?.reliabilityClass || 'primary-evidence' },
    { sourceId: 'yahoo-chart-public', use: 'price/relative-strength/dislocation signal only', reliabilityClass: sourceById['yahoo-chart-public']?.reliabilityClass || 'usable-with-cross-check' }
  ];
  if (eventsForTicker.some(e => e.evidenceRefs?.includes('outputs/market-stress-brief.json'))) refs.push({ sourceId: 'market-stress-brief', use: 'local stress/anomaly classification', reliabilityClass: 'internal-signal' });
  refs.push({ sourceId: 'sec-company-submissions', use: 'required next primary-source filing check before promotion', reliabilityClass: sourceById['sec-company-submissions']?.reliabilityClass || 'primary-evidence', status: 'required_not_yet_attached' });
  refs.push({ sourceId: 'company-investor-relations', use: 'required thesis/catalyst source before promotion', reliabilityClass: sourceById['company-investor-relations']?.reliabilityClass || 'strong-context', status: 'required_not_yet_attached' });
  return refs;
}
const all = list(candidates.allCandidates);
const packets = all.map(c => {
  const evs = list(eventByTicker[c.ticker]);
  const price = derivePriceFrame(c);
  const score = opportunityScore(c, evs);
  const evidenceStatus = 'market_signal_plus_internal_thesis';
  const packet = {
    packetId: `opp-${String(c.ticker || '').toLowerCase()}-${now.slice(0,10)}`,
    generatedAt: now,
    ticker: c.ticker,
    name: c.name || c.ticker,
    lane: lane(c),
    opportunityStage: stageFromScore(score, evidenceStatus, evs),
    opportunityScore: score,
    actionPermission: 'RESEARCH_ONLY_NO_BUY_PERMISSION',
    whyInteresting: c.thesis,
    whyNow: evs.length
      ? evs.map(e => e.summary).slice(0, 3)
      : [`In Opportunity Scout with ${c.category || 'research'} classification.`],
    portfolioRole: role(c),
    priceFrame: price,
    evidenceStatus,
    evidenceRefs: evidenceRefs(c, evs),
    confirmBeforePromotion: list(c.confirmBeforeAdd).length ? list(c.confirmBeforeAdd) : ['fresh quote', 'primary-source business evidence', 'defined invalidation'],
    invalidationQuestions: list(c.keyRisks).length ? list(c.keyRisks).map(r => `Risk to invalidate/check: ${r}`) : ['No key risks loaded; packet cannot promote.'],
    missingForPromotion: [
      'primary-source filing/IR evidence attached',
      'defined add zone and invalidation level',
      'risk budget / max position size',
      'portfolio concentration impact',
      'decision owner review'
    ],
    relatedNativeEvents: evs.map(e => ({ eventId: e.eventId, eventType: e.eventType, severity: e.severity, summary: e.summary, question: e.nextResearchQuestion })),
    sourceBoundary: 'Local/public/internal evidence only. No web_search, no fresh news causality claim.'
  };
  return packet;
}).sort((a,b) => b.opportunityScore - a.opportunityScore);
const priority = packets.filter(p => ['PRIORITY_RESEARCH','BUILD_EVIDENCE_PACKET'].includes(p.opportunityStage)).slice(0, 8);
const output = {
  generatedAt: now,
  runMode: 'LOCAL_OPPORTUNITY_EVIDENCE_NO_WEB_SEARCH',
  status: packets.length ? 'ACTIVE' : 'EMPTY',
  policy: 'Opportunity packets identify research priority only. No packet authorizes a buy without primary evidence, price zone, invalidation, risk budget, and human review.',
  marketContext: {
    stressHeadline: stress.headline || null,
    broadAvgDayChangePct: stress.readings?.broadAvgDayChangePct ?? null,
    worstPressurePockets: list(stress.readings?.worstDecliners).slice(0, 6).map(x => ({ symbol: x.symbol, dayChangePct: pct(x.dayChangePct) }))
  },
  counts: {
    packets: packets.length,
    priorityResearch: packets.filter(p => p.opportunityStage === 'PRIORITY_RESEARCH').length,
    buildEvidencePacket: packets.filter(p => p.opportunityStage === 'BUILD_EVIDENCE_PACKET').length,
    researchOnly: packets.filter(p => p.actionPermission.includes('RESEARCH_ONLY')).length
  },
  priorityQueue: priority,
  packets
};
for (const rel of ['outputs/opportunity-evidence-packets.json', 'public/outputs/opportunity-evidence-packets.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ wrote: 'outputs/opportunity-evidence-packets.json', packets: packets.length, priority: priority.length, top: priority.slice(0,5).map(p => `${p.ticker}:${p.opportunityScore}`) }, null, 2));
