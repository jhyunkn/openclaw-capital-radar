const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const notesDir = path.join(root, 'agent-notes', 'tickers');
const outPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const list = value => Array.isArray(value) ? value : [];
const n = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
function readNote(ticker) {
  const file = path.join(notesDir, `${String(ticker).toLowerCase()}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
function exposureType(h) {
  const ticker = String(h.ticker || '').toUpperCase();
  const text = `${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''}`.toLowerCase();
  if (['TSLT','CONL','TMF','TQQQ','SQQQ','SOXL','SOXS','BITX'].includes(ticker)) return 'levered';
  if (/levered|decay product|daily reset|2x|3x|option/i.test(text)) return 'levered';
  if (['IBIT','BITO','ETHE'].includes(ticker) || /crypto|bitcoin|ethereum/i.test(text)) return 'crypto';
  if (['SPY','QQQ','IWM','DIA','VTI','VOO'].includes(ticker) || /index|etf basket|broad market/i.test(text)) return 'index';
  return 'equity';
}
function riskCap(h) { const type = exposureType(h); return type === 'levered' || type === 'crypto' ? 5 : 15; }
function distance(current, target) { return current > 0 && target > 0 ? ((target - current) / current) * 100 : null; }
function thresholdCandidates(h) {
  const t = h.signalThresholds || {};
  const current = n(h.livePrice);
  return [
    ['vol-adjusted add zone', t.addPrice, t.addPct, 'positive'],
    ['vol-adjusted trim zone', t.trimPrice, t.trimPct, 'caution'],
    ['vol-adjusted risk review', t.riskReviewPrice, t.riskReviewPct, 'danger']
  ].map(([label, value, pct, tone]) => ({ label, value: n(value), thresholdPct: n(pct), tone, distancePct: Number.isFinite(n(value)) ? distance(current, n(value)) : null, source: 'signalThresholds' }))
    .filter(x => Number.isFinite(x.value) && Number.isFinite(x.distancePct));
}
function nearestBoundary(h) {
  const candidates = thresholdCandidates(h);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];
}
function thesisStatus(h, note) {
  const signal = String(h.computedSignal || h.signal || '').toUpperCase();
  const thesis = `${note?.agentThesis?.baseCase || ''} ${h.thesis || ''} ${h.actionRationale || ''}`.trim();
  const invalidation = note?.agentThesis?.invalidation || h.watch || '';
  if (signal.includes('EXIT')) return { status: 'Threatened', tone: 'danger', reason: 'Exit review signal requires thesis invalidation check before any further capital.' };
  if (signal.includes('INVESTIGATE')) return { status: 'Unverified', tone: 'caution', reason: 'Signal requires source/thesis validation before action.' };
  if (!thesis || thesis.length < 80) return { status: 'Underwritten weakly', tone: 'caution', reason: 'Thesis text is too thin for high-confidence strategy.' };
  if (!invalidation || /define|pending|required/i.test(invalidation)) return { status: 'Intact but incomplete', tone: 'caution', reason: 'Thesis exists but invalidation condition needs sharpening.' };
  return { status: 'Intact', tone: 'positive', reason: 'Thesis, rationale, and invalidation language are present.' };
}
function dataConfidence(h) {
  const conf = h.dataContract?.confidence || {};
  const na = h.dataContract?.notApplicable === true;
  const fields = ['forwardPE', 'fcfYield', 'nextEarningsDate'];
  const missing = fields.filter(f => !na && (!h.dataContract || conf[f] === 'missing' || h.dataContract[f] == null));
  if (na) return { status: 'Not applicable', tone: 'positive', missing: [], reason: h.dataContract?.reason || 'Operating fundamentals are not applicable to this instrument.' };
  if (missing.length >= 2) return { status: 'Weak data', tone: 'danger', missing, reason: `Missing ${missing.join(', ')}.` };
  if (missing.length === 1) return { status: 'Partial data', tone: 'caution', missing, reason: `Missing ${missing[0]}.` };
  return { status: 'Usable data', tone: 'positive', missing, reason: 'Core valuation/event fields are available.' };
}
function positionPressure(h) {
  const weight = n(h.portfolioWeightPct);
  const cap = riskCap(h);
  if (!Number.isFinite(weight)) return { status: 'Unknown', tone: 'caution', cap, reason: 'Weight missing.' };
  const ratio = weight / cap;
  if (ratio >= 1) return { status: 'Over budget', tone: 'danger', cap, reason: `${weight.toFixed(2)}% exceeds ${cap}% cap.` };
  if (ratio >= .85) return { status: 'Near cap', tone: 'caution', cap, reason: `${weight.toFixed(2)}% is near ${cap}% cap.` };
  return { status: 'Inside budget', tone: 'positive', cap, reason: `${weight.toFixed(2)}% is inside ${cap}% cap.` };
}
function trendRead(h) {
  const p5 = n(h.perf5dPct), p1 = n(h.perf1mPct), p3 = n(h.perf3mPct);
  if ([p5, p1, p3].every(v => Number.isFinite(v) && v > 0)) return { status: 'Broadly supportive', tone: 'positive', reason: '5D, 1M, and 3M are positive.' };
  if ([p5, p1, p3].every(v => Number.isFinite(v) && v < 0)) return { status: 'Deteriorating', tone: 'danger', reason: '5D, 1M, and 3M are negative.' };
  if (Number.isFinite(p1) && Number.isFinite(p3) && p1 > 0 && p3 > 0) return { status: 'Supportive', tone: 'positive', reason: '1M and 3M trend remain positive.' };
  if (Number.isFinite(p1) && Number.isFinite(p3) && p1 < 0 && p3 < 0) return { status: 'Weakening', tone: 'caution', reason: '1M and 3M trend are negative.' };
  return { status: 'Mixed', tone: 'caution', reason: 'Momentum signals are split.' };
}
function role(h) {
  const type = exposureType(h);
  const text = `${h.exposureBucket || h.role || ''}`;
  if (type === 'levered') return 'Tactical torque / decay risk';
  if (type === 'crypto') return 'Liquidity-cycle exposure';
  if (type === 'index') return 'Portfolio ballast / market beta';
  if (/AI|infrastructure|compounder/i.test(text)) return 'Core AI / infrastructure compounder';
  return 'Single-name equity exposure';
}
function portfolioConflict(h) {
  const ticker = String(h.ticker || '').toUpperCase();
  const roleText = `${h.exposureBucket || ''} ${h.role || ''} ${h.thesis || ''}`.toLowerCase();
  const aiNames = holdings.filter(x => /AI|infrastructure|cloud|semiconductor|data center/i.test(`${x.exposureBucket || ''} ${x.role || ''} ${x.thesis || ''}`));
  const leveredNames = holdings.filter(x => ['TSLT','CONL','TMF','TQQQ','SQQQ','SOXL','SOXS','BITX'].includes(String(x.ticker || '').toUpperCase()) || /levered|decay product|daily reset|2x|3x/i.test(`${x.exposureBucket || ''} ${x.role || ''} ${x.thesis || ''}`));
  if (/AI|infrastructure|cloud|semiconductor|data center/i.test(roleText) && aiNames.length >= 3) return { status: 'AI concentration', tone: 'caution', reason: `${aiNames.length} holdings map to AI/infrastructure exposure; avoid treating each as independent risk.` };
  if (exposureType(h) === 'levered' && leveredNames.length >= 2) return { status: 'Levered cluster', tone: 'danger', reason: `${leveredNames.length} levered/decay products exist; correlation and decay risk can compound.` };
  if (ticker === 'AMZN' && n(h.portfolioWeightPct) >= 13) return { status: 'Single-name concentration', tone: 'caution', reason: 'AMZN is near the single-name concentration limit.' };
  return { status: 'No major conflict', tone: 'positive', reason: 'No dominant portfolio conflict detected from current tags.' };
}
function actionPermission(h, pressure, thesis, data) {
  const signal = String(h.computedSignal || h.signal || '').toUpperCase();
  const boundary = nearestBoundary(h);
  if (signal.includes('EXIT')) return { status: 'No add / exit review', tone: 'danger', reason: 'Exit review overrides price proximity.' };
  if (signal.includes('TRIM')) return { status: 'No add / trim watch', tone: 'danger', reason: 'Trim watch overrides add-zone proximity.' };
  if (signal.includes('INVESTIGATE')) return { status: 'No action until verified', tone: 'caution', reason: 'Investigate means resolve thesis/data before capital movement.' };
  if (pressure.tone !== 'positive') return { status: 'Hold only', tone: 'caution', reason: `Position is ${pressure.status.toLowerCase()}; adding is blocked by risk budget.` };
  if (data.tone === 'danger') return { status: 'Hold / verify data', tone: 'caution', reason: 'Data confidence is too weak for an add decision.' };
  if (boundary?.label === 'vol-adjusted add zone' && Math.abs(boundary.distancePct) <= 4 && thesis.tone !== 'danger') return { status: 'Add review allowed', tone: 'positive', reason: 'Price is near volatility-adjusted add zone and no risk-budget block is detected.' };
  return { status: 'Hold / monitor', tone: 'positive', reason: 'No immediate action condition is fully satisfied.' };
}
function urgency(h, boundary, pressure, data, trend, action) {
  const signal = String(h.computedSignal || h.signal || '').toUpperCase();
  if (signal.includes('EXIT') || pressure.tone === 'danger') return { level: 'Now', tone: 'danger', reason: 'Exit/risk-budget pressure requires immediate review.' };
  if (signal.includes('TRIM') || data.tone === 'danger') return { level: 'This week', tone: 'caution', reason: 'Trim watch or weak data needs near-term review.' };
  if (boundary && Math.abs(boundary.distancePct) <= 3) return { level: 'Soon', tone: 'caution', reason: `Near ${boundary.label}.` };
  if (trend.tone === 'danger') return { level: 'Soon', tone: 'caution', reason: 'Trend deterioration should be monitored.' };
  if (action.status.includes('Hold')) return { level: 'Monitor', tone: 'positive', reason: 'No action threshold is confirmed.' };
  return { level: 'Monitor', tone: 'positive', reason: 'No urgent conflict detected.' };
}
function newInformation(h, boundary, pressure, data, trend, conflict) {
  const items = [];
  if (boundary && Math.abs(boundary.distancePct) <= 4) items.push(`Near ${boundary.label} (${boundary.distancePct >= 0 ? '+' : ''}${boundary.distancePct.toFixed(2)}%; ${boundary.thresholdPct >= 0 ? '+' : ''}${boundary.thresholdPct.toFixed(2)}% threshold).`);
  if (pressure.tone !== 'positive') items.push(pressure.reason);
  if (data.tone !== 'positive') items.push(data.reason);
  if (trend.tone !== 'positive') items.push(trend.reason);
  if (conflict.tone !== 'positive') items.push(conflict.reason);
  return items.length ? items.slice(0, 3) : ['No material new pressure detected from current processed data.'];
}
function signalChangeConditions(h, boundary, pressure, data) {
  const t = h.signalThresholds || {};
  const conditions = [];
  if (Number.isFinite(n(t.addPrice))) conditions.push(`Add review only near $${n(t.addPrice).toFixed(2)} (${n(t.addPct).toFixed(2)}% vol-adjusted band) with thesis/data gates clear.`);
  if (Number.isFinite(n(t.trimPrice))) conditions.push(`Trim/rebalance review near $${n(t.trimPrice).toFixed(2)} (+${n(t.trimPct).toFixed(2)}% vol-adjusted band) or if weight exceeds cap.`);
  if (Number.isFinite(n(t.riskReviewPrice))) conditions.push(`Risk/exit review if price breaks $${n(t.riskReviewPrice).toFixed(2)} (${n(t.riskReviewPct).toFixed(2)}% vol-adjusted band) or thesis invalidation triggers.`);
  if (data.tone === 'danger') conditions.push('Signal confidence improves only after missing data is resolved.');
  if (pressure.tone !== 'positive') conditions.push('Adding remains blocked until position pressure is reduced.');
  return conditions.slice(0, 5);
}
function decisionConfidence(thesis, data, trend, pressure, conflict) {
  const tones = [thesis.tone, data.tone, trend.tone, pressure.tone, conflict.tone];
  const score = tones.reduce((sum, tone) => sum + (tone === 'positive' ? 20 : tone === 'caution' ? 10 : 0), 0);
  if (score >= 80) return { level: 'High', score, tone: 'positive', reason: 'Most decision factors are supportive.' };
  if (score >= 50) return { level: 'Medium', score, tone: 'caution', reason: 'Several factors conflict or require verification.' };
  return { level: 'Low', score, tone: 'danger', reason: 'Decision is constrained by weak data, risk, trend, or thesis conflict.' };
}
function interpret(h) {
  const note = readNote(h.ticker);
  const boundary = nearestBoundary(h);
  const thesis = thesisStatus(h, note);
  const data = dataConfidence(h);
  const pressure = positionPressure(h);
  const trend = trendRead(h);
  const conflict = portfolioConflict(h);
  const action = actionPermission(h, pressure, thesis, data);
  const urgent = urgency(h, boundary, pressure, data, trend, action);
  const confidence = decisionConfidence(thesis, data, trend, pressure, conflict);
  return { ticker: h.ticker, signal: h.computedSignal || h.signal || 'Review', role: role(h), exposureType: exposureType(h), riskCap: riskCap(h), thresholdPolicy: h.signalThresholds?.formula || 'missing_signal_thresholds', thesisStatus: thesis, actionPermission: action, urgency: urgent, newInformation: newInformation(h, boundary, pressure, data, trend, conflict), nearestDecisionBoundary: boundary, positionPressure: pressure, trendRead: trend, dataConfidence: data, portfolioConflict: conflict, decisionConfidence: confidence, signalChangeConditions: signalChangeConditions(h, boundary, pressure, data) };
}
const interpretations = holdings.map(interpret);
const homepage = {
  actNow: interpretations.filter(x => x.urgency.level === 'Now'),
  reviewSoon: interpretations.filter(x => ['This week','Soon'].includes(x.urgency.level)),
  blockedAdds: interpretations.filter(x => /No action|No add|Hold only|verify/i.test(x.actionPermission.status)),
  weakData: interpretations.filter(x => x.dataConfidence.tone !== 'positive'),
  portfolioConflicts: interpretations.filter(x => x.portfolioConflict.tone !== 'positive'),
  highConfidence: interpretations.filter(x => x.decisionConfidence.level === 'High')
};
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), policy: 'Strategy Interpreter uses h.signalThresholds as the authoritative signal-change source.', homepage, interpretations }, null, 2) + '\n');
console.log(`generated strategy interpretations for ${interpretations.length} holdings using volatility-adjusted thresholds`);
