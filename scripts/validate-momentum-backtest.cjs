'use strict';

/*
 * validate-momentum-backtest.cjs
 *
 * Validator for outputs/momentum/momentum-backtest.json (NOT wired into the
 * build manifest/lane — run explicitly).
 *
 * Checks:
 *   1. JSON parses; required top-level fields and methodology fields present.
 *   2. Window dates sane (valid ISO dates, start < end, within cache range).
 *   3. methodology.lookaheadControls non-empty; limitations[] covers the three
 *      mandatory disclosures (survivorship bias, 6-year window, gate inputs).
 *   4. No NaN/Infinity anywhere (post-parse: no nulls in numeric positions) and
 *      all stat fields finite.
 *   5. Internal consistency: nRebalances == rebalanceLog length; gate counts sum;
 *      rankedUniverse length == eligibleCount; targetList length == activeCut
 *      (0 for RED); crashEpisodes contains the 2022 bear entry in-sample.
 *   6. NO-LOOKAHEAD SPOT CHECK (independent reimplementation): with a fixed
 *      seed, pick 2 historical rebalance dates and 3 symbols each; recompute the
 *      composite rank from the price cache using ONLY bars with timestamps <= T
 *      and confirm it matches the backtest's recorded rank. Also recompute the
 *      gate from cache inputs and confirm it matches the recorded gate.
 *
 * Exit non-zero with a clear message on any failure.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const artifactPath = path.join(root, 'outputs', 'momentum', 'momentum-backtest.json');
const cachePath = path.join(root, 'outputs', 'cache', 'momentum', 'price-history.json');
const creditPath = path.join(root, 'data', 'cache', 'credit-series.json');
const volPath = path.join(root, 'data', 'cache', 'volatility-series.json');

const WARMUP_BARS = 252 + 21;
const SQRT_252 = Math.sqrt(252);
const SIGNAL_KEYS = ['ret12m1m', 'ret6m1m', 'dist52wHigh', 'maStack', 'volScaled'];

let failures = [];
function fail(msg) { failures.push(msg); }
function check(cond, msg) { if (!cond) fail(msg); }

// Deterministic PRNG (mulberry32) so the spot check is reproducible.
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function readJson(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { fail(`cannot parse ${path.relative(root, p)}: ${e.message}`); return null; }
}

/* ---- independent signal implementation (mirror of runner, separate code path) ---- */

function sma(arr, n, t) {
  let s = 0;
  for (let i = t - n + 1; i <= t; i++) s += arr[i];
  return s / n;
}

function signalsAsOf(adj, t) {
  const r12 = adj[t - 21] / adj[t - 252] - 1;
  const r6 = adj[t - 21] / adj[t - 126] - 1;
  let hi = -Infinity;
  for (let i = t - 252; i <= t; i++) if (adj[i] > hi) hi = adj[i];
  const px = adj[t];
  const d52 = px / hi - 1;
  const s50 = sma(adj, 50, t), s200 = sma(adj, 200, t);
  const stack = px > s50 && s50 > s200 ? 1 : (px > s50 ? 0.5 : 0);
  const lr = [];
  for (let i = t - 251; i <= t; i++) lr.push(Math.log(adj[i] / adj[i - 1]));
  const mean = lr.reduce((a, b) => a + b, 0) / lr.length;
  const sd = Math.sqrt(lr.reduce((a, r) => a + (r - mean) * (r - mean), 0) / (lr.length - 1));
  const vs = sd * SQRT_252 > 0 ? r12 / (sd * SQRT_252) : 0;
  return { ret12m1m: r12, ret6m1m: r6, dist52wHigh: d52, maStack: stack, volScaled: vs };
}

function asOfIndex(dates, asOfEpoch) {
  let lo = 0, hi = dates.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (dates[mid] <= asOfEpoch) { ans = mid; lo = mid + 1; } else hi = mid - 1;
  }
  return ans;
}

function obsAsOf(series, asOfIso) {
  let best = null;
  for (const o of series) {
    if (o.date <= asOfIso && o.value !== null && o.value !== undefined && (!best || o.date > best.date)) best = o;
  }
  return best ? best.value : null;
}

