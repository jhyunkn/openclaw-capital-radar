const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const coveragePath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const outPath = path.join(root, 'outputs', 'ic-decision-memos.json');
if (!fs.existsSync(coveragePath)) throw new Error('portfolio-thesis-coverage-map.json missing');
if (!fs.existsSync(interpPath)) throw new Error('strategy-interpretations.json missing');
const coverage = JSON.parse(fs.readFileSync(coveragePath, 'utf8'));
const interp = JSON.parse(fs.readFileSync(interpPath, 'utf8'));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = new Map((state.holdings || []).map(h => [String(h.ticker || '').toUpperCase(), h]));
const interpByTicker = new Map((interp.interpretations || []).map(i => [String(i.ticker || '').toUpperCase(), i]));
const n = v => { const x = Number(v); return Number.isFinite(x) ? x : null; };
function money(v){ const x = n(v); return x == null ? 'n/a' : `$${x.toLocaleString(undefined, { maximumFractionDigits: x < 1 ? 4 : 2 })}`; }
function pct(v){ const x = n(v); return x == null ? 'n/a' : `${x >= 0 ? '+' : ''}${x.toFixed(2)}%`; }
function missingSummary(row){
  const missing = row.missingEvidence || [];
  if (!missing.length) return 'No missing evidence or breach flagged by current coverage model.';
  return missing.slice(0,3).map(m => `${m.category}: ${m.finding}`).join(' | ');
}
function actionDecision(row, i, h){
  const signal = String(row.signal || h?.computedSignal || h?.signal || '').toUpperCase();
  const permission = String(row.actionPermission || i?.actionPermission?.status || 'Research required');
  const state = row.coverageState;
  const blocked = row.blockedForAction || /No action|No add|exit review|trim watch/i.test(permission);
  if (signal.includes('EXIT')) return { label: 'EXIT REVIEW', tone: 'danger', allowedAction: 'No add. Review exit or risk reduction before any new capital.', strict: true };
  if (signal.includes('TRIM')) return { label: 'TRIM REVIEW', tone: 'danger', allowedAction: 'No add. Review trim/rebalance conditions first.', strict: true };
  if (signal.includes('INVESTIGATE')) return { label: 'DO NOT ADD', tone: 'danger', allowedAction: 'Hold-only or reduce-risk review until thesis/data verification clears.', strict: true };
  if (blocked || state === 'constrained') return { label: 'CAPITAL BLOCKED', tone: 'danger', allowedAction: 'No new capital until the blocking condition is resolved.', strict: true };
  if (/Add review allowed/i.test(permission)) return { label: 'ADD REVIEW ALLOWED', tone: 'positive', allowedAction: 'Review add only near the stated threshold and only if thesis/evidence gates remain intact.', strict: false };
  if (state === 'partial' || state === 'thin') return { label: 'RESEARCH FIRST', tone: 'caution', allowedAction: 'No action until missing evidence or underwriting gaps are resolved.', strict: true };
  return { label: 'HOLD / MONITOR', tone: 'positive', allowedAction: 'Hold and monitor; no automatic action is implied.', strict: false };
}
function decisionReason(row, i, h, decision){
  const boundary = i?.nearestDecisionBoundary;
  const pieces = [];
  pieces.push(`Coverage state is ${row.coverageState} with score ${row.thesisCoverageScore}% against required ${row.minimumRequired}%.`);
  if (row.blockedForAction) pieces.push('Action is blocked by signal, permission, or position-size rule.');
  if (i?.positionPressure?.reason) pieces.push(i.positionPressure.reason);
  if (i?.dataConfidence?.reason && i.dataConfidence.tone !== 'positive') pieces.push(i.dataConfidence.reason);
  if (i?.portfolioConflict?.reason && i.portfolioConflict.tone !== 'positive') pieces.push(i.portfolioConflict.reason);
  if (boundary) pieces.push(`Nearest relevant threshold is ${boundary.label} at ${money(boundary.value)} (${pct(boundary.distancePct)} away).`);
  return pieces.slice(0,4).join(' ');
}
function make(row){
  const ticker = String(row.ticker || '').toUpperCase();
  const i = interpByTicker.get(ticker) || {};
  const h = holdings.get(ticker) || {};
  const decision = actionDecision(row, i, h);
  const boundary = i.nearestDecisionBoundary || row.thesisChain?.nearestThreshold || null;
  return {
    ticker,
    generatedAt: new Date().toISOString(),
    decision: decision.label,
    tone: decision.tone,
    strict: decision.strict,
    oneLine: `${ticker} — ${decision.label}`,
    reason: decisionReason(row, i, h, decision),
    allowedAction: decision.allowedAction,
    forbiddenAction: decision.strict ? 'Do not add capital from this memo alone.' : 'Do not treat review permission as automatic execution.',
    coverageState: row.coverageState,
    thesisCoverageScore: row.thesisCoverageScore,
    minimumRequired: row.minimumRequired,
    actionPermission: row.actionPermission,
    humanReviewRequired: row.humanReviewRequired,
    blockedForAction: row.blockedForAction,
    nearestThreshold: boundary ? {
      label: boundary.label,
      value: boundary.value,
      distancePct: boundary.distancePct,
      thresholdPct: boundary.thresholdPct,
      source: boundary.source || 'strategy-interpreter'
    } : null,
    missingEvidenceSummary: missingSummary(row),
    missingEvidence: row.missingEvidence || [],
    nextStep: row.nextStep,
    sourceLinks: {
      coverageMap: '/outputs/portfolio-thesis-coverage-map.json',
      strategyInterpretations: '/outputs/strategy-interpretations.json',
      thresholds: '/outputs/signal-thresholds.json'
    }
  };
}
const memos = (coverage.holdings || []).map(make);
const summary = {
  generatedAt: new Date().toISOString(),
  total: memos.length,
  doNotAdd: memos.filter(m => ['DO NOT ADD','CAPITAL BLOCKED','EXIT REVIEW','TRIM REVIEW','RESEARCH FIRST'].includes(m.decision)).length,
  addReviewAllowed: memos.filter(m => m.decision === 'ADD REVIEW ALLOWED').length,
  holdMonitor: memos.filter(m => m.decision === 'HOLD / MONITOR').length,
  humanReviewRequired: memos.filter(m => m.humanReviewRequired).length,
  strict: memos.filter(m => m.strict).length
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ layer: 'ic-decision-memos', policy: 'Decision memos are permission grammar, not trade execution. They make allowed and forbidden actions explicit.', summary, memos }, null, 2) + '\n');
console.log(`generated ${memos.length} IC decision memos: ${summary.doNotAdd} restricted / ${summary.addReviewAllowed} add-review`);
