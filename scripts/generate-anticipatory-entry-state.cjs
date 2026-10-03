'use strict';

/*
 * Fail-closed anticipatory-entry calibration.
 *
 * This is deliberately separate from confirmed momentum/arb entries. It asks:
 * "Before a breakout confirms, did comparable top-decile momentum pullbacks
 * historically produce a positive 1-week/1-month path often enough to justify
 * a very small probe?"
 *
 * Evidence discipline:
 * - six years of adjusted-close history from the existing momentum cache;
 * - monthly, no-lookahead observations;
 * - chronological calibration/validation split;
 * - candidate-specific bands/invalidation/reward-risk;
 * - PROBE only (never ADD/BUY); portfolio risk capped at 0.25%;
 * - persistent forward forecast ledger, scored when 21 later bars exist.
 *
 * Known limitation: the universe is current S&P 500 membership, so historical
 * results retain survivorship bias. The state exposes this and never grants
 * HIGH confidence.
 */

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const CACHE = path.join(root, 'outputs', 'cache', 'momentum', 'price-history.json');
const MOMENTUM = path.join(root, 'outputs', 'momentum', 'momentum-state.json');
const GATE = path.join(root, 'outputs', 'momentum', 'momentum-gate.json');
const OUT_DIR = path.join(root, 'outputs', 'anticipatory');
const PUBLIC_DIR = path.join(root, 'public', 'outputs', 'anticipatory');
const STATE = path.join(OUT_DIR, 'anticipatory-entry-state.json');
const LEDGER = path.join(OUT_DIR, 'forecast-ledger.json');

const MIN_BARS = 273;
const VALIDATION_MONTHS = 18;
const MIN_CALIBRATION = 40;
const MIN_VALIDATION = 15;
const MAX_RISK_PCT = 10;
const MIN_REWARD_RISK = 1.25;
const PROBE_RISK_BUDGET_PCT = 0.25;

const read = (p, fallback = null) => { try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; } };
const round = (v, d = 4) => Number.isFinite(v) ? Number(v.toFixed(d)) : null;
const iso = epoch => new Date(epoch * 1000).toISOString().slice(0, 10);
function write(p, value) { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(value, null, 2) + '\n'); }
function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
function median(xs) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
function quantile(xs, q) { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); const x = (s.length - 1) * q; const lo = Math.floor(x), hi = Math.ceil(x); return s[lo] + (s[hi] - s[lo]) * (x - lo); }
function sma(xs, n, t) { let sum = 0; for (let i = t - n + 1; i <= t; i++) sum += xs[i]; return sum / n; }
function dailyVol(xs, t, n = 20) { const rs = []; for (let i = t - n + 1; i <= t; i++) rs.push(Math.log(xs[i] / xs[i - 1])); const m = mean(rs); return Math.sqrt(rs.reduce((a, r) => a + (r - m) ** 2, 0) / Math.max(1, rs.length - 1)); }
function maxSlice(xs, a, b) { let out = -Infinity; for (let i = a; i <= b; i++) out = Math.max(out, xs[i]); return out; }
function asOfIndex(dates, epoch) { let lo = 0, hi = dates.length - 1, ans = -1; while (lo <= hi) { const mid = (lo + hi) >> 1; if (dates[mid] <= epoch) { ans = mid; lo = mid + 1; } else hi = mid - 1; } return ans; }

function signals(adj, t) {
  if (t < MIN_BARS) return null;
  const price = adj[t];
  const ret12m1m = adj[t - 21] / adj[t - 252] - 1;
  const ret6m1m = adj[t - 21] / adj[t - 126] - 1;
  const hi52 = maxSlice(adj, t - 252, t);
  const s50 = sma(adj, 50, t), s200 = sma(adj, 200, t);
  const rets = [];
  for (let i = t - 251; i <= t; i++) rets.push(Math.log(adj[i] / adj[i - 1]));
  const m = mean(rets);
  const annVol = Math.sqrt(rets.reduce((a, r) => a + (r - m) ** 2, 0) / (rets.length - 1)) * Math.sqrt(252);
  return { ret12m1m, ret6m1m, dist52wHigh: price / hi52 - 1, maStack: price > s50 && s50 > s200 ? 1 : price > s50 ? 0.5 : 0, volScaled: annVol > 0 ? ret12m1m / annVol : 0 };
}

function rank(rows) {
  const keys = ['ret12m1m', 'ret6m1m', 'dist52wHigh', 'maStack', 'volScaled'];
  const maps = {};
  for (const key of keys) {
    const sorted = [...rows].sort((a, b) => a.s[key] - b.s[key]);
    maps[key] = new Map(sorted.map((r, i) => [r.symbol, (i + 1) / sorted.length]));
  }
  for (const row of rows) row.composite = mean(keys.map(k => maps[k].get(row.symbol)));
  rows.sort((a, b) => b.composite - a.composite || a.symbol.localeCompare(b.symbol));
  rows.forEach((r, i) => { r.rank = i + 1; r.rankPct = (i + 1) / rows.length; });
  return rows;
}

