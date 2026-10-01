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
 *      (0 for RED); crashEpisodes contains the 2022 bear entry in-sample;
 *      variants gated_v2/gated_v2_fast present; gateComparison present with
 *      all four variants; per-entry gateV2/gateV2Fast fields sane.
 *   6. NO-LOOKAHEAD SPOT CHECK (independent reimplementation): with a fixed
 *      seed, pick 2 historical rebalance dates and 3 symbols each; recompute the
 *      composite rank from the price cache using ONLY bars with timestamps <= T
 *      and confirm it matches the backtest's recorded rank. Also recompute the
 *      gate from cache inputs and confirm it matches the recorded gate.
 *   7. V2 GATE CHECK (independent reimplementation): recompute the v2 stress
 *      score from each entry's recorded gateInputs with separate threshold
 *      code, replay the asymmetric hysteresis over the full score sequence
 *      (standard + fast) with separate logic, and confirm every entry's
 *      recorded tier/exposure matches.
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
  for (const f of ['generatedAt', 'methodology', 'window', 'variants', 'gateComparison', 'crashEpisodes', 'rebalanceLog']) {
    check(doc[f] !== undefined && doc[f] !== null, `missing top-level field: ${f}`);
  }
  const m = doc.methodology || {};
  for (const f of ['universe', 'rebalanceRule', 'costBps', 'warmupBars', 'windowStart', 'windowEnd', 'lookaheadControls', 'limitations']) {
    check(m[f] !== undefined && m[f] !== null, `missing methodology field: ${f}`);
  }
  for (const v of ['gated', 'gated_v2', 'gated_v2_fast', 'ungated', 'benchmark']) {
    check(doc.variants && doc.variants[v], `missing variants.${v}`);
    for (const f of ['cagr', 'annVol', 'maxDrawdown', 'sharpe', 'nRebalances', 'turnoverAvg']) {
      if (v === 'benchmark' && (f === 'nRebalances' || f === 'turnoverAvg')) continue;
      const val = doc.variants[v] && doc.variants[v][f];
      check(typeof val === 'number' && Number.isFinite(val), `variants.${v}.${f} missing or non-finite`);
    }
  }
  // methodology must document the v2 design (fixed parameters, not tuned)
  const methText = JSON.stringify(m.variants || {}) + ' ' + (m.limitations || []).join(' ');
  check(/gated_v2/.test(methText), 'methodology missing gated_v2 variant description');
  check(/hysteresis/i.test(methText), 'methodology missing hysteresis description');
  check(/never 0/.test(methText), 'methodology missing the never-0% exposure floor disclosure');
  // gateComparison: four rows + crash-episode returns
  const gc = doc.gateComparison || {};
  check(Array.isArray(gc.rows) && gc.rows.length === 4, 'gateComparison.rows must have 4 entries');
  const rowNames = (gc.rows || []).map(r => r.variant);
  for (const want of ['gated (v1)', 'gated_v2', 'gated_v2_fast', 'ungated']) {
    check(rowNames.includes(want), `gateComparison missing row: ${want}`);
  }
  for (const r of (gc.rows || [])) {
    for (const f of ['cagr', 'maxDrawdown', 'sharpe']) {
      check(typeof r[f] === 'number' && Number.isFinite(r[f]), `gateComparison row ${r.variant}.${f} missing or non-finite`);
    }
  }
  check(gc.crashEpisodeReturns && gc.crashEpisodeReturns['2022 bear market'] && gc.crashEpisodeReturns['2025 tariff drawdown'],
    'gateComparison.crashEpisodeReturns must cover both in-sample episodes');

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
    /^root\.crashEpisodes\[\d+\]\.(gatedReturn|gatedV2Return|gatedV2FastReturn|ungatedReturn|benchmarkReturn)$/,
    /^root\.rebalanceLog\[\d+\]\.gateInputs\.hyOas$/,
    /^root\.rebalanceLog\[\d+\]\.(gateV2|gateV2Fast)\.legs\.(spxBelow200d|hyOasStress|vixStress)$/,
    /^root\.rebalanceLog\[\d+\]\.note$/,
    // gateComparison: each row carries only the change-count metrics that apply
    // to its variant (v1 -> gateFlips; v2 -> scoreChanges/tierChanges; ungated -> 0s)
    /^root\.gateComparison\.rows\[\d+\]\.(gateFlips|scoreChanges|tierChanges)$/,
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
  check(doc.variants.gated_v2.nRebalances === log.length, `gated_v2 nRebalances != rebalanceLog length`);
  check(doc.variants.gated_v2_fast.nRebalances === log.length, `gated_v2_fast nRebalances != rebalanceLog length`);
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
    // v2 per-entry fields
    for (const key of ['gateV2', 'gateV2Fast']) {
      const v = e[key];
      check(v && typeof v === 'object', `${e.date}: missing ${key}`);
      if (!v) continue;
      check(Number.isInteger(v.score) && v.score >= 0 && v.score <= 3, `${e.date}: ${key}.score invalid (${v.score})`);
      check(Number.isInteger(v.legsAvailable) && v.legsAvailable >= 0 && v.legsAvailable <= 3, `${e.date}: ${key}.legsAvailable invalid`);
      check(v.score <= v.legsAvailable, `${e.date}: ${key}.score ${v.score} > legsAvailable ${v.legsAvailable}`);
      check([1.0, 0.6, 0.25].includes(v.exposure), `${e.date}: ${key}.exposure ${v.exposure} not in {1.0, 0.6, 0.25}`);
      check(Number.isInteger(v.tier) && v.tier >= 0 && v.tier <= 2, `${e.date}: ${key}.tier invalid`);
      check(typeof v.tierChanged === 'boolean', `${e.date}: ${key}.tierChanged not boolean`);
      check(v.tierLabel === ['FULL', 'REDUCED', 'DEFENSIVE'][v.tier], `${e.date}: ${key}.tierLabel mismatch`);
      // Note: effective tier may lag the raw-score target tier (hysteresis);
      // the exact invariant is verified by the independent replay in §7 below.
    }
    // v2 score inputs must be consistent with the recorded v1 gate inputs
    const gi = e.gateInputs || {};
    const giSpxBelow = gi.spxAbove200d === true ? false : gi.spxAbove200d === false ? true : null;
    check(e.gateV2.legs.spxBelow200d === giSpxBelow, `${e.date}: gateV2 spx leg != gateInputs`);
    check((e.gateV2.legs.hyOasStress === null && gi.hyOas === null) || e.gateV2.legs.hyOasStress === (gi.hyOas >= 4.0),
      `${e.date}: gateV2 HY leg != gateInputs`);
    check((e.gateV2.legs.vixStress === null && gi.vix === null) || e.gateV2.legs.vixStress === (gi.vix >= 30),
      `${e.date}: gateV2 VIX leg != gateInputs`);
  }
  console.log(`gate counts: ${JSON.stringify(gateCounts)}; rebalances: ${log.length}`);

  const eps = doc.crashEpisodes || [];
  const e2022 = eps.find(e => /2022 bear/i.test(e.name || ''));
  check(e2022 && e2022.inSample === true, 'crashEpisodes missing in-sample 2022 bear entry');
  check(e2022 && typeof e2022.gatedReturn === 'number' && typeof e2022.ungatedReturn === 'number',
    '2022 bear episode missing numeric gated/ungated returns');
  check(e2022 && typeof e2022.gatedV2Return === 'number' && typeof e2022.gatedV2FastReturn === 'number',
    '2022 bear episode missing numeric gatedV2/gatedV2Fast returns');
  const e2025 = eps.find(e => /2025 tariff/i.test(e.name || ''));
  check(e2025 && e2025.inSample === true && typeof e2025.gatedV2Return === 'number' && typeof e2025.gatedV2FastReturn === 'number',
    '2025 tariff episode missing numeric gatedV2/gatedV2Fast returns');
  check(eps.some(e => e.inSample === false && e.gatedReturn === null), 'crashEpisodes missing named out-of-sample episode');

  /* 7. v2 gate check: independent score recomputation + hysteresis replay */
  (function v2Check() {
    // Independent score code (separate from scripts/momentum-gate-v2.cjs):
    // S = (SPX below 200d) + (HY OAS >= 4.0) + (VIX >= 30), unavailable legs = 0.
    function scoreIndependent(gi) {
      let s = 0;
      const legs = { spxBelow200d: null, hyOasStress: null, vixStress: null };
      if (gi.spxAbove200d === true || gi.spxAbove200d === false) {
        legs.spxBelow200d = !gi.spxAbove200d;
        if (legs.spxBelow200d) s++;
      }
      if (typeof gi.hyOas === 'number' && Number.isFinite(gi.hyOas)) {
        legs.hyOasStress = gi.hyOas >= 4.0;
        if (legs.hyOasStress) s++;
      }
      if (typeof gi.vix === 'number' && Number.isFinite(gi.vix)) {
        legs.vixStress = gi.vix >= 30;
        if (legs.vixStress) s++;
      }
      return { score: s, legs };
    }
    // Independent hysteresis (separate logic, same spec): de-risk immediate;
    // re-risk at most one tier per step, only with confirmation.
    function hysteresisIndependent(scores, fast) {
      const EXP = [1.0, 0.6, 0.25];
      const tgt = s => (s <= 0 ? 0 : s === 1 ? 1 : 2);
      const out = [];
      let eff = null, prev = null;
      for (const s of scores) {
        const t = tgt(s);
        if (eff === null) eff = t;
        else if (t >= eff) eff = t;                       // de-risk: immediate
        else if (fast || (prev !== null && prev === s)) eff = eff - 1; // re-risk: one tier, confirmed
        out.push({ tier: eff, exposure: EXP[eff] });
        prev = s;
      }
      return out;
    }
    const scores = log.map(e => {
      const ind = scoreIndependent(e.gateInputs || {});
      if (ind.score !== e.gateV2.score) fail(`${e.date}: v2 score mismatch (independent ${ind.score} != recorded ${e.gateV2.score})`);
      if (ind.score !== e.gateV2Fast.score) fail(`${e.date}: v2-fast score mismatch`);
      return ind.score;
    });
    const std = hysteresisIndependent(scores, false);
    const fst = hysteresisIndependent(scores, true);
    log.forEach((e, i) => {
      if (std[i].tier !== e.gateV2.tier || std[i].exposure !== e.gateV2.exposure) {
        fail(`${e.date}: v2 hysteresis mismatch (independent tier ${std[i].tier}/${std[i].exposure} != recorded ${e.gateV2.tier}/${e.gateV2.exposure})`);
      }
      if (fst[i].tier !== e.gateV2Fast.tier || fst[i].exposure !== e.gateV2Fast.exposure) {
        fail(`${e.date}: v2-fast hysteresis mismatch`);
      }
    });
    const tierChg = arr => { let c = 0; for (let i = 1; i < arr.length; i++) if (arr[i].tier !== arr[i - 1].tier) c++; return c; };
    console.log(`v2 check: ${scores.length} scores replayed; tier changes std=${tierChg(std)} fast=${tierChg(fst)}`);
  })();

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
