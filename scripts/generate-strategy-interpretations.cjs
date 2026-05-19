const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.sample.json') : path.join(root, 'data', 'report-state.sample.json');
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
function riskCap(h) {
  const type = exposureType(h);
  if (type === 'index') return 55;
  return type === 'levered' || type === 'crypto' ? 5 : 15;
}
function capFramework(h) {
  const type = exposureType(h);
  if (type === 'index') return 'Index ballast framework';
  if (type === 'levered') return 'Levered / decay risk framework';
  if (type === 'crypto') return 'Crypto / liquidity-beta framework';
  return 'Single-name concentration framework';
}
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
  const framework = capFramework(h);
  if (!Number.isFinite(weight)) return { status: 'Unknown', tone: 'caution', cap, framework, reason: 'Weight missing.' };
  const ratio = weight / cap;
  if (ratio >= 1) return { status: 'Over budget', tone: 'danger', cap, framework, reason: `${weight.toFixed(2)}% exceeds ${cap}% ${framework.toLowerCase()} cap.` };
  if (ratio >= .85) return { status: 'Near cap', tone: 'caution', cap, framework, reason: `${weight.toFixed(2)}% is near ${cap}% ${framework.toLowerCase()} cap.` };
  return { status: 'Inside budget', tone: 'positive', cap, framework, reason: `${weight.toFixed(2)}% is inside ${cap}% ${framework.toLowerCase()} cap.` };
}
module.exports = {};