function setup(adj, t, rankPct, requireForwardBars = true) {
  if (t < MIN_BARS || (requireForwardBars && t + 21 >= adj.length)) return null;
  const price = adj[t], s20 = sma(adj, 20, t), s50 = sma(adj, 50, t);
  const hi20 = maxSlice(adj, t - 20, t);
  const offHigh = price / hi20 - 1;
  const dist20 = price / s20 - 1, dist50 = price / s50 - 1;
  const good = price > s50 && offHigh >= -0.08 && dist20 <= 0.06 && dist50 <= 0.15;
  const lowerEnd = offHigh <= -0.005;
  if (!good || !lowerEnd || rankPct > 0.10) return null;
  const sigma = dailyVol(adj, t);
  const entryBandLow = price * (1 - Math.max(0.004, sigma * 0.5));
  const entryBandHigh = price * (1 + Math.max(0.002, sigma * 0.25));
  const volatilityStop = price * (1 - Math.max(0.04, sigma * Math.sqrt(5) * 1.5));
  const invalidation = Math.min(s50 * 0.99, volatilityStop);
  const target = Math.max(hi20, price * (1 + Math.max(0.05, sigma * Math.sqrt(21) * 1.5)));
  const riskPct = (price - invalidation) / price * 100;
  const rewardPct = (target - price) / price * 100;
  const rewardRisk = riskPct > 0 ? rewardPct / riskPct : null;
  const pullbackBucket = offHigh <= -0.03 ? 'medium' : 'shallow';
  const rankBucket = rankPct <= 0.05 ? 'top5' : 'top10';
  return { price, s50, hi20, offHigh, sigma, entryBandLow, entryBandHigh, invalidation, target, riskPct, rewardPct, rewardRisk, cohort: `${rankBucket}:${pullbackBucket}` };
}

function outcome(adj, t, plan) {
  const r5 = adj[t + 5] / plan.price - 1;
  const r21 = adj[t + 21] / plan.price - 1;
  let first = 'horizon';
  for (let i = t + 1; i <= t + 21; i++) {
    if (adj[i] <= plan.invalidation) { first = 'invalidation'; break; }
    if (adj[i] >= plan.target) { first = 'target'; break; }
  }
  return { r5, r21, positive21: r21 > 0, targetFirst: first === 'target', first };
}

function summary(rows) {
  const r5 = rows.map(r => r.outcome.r5 * 100), r21 = rows.map(r => r.outcome.r21 * 100);
  const wins = rows.filter(r => r.outcome.positive21).length;
  const targets = rows.filter(r => r.outcome.targetFirst).length;
  return {
    n: rows.length,
    pPositive21: rows.length ? round((wins + 1) / (rows.length + 2), 4) : null,
    pTargetBeforeStop: rows.length ? round((targets + 1) / (rows.length + 2), 4) : null,
    returns5dPct: { p10: round(quantile(r5, .1), 2), median: round(median(r5), 2), p90: round(quantile(r5, .9), 2) },
    returns21dPct: { p10: round(quantile(r21, .1), 2), median: round(median(r21), 2), p90: round(quantile(r21, .9), 2) },
  };
}

function evaluateForecast(record, series) {
  if (record.status === 'SCORED') return record;
  const start = asOfIndex(series.dates, Date.parse(record.asOf + 'T23:59:59Z') / 1000);
  if (start < 0 || start + 21 >= series.adj.length) return record;
  // Yahoo adjusted closes can be retroactively rescaled after dividends or
  // splits. Rebase the frozen percentage plan onto the cache's as-of adjusted
  // close so scoring remains economically identical after corporate actions.
  const entry = series.adj[start];
  const invalidation = entry * (1 - record.invalidation.riskPct / 100);
  const target = entry * (1 + record.target.rewardPct / 100);
  let first = 'horizon';
  for (let i = start + 1; i <= start + 21; i++) {
    if (series.adj[i] <= invalidation) { first = 'invalidation'; break; }
    if (series.adj[i] >= target) { first = 'target'; break; }
  }
  return {
    ...record,
    status: 'SCORED',
    scoredAt: iso(series.dates[start + 21]),
    realized: {
      return5dPct: round((series.adj[start + 5] / entry - 1) * 100, 2),
      return21dPct: round((series.adj[start + 21] / entry - 1) * 100, 2),
      targetOrInvalidationFirst: first,
    },
  };
}

