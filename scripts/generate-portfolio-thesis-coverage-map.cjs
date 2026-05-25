const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const exposurePath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const dossierPath = path.join(root, 'data', 'thesis', 'sample-thesis-dossiers.json');
const evidencePath = path.join(root, 'data', 'research', 'sample-evidence-packets.json');
const outPath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const interpretations = fs.existsSync(interpPath) ? JSON.parse(fs.readFileSync(interpPath, 'utf8')).interpretations || [] : [];
const exposure = fs.existsSync(exposurePath) ? JSON.parse(fs.readFileSync(exposurePath, 'utf8')) : { buckets: [] };
const dossiers = fs.existsSync(dossierPath) ? JSON.parse(fs.readFileSync(dossierPath, 'utf8')) : [];
const evidence = fs.existsSync(evidencePath) ? JSON.parse(fs.readFileSync(evidencePath, 'utf8')) : [];
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const n = v => { const x = Number(v); return Number.isFinite(x) ? x : 0; };
const text = v => String(v || '').trim();
const dossierByTicker = new Map(dossiers.map(d => [String(d.ticker || '').toUpperCase(), d]));
const interpByTicker = new Map(interpretations.map(i => [String(i.ticker || '').toUpperCase(), i]));
const evidenceByTicker = new Map();
for (const item of evidence) {
  const ticker = String(item.ticker || '').toUpperCase();
  if (!evidenceByTicker.has(ticker)) evidenceByTicker.set(ticker, []);
  evidenceByTicker.get(ticker).push(item);
}
function bucketFor(ticker) {
  for (const bucket of exposure.buckets || []) {
    if ((bucket.members || []).some(m => String(m.ticker || '').toUpperCase() === ticker)) return bucket;
  }
  return null;
}
function classifyRole(h, bucket) {
  const ticker = String(h.ticker || '').toUpperCase();
  if (['TSLT','CONL'].includes(ticker)) return 'levered_tactical';
  if (ticker === 'BMNR') return 'speculative';
  if (ticker === 'SPY') return 'index_core';
  return bucket?.id || 'single_name';
}
function scoreBool(ok, points) { return ok ? points : 0; }
function sourceEvidenceStatus(ticker, ev, speculative) {
  const substantive = ev.filter(item => {
    const sourceType = String(item.sourceType || '').toLowerCase();
    const sourceName = String(item.sourceName || '').toLowerCase();
    const claimType = String(item.claimType || '').toLowerCase();
    const hasExternalAnchor = Boolean(item.sourceUrl) || /sec|filing|10-k|10-q|8-k|investor|earnings|presentation|transcript|company|exchange|primary/i.test(`${item.sourceName || ''} ${item.notes || ''}`);
    const governanceOnly = /policy|requirement|warning|governance/i.test(sourceName) || /governance/.test(claimType);
    if (governanceOnly) return false;
    if (sourceType === 'internal' && !hasExternalAnchor) return false;
    return true;
  });
  if (!ev.length) return { score: 0, status: 'missing', finding: 'No source evidence packet attached.', substantiveCount: 0, governanceOnlyCount: 0 };
  if (!substantive.length) return { score: 0, status: 'missing', finding: `${ev.length} packet(s) attached, but none are substantive primary/external thesis evidence.`, substantiveCount: 0, governanceOnlyCount: ev.length };
  return { score: 18, status: 'covered', finding: `${substantive.length} substantive evidence packet(s) attached.`, substantiveCount: substantive.length, governanceOnlyCount: ev.length - substantive.length };
}
function highRiskEvidenceReview({ ticker, h, d, ev, fundamentals, thesisText, invalidation, bucket, overCap }) {
  const t = String(ticker || '').toUpperCase();
  if (!['BMNR','TSNF','TSLT','CONL'].includes(t) && !/speculative|levered|crypto/i.test(`${bucket?.label || ''} ${d?.positionRole || ''}`)) return null;
  const evidenceText = `${JSON.stringify(ev)} ${thesisText} ${JSON.stringify(invalidation)} ${JSON.stringify(fundamentals)} ${h.watch || ''}`.toLowerCase();
  const requirements = [
    { id: 'company_thesis', label: 'Company/vehicle thesis', passed: thesisText.length >= 90 && !/potential asymmetry if thesis is real|requiring a human-reviewed thesis/i.test(thesisText), needed: 'Specific source-backed operating/vehicle thesis; not just placeholder optionality.' },
    { id: 'primary_source_evidence', label: 'Primary/source evidence', passed: ev.some(x => x.sourceUrl || /sec|filing|10-k|10-q|8-k|investor|presentation|transcript|company/i.test(`${x.sourceName || ''} ${x.notes || ''}`)), needed: 'Attach SEC filing, issuer materials, prospectus/holding disclosure, or earnings/IR evidence.' },
    { id: 'liquidity_balance_sheet', label: 'Liquidity / balance-sheet evidence', passed: /liquidity|cash|debt|working capital|current assets|assets under management|aum|volume|spread/.test(evidenceText), needed: 'Define liquidity runway, trading liquidity, balance-sheet constraints, or ETF liquidity mechanics.' },
    { id: 'dilution_structural_risk', label: 'Dilution / structural risk', passed: /dilution|atm|share issuance|convertible|warrant|expense ratio|creation|redemption|tracking|structural/.test(evidenceText), needed: 'Identify dilution, issuance, ETF structure, tracking, fees, or embedded decay/structural risks.' },
    { id: 'downside_invalidation', label: 'Downside / invalidation path', passed: Array.isArray(invalidation) && invalidation.length >= 2 && String(invalidation.join(' ')).length >= 80, needed: 'Two or more concrete invalidation triggers tied to evidence and price/risk behavior.' },
    { id: 'catalyst_path', label: 'Catalyst path', passed: Boolean(fundamentals.nextEarningsDate) || /catalyst|earnings|filing|rebalance|launch|approval|guidance|staking|holdings|cycle/.test(evidenceText), needed: 'Named catalyst/event path and what evidence would confirm or reject it.' },
    { id: 'position_size_fit', label: 'Position-size fit', passed: !overCap, needed: 'Exposure must fit speculative/levered risk budget before any add review.' }
  ];
  const missing = requirements.filter(r => !r.passed).map(r => ({ id: r.id, label: r.label, needed: r.needed }));
  return {
    status: missing.length ? 'insufficient_for_confident_posture' : 'sufficient_for_review_not_execution',
    passed: requirements.length - missing.length,
    total: requirements.length,
    missing,
    permissionEffect: missing.length ? 'research_only_or_hold_reduce_review' : 'eligible_for_human_review_only'
  };
}
function evaluate(h) {
  const ticker = String(h.ticker || '').toUpperCase();
  const d = dossierByTicker.get(ticker);
  const interp = interpByTicker.get(ticker);
  const ev = evidenceByTicker.get(ticker) || [];
  const bucket = bucketFor(ticker);
  const thesisText = text(d?.coreThesis || h.thesis || h.actionRationale);
  const invalidation = d?.invalidationTriggers || (h.watch ? [h.watch] : []);
  const fundamentals = h.dataContract || {};
  const role = classifyRole(h, bucket);
  const speculative = ['BMNR','TSNF','TSLT','CONL'].includes(ticker) || /speculative|levered|crypto/i.test(`${role} ${bucket?.label || ''}`);
  const actionPermission = interp?.actionPermission?.status || (speculative ? 'Human review required' : 'Research required');
  const signal = String(h.computedSignal || h.signal || 'Review');
  const overCap = bucket && typeof bucket.capPct === 'number' && n(h.portfolioWeightPct) > bucket.capPct;
  const sourceEvidence = sourceEvidenceStatus(ticker, ev, speculative);
  const actionBlocked = /No action|No add|exit review|trim watch/i.test(actionPermission) || /INVESTIGATE|EXIT|TRIM/i.test(signal) || overCap;
  const highRiskReview = highRiskEvidenceReview({ ticker, h, d, ev, fundamentals, thesisText, invalidation, bucket, overCap });
  const categories = {
    businessModel: {
      score: scoreBool(thesisText.length >= 35, 12),
      max: 12,
      status: thesisText.length >= 35 ? 'covered' : 'missing',
      finding: thesisText.length >= 35 ? 'Business/thesis text exists.' : 'Business model thesis is too thin.'
    },
    valuation: {
      score: scoreBool(fundamentals.notApplicable || fundamentals.forwardPE != null || fundamentals.fcfYield != null, 12),
      max: 12,
      status: fundamentals.notApplicable ? 'not_applicable' : (fundamentals.forwardPE != null || fundamentals.fcfYield != null ? 'covered' : 'missing'),
      finding: fundamentals.notApplicable ? fundamentals.reason || 'Operating fundamentals not applicable.' : `Forward PE ${fundamentals.forwardPE ?? 'missing'}; FCF yield ${fundamentals.fcfYield ?? 'missing'}.`
    },
    catalyst: {
      score: scoreBool(fundamentals.nextEarningsDate || /catalyst|earnings|guidance|capex|cycle|review|watch/i.test(`${h.watch || ''} ${interp?.newInformation?.join(' ') || ''}`), 10),
      max: 10,
      status: fundamentals.nextEarningsDate || /catalyst|earnings|guidance|capex|cycle|review|watch/i.test(`${h.watch || ''} ${interp?.newInformation?.join(' ') || ''}`) ? 'covered' : 'missing',
      finding: fundamentals.nextEarningsDate ? `Next event date: ${fundamentals.nextEarningsDate}.` : 'Catalyst/event trigger needs definition.'
    },
    riskInvalidation: {
      score: scoreBool(Array.isArray(invalidation) && invalidation.length > 0 && text(invalidation.join(' ')).length >= 25, 16),
      max: 16,
      status: Array.isArray(invalidation) && invalidation.length > 0 && text(invalidation.join(' ')).length >= 25 ? 'covered' : 'missing',
      finding: Array.isArray(invalidation) && invalidation.length > 0 ? invalidation.slice(0,2).join(' · ') : 'No invalidation trigger.'
    },
    positionSizing: {
      score: scoreBool(h.portfolioWeightPct != null && bucket && typeof bucket.capPct === 'number' && !overCap, 12),
      max: 12,
      status: h.portfolioWeightPct != null && bucket ? (overCap ? 'breach' : 'covered') : 'missing',
      finding: bucket ? `${n(h.portfolioWeightPct).toFixed(2)}% in ${bucket.label}; review cap ${bucket.capPct}%.${overCap ? ' Position exceeds review cap.' : ''}` : 'No exposure bucket mapped.'
    },
    macroSensitivity: {
      score: scoreBool(interp?.portfolioConflict || bucket, 10),
      max: 10,
      status: interp?.portfolioConflict || bucket ? 'covered' : 'missing',
      finding: interp?.portfolioConflict?.reason || bucket?.interpretation || 'Macro/exposure sensitivity not mapped.'
    },
    dataFreshness: {
      score: scoreBool(state.meta?.generatedAt && h.priceAsOf, 10),
      max: 10,
      status: state.meta?.generatedAt && h.priceAsOf ? 'covered' : 'missing',
      finding: state.meta?.generatedAt && h.priceAsOf ? `Report ${state.meta.generatedAt}; price ${h.priceAsOf}.` : 'Freshness metadata incomplete.'
    },
    sourceEvidence: {
      score: sourceEvidence.score,
      max: 18,
      status: sourceEvidence.status,
      finding: sourceEvidence.finding
    }
  };
  const total = Object.values(categories).reduce((sum, c) => sum + c.score, 0);
  const max = Object.values(categories).reduce((sum, c) => sum + c.max, 0);
  const score = Math.round((total / max) * 100);
  const missing = Object.entries(categories).filter(([, c]) => c.status === 'missing' || c.status === 'breach').map(([k, c]) => ({ category: k, finding: c.finding }));
  const minimumRequired = speculative ? 80 : ticker === 'SPY' ? 55 : 65;
  let coverageState = score >= minimumRequired && missing.length <= (speculative ? 1 : 2) ? 'underwritten' : score >= 45 ? 'partial' : 'thin';
  if (actionBlocked && coverageState === 'underwritten') coverageState = 'constrained';
  return {
    ticker,
    role,
    positionStatus: d?.positionStatus || 'holding',
    signal,
    actionPermission,
    thesisCoverageScore: score,
    minimumRequired,
    coverageState,
    blockedForAction: actionBlocked,
    humanReviewRequired: speculative || d?.humanReviewRequired === true || /INVESTIGATE|EXIT|TRIM/i.test(signal),
    categories,
    missingEvidence: missing,
    thesisChain: {
      thesis: thesisText || 'Missing thesis.',
      signal,
      nearestThreshold: interp?.nearestDecisionBoundary || null,
      actionPermission,
      invalidation: Array.isArray(invalidation) ? invalidation : [String(invalidation || '')].filter(Boolean)
    },
    highRiskEvidenceReview: highRiskReview,
    nextStep: actionBlocked ? 'Resolve action block before capital movement; coverage alone is not permission.' : (missing.length ? `Attach/define: ${missing.slice(0,3).map(m => m.category).join(', ')}.` : 'Coverage is sufficient for monitoring; still requires human decision for capital action.')
  };
}
const holdingsCoverage = holdings.map(evaluate);
const summary = {
  totalHoldings: holdingsCoverage.length,
  underwritten: holdingsCoverage.filter(x => x.coverageState === 'underwritten').length,
  constrained: holdingsCoverage.filter(x => x.coverageState === 'constrained').length,
  partial: holdingsCoverage.filter(x => x.coverageState === 'partial').length,
  thin: holdingsCoverage.filter(x => x.coverageState === 'thin').length,
  humanReviewRequired: holdingsCoverage.filter(x => x.humanReviewRequired).length,
  blockedForAction: holdingsCoverage.filter(x => x.blockedForAction).length,
  averageCoverageScore: Math.round(holdingsCoverage.reduce((s, x) => s + x.thesisCoverageScore, 0) / Math.max(1, holdingsCoverage.length)),
  weakestCoverage: holdingsCoverage.slice().sort((a,b) => a.thesisCoverageScore - b.thesisCoverageScore).slice(0, 5).map(x => ({ ticker: x.ticker, score: x.thesisCoverageScore, state: x.coverageState, missing: x.missingEvidence.map(m => m.category) }))
};
const result = {
  generatedAt: new Date().toISOString(),
  layer: 'portfolio-thesis-coverage-map',
  policy: 'Coverage score measures documentation/evidence completeness. Coverage state also respects action blocks, signal state, and position-size breaches. It does not authorize autonomous trades.',
  summary,
  holdings: holdingsCoverage,
  recommendedNextMove: 'Attach primary evidence packets and resolve constrained action states before M2 signal-performance attribution.'
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated portfolio thesis coverage map: ${summary.underwritten} underwritten / ${summary.constrained} constrained / ${summary.partial} partial / ${summary.thin} thin`);
