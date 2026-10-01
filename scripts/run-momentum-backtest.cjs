'use strict';

/*
 * run-momentum-backtest.cjs
 *
 * Phase 2 — deterministic backtest harness for the Phase 1 momentum engine.
 *
 * NO-LOOKAHEAD DISCIPLINE (structural):
 *   - The signal function takes (adj, dates, asOfIndex) and ONLY ever reads
 *     indices <= asOfIndex. There is no code path that reads beyond it.
 *   - For each rebalance date T, each symbol's as-of index is the largest index
 *     with dates[idx] <= T. Symbols with fewer than WARMUP_BARS bars through T
 *     are excluded from that rebalance's universe (graceful, recorded).
 *   - Gate inputs use only observations dated <= T (SPX 200-day from ^GSPC bars
 *     <= T; latest VIX / HY OAS observation with date <= T).
 *
 * Variants:
 *   (a) gated   — v1: RED month: all cash (0% return). YELLOW: top 5% only.
 *                 GREEN: top decile, equal weight.
 *   (b) gated_v2 — v2 regime gate (shared module scripts/momentum-gate-v2.cjs):
 *                 stress score S = (SPX below 200d) + (HY OAS >= 4.0) +
 *                 (VIX >= 30); exposure tiers S=0 -> 100%, S=1 -> 60%,
 *                 S>=2 -> 25% (floor, never 0%); target list ALWAYS the top
 *                 decile scaled by exposure, remainder cash; asymmetric
 *                 hysteresis — de-risk immediate on S rise, re-risk at most
 *                 one tier per rebalance and only when the lower S has held
 *                 for 2 consecutive rebalances (current + prior).
 *   (c) gated_v2_fast — identical to gated_v2 but re-risk needs only 1
 *                 rebalance of confirmation (sensitivity variant; reported,
 *                 not selected on).
 *   (d) ungated — always fully invested, top decile, equal weight.
 *   Benchmark: ^GSPC buy-and-hold total return over the same window (adj close).
 *
 * Costs: 10 bps per side on traded notional (buys + sells), share-count
 * accounting, rebalanced at T's close (first trading day of each month).
 *
 * Output: outputs/momentum/momentum-backtest.json
 */

const fs = require('fs');
const path = require('path');
const gateV2 = require('./momentum-gate-v2.cjs'); // shared v2 gate: backtest + live use one implementation

const root = path.join(__dirname, '..');
const cachePath = path.join(root, 'outputs', 'cache', 'momentum', 'price-history.json');
const creditPath = path.join(root, 'data', 'cache', 'credit-series.json');
const volPath = path.join(root, 'data', 'cache', 'volatility-series.json');
const outPath = path.join(root, 'outputs', 'momentum', 'momentum-backtest.json');

const WARMUP_BARS = 252 + 21; // 273: 252d signal span + skipped most-recent month
const SQRT_252 = Math.sqrt(252);
const COST_BPS_PER_SIDE = 10;
const COST_RATE = COST_BPS_PER_SIDE / 10000;
const SIGNAL_KEYS = ['ret12m1m', 'ret6m1m', 'dist52wHigh', 'maStack', 'volScaled'];

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}
function isoOf(epochSec) { return new Date(epochSec * 1000).toISOString().slice(0, 10); }
function r6(x) { return Math.round(x * 1e6) / 1e6; }

/* ---------------- signal computation (Phase 1 formula, as-of indexed) ---------------- */

function sma(arr, n, t) {
  let sum = 0;
  for (let i = t - n + 1; i <= t; i++) sum += arr[i];
  return sum / n;
}

// Structural no-lookahead: every read uses index <= t. Nothing else is reachable.
function computeSignalsAsOf(adj, t) {
  const ret12m1m = adj[t - 21] / adj[t - 252] - 1;
  const ret6m1m = adj[t - 21] / adj[t - 126] - 1;
  let hi = -Infinity;
  for (let i = t - 252; i <= t; i++) if (adj[i] > hi) hi = adj[i];
  const price = adj[t];
  const dist52wHigh = price / hi - 1;
  const sma50 = sma(adj, 50, t);
  const sma200 = sma(adj, 200, t);
  const maStack = price > sma50 && sma50 > sma200 ? 1 : (price > sma50 ? 0.5 : 0);
  let sum = 0;
  const rets = [];
  for (let i = t - 251; i <= t; i++) {
    const r = Math.log(adj[i] / adj[i - 1]);
    rets.push(r);
    sum += r;
  }
  const mean = sum / rets.length;
  let v = 0;
  for (const r of rets) v += (r - mean) * (r - mean);
  const stdev = Math.sqrt(v / (rets.length - 1));
  const vol = stdev * SQRT_252;
  const volScaled = vol > 0 ? ret12m1m / vol : 0;
  return { ret12m1m, ret6m1m, dist52wHigh, maStack, volScaled };
}

