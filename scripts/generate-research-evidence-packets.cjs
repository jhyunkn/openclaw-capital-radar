const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const strategyPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const exposurePath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const dossierPath = path.join(root, 'outputs', 'thesis-dossiers.json');
const researchPath = path.join(root, 'outputs', 'research-candidate-map.json');
const outPath = path.join(root, 'outputs', 'research-evidence-packets.json');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const strategy = fs.existsSync(strategyPath) ? JSON.parse(fs.readFileSync(strategyPath, 'utf8')) : { interpretations: [] };
const exposure = fs.existsSync(exposurePath) ? JSON.parse(fs.readFileSync(exposurePath, 'utf8')) : { buckets: [] };
const dossiers = fs.existsSync(dossierPath) ? JSON.parse(fs.readFileSync(dossierPath, 'utf8')) : { all: [] };
const research = fs.existsSync(researchPath) ? JSON.parse(fs.readFileSync(researchPath, 'utf8')) : { allCandidates: [] };

const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const candidates = Array.isArray(research.allCandidates) ? research.allCandidates : [];
const strategyByTicker = new Map((strategy.interpretations || []).map(x => [String(x.ticker || '').toUpperCase(), x]));
const dossierByTicker = new Map((dossiers.all || []).map(x => [String(x.ticker || '').toUpperCase(), x]));
const candidateByTicker = new Map(candidates.map(x => [String(x.ticker || '').toUpperCase(), x]));
const list = value => Array.isArray(value) ? value : [];
const n = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
const nowIso = new Date().toISOString();