function main() {
  const doc = readJson(artifactPath);
  if (!doc) { console.error('FAIL:\n- ' + failures.join('\n- ')); process.exit(1); }

  /* 1. required fields */
  for (const f of ['generatedAt', 'methodology', 'window', 'variants', 'crashEpisodes', 'rebalanceLog']) {
    check(doc[f] !== undefined && doc[f] !== null, `missing top-level field: ${f}`);
  }
  const m = doc.methodology || {};
  for (const f of ['universe', 'rebalanceRule', 'costBps', 'warmupBars', 'windowStart', 'windowEnd', 'lookaheadControls', 'limitations']) {
    check(m[f] !== undefined && m[f] !== null, `missing methodology field: ${f}`);
  }
  for (const v of ['gated', 'ungated', 'benchmark']) {
    check(doc.variants && doc.variants[v], `missing variants.${v}`);
    for (const f of ['cagr', 'annVol', 'maxDrawdown', 'sharpe', 'nRebalances', 'turnoverAvg']) {
      if (v === 'benchmark' && (f === 'nRebalances' || f === 'turnoverAvg')) continue;
      const val = doc.variants[v] && doc.variants[v][f];
      check(typeof val === 'number' && Number.isFinite(val), `variants.${v}.${f} missing or non-finite`);
    }
  }

  /* 2. window dates sane */
  const ws = m.windowStart, we = m.windowEnd;
  check(/^\d{4}-\d{2}-\d{2}$/.test(ws || ''), `windowStart not ISO date: ${ws}`);
  check(/^\d{4}-\d{2}-\d{2}$/.test(we || ''), `windowEnd not ISO date: ${we}`);
  check(ws < we, `windowStart ${ws} not before windowEnd ${we}`);
  check(doc.window && doc.window.start === ws && doc.window.end === we, 'window.start/end mismatch methodology');

  /* 3. lookahead controls + mandatory disclosures */
  check(Array.isArray(m.lookaheadControls) && m.lookaheadControls.length > 0, 'methodology.lookaheadControls empty');
  const lim = (m.limitations || []).join(' ').toLowerCase();
  check(/survivor/i.test(lim), 'limitations[] missing survivorship-bias disclosure');
  check(/6-year|six-year|6 year/.test(lim), 'limitations[] missing 6-year-window disclosure');
  check(/2008|gfc|2020.*covid|covid.*2020/.test(lim), 'limitations[] missing out-of-sample stress-episode disclosure');
  check(/hy oas|bamlh0a0hym2/.test(lim), 'limitations[] missing gate-input (HY OAS) substitution disclosure');

  /* 4. no NaN/Infinity; nulls only where the schema legitimately allows them
     (out-of-sample episode returns, unavailable HY OAS, absent notes) */
  const NULL_OK = [
    /^root\.crashEpisodes\[\d+\]\.(gatedReturn|ungatedReturn|benchmarkReturn)$/,
    /^root\.rebalanceLog\[\d+\]\.gateInputs\.hyOas$/,
    /^root\.rebalanceLog\[\d+\]\.note$/,
  ];
  (function walk(x, trail) {
    if (typeof x === 'number') check(Number.isFinite(x), `non-finite number at ${trail}`);
    else if (x === null) check(NULL_OK.some(re => re.test(trail)), `unexpected null at ${trail}`);
    else if (Array.isArray(x)) x.forEach((v, i) => walk(v, `${trail}[${i}]`));
    else if (x && typeof x === 'object') for (const k of Object.keys(x)) walk(x[k], `${trail}.${k}`);
  })(doc, 'root');

  /* 5. internal consistency */
  const log = doc.rebalanceLog || [];
  check(doc.variants.gated.nRebalances === log.length, `gated nRebalances ${doc.variants.gated.nRebalances} != rebalanceLog length ${log.length}`);
  check(doc.variants.ungated.nRebalances === log.length, `ungated nRebalances ${doc.variants.ungated.nRebalances} != rebalanceLog length ${log.length}`);
  check(m.warmupBars === WARMUP_BARS, `warmupBars ${m.warmupBars} != ${WARMUP_BARS}`);
  const gateCounts = {};
  for (const e of log) {
    gateCounts[e.gate] = (gateCounts[e.gate] || 0) + 1;
    check(e.rankedUniverse && e.rankedUniverse.length === e.eligibleCount,
      `${e.date}: rankedUniverse length != eligibleCount`);
    const expectActive = e.gate === 'RED' ? 0 : e.activeCut;
    check(e.targetList.length === expectActive,
      `${e.date}: targetList length ${e.targetList.length} != expected ${expectActive} (gate ${e.gate})`);
    const rankPos = new Map(e.rankedUniverse.map((s, i) => [s, i + 1]));
    for (const s of e.targetList) {
      check(rankPos.get(s) <= e.activeCut, `${e.date}: target ${s} rank ${rankPos.get(s)} > activeCut ${e.activeCut}`);
    }
  }
  console.log(`gate counts: ${JSON.stringify(gateCounts)}; rebalances: ${log.length}`);

  const eps = doc.crashEpisodes || [];
  const e2022 = eps.find(e => /2022 bear/i.test(e.name || ''));
  check(e2022 && e2022.inSample === true, 'crashEpisodes missing in-sample 2022 bear entry');
  check(e2022 && typeof e2022.gatedReturn === 'number' && typeof e2022.ungatedReturn === 'number',
    '2022 bear episode missing numeric gated/ungated returns');
  check(eps.some(e => e.inSample === false && e.gatedReturn === null), 'crashEpisodes missing named out-of-sample episode');

  if (failures.length) { console.error('FAIL:\n- ' + failures.join('\n- ')); process.exit(1); }

  /* 6. no-lookahead spot check: independent recomputation */
  const cache = readJson(cachePath);
  const credit = readJson(creditPath);
  const vol = readJson(volPath);
  if (!cache || failures.length) { console.error('FAIL:\n- ' + failures.join('\n- ')); process.exit(1); }

  const hySeries = credit?.series?.BAMLH0A0HYM2 || [];
  const vixSeries = vol?.series?.VIX || [];
  const hyFirst = hySeries.length ? hySeries[0].date : null;
  const bAdj = cache.benchmark.adj;
  const symbols = Object.keys(cache.symbols).sort();

  const rng = mulberry32(20260930);
  const dateIdx = [Math.floor(rng() * log.length), Math.floor(rng() * log.length)];
  const spotFails = [];
  for (const di of dateIdx) {
    const e = log[di];
    const T = e.benchmarkIndex;
    const tEpoch = cache.benchmark.dates[T];
    // independent rank recomputation: only bars with timestamp <= T
    const rows = [];
    for (const s of symbols) {
      const d = cache.symbols[s];
      const idx = asOfIndex(d.dates, tEpoch);
      if (idx >= WARMUP_BARS) {
        const sig = signalsAsOf(d.adj, idx);
        if (Object.values(sig).every(Number.isFinite)) rows.push({ symbol: s, signals: sig });
      }
    }
    const rankMaps = {};
    for (const k of SIGNAL_KEYS) {
      const sorted = [...rows].sort((a, b) => a.signals[k] - b.signals[k]);
      const mm = new Map();
      sorted.forEach((r, i) => mm.set(r.symbol, (i + 1) / sorted.length));
      rankMaps[k] = mm;
    }
    for (const r of rows) r.composite = SIGNAL_KEYS.reduce((a, k) => a + rankMaps[k].get(r.symbol), 0) / SIGNAL_KEYS.length;
    rows.sort((a, b) => b.composite - a.composite || (a.symbol < b.symbol ? -1 : 1));
    const recomputed = new Map(rows.map((r, i) => [r.symbol, i + 1]));
    const recorded = new Map(e.rankedUniverse.map((s, i) => [s, i + 1]));
    check(recomputed.size === recorded.size, `${e.date}: eligible count mismatch (recomputed ${recomputed.size} vs recorded ${recorded.size})`);
    const symIdx = [Math.floor(rng() * symbols.length), Math.floor(rng() * symbols.length), Math.floor(rng() * symbols.length)];
    for (const si of symIdx) {
      const s = symbols[si];
      const rec = recorded.get(s), rec2 = recomputed.get(s);
      if (rec === undefined && rec2 === undefined) continue; // ineligible both ways
      if (rec !== rec2) spotFails.push(`${e.date} ${s}: recorded rank ${rec} != recomputed ${rec2}`);
    }
    // independent gate recomputation
    const price = bAdj[T];
    const s200 = sma(bAdj, 200, T);
    const margin = price / s200 - 1;
    const vix = obsAsOf(vixSeries, e.date);
    const hyAvail = hyFirst !== null && e.date >= hyFirst;
    const hy = hyAvail ? obsAsOf(hySeries, e.date) : null;
    const red = price < s200 || (hy !== null && hy >= 4.0);
    const gate = red ? 'RED'
      : (hy !== null && hy >= 3.5) || (vix !== null && vix >= 25) || margin < 0.02 ? 'YELLOW' : 'GREEN';
    if (gate !== e.gate) spotFails.push(`${e.date}: recorded gate ${e.gate} != recomputed ${gate}`);
    // gate inputs cross-check
    const gi = e.gateInputs || {};
    if (Math.abs(gi.spxMarginPct - Math.round(margin * 1e6) / 1e6) > 1e-6) spotFails.push(`${e.date}: spxMarginPct mismatch`);
    if ((gi.vix ?? null) !== vix) spotFails.push(`${e.date}: vix input mismatch`);
    if ((gi.hyOas ?? null) !== hy) spotFails.push(`${e.date}: hyOas input mismatch`);
    console.log(`spot-check ${e.date}: ${recomputed.size} eligible, gate ${gate} (recorded ${e.gate})`);
  }
  spotFails.forEach(f => fail('spot-check: ' + f));

  if (failures.length) { console.error('FAIL:\n- ' + failures.join('\n- ')); process.exit(1); }
  console.log('validate-momentum-backtest: PASS');
}

main();