function rankUniverse(rows) {
  // rows: [{symbol, signals}] -> returns rows sorted with .rank 1..N
  const rankMaps = {};
  for (const k of SIGNAL_KEYS) {
    const sorted = [...rows].sort((a, b) => a.signals[k] - b.signals[k]);
    const n = sorted.length;
    const m = new Map();
    sorted.forEach((row, i) => m.set(row.symbol, (i + 1) / n));
    rankMaps[k] = m;
  }
  for (const row of rows) {
    const pct = SIGNAL_KEYS.map(k => rankMaps[k].get(row.symbol));
    row.composite = pct.reduce((a, b) => a + b, 0) / pct.length;
  }
  rows.sort((a, b) => b.composite - a.composite || (a.symbol < b.symbol ? -1 : 1));
  rows.forEach((row, i) => { row.rank = i + 1; });
  return rows;
}

// Largest index with dates[idx] <= asOfEpoch. -1 if the whole series is later.
function asOfIndex(dates, asOfEpoch) {
  let lo = 0, hi = dates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= asOfEpoch) { ans = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return ans;
}

// Latest observation with obsDate <= asOfIso (YYYY-MM-DD strings sort lexicographically).
function obsAsOf(series, asOfIso) {
  let best = null;
  for (const o of series) {
    if (o.date <= asOfIso && o.value !== null && o.value !== undefined) {
      if (!best || o.date > best.date) best = o;
    }
  }
  return best ? best.value : null;
}

/* ---------------- performance statistics ---------------- */

function statsFromCurve(curve) {
  // curve: [{date, nav}] ascending; nav > 0
  const n = curve.length;
  const rets = [];
  for (let i = 1; i < n; i++) {
    const r = Math.log(curve[i].nav / curve[i - 1].nav);
    rets.push(r);
  }
  const mean = rets.reduce((a, b) => a + b, 0) / rets.length;
  let v = 0;
  for (const r of rets) v += (r - mean) * (r - mean);
  const sd = Math.sqrt(v / (rets.length - 1));
  const annVol = sd * SQRT_252;
  const sharpe = sd > 0 ? (mean / sd) * SQRT_252 : 0; // risk-free = 0, disclosed
  const years = rets.length / 252;
  const cagr = Math.pow(curve[n - 1].nav / curve[0].nav, 1 / years) - 1;
  let peak = curve[0].nav, peakDate = curve[0].date, mdd = 0, mddPeak = curve[0].date, mddTrough = curve[0].date;
  for (const c of curve) {
    if (c.nav > peak) { peak = c.nav; peakDate = c.date; }
    const dd = c.nav / peak - 1;
    if (dd < mdd) { mdd = dd; mddPeak = peakDate; mddTrough = c.date; }
  }
  const totalReturn = curve[n - 1].nav / curve[0].nav - 1;
  const annual = {};
  let yearStartIdx = 0;
  for (let i = 1; i < n; i++) {
    const prevY = curve[i - 1].date.slice(0, 4);
    const curY = curve[i].date.slice(0, 4);
    if (curY !== prevY) {
      annual[prevY] = r6(curve[i - 1].nav / curve[yearStartIdx].nav - 1);
      yearStartIdx = i;
    }
  }
  const lastY = curve[n - 1].date.slice(0, 4);
  annual[lastY] = r6(curve[n - 1].nav / curve[yearStartIdx].nav - 1);
  return {
    totalReturn: r6(totalReturn),
    cagr: r6(cagr),
    annVol: r6(annVol),
    sharpe: r6(sharpe),
    maxDrawdown: r6(mdd),
    maxDrawdownPeriod: { peakDate: mddPeak, troughDate: mddTrough },
    annualReturns: annual,
    tradingDays: n,
  };
}

/* ---------------- main ---------------- */

