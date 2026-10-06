const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// Dollar Stress Check: distinguishes a normal crisis dollar bid (haven works)
// from a Sell-America pattern (haven failing: stocks down, dollar DOWN, yields UP).
// Reads committed caches only — no live fetch (house pattern).

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch (_) { return null; }
}
function rows(series) {
  return (Array.isArray(series) ? series : [])
    .filter(r => r && r.date && Number.isFinite(Number(r.value)))
    .map(r => ({ date: r.date, value: Number(r.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function candleRows(candles) {
  return (Array.isArray(candles) ? candles : [])
    .filter(c => c && c.time && Number.isFinite(Number(c.close)))
    .map(c => ({ date: c.time, value: Number(c.close) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function diffDays(from, to) {
  return Math.round((new Date(`${to}T00:00:00Z`) - new Date(`${from}T00:00:00Z`)) / 86400000);
}
const round = (v, d = 2) => (Number.isFinite(Number(v)) ? Number(Number(v).toFixed(d)) : null);

// Change over a calendar window: last observation on/before (latest - days).
// Records the actual span because some FRED caches are sparsely sampled.
function windowChange(series, days) {
  if (!series.length) return null;
  const last = series[series.length - 1];
  const target = addDays(last.date, -days);
  let prior = null;
  for (const r of series) { if (r.date <= target) prior = r; else break; }
  if (!prior) return null;
  return {
    fromDate: prior.date, fromValue: round(prior.value, 4),
    toDate: last.date, toValue: round(last.value, 4),
    pctChange: round((last.value / prior.value - 1) * 100, 3),
    delta: round(last.value - prior.value, 4),
    deltaBp: round((last.value - prior.value) * 100, 1),
    spanDays: diffDays(prior.date, last.date), windowDays: days
  };
}

const fx = readJson('data/cache/fx-dollar-series.json');
const vol = readJson('data/cache/volatility-series.json');
const dur = readJson('data/cache/duration-series.json');
const cred = readJson('data/cache/credit-series.json');
const comm = readJson('data/cache/commodities-series.json');
const spyCandles = readJson('data/market-candles/SPY.json');

const dxy = rows(fx?.series?.DXY);
const spy = candleRows(spyCandles?.candles);
const vix = rows(vol?.series?.VIX);
const dgs10 = rows(dur?.series?.DGS10);
const hy = rows(cred?.series?.BAMLH0A0HYM2);
const gold = rows(comm?.series?.GOLD);

const lastOf = s => (s.length ? s[s.length - 1] : null);
const anchorDate = [lastOf(dxy)?.date, lastOf(spy)?.date, lastOf(vix)?.date, lastOf(dgs10)?.date, lastOf(hy)?.date]
  .filter(Boolean).sort().at(-1) || null;
const lagDays = s => (anchorDate && lastOf(s) ? diffDays(lastOf(s).date, anchorDate) : null);

const m = {
  dxyLevel: round(lastOf(dxy)?.value, 3), dxyDate: lastOf(dxy)?.date || null,
  dxy5: windowChange(dxy, 5), dxy20: windowChange(dxy, 20),
  spyLevel: round(lastOf(spy)?.value, 2), spyDate: lastOf(spy)?.date || null,
  spy5: windowChange(spy, 5), spy20: windowChange(spy, 20),
  vixLevel: round(lastOf(vix)?.value, 2), vixDate: lastOf(vix)?.date || null,
  vix5: windowChange(vix, 5),
  dgs10Level: round(lastOf(dgs10)?.value, 2), dgs10Date: lastOf(dgs10)?.date || null,
  dgs10_5: windowChange(dgs10, 5), dgs10_20: windowChange(dgs10, 20),
  hyLevel: round(lastOf(hy)?.value, 2), hyDate: lastOf(hy)?.date || null,
  hy5: windowChange(hy, 5), hy20: windowChange(hy, 20),
  goldLevel: round(lastOf(gold)?.value, 1), goldDate: lastOf(gold)?.date || null,
  gold5: windowChange(gold, 5)
};

const TH = { spyDown5: -1.0, spyDown20: -3.0, dxyMove: 0.3, dxySpike5: 2.0, vixExtreme: 35, hyWiden5Bp: 50, yieldMoveBp: 10, staleLagDays: 7 };

const staleInputs = [];
if ((lagDays(dgs10) ?? 0) > TH.staleLagDays) staleInputs.push(`DGS10 lag ${lagDays(dgs10)}d (latest ${m.dgs10Date})`);
if ((lagDays(hy) ?? 0) > TH.staleLagDays) staleInputs.push(`HY OAS lag ${lagDays(hy)}d (latest ${m.hyDate})`);
const partial = staleInputs.length > 0 || !m.dgs10_5 || !m.hy5;

let verdict, label, implication, whatWouldChange, dollarHaven;
if (!m.dxy5 || !m.spy5) {
  verdict = 'DATA_STALE';
  label = 'Data stale — verdict not computable';
  implication = 'Primary dollar or equity inputs are missing from the committed caches. Do not trade on this check.';
  whatWouldChange = 'Restoring current DXY and SPY series in the public caches re-enables the verdict.';
  dollarHaven = 'UNKNOWN';
} else {
  const spyDown = m.spy5.pctChange <= TH.spyDown5 || (m.spy20 && m.spy20.pctChange <= TH.spyDown20 && m.spy5.pctChange < 0);
  const dxyUp = m.dxy5.pctChange >= TH.dxyMove;
  const dxyDown = m.dxy5.pctChange <= -TH.dxyMove;
  const yieldUp = m.dgs10_5 ? m.dgs10_5.deltaBp >= TH.yieldMoveBp : false;
  const yieldDown = m.dgs10_5 ? m.dgs10_5.deltaBp <= -TH.yieldMoveBp : false;
  const extreme = m.dxy5.pctChange >= TH.dxySpike5 || (m.vixLevel ?? 0) >= TH.vixExtreme || (m.hy5 ? m.hy5.deltaBp >= TH.hyWiden5Bp : false);
  const rightSide20 = m.dxy20 && m.dxy20.pctChange >= 1.0 && m.dxy5.pctChange >= -TH.dxyMove && !spyDown;

  if (spyDown && dxyDown && yieldUp) {
    verdict = 'SELL_AMERICA_STRESS';
    label = 'Sell-America stress — haven failing';
    implication = 'Stocks down, dollar down, Treasury yields up (April 2025 pattern): dollar cash is NOT the refuge here. The crisis hedge is gold / CHF / JPY, not dollars.';
    whatWouldChange = 'Verdict clears when the dollar starts rising into equity weakness again (DXY 5d back above +0.3% while SPY falls) or the 10Y yield turns down — either restores the normal haven pattern.';
    dollarHaven = 'FAILING';
  } else if (spyDown && dxyUp && extreme) {
    verdict = 'DOLLAR_LIQUIDITY_STRESS';
    label = 'Dollar liquidity stress — forced selling';
    implication = 'Extreme forced dollar demand. Do not deploy dry powder yet: wait for the dollar spike to stall or a Fed liquidity response — that dollar peak has historically marked the deploy window.';
    whatWouldChange = 'Steps down to NORMAL_RISK_OFF when the extremes clear: DXY 5d spike below +2.0%, VIX below 35, and HY OAS 5d widening below +50bp.';
    dollarHaven = 'WORKING_EXTREME';
  } else if (spyDown && dxyUp) {
    verdict = 'NORMAL_RISK_OFF';
    label = 'Normal risk-off — haven bid working';
    implication = yieldDown
      ? 'Equities down, dollar up, Treasury yields down: the classic haven bid is working. Hold dry powder in T-bills; forced selling is not extreme yet.'
      : 'Equities down with a dollar bid, but Treasury yields have not confirmed (no yield decline). Haven is working on the FX leg only — size accordingly.';
    whatWouldChange = 'Escalates to DOLLAR_LIQUIDITY_STRESS on a DXY 5d spike >= +2.0%, VIX >= 35, or HY OAS widening >= +50bp in 5d. Flips to SELL_AMERICA_STRESS if the dollar starts falling while yields rise into equity weakness.';
    dollarHaven = 'WORKING';
  } else if (spyDown) {
    verdict = 'NORMAL_RISK_OFF';
    label = 'Equity stress — dollar bid not confirmed';
    implication = 'Equities are selling off but the dollar is not bid and yields are not rising — this is equity stress first, not a dollar-liquidity event and not a Sell-America pattern.';
    whatWouldChange = 'A dollar bid (DXY 5d >= +0.3%) confirms NORMAL_RISK_OFF; a falling dollar with yields up >= +10bp flips it to SELL_AMERICA_STRESS.';
    dollarHaven = 'NOT_CONFIRMED';
  } else if (dxyUp || rightSide20) {
    verdict = 'DOLLAR_STRENGTH_RIGHT_SIDE';
    label = 'Dollar strength — right side of the smile';
    implication = 'Dollar strength here is the growth/rates kind, not a panic bid: equities are not in stress. It pressures foreign-earnings translation and EM, but it is not a crisis signal — cash is not yet a crisis asset.';
    whatWouldChange = 'Turns defensive if SPY breaks down (5d <= -1.0%) while the dollar keeps rising — that reclassifies to NORMAL_RISK_OFF or DOLLAR_LIQUIDITY_STRESS.';
    dollarHaven = 'NOT_TESTED';
  } else {
    verdict = 'NO_STRESS';
    label = 'No dollar stress';
    implication = 'No dollar-stress pattern: the dollar is not distorting cross-asset prices. Normal position-sizing rules apply.';
    whatWouldChange = 'Any SPY 5d drop beyond -1.0% paired with a dollar move of +/-0.3% or a 10Y move beyond 10bp activates a stress verdict.';
    dollarHaven = 'NOT_TESTED';
  }
}

const state = {
  artifact: 'dollar-stress-state',
  version: 1,
  generatedAt: new Date().toISOString(),
  generatedBy: 'scripts/generate-dollar-stress-state.cjs',
  anchorDate,
  coverage: verdict === 'DATA_STALE' ? 'MISSING' : (partial ? 'PARTIAL' : 'FULL'),
  partial,
  staleInputs,
  verdict,
  verdictLabel: label,
  dollarHaven,
  implication,
  whatWouldChange,
  thresholds: TH,
  inputs: {
    dxy: { level: m.dxyLevel, asOf: m.dxyDate, change5dPct: m.dxy5?.pctChange ?? null, change20dPct: m.dxy20?.pctChange ?? null, window5d: m.dxy5, window20d: m.dxy20 },
    spy: { level: m.spyLevel, asOf: m.spyDate, change5dPct: m.spy5?.pctChange ?? null, change20dPct: m.spy20?.pctChange ?? null, window5d: m.spy5, window20d: m.spy20 },
    vix: { level: m.vixLevel, asOf: m.vixDate, change5dDelta: m.vix5?.delta ?? null, window5d: m.vix5 },
    dgs10: { levelPct: m.dgs10Level, asOf: m.dgs10Date, lagDays: lagDays(dgs10), cacheStatus: dur?.cache_status || null, change5dBp: m.dgs10_5?.deltaBp ?? null, change20dBp: m.dgs10_20?.deltaBp ?? null, window5d: m.dgs10_5, window20d: m.dgs10_20 },
    hyOas: { levelPct: m.hyLevel, asOf: m.hyDate, lagDays: lagDays(hy), cacheStatus: cred?.cache_status || null, change5dBp: m.hy5?.deltaBp ?? null, change20dBp: m.hy20?.deltaBp ?? null, window5d: m.hy5, window20d: m.hy20 },
    gold: { level: m.goldLevel, asOf: m.goldDate, change5dPct: m.gold5?.pctChange ?? null }
  },
  rules: [
    'SELL_AMERICA_STRESS: SPY down (5d <= -1% or 20d <= -3% with 5d < 0) AND DXY 5d <= -0.3% AND 10Y yield +>= 10bp over its 5d window.',
    'DOLLAR_LIQUIDITY_STRESS: risk-off with dollar bid AND (DXY 5d >= +2.0% OR VIX >= 35 OR HY OAS 5d widening >= +50bp).',
    'NORMAL_RISK_OFF: SPY down with DXY 5d >= +0.3% (haven working), or equity stress without a confirmed dollar pattern.',
    'DOLLAR_STRENGTH_RIGHT_SIDE: DXY up (5d >= +0.3%, or 20d >= +1.0% with 5d not falling) while SPY is not in stress.',
    'NO_STRESS: none of the above patterns.',
    'PARTIAL label (not a verdict override) when DGS10 or HY OAS latest date lags the anchor date by > 7 days.'
  ],
  limitations: [
    'Windows are calendar windows over committed caches; sparse FRED sampling means the 5d yield/OAS windows can span more calendar days — actual from-dates are recorded per input.',
    'Cross-currency basis and offshore dollar funding spreads remain missing evidence; DXY/VIX/HY are proxies.',
    ...(fx?.limitations || [])
  ],
  sources: [
    'data/cache/fx-dollar-series.json', 'data/market-candles/SPY.json', 'data/cache/volatility-series.json',
    'data/cache/duration-series.json', 'data/cache/credit-series.json', 'data/cache/commodities-series.json'
  ]
};

for (const rel of ['outputs/dollar-stress-state.json', 'public/outputs/dollar-stress-state.json']) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
}
console.log(JSON.stringify({ verdict, label, partial, anchorDate, dxy: state.inputs.dxy, spy5: state.inputs.spy.change5dPct, dgs10_5bp: state.inputs.dgs10.change5dBp, hy5bp: state.inputs.hyOas.change5dBp, vix: state.inputs.vix.level }, null, 2));