function main() {
  const cache = read(CACHE), momentum = read(MOMENTUM), gate = read(GATE, {});
  if (!cache?.symbols || !cache?.benchmark?.dates || !momentum?.table) throw new Error('anticipatory entry inputs missing; run momentum fetch/state first');

  const symbols = Object.entries(cache.symbols).filter(([, s]) => Array.isArray(s.adj) && s.adj.length >= MIN_BARS + 22);
  const b = cache.benchmark;
  const anchors = [];
  let prevMonth = null;
  for (let i = MIN_BARS; i < b.dates.length - 21; i++) {
    const ym = iso(b.dates[i]).slice(0, 7);
    if (ym !== prevMonth) { anchors.push({ epoch: b.dates[i], date: iso(b.dates[i]), bIndex: i }); prevMonth = ym; }
  }

  const events = [];
  for (const anchor of anchors) {
    if (b.adj[anchor.bIndex] <= sma(b.adj, 200, anchor.bIndex)) continue;
    const rows = [];
    for (const [symbol, s] of symbols) {
      const t = asOfIndex(s.dates, anchor.epoch);
      const sig = signals(s.adj, t);
      if (sig && t + 21 < s.adj.length) rows.push({ symbol, s: sig, t, series: s });
    }
    rank(rows);
    for (const row of rows) {
      const plan = setup(row.series.adj, row.t, row.rankPct);
      if (!plan) continue;
      events.push({ date: anchor.date, symbol: row.symbol, cohort: plan.cohort, rankPct: row.rankPct, plan, outcome: outcome(row.series.adj, row.t, plan) });
    }
  }

  const uniqueMonths = [...new Set(events.map(e => e.date.slice(0, 7)))].sort();
  const validationStart = uniqueMonths[Math.max(0, uniqueMonths.length - VALIDATION_MONTHS)] || '9999-99';
  const calibrationRows = events.filter(e => e.date.slice(0, 7) < validationStart);
  const validationRows = events.filter(e => e.date.slice(0, 7) >= validationStart);

  const currentRows = momentum.table.filter(r => r.inTopDecile && r.entryQuality?.rating === 'GOOD');
  const candidates = [];
  for (const row of currentRows) {
    const series = cache.symbols[row.symbol];
    if (!series) continue;
    const t = series.adj.length - 1;
    const plan = setup(series.adj, t, row.rank / momentum.includedCount, false);
    if (!plan) continue;
    let cal = calibrationRows.filter(e => e.cohort === plan.cohort);
    let val = validationRows.filter(e => e.cohort === plan.cohort);
    let cohort = plan.cohort;
    if (cal.length < MIN_CALIBRATION || val.length < MIN_VALIDATION) {
      const rankBucket = plan.cohort.split(':')[0];
      cal = calibrationRows.filter(e => e.cohort.startsWith(`${rankBucket}:`));
      val = validationRows.filter(e => e.cohort.startsWith(`${rankBucket}:`));
      cohort = `${rankBucket}:all_pullbacks`;
    }
    if (cal.length < MIN_CALIBRATION || val.length < MIN_VALIDATION) { cal = calibrationRows; val = validationRows; cohort = 'all_qualified_pullbacks'; }
    const cs = summary(cal), vs = summary(val);
    const blockers = [];
    if (cs.n < MIN_CALIBRATION) blockers.push(`calibration sample ${cs.n} < ${MIN_CALIBRATION}`);
    if (vs.n < MIN_VALIDATION) blockers.push(`validation sample ${vs.n} < ${MIN_VALIDATION}`);
    if (!(cs.pPositive21 >= .55)) blockers.push(`calibrated 21d probability ${round((cs.pPositive21 || 0) * 100, 1)}% < 55%`);
    if (!(vs.pPositive21 >= .52)) blockers.push(`validation 21d hit rate ${round((vs.pPositive21 || 0) * 100, 1)}% < 52%`);
    if (!(vs.returns21dPct.median > 0)) blockers.push(`validation median 21d return ${vs.returns21dPct.median}% is not positive`);
    if (!(plan.rewardRisk >= MIN_REWARD_RISK)) blockers.push(`reward/risk ${round(plan.rewardRisk, 2)} < ${MIN_REWARD_RISK}`);
    if (!(plan.riskPct <= MAX_RISK_PCT)) blockers.push(`invalidation risk ${round(plan.riskPct, 1)}% > ${MAX_RISK_PCT}%`);
    if ((gate.score ?? 3) >= 2 || (gate.exposure ?? 0) < .6) blockers.push(`regime gate ${gate.tierLabel || 'unknown'} does not permit probes`);
    const status = blockers.length ? 'BLOCKED' : 'PROBE_ELIGIBLE';
    const maxPositionPct = Math.min(1, PROBE_RISK_BUDGET_PCT / (plan.riskPct / 100));
    candidates.push({
      symbol: row.symbol,
      state: status,
      confidence: status === 'PROBE_ELIGIBLE' && vs.n >= 30 ? 'MEDIUM' : 'LOW',
      cohort,
      asOf: row.asOf,
      entry: { low: round(plan.entryBandLow, 2), high: round(plan.entryBandHigh, 2), referencePrice: round(plan.price, 2), method: 'current price ± realized-volatility buffer' },
      invalidation: { price: round(plan.invalidation, 2), riskPct: round(plan.riskPct, 2), method: 'lower of 50-day mean less 1% or five-day volatility stop' },
      target: { price: round(plan.target, 2), rewardPct: round(plan.rewardPct, 2), method: 'higher of 20-day high or 1.5x expected 21-day volatility' },
      rewardRisk: round(plan.rewardRisk, 2),
      calibration: cs,
      validation: vs,
      projectedPath: { oneWeekPct: cs.returns5dPct, oneMonthPct: cs.returns21dPct },
      sizing: { action: status === 'PROBE_ELIGIBLE' ? 'PROBE' : 'WATCH', maxPortfolioRiskPct: PROBE_RISK_BUDGET_PCT, maxPositionPct: round(maxPositionPct, 2), noAddWithoutConfirmation: true },
      blockers,
      evidence: ['outputs/cache/momentum/price-history.json', 'outputs/momentum/momentum-state.json', 'outputs/momentum/momentum-gate.json'],
    });
  }
  candidates.sort((a, b) => (a.state === b.state ? (b.validation.pPositive21 || 0) - (a.validation.pPositive21 || 0) : a.state === 'PROBE_ELIGIBLE' ? -1 : 1));

  const oldLedger = read(LEDGER, { artifact: 'anticipatory-forecast-ledger', forecasts: [] });
  let forecasts = (oldLedger.forecasts || []).map(f => cache.symbols[f.symbol] ? evaluateForecast(f, cache.symbols[f.symbol]) : f);
  const ids = new Set(forecasts.map(f => f.id));
  for (const c of candidates.filter(c => c.state === 'PROBE_ELIGIBLE')) {
    const id = `${c.asOf}:${c.symbol}`;
    if (ids.has(id)) continue;
    forecasts.push({ id, symbol: c.symbol, asOf: c.asOf, status: 'PENDING', probabilityPositive21: c.calibration.pPositive21, entry: c.entry, invalidation: c.invalidation, target: c.target, cohort: c.cohort });
    ids.add(id);
  }
  forecasts = forecasts.slice(-1000);
  const scored = forecasts.filter(f => f.status === 'SCORED');
  const ledger = {
    artifact: 'anticipatory-forecast-ledger', generatedAt: new Date().toISOString(), forecasts,
    scorecard: { total: forecasts.length, pending: forecasts.length - scored.length, scored: scored.length, positive21HitRate: scored.length ? round(scored.filter(f => f.realized.return21dPct > 0).length / scored.length, 4) : null, targetBeforeStopRate: scored.length ? round(scored.filter(f => f.realized.targetOrInvalidationFirst === 'target').length / scored.length, 4) : null },
  };

  const eligible = candidates.filter(c => c.state === 'PROBE_ELIGIBLE');
  const state = {
    artifact: 'anticipatory-entry-state', version: 1, generatedAt: new Date().toISOString(), asOf: momentum.table.find(r => r.asOf)?.asOf || null,
    permission: eligible.length ? 'PROBE_AVAILABLE' : 'UNAVAILABLE',
    policy: 'Anticipatory entries are capped PROBE decisions. They never authorize ADD/BUY, never bypass confirmation, and risk at most 0.25% of portfolio value per candidate.',
    methodology: { universe: 'current S&P 500 constituents', history: 'six years adjusted closes', sampling: 'monthly no-lookahead observations', split: `chronological; final ${VALIDATION_MONTHS} months held out`, minCalibration: MIN_CALIBRATION, minValidation: MIN_VALIDATION, caveats: ['current-constituent survivorship bias', 'close-only paths cannot resolve intraday order when both levels trade the same day', 'earnings dates unavailable and therefore not modeled', 'probabilities describe historical cohorts, not guarantees'] },
    summary: { candidates: candidates.length, eligible: eligible.length, blocked: candidates.length - eligible.length, historicalEvents: events.length, calibrationEvents: calibrationRows.length, validationEvents: validationRows.length, validationStart },
    candidates,
    ledgerScorecard: ledger.scorecard,
  };
  write(STATE, state); write(path.join(PUBLIC_DIR, 'anticipatory-entry-state.json'), state);
  write(LEDGER, ledger); write(path.join(PUBLIC_DIR, 'forecast-ledger.json'), ledger);
  console.log(`anticipatory-entry-state: candidates=${candidates.length} eligible=${eligible.length} blocked=${candidates.length - eligible.length} events=${events.length} validation=${validationRows.length}`);
}

main();