function main() {
  const cache = readJson(cachePath);
  if (!cache || !cache.symbols || !cache.benchmark) {
    console.error(`price cache missing or malformed: ${cachePath}`);
    process.exit(1);
  }
  const symbols = Object.keys(cache.symbols).sort();
  const bDates = cache.benchmark.dates;
  const bAdj = cache.benchmark.adj;
  const bDateIso = bDates.map(isoOf);
  const lastBarIso = bDateIso[bDateIso.length - 1];

  // Rebalance calendar: first trading day (first bar) of each calendar month.
  const rebMonths = [];
  let prevMonth = null;
  for (let i = 0; i < bDates.length; i++) {
    const ym = bDateIso[i].slice(0, 7);
    if (ym !== prevMonth) { rebMonths.push({ date: bDateIso[i], epoch: bDates[i], index: i, ym }); prevMonth = ym; }
  }
  // Window start: first rebalance date with WARMUP_BARS of history (compute, don't hardcode).
  const firstEligible = rebMonths.find(m => m.index >= WARMUP_BARS);
  if (!firstEligible) { console.error('insufficient history for any rebalance'); process.exit(1); }
  const rebDates = rebMonths.filter(m => m.index >= firstEligible.index);
  const windowStart = firstEligible.date;

  console.log(`window: ${windowStart} -> ${lastBarIso}; ${rebDates.length} rebalances; ${symbols.length} symbols`);

  // Gate inputs from caches.
  const credit = readJson(creditPath);
  const vol = readJson(volPath);
  const hySeries = credit?.series?.BAMLH0A0HYM2 || [];
  const vixSeries = vol?.series?.VIX || [];
  const hyFirstDate = hySeries.length ? hySeries[0].date : null;

  const GATE_T = { hyOasRed: 4.0, hyOasYellow: 3.5, vixYellow: 25, spxThinMargin: 0.02 };

  function gateAsOf(bIndex, asOfIso) {
    const price = bAdj[bIndex];
    const s200 = sma(bAdj, 200, bIndex);
    const margin = price / s200 - 1;
    const vix = obsAsOf(vixSeries, asOfIso);
    const hyAvailable = hyFirstDate !== null && asOfIso >= hyFirstDate;
    const hy = hyAvailable ? obsAsOf(hySeries, asOfIso) : null;
    const redBySpx = price < s200;
    const redByHy = hy !== null && hy >= GATE_T.hyOasRed;
    if (redBySpx || redByHy) {
      return { gate: 'RED', inputs: { spxAbove200d: !redBySpx, spxMarginPct: r6(margin), vix, hyOas: hy, hyOasAvailable: hyAvailable } };
    }
    const yellowByHy = hy !== null && hy >= GATE_T.hyOasYellow;
    const yellowByVix = vix !== null && vix >= GATE_T.vixYellow;
    const yellowByMargin = margin < GATE_T.spxThinMargin;
    const gate = (yellowByHy || yellowByVix || yellowByMargin) ? 'YELLOW' : 'GREEN';
    return { gate, inputs: { spxAbove200d: true, spxMarginPct: r6(margin), vix, hyOas: hy, hyOasAvailable: hyAvailable } };
  }

  // Per-symbol date/adj refs for pointer arithmetic.
  const symData = {};
  for (const s of symbols) symData[s] = cache.symbols[s];

  // ---- rebalance loop: signals, ranks, gate ----
  const rebalanceLog = [];
  const droppedSymbols = new Set();
  for (const m of rebDates) {
    const eligible = [];
    const ineligible = [];
    for (const s of symbols) {
      const d = symData[s];
      const idx = asOfIndex(d.dates, m.epoch);
      if (idx >= WARMUP_BARS) {
        const signals = computeSignalsAsOf(d.adj, idx);
        const vals = Object.values(signals);
        if (vals.every(Number.isFinite)) eligible.push({ symbol: s, signals, price: d.adj[idx] });
        else ineligible.push(s);
      } else {
        ineligible.push(s);
        if (idx >= 0) droppedSymbols.add(s);
      }
    }
    const ranked = rankUniverse(eligible);
    const n = ranked.length;
    const decileCut = Math.ceil(n / 10);
    const vigintileCut = Math.ceil(n / 20);
    const g = gateAsOf(m.index, m.date);
    const activeCut = g.gate === 'GREEN' ? decileCut : g.gate === 'YELLOW' ? vigintileCut : 0;
    const targetList = ranked.filter(r => r.rank <= activeCut).map(r => r.symbol);
    // v2 stress score from the SAME gate inputs (shared module; hysteresis applied after the loop).
    const v2score = gateV2.scoreFromLegs({
      spxBelow200d: g.inputs.spxAbove200d === true ? false : g.inputs.spxAbove200d === false ? true : null,
      hyOas: g.inputs.hyOas,
      vix: g.inputs.vix,
    });
    rebalanceLog.push({
      date: m.date,
      benchmarkIndex: m.index,
      gate: g.gate,
      gateInputs: g.inputs,
      gateV2Score: v2score, // replaced below by gateV2/gateV2Fast after hysteresis
      eligibleCount: n,
      ineligibleCount: ineligible.length,
      decileCut,
      activeCut,
      targetList,
      rankedUniverse: ranked.map(r => r.symbol), // rank order; rank = position+1
      note: g.gate === 'RED' ? 'Gate RED — target is cash (empty list).' : null,
    });
  }

  // ---- v2 hysteresis: one pass over the score sequence (standard + fast) ----
  // De-risk is immediate; re-risk needs 2 consecutive rebalances at the lower
  // score (standard) or 1 (fast). First rebalance initializes the tier.
  const v2ScoreSeq = rebalanceLog.map(e => ({ date: e.date, score: e.gateV2Score.score }));
  const v2Hyst = gateV2.applyHysteresis(v2ScoreSeq, { fast: false });
  const v2HystFast = gateV2.applyHysteresis(v2ScoreSeq, { fast: true });
  rebalanceLog.forEach((e, i) => {
    const s = v2Hyst[i], f = v2HystFast[i];
    e.gateV2 = {
      score: e.gateV2Score.score,
      legs: e.gateV2Score.legs,
      legsAvailable: e.gateV2Score.legsAvailable,
      tier: s.tier, tierLabel: s.tierLabel, exposure: s.exposure, tierChanged: s.tierChanged,
    };
    e.gateV2Fast = {
      score: e.gateV2Score.score,
      legs: e.gateV2Score.legs,
      legsAvailable: e.gateV2Score.legsAvailable,
      tier: f.tier, tierLabel: f.tierLabel, exposure: f.exposure, tierChanged: f.tierChanged,
    };
    delete e.gateV2Score;
  });

  // ---- portfolio simulation ----
  const rebByIndex = new Map(rebalanceLog.map(e => [e.benchmarkIndex, e]));
  const i0 = firstEligible.index;
  const iEnd = bDates.length - 1;

  function targetForVariant(variant, entry) {
    // v1 gated: gate's active list (cash on RED). ungated + v2 variants: always
    // the full top decile; v2 scales it by the hysteresis-adjusted exposure.
    if (variant === 'gated_v2') return { list: entry.rankedUniverse.slice(0, entry.decileCut), exposure: entry.gateV2.exposure };
    if (variant === 'gated_v2_fast') return { list: entry.rankedUniverse.slice(0, entry.decileCut), exposure: entry.gateV2Fast.exposure };
    if (variant === 'ungated') return { list: entry.rankedUniverse.slice(0, entry.decileCut), exposure: 1.0 };
    return { list: entry.targetList, exposure: 1.0 }; // 'gated' (v1)
  }

  function simulate(variant) {
    const shares = new Map(); // symbol -> share count
    let cash = 1.0;
    const curve = [];
    let totalTraded = 0, totalCost = 0, turnoverSum = 0, nReb = 0;
    // per-symbol price pointers (indices into that symbol's arrays)
    const ptr = {};
    const lastPrice = {};
    for (const s of symbols) { ptr[s] = asOfIndex(symData[s].dates, bDates[i0]); lastPrice[s] = ptr[s] >= 0 ? symData[s].adj[ptr[s]] : null; }

    function priceAt(s, dayEpoch) {
      const d = symData[s];
      while (ptr[s] + 1 < d.dates.length && d.dates[ptr[s] + 1] <= dayEpoch) ptr[s]++;
      if (d.dates[ptr[s]] < dayEpoch && ptr[s] === d.dates.length - 1) {
        // series ended early: freeze at last close (graceful)
        droppedSymbols.add(s);
      }
      lastPrice[s] = d.adj[ptr[s]];
      return lastPrice[s];
    }

    for (let i = i0; i <= iEnd; i++) {
      const dayEpoch = bDates[i];
      const entry = rebByIndex.get(i);
      if (entry) {
        nReb++;
        const { list: targetList, exposure } = targetForVariant(variant, entry);
        const targetSet = new Set(targetList);
        // nav before trades, at T's close
        let nav = cash;
        const px = {};
        for (const s of shares.keys()) { px[s] = priceAt(s, dayEpoch); nav += shares.get(s) * px[s]; }
        for (const s of targetList) if (!px[s]) px[s] = priceAt(s, dayEpoch);

        let traded = 0, cost = 0;
        // exits
        for (const s of [...shares.keys()]) {
          if (!targetSet.has(s)) {
            const proceeds = shares.get(s) * px[s];
            const c = proceeds * COST_RATE;
            cash += proceeds - c;
            traded += proceeds; cost += c;
            shares.delete(s);
          }
        }
        // entries / adjustments
        if (targetList.length > 0) {
          let avail = cash;
          for (const s of shares.keys()) if (targetSet.has(s)) avail += shares.get(s) * px[s];
          // v2: invest exposure x avail across the decile; the rest stays cash.
          // v1/ungated exposure is 1.0, so this reduces to the old behavior.
          const targetVal = (avail * exposure) / targetList.length;
          for (const s of targetList) {
            const cur = (shares.get(s) || 0) * px[s];
            const delta = targetVal - cur;
            if (Math.abs(delta) < 1e-9) continue;
            if (delta > 0) {
              const sh = delta / px[s];
              const c = delta * COST_RATE;
              cash -= delta + c;
              shares.set(s, (shares.get(s) || 0) + sh);
              traded += delta; cost += c;
            } else {
              const reduce = Math.min(-delta / px[s], shares.get(s));
              const c = reduce * px[s] * COST_RATE;
              cash += reduce * px[s] - c;
              const rem = shares.get(s) - reduce;
              if (rem < 1e-12) shares.delete(s); else shares.set(s, rem);
              traded += reduce * px[s]; cost += c;
            }
          }
        }
        totalTraded += traded; totalCost += cost;
        const navBefore = (() => { let nv = cash; for (const [s, sh] of shares) nv += sh * px[s]; return nv; })();
        // nav before trades was computed pre-trade; recompute for turnover denominator
        turnoverSum += nav > 0 ? traded / nav : 0;
        entry[`sim_${variant}`] = { tradedNotional: r6(traded), costPaid: r6(cost), turnoverTwoSided: nav > 0 ? r6(traded / nav) : 0, navAfter: r6(navBefore) };
      }
      let navDay = cash;
      for (const [s, sh] of shares) navDay += sh * priceAt(s, dayEpoch);
      curve.push({ date: bDateIso[i], nav: navDay });
    }
    return {
      curve,
      nRebalances: nReb,
      totalCostPaid: r6(totalCost),
      totalTradedNotional: r6(totalTraded),
      turnoverAvg: r6(turnoverSum / Math.max(1, nReb)),
    };
  }

  const gated = simulate('gated');
  const gatedV2 = simulate('gated_v2');
  const gatedV2Fast = simulate('gated_v2_fast');
  const ungated = simulate('ungated');

  // benchmark buy-and-hold over the same window
  const bhBase = bAdj[i0];
  const benchCurve = [];
  for (let i = i0; i <= iEnd; i++) benchCurve.push({ date: bDateIso[i], nav: bAdj[i] / bhBase });

  const gatedStats = statsFromCurve(gated.curve);
  const gatedV2Stats = statsFromCurve(gatedV2.curve);
  const gatedV2FastStats = statsFromCurve(gatedV2Fast.curve);
  const ungatedStats = statsFromCurve(ungated.curve);
  const benchStats = statsFromCurve(benchCurve);

  function simSummary(sim, stats) {
    return {
      ...stats,
      nRebalances: sim.nRebalances,
      turnoverAvg: sim.turnoverAvg,
      totalCostPaid: sim.totalCostPaid,
      totalTradedNotional: sim.totalTradedNotional,
    };
  }

  // gate/tier change counts over the 59 rebalances
  function countChanges(arr) { let c = 0; for (let i = 1; i < arr.length; i++) if (arr[i] !== arr[i - 1]) c++; return c; }
  const v1GateFlips = countChanges(rebalanceLog.map(e => e.gate));
  const v2ScoreChanges = countChanges(rebalanceLog.map(e => e.gateV2.score));
  const v2TierChanges = countChanges(rebalanceLog.map(e => e.gateV2.tier));
  const v2FastTierChanges = countChanges(rebalanceLog.map(e => e.gateV2Fast.tier));

  // crash episodes
  function episodeReturn(curve, startIso, endIso) {
    const a = curve.reduce((best, c) => (c.date <= startIso && (!best || c.date > best.date) ? c : best), null);
    const b = curve.reduce((best, c) => (c.date <= endIso && (!best || c.date > best.date) ? c : best), null);
    if (!a || !b) return null;
    return { period: `${a.date} -> ${b.date}`, ret: r6(b.nav / a.nav - 1) };
  }
  const crashEpisodes = [
    {
      name: '2022 bear market',
      inSample: true,
      ...(() => {
        const g = episodeReturn(gated.curve, '2022-01-03', '2022-10-12');
        const g2 = episodeReturn(gatedV2.curve, '2022-01-03', '2022-10-12');
        const gf = episodeReturn(gatedV2Fast.curve, '2022-01-03', '2022-10-12');
        const u = episodeReturn(ungated.curve, '2022-01-03', '2022-10-12');
        const b = episodeReturn(benchCurve, '2022-01-03', '2022-10-12');
        return { period: g.period, gatedReturn: g.ret, gatedV2Return: g2.ret, gatedV2FastReturn: gf.ret, ungatedReturn: u.ret, benchmarkReturn: b.ret };
      })(),
      note: 'In-sample: SPX fell -25.4% peak (2022-01-03) to trough (2022-10-12). VIX leg active (weekly obs); HY OAS unavailable before 2023-09-30, so the 2022 gate ran on SPX-200d + VIX only.',
    },
    {
      name: '2025 tariff drawdown',
      inSample: true,
      ...(() => {
        const g = episodeReturn(gated.curve, '2025-02-19', '2025-04-08');
        const g2 = episodeReturn(gatedV2.curve, '2025-02-19', '2025-04-08');
        const gf = episodeReturn(gatedV2Fast.curve, '2025-02-19', '2025-04-08');
        const u = episodeReturn(ungated.curve, '2025-02-19', '2025-04-08');
        const b = episodeReturn(benchCurve, '2025-02-19', '2025-04-08');
        return { period: g.period, gatedReturn: g.ret, gatedV2Return: g2.ret, gatedV2FastReturn: gf.ret, ungatedReturn: u.ret, benchmarkReturn: b.ret };
      })(),
      note: 'In-sample: second-worst drawdown in window (SPX -10.1% from 2025-02-19 peak; trough 2025-04-08 bar). Full gate (SPX-200d + VIX + HY OAS) active.',
    },
    {
      name: '2008-09 Global Financial Crisis',
      inSample: false,
      period: '2007-10-09 -> 2009-03-09 (reference)',
      gatedReturn: null, gatedV2Return: null, gatedV2FastReturn: null, ungatedReturn: null, benchmarkReturn: null,
      note: 'OUT OF SAMPLE — cannot test: 6-year cache starts 2020-10-01. The engine has never seen a -50%+ systemic drawdown; momentum crash risk (e.g. 2009 reversal) is untested.',
    },
    {
      name: '2020 COVID crash',
      inSample: false,
      period: '2020-02-19 -> 2020-03-23 (reference)',
      gatedReturn: null, gatedV2Return: null, gatedV2FastReturn: null, ungatedReturn: null, benchmarkReturn: null,
      note: 'OUT OF SAMPLE — cannot test: cache starts 2020-10-01, after the crash. Fast -34% drawdown with violent rebound is exactly the regime where monthly momentum whipsaws; untested.',
    },
  ];

  const methodology = {
    universe: cache.universe || 'sp500-constituents',
    universeAsOf: cache.universeAsOf || null,
    rebalanceRule: 'First trading day of each calendar month (first bar of the month in the price cache). Execute at that day\'s close. Equal weight across the active list.',
    costBps: COST_BPS_PER_SIDE,
    costRule: '10 bps per side on traded notional (buys + sells); share-count accounting; residual cash earns 0%.',
    warmupBars: WARMUP_BARS,
    warmupRule: 'A symbol is eligible at rebalance date T only if it has >= 273 bars with timestamps <= T (252d signal span + 21d skipped month). First rebalance = first month-start bar with index >= 273 (computed, not hardcoded).',
    windowStart,
    windowEnd: lastBarIso,
    variants: {
      gated: 'Gate at T: RED (SPX below 200-day OR HY OAS >= 4.0) -> 100% cash (0% return). YELLOW (HY OAS >= 3.5 OR VIX >= 25 OR SPX 200-day margin < 2%) -> top 5% (vigintile) only. GREEN -> top decile. (v1 — superseded by gated_v2; retained for comparison.)',
      gated_v2: 'v2 stress score S = (SPX below 200-day ? 1:0) + (HY OAS >= 4.0 ? 1:0) + (VIX >= 30 ? 1:0), computed on available legs only (HY OAS history starts 2023-09-30; before that the score runs on SPX-200d + VIX only, same substitution as v1). Exposure tiers: S=0 -> 100% (FULL), S=1 -> 60% (REDUCED), S>=2 -> 25% (DEFENSIVE, floor — never 0%). Target list is ALWAYS the top decile scaled by exposure; remainder is cash; no vigintile concentration. Asymmetric hysteresis: de-risk applies immediately when S rises; re-risk moves at most one tier per rebalance and only when the lower S has held for 2 consecutive rebalances (current + prior). Single implementation shared with the live gate: scripts/momentum-gate-v2.cjs.',
      gated_v2_fast: 'Sensitivity variant of gated_v2: identical score/tiers/target list, but re-risk needs only 1 rebalance of confirmation (no hold requirement), still at most one tier per rebalance. Reported, not selected on.',
      ungated: 'Gate ignored — always fully invested in the top decile, equal weight.',
      benchmark: '^GSPC buy-and-hold total return (adjusted close, i.e. dividends included) over the same window.',
    },
    turnoverDefinition: 'Two-sided turnover per rebalance = (buy notional + sell notional) / NAV before trades; turnoverAvg = mean across all rebalances (first rebalance counts: ~100% all-buys).',
    sharpeNote: 'Sharpe uses risk-free rate = 0 and daily log returns (252 trading days/year).',
    lookaheadControls: [
      'computeSignalsAsOf(adj, t) reads only indices <= t — no code path reaches beyond the as-of index.',
      'Per-symbol as-of index = largest index with bar timestamp <= T (binary search); symbols with fewer than 273 bars through T are excluded from that rebalance.',
      'Gate inputs use only data dated <= T: SPX 200-day from ^GSPC bars <= T; latest VIX observation with date <= T; latest HY OAS observation with date <= T.',
      'Trades execute at T\'s close; next-month returns come only from bars after T.',
      'Adjusted closes throughout (dividends/splits accounted); raw closes never used.',
    ],
    limitations: [
      'SURVIVORSHIP BIAS: universe = CURRENT S&P 500 constituents (as of 2026-10-01). Names that were members during the window but were later removed (bankruptcies, delistings, takeovers) are absent — this flatters backfilled historical returns and momentum ranks.',
      '6-YEAR WINDOW ONLY: covers the 2022 bear market (-25.4% SPX) and the 2025 tariff drawdown (-10.1%), but NOT the 2008-09 GFC or the 2020 COVID crash. The engine is untested in -40%+ systemic drawdowns and in violent V-shaped rebounds (momentum whipsaw regime).',
      'GATE INPUT SUBSTITUTION: HY OAS history (BAMLH0A0HYM2) exists only from 2023-09-30. For rebalance dates before that, the gate ran on the SPX-200d + VIX legs only (no credit leg) — including the entire 2022 bear market. VIX series is weekly-sampled (median 5-day gaps); the gate uses the latest observation dated <= T.',
      'First trading day of month = first bar of the month in the cache (actual trading days); exchange-holiday edge cases are handled exactly by the data.',
      'Cash earns 0% (no T-bill yield credited); benchmark is total return including dividends via adjusted close.',
      'V2 HYSTERESIS INITIALIZATION: the first rebalance initializes the effective tier to the target tier (no history to confirm against); the asymmetric confirmation rule applies from the second rebalance on.',
      'V2 LIVE PARITY: the live gate (scripts/generate-momentum-state.cjs) uses the same shared module (scripts/momentum-gate-v2.cjs); live hysteresis is approximated on a monthly score history, documented in momentum-gate.json.',
    ],
  };

  const gateComparison = {
    note: 'Head-to-head of the v1 gate, the v2 gate (standard + fast sensitivity), and ungated, on identical window/costs/universe. Flips = consecutive-rebalance gate changes (v1); tierChanges = consecutive-rebalance effective-exposure changes (v2).',
    rows: [
      {
        variant: 'gated (v1)', cagr: gatedStats.cagr, maxDrawdown: gatedStats.maxDrawdown,
        sharpe: gatedStats.sharpe, annVol: gatedStats.annVol, totalReturn: gatedStats.totalReturn,
        gateFlips: v1GateFlips, scoreChanges: null, tierChanges: null,
        note: 'Binary RED->cash + YELLOW vigintile concentration. Suffers the re-risk lag documented in the diagnosis.',
      },
      {
        variant: 'gated_v2', cagr: gatedV2Stats.cagr, maxDrawdown: gatedV2Stats.maxDrawdown,
        sharpe: gatedV2Stats.sharpe, annVol: gatedV2Stats.annVol, totalReturn: gatedV2Stats.totalReturn,
        gateFlips: null, scoreChanges: v2ScoreChanges, tierChanges: v2TierChanges,
        note: 'Stress score + exposure tiers (100/60/25%) + asymmetric hysteresis; always top decile.',
      },
      {
        variant: 'gated_v2_fast', cagr: gatedV2FastStats.cagr, maxDrawdown: gatedV2FastStats.maxDrawdown,
        sharpe: gatedV2FastStats.sharpe, annVol: gatedV2FastStats.annVol, totalReturn: gatedV2FastStats.totalReturn,
        gateFlips: null, scoreChanges: v2ScoreChanges, tierChanges: v2FastTierChanges,
        note: 'Sensitivity variant: 1-rebalance re-risk confirmation. Reported, not selected on.',
      },
      {
        variant: 'ungated', cagr: ungatedStats.cagr, maxDrawdown: ungatedStats.maxDrawdown,
        sharpe: ungatedStats.sharpe, annVol: ungatedStats.annVol, totalReturn: ungatedStats.totalReturn,
        gateFlips: 0, scoreChanges: 0, tierChanges: 0,
        note: 'No gate — always fully invested in the top decile.',
      },
    ],
    crashEpisodeReturns: {
      '2022 bear market': {
        gated: crashEpisodes[0].gatedReturn, gated_v2: crashEpisodes[0].gatedV2Return,
        gated_v2_fast: crashEpisodes[0].gatedV2FastReturn, ungated: crashEpisodes[0].ungatedReturn,
        benchmark: crashEpisodes[0].benchmarkReturn,
      },
      '2025 tariff drawdown': {
        gated: crashEpisodes[1].gatedReturn, gated_v2: crashEpisodes[1].gatedV2Return,
        gated_v2_fast: crashEpisodes[1].gatedV2FastReturn, ungated: crashEpisodes[1].ungatedReturn,
        benchmark: crashEpisodes[1].benchmarkReturn,
      },
    },
  };

  const doc = {
    generatedAt: new Date().toISOString(),
    methodology,
    window: { start: windowStart, end: lastBarIso, rebalanceCount: rebDates.length },
    variants: {
      gated: simSummary(gated, gatedStats),
      gated_v2: simSummary(gatedV2, gatedV2Stats),
      gated_v2_fast: simSummary(gatedV2Fast, gatedV2FastStats),
      ungated: simSummary(ungated, ungatedStats),
      benchmark: { ...benchStats, note: '^GSPC buy-and-hold, no costs' },
    },
    gateComparison,
    crashEpisodes,
    rebalanceLog,
    droppedSymbols: [...droppedSymbols].sort(),
    droppedSymbolsNote: droppedSymbols.size
      ? 'These symbols had < 273 bars at some rebalance date (recent listings) or their series ended early; excluded from those dates\' universes.'
      : 'No symbols dropped out of history during the window.',
  };

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(doc));
  console.log(`wrote ${path.relative(root, outPath)}`);
  console.log(`gated    CAGR ${(gatedStats.cagr * 100).toFixed(2)}%  maxDD ${(gatedStats.maxDrawdown * 100).toFixed(2)}%  Sharpe ${gatedStats.sharpe}  flips ${v1GateFlips}`);
  console.log(`gated_v2 CAGR ${(gatedV2Stats.cagr * 100).toFixed(2)}%  maxDD ${(gatedV2Stats.maxDrawdown * 100).toFixed(2)}%  Sharpe ${gatedV2Stats.sharpe}  scoreChg ${v2ScoreChanges} tierChg ${v2TierChanges}`);
  console.log(`v2_fast  CAGR ${(gatedV2FastStats.cagr * 100).toFixed(2)}%  maxDD ${(gatedV2FastStats.maxDrawdown * 100).toFixed(2)}%  Sharpe ${gatedV2FastStats.sharpe}  scoreChg ${v2ScoreChanges} tierChg ${v2FastTierChanges}`);
  console.log(`ungated  CAGR ${(ungatedStats.cagr * 100).toFixed(2)}%  maxDD ${(ungatedStats.maxDrawdown * 100).toFixed(2)}%  Sharpe ${ungatedStats.sharpe}`);
  console.log(`bench    CAGR ${(benchStats.cagr * 100).toFixed(2)}%  maxDD ${(benchStats.maxDrawdown * 100).toFixed(2)}%  Sharpe ${benchStats.sharpe}`);
}

main();
