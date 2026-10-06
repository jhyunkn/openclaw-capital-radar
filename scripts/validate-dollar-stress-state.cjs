const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'outputs', 'dollar-stress-state.json');
const indexPath = path.join(root, 'index.html');
const reportPath = path.join(root, 'outputs', 'dollar-stress-validation-report.json');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return null; }
}
function fail(errors, warnings = []) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), status: 'FAILED', errors, warnings }, null, 2));
  console.error(`Dollar Stress validation failed: ${errors.join('; ')}`);
  process.exit(1);
}

const ALLOWED = ['NO_STRESS', 'DOLLAR_STRENGTH_RIGHT_SIDE', 'NORMAL_RISK_OFF', 'DOLLAR_LIQUIDITY_STRESS', 'SELL_AMERICA_STRESS', 'DATA_STALE'];
const errors = [];
const warnings = [];
const state = readJson(statePath);
if (!state) errors.push('dollar-stress-state.json missing or unreadable');

if (state) {
  if (state.artifact !== 'dollar-stress-state') errors.push(`unexpected artifact: ${state.artifact}`);
  if (!ALLOWED.includes(state.verdict)) errors.push(`verdict not in allowed set: ${state.verdict}`);
  if (!state.implication) errors.push('implication missing');
  if (!state.whatWouldChange) errors.push('whatWouldChange missing');
  const i = state.inputs || {};
  if (!Number.isFinite(Number(i.dxy?.level))) errors.push('inputs.dxy.level missing');
  if (!Number.isFinite(Number(i.dxy?.change5dPct))) errors.push('inputs.dxy.change5dPct missing');
  if (!Number.isFinite(Number(i.spy?.change5dPct))) errors.push('inputs.spy.change5dPct missing');
  if (!Number.isFinite(Number(i.vix?.level))) errors.push('inputs.vix.level missing');
  if (i.dgs10?.levelPct == null || i.hyOas?.levelPct == null) warnings.push('rate/credit levels missing — verdict rests on FX/equity/vol inputs only');
  if ((i.dgs10?.lagDays ?? 0) > 7 || (i.hyOas?.lagDays ?? 0) > 7) {
    if (!state.partial) errors.push('stale rate/credit inputs not honestly labelled PARTIAL');
    warnings.push(`stale inputs: DGS10 lag ${i.dgs10?.lagDays}d, HY OAS lag ${i.hyOas?.lagDays}d`);
  }
  // Verdict/input consistency — the falsifier must match its own measured inputs.
  if (state.verdict === 'SELL_AMERICA_STRESS') {
    if (!(Number(i.spy?.change5dPct) < 0)) errors.push('SELL_AMERICA_STRESS but SPY 5d is not negative');
    if (!(Number(i.dxy?.change5dPct) < 0)) errors.push('SELL_AMERICA_STRESS but DXY 5d is not negative');
    if (!(Number(i.dgs10?.change5dBp) > 0)) errors.push('SELL_AMERICA_STRESS but 10Y 5d change is not positive');
  }
  if (state.verdict === 'DOLLAR_LIQUIDITY_STRESS') {
    const extreme = Number(i.dxy?.change5dPct) >= 2.0 || Number(i.vix?.level) >= 35 || Number(i.hyOas?.change5dBp) >= 50;
    if (!extreme) errors.push('DOLLAR_LIQUIDITY_STRESS but no extreme input (DXY 5d >= 2%, VIX >= 35, HY +50bp) is present');
  }
  if (state.verdict === 'DOLLAR_STRENGTH_RIGHT_SIDE' && Number(i.spy?.change5dPct) <= -1.0 && Number(i.spy?.change20dPct) <= -3.0) {
    errors.push('DOLLAR_STRENGTH_RIGHT_SIDE but SPY is in stress on both windows');
  }
  const genAge = Date.now() - new Date(state.generatedAt || 0).getTime();
  if (!(genAge >= 0) || genAge > 14 * 86400000) warnings.push('dollar-stress-state generatedAt is older than 14 days or invalid');
}

if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  // Only enforce homepage presence when a rendered homepage exists alongside a fresh state;
  // the validation stage can run before ship on a stale homepage, so presence is a warning there.
  if (!html.includes('dollar-stress-check')) warnings.push('dollar-stress-check block not present in index.html (ship-stage injection may not have run yet)');
  if (html.includes('dollar-stress-check') && state && !html.includes(`data-verdict="${state.verdict}"`)) {
    // Not an error: the validation stage can run before ship re-injects from the fresh state.
    // Post-ship presence is enforced by the build-vercel final injector (throws on failure).
    warnings.push('index.html dollar-stress verdict differs from state (pre-ship validation order or stale homepage)');
  }
} else {
  warnings.push('index.html missing — homepage presence not checked');
}

if (errors.length) fail(errors, warnings);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), status: 'OK', verdict: state?.verdict || null, warnings }, null, 2));
console.log(`Dollar Stress validation passed (verdict: ${state?.verdict}, warnings: ${warnings.length})`);