function source(label, type, asOf, confidence, fields, note) {
  return { label, type, asOf: asOf || null, confidence: confidence || 'unknown', fields: list(fields), note: note || '' };
}
function ageDays(asOf) {
  if (!asOf) return null;
  const d = new Date(asOf);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.round((Date.now() - d.getTime()) / 86400000));
}
function freshnessLabel(asOf) {
  const days = ageDays(asOf);
  if (days === null) return 'unknown';
  if (days <= 1) return 'fresh';
  if (days <= 7) return 'recent';
  if (days <= 30) return 'aging';
  return 'stale';
}
function exposureMatches(ticker) {
  return list(exposure.buckets).filter(bucket => list(bucket.members).some(m => String(m.ticker || '').toUpperCase() === ticker)).map(bucket => ({ id: bucket.id, label: bucket.label, weightPct: bucket.weightPct, pressure: bucket.pressure, interpretation: bucket.interpretation }));
}
function valuationSnapshot(x, interp) {
  const dc = x.dataContract || {};
  const fpe = dc.forwardPE ?? x.forwardPE ?? x.forwardPe ?? x.finviz?.metrics?.['Forward P/E'] ?? null;
  const fcf = dc.fcfYield ?? x.fcfYield ?? x.freeCashFlowYield ?? null;
  const exposureType = interp?.exposureType || 'unknown';
  let relevance = 'relevant';
  let interpretation = 'Valuation requires comparison to growth, margin durability, and macro regime.';
  if (exposureType === 'levered') { relevance = 'not-applicable'; interpretation = 'Traditional valuation is not the decision basis for levered daily-reset products; path, decay, liquidity, and underlying trend dominate.'; }
  else if (exposureType === 'crypto') { relevance = 'limited'; interpretation = 'Traditional valuation is limited; analyze liquidity regime, flows, adoption narrative, and drawdown risk.'; }
  else if (exposureType === 'index') { relevance = 'aggregate'; interpretation = 'Use broad-market valuation, earnings breadth, concentration, and liquidity rather than single-company valuation.'; }
  else if (fpe == null && fcf == null) { relevance = 'incomplete'; interpretation = 'Forward valuation data is missing; confidence should not be upgraded until sourced.'; }
  return { forwardPE: fpe ?? null, fcfYield: fcf ?? null, relevance, interpretation, sourceConfidence: dc.confidence || null, sourceAsOf: dc.sourceAsOf || null };
}
function earningsCatalysts(x, interp, dossier, candidate) {
  const nextEarningsDate = x.dataContract?.nextEarningsDate || x.nextEarningsDate || x.earningsDate || null;
  const catalysts = [];
  if (nextEarningsDate) catalysts.push({ type: 'earnings', date: nextEarningsDate, description: 'Next known earnings/event date from available metadata.', confidence: x.dataContract?.confidence?.nextEarningsDate || 'low' });
  for (const item of list(candidate?.confirmBeforeAdd || dossier?.confirmBeforeAdd)) catalysts.push({ type: 'confirm-before-add', date: null, description: item, confidence: 'medium' });
  for (const item of list(interp?.signalChangeConditions)) catalysts.push({ type: 'signal-change-condition', date: null, description: item, confidence: 'medium' });
  if (!catalysts.length) catalysts.push({ type: 'unmapped', date: null, description: 'No explicit catalyst calendar mapped; requires source-backed research.', confidence: 'missing' });
  return catalysts.slice(0, 8);
}
function macroSensitivity(x, interp, dossier) {
  const links = new Map();
  for (const item of list(dossier?.macroLinkage)) links.set(item, { factor: item, direction: 'mixed', confidence: 'medium', note: 'From thesis dossier macro linkage.' });
  for (const bucket of exposureMatches(String(x.ticker || '').toUpperCase())) links.set(bucket.label, { factor: bucket.label, direction: bucket.pressure, confidence: 'medium', note: bucket.interpretation });
  if (interp?.portfolioConflict?.status && interp.portfolioConflict.status !== 'No major conflict') links.set(interp.portfolioConflict.status, { factor: interp.portfolioConflict.status, direction: interp.portfolioConflict.tone || 'caution', confidence: 'medium', note: interp.portfolioConflict.reason });
  if (!links.size) links.set('unmapped macro sensitivity', { factor: 'unmapped macro sensitivity', direction: 'unknown', confidence: 'missing', note: 'Macro sensitivity requires research.' });
  return Array.from(links.values());
}
function dataConfidence(x, interp, valuation, sources) {
  const missing = [];
  if (valuation.forwardPE == null && valuation.relevance === 'relevant') missing.push('forwardPE');
  if (valuation.fcfYield == null && valuation.relevance === 'relevant') missing.push('fcfYield');
  if (!x.dataContract?.nextEarningsDate && interp?.exposureType === 'equity') missing.push('nextEarningsDate');
  const sourceScores = sources.map(s => s.confidence === 'high' ? 1 : s.confidence === 'medium' ? .7 : s.confidence === 'low' ? .4 : .1);
  const avg = sourceScores.length ? sourceScores.reduce((a,b)=>a+b,0)/sourceScores.length : .1;
  let score = Math.round(avg * 70 + Math.max(0, 30 - missing.length * 10));
  score = Math.max(0, Math.min(100, score));
  return { score, level: score >= 80 ? 'high' : score >= 60 ? 'medium' : score >= 40 ? 'low' : 'very-low', missing, interpretation: missing.length ? `Missing ${missing.join(', ')}; strategic confidence should remain constrained.` : 'Core evidence fields are sufficiently available for operating review.' };
}
function unresolvedQuestions(x, interp, dossier, valuation, confidence) {
  const questions = [];
  if (confidence.missing.length) questions.push(`Resolve missing data: ${confidence.missing.join(', ')}.`);
  if (valuation.relevance === 'incomplete') questions.push('What is the source-backed valuation regime and expectation gap?');
  if (valuation.relevance === 'not-applicable') questions.push('What volatility/decay path would invalidate tactical exposure?');
  if (!dossier?.exitCondition || /requires explicit|requires source/i.test(dossier.exitCondition)) questions.push('What exact condition invalidates the thesis?');
  if (interp?.portfolioConflict?.tone !== 'positive') questions.push(`How should ${x.ticker} be sized relative to portfolio conflict: ${interp?.portfolioConflict?.status}?`);
  if (!questions.length) questions.push('What new evidence would justify changing the current signal?');
  return questions.slice(0, 6);
}
function evidenceSummary(x, interp, dossier, valuation, confidence, macro) {
  const pieces = [];
  pieces.push(`${x.ticker} is classified as ${interp?.role || dossier?.role || 'unclassified'} with action permission: ${interp?.actionPermission?.status || 'Review'}.`);
  pieces.push(`Evidence confidence is ${confidence.level} (${confidence.score}/100).`);
  if (valuation.relevance === 'relevant') pieces.push(`Valuation snapshot: Forward PE ${valuation.forwardPE ?? 'missing'}, FCF Yield ${valuation.fcfYield ?? 'missing'}.`);
  else pieces.push(`Valuation relevance: ${valuation.relevance}; ${valuation.interpretation}`);
  pieces.push(`Macro sensitivity: ${macro.slice(0,3).map(m => m.factor).join(' · ')}.`);
  return pieces.join(' ');
}
function buildPacket(x, type) {
  const ticker = String(x.ticker || '').toUpperCase();
  const interp = strategyByTicker.get(ticker) || {};
  const dossier = dossierByTicker.get(ticker) || {};
  const candidate = candidateByTicker.get(ticker) || null;
  const asOf = x.priceAsOf || x.asOf || x.finviz?.asOf || state.meta?.generatedAt || state.meta?.reportDate || null;
  const sources = [
    source('report-state live JSON', 'internal-normalized-state', state.meta?.normalizedAtBuild || state.meta?.generatedAt || state.meta?.reportDate, 'medium', ['price','portfolioWeight','signal','performance'], 'Primary normalized state used by build.'),
    source('strategy interpretations JSON', 'derived-strategy', strategy.generatedAt, 'medium', ['actionPermission','urgency','decisionConfidence','portfolioConflict'], 'Derived from rule-based Strategy Interpreter.'),
    source('thesis dossiers JSON', 'derived-thesis', dossiers.generatedAt, 'medium', ['businessModel','macroLinkage','cases','confirmBeforeAdd','risks'], 'Dossier generated from available holdings, candidates, strategy interpretation, and agent notes.'),
    source('portfolio exposure map JSON', 'derived-portfolio-context', exposure.generatedAt, 'medium', ['portfolioPressure','macroSensitivity','exposureBuckets'], 'Portfolio-level exposure and conflict map.'),
    source('research candidate map JSON', 'derived-research', research.generatedAt, candidate ? 'medium' : 'missing', ['candidateScores','portfolioFit'], candidate ? 'Candidate appears in research map.' : 'Ticker is not a research candidate.')
  ];
  if (x.finviz) sources.push(source('Finviz-derived holding metadata', 'external-snapshot', x.finviz.asOf || asOf, 'medium', Object.keys(x.finviz.parsed || {}).concat(Object.keys(x.finviz.metrics || {})), 'External market/fundamental snapshot if available.'));
  const valuation = valuationSnapshot(x, interp);
  const catalysts = earningsCatalysts(x, interp, dossier, candidate);
  const macro = macroSensitivity(x, interp, dossier);
  const confidence = dataConfidence(x, interp, valuation, sources);
  const unresolved = unresolvedQuestions(x, interp, dossier, valuation, confidence);
  const freshest = sources.map(s => s.asOf).filter(Boolean).sort().reverse()[0] || nowIso;
  return {
    ticker,
    type,
    generatedAt: nowIso,
    freshness: { latestSourceAsOf: freshest, label: freshnessLabel(freshest), ageDays: ageDays(freshest) },
    evidenceSummary: evidenceSummary(x, interp, dossier, valuation, confidence, macro),
    sourceList: sources,
    valuationSnapshot: valuation,
    earningsCatalystCalendar: catalysts,
    macroSensitivity: macro,
    dataConfidence: confidence,
    unresolvedQuestions: unresolved,
    actionPermission: interp?.actionPermission || null,
    thesisReference: { confidence: dossier?.dossierConfidence || null, baseCase: dossier?.cases?.base || null, exitCondition: dossier?.exitCondition || null },
    portfolioContext: exposureMatches(ticker)
  };
}
const holdingPackets = holdings.map(h => buildPacket(h, 'holding'));
const candidatePackets = candidates.filter(c => !holdings.some(h => String(h.ticker || '').toUpperCase() === String(c.ticker || '').toUpperCase())).map(c => buildPacket(c, 'candidate'));
const result = { generatedAt: nowIso, purpose: 'Research Evidence Engine: evidence summaries, sources, freshness, valuation, catalysts, macro sensitivity, data confidence, unresolved questions.', holdings: holdingPackets, candidates: candidatePackets, all: [...holdingPackets, ...candidatePackets] };
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(result, null, 2) + '\n');
console.log(`generated research evidence packets: ${holdingPackets.length} holdings / ${candidatePackets.length} candidates`);
