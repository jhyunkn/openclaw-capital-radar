'use strict';

/*
 * generate-momentum-state.cjs
 *
 * Phase 1 momentum engine — signal computation, cross-sectional ranking,
 * regime gate (REUSED macro state), rebalance calendar.
 *
 * Fully deterministic: same cache inputs -> byte-identical outputs.
 *
 * Signals per symbol (trading-day offsets on adjusted closes, t = last bar):
 *   ret12m1m  = adj[t-21]/adj[t-252] - 1   (12m momentum skipping most recent month)
 *   ret6m1m   = adj[t-21]/adj[t-126] - 1    (6m momentum skipping most recent month)
 *   dist52wHigh = price / max(adj[t-252..t]) - 1
 *   maStack   = 1 if price > sma50 > sma200, 0.5 if price > sma50 only, else 0
 *   volScaled = ret12m1m / (stdev(daily log returns, trailing 252d) * sqrt(252))
 *   composite = mean of cross-sectional percentile ranks of the five signals
 *   rank      = 1..N by composite descending (ties broken by symbol, deterministic)
 *
 * Regime gate mapping (explicit, auditable — see momentum-gate.json):
 *   RED    if SPX below 200-day OR HY OAS >= 4.0            -> list EMPTY / cash
 *   YELLOW if HY OAS >= 3.5 OR VIX >= 25 OR SPX 200d margin < 2%
 *                                                     -> top 5% only, cautious flag
 *   GREEN  otherwise                                        -> top decile active
 *
 * Committed outputs:
 *   outputs/momentum/momentum-state.json
 *   outputs/momentum/momentum-top-decile.json
 *   outputs/momentum/momentum-gate.json
 *   outputs/momentum/momentum-rebalance.json
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cachePath = path.join(root, 'outputs', 'cache', 'momentum', 'price-history.json');
const outDir = path.join(root, 'outputs', 'momentum');

const MIN_BARS = 253; // must span adj[t-252] for all five signals
const SQRT_252 = Math.sqrt(252);

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

function sma(values, n, t) {
  let sum = 0;
  for (let i = t - n + 1; i <= t; i++) sum += values[i];
  return sum / n;
}

function computeSignals(adj) {
  const t = adj.length - 1;
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
  let var_ = 0;
  for (const r of rets) var_ += (r - mean) * (r - mean);
  const stdev = Math.sqrt(var_ / (rets.length - 1));
  const vol = stdev * SQRT_252;
  const volScaled = vol > 0 ? ret12m1m / vol : 0;

  return { ret12m1m, ret6m1m, dist52wHigh, maStack, volScaled };
}

function percentileRanks(rows, key, ascending) {
  const sorted = [...rows].sort((a, b) =>
    ascending ? a.signals[key] - b.signals[key] : b.signals[key] - a.signals[key]);
  const n = sorted.length;
  const ranks = new Map();
  sorted.forEach((row, i) => ranks.set(row.symbol, (i + 1) / n));
  return ranks;
}

/* ---------- regime gate inputs (REUSED committed macro state) ---------- */

function findMetric(state, groupId, metricId) {
  const group = (state?.groups || []).find(g => g.id === groupId);
  return (group?.metrics || []).find(m => m.id === metricId) || null;
}

function readHyOas() {
  // Primary: current-market-state credit group (has value + freshness)
  const cms = readJson(path.join(root, 'outputs', 'current-market-state.json'));
  const m = findMetric(cms, 'credit', 'hy_oas');
  if (m && m.value !== undefined && m.value !== null) {
    return {
      value: parseFloat(m.value),
      source: 'outputs/current-market-state.json groups.credit.metrics[hy_oas]',
      freshness: m.freshness || 'unknown',
    };
  }
  // Fallback: raw observations tail in credit-state.json
  const credit = readJson(path.join(root, 'outputs', 'credit-state.json'));
  const obs = credit?.datasets?.hy_oas?.observations;
  if (Array.isArray(obs) && obs.length) {
    const last = obs[obs.length - 1];
    return {
      value: last.value,
      source: 'outputs/credit-state.json datasets.hy_oas.observations (last)',
      freshness: last.date,
    };
  }
  return { value: null, source: 'unavailable', freshness: 'unavailable' };
}

function readVix() {
  const cms = readJson(path.join(root, 'outputs', 'current-market-state.json'));
  const m = findMetric(cms, 'volatility', 'vix');
  return {
    value: m && m.value !== undefined ? parseFloat(m.value) : null,
    source: 'outputs/current-market-state.json groups.volatility.metrics[vix]',
    freshness: m?.freshness || 'unknown',
  };
}

function spx200d(benchmark) {
  // Refresh of the stale chart-regime-decision-state SPX-vs-200D read,
  // computed from the same Yahoo adjclose series family. Not new macro logic.
  if (!benchmark || !Array.isArray(benchmark.adj) || benchmark.adj.length < 200) {
    return { above: null, marginPct: null, price: null, sma200: null, asOf: null, ok: false };
  }
  const adj = benchmark.adj;
  const t = adj.length - 1;
  const price = adj[t];
  const s200 = sma(adj, 200, t);
  const marginPct = price / s200 - 1;
  const ts = benchmark.dates[t];
  return {
    above: price > s200,
    marginPct,
    price,
    sma200: s200,
    asOf: new Date(ts * 1000).toISOString().slice(0, 10),
    ok: true,
  };
}

/* ---------- rebalance calendar ---------- */

function isoDate(d) { return d.toISOString().slice(0, 10); }

function computeRebalance(lastDataDateIso, prevTopDecile, currentList) {
  const lastData = new Date(lastDataDateIso + 'T12:00:00Z');
  const firstOfMonth = new Date(Date.UTC(lastData.getUTCFullYear(), lastData.getUTCMonth(), 1));
  // last rebalance: first trading day (weekday) of the current month
  const lastReb = new Date(firstOfMonth);
  while (lastReb.getUTCDay() === 0 || lastReb.getUTCDay() === 6) lastReb.setUTCDate(lastReb.getUTCDate() + 1);
  // next rebalance: first trading day (weekday) of next month — estimate, holidays unknown
  const nextMonth = new Date(Date.UTC(lastData.getUTCFullYear(), lastData.getUTCMonth() + 1, 1));
  const nextReb = new Date(nextMonth);
  while (nextReb.getUTCDay() === 0 || nextReb.getUTCDay() === 6) nextReb.setUTCDate(nextReb.getUTCDate() + 1);
  // trading days remaining: weekdays strictly after lastDataDate, up to nextReb inclusive
  let remaining = 0;
  const cursor = new Date(Date.UTC(lastData.getUTCFullYear(), lastData.getUTCMonth(), lastData.getUTCDate() + 1));
  const endDay = new Date(Date.UTC(nextReb.getUTCFullYear(), nextReb.getUTCMonth(), nextReb.getUTCDate()));
  while (cursor <= endDay) {
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) remaining++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  const result = {
    frequency: 'monthly',
    rule: 'Rebalance on the first trading day of each calendar month. Next date is a weekday estimate — exchange holidays not modeled.',
    lastRebalanceDate: isoDate(lastReb),
    nextRebalanceDate: isoDate(nextReb),
    tradingDaysRemaining: remaining,
    asOfDataDate: lastDataDateIso,
    turnover: null,
  };
  if (prevTopDecile && Array.isArray(prevTopDecile.list) && Array.isArray(currentList)) {
    const prev = new Set(prevTopDecile.list.map(e => e.symbol));
    const cur = new Set(currentList);
    const entries = [...cur].filter(s => !prev.has(s)).sort();
    const exits = [...prev].filter(s => !cur.has(s)).sort();
    result.turnover = {
      entries,
      exits,
      entryCount: entries.length,
      exitCount: exits.length,
      // 10 bps per side: each replaced slot pays an exit leg + an entry leg
      estimatedChurnCostBps: (entries.length + exits.length) * 10,
      vsPreviousGeneratedAt: prevTopDecile.generatedAt || null,
    };
  } else {
    result.turnover = {
      note: 'First run — no previously committed top-decile file; turnover is null.',
    };
  }
  return result;
}

/* ---------- main ---------- */

function main() {
  if (!fs.existsSync(cachePath)) {
    console.error(`price cache missing: ${cachePath} — run scripts/fetch-momentum-history.cjs first`);
    process.exit(1);
  }
  const cache = readJson(cachePath);
  const symbols = Object.keys(cache.symbols || {});
  const dataHealth = cache.dataHealth || 'UNKNOWN';
  const coverageCount = symbols.length;
  const generatedAt = new Date().toISOString();

  const included = [];
  const excluded = [];
  for (const symbol of symbols) {
    const s = cache.symbols[symbol];
    if (!s || !Array.isArray(s.adj) || s.adj.length < MIN_BARS) {
      excluded.push({ symbol, reason: 'insufficient history', bars: s?.adj?.length || 0 });
      continue;
    }
    const signals = computeSignals(s.adj);
    const vals = Object.values(signals);
    if (vals.some(v => !Number.isFinite(v))) {
      excluded.push({ symbol, reason: 'non-finite signal' });
      continue;
    }
    included.push({
      symbol,
      price: s.adj[s.adj.length - 1],
      asOf: new Date(s.dates[s.dates.length - 1] * 1000).toISOString().slice(0, 10),
      signals,
    });
  }

  // cross-sectional percentile ranks -> composite -> rank
  const keys = ['ret12m1m', 'ret6m1m', 'dist52wHigh', 'maStack', 'volScaled'];
  const rankMaps = {};
  for (const k of keys) rankMaps[k] = percentileRanks(included, k, true);
  for (const row of included) {
    const pct = keys.map(k => rankMaps[k].get(row.symbol));
    row.percentiles = Object.fromEntries(keys.map((k, i) => [k, Math.round(pct[i] * 10000) / 10000]));
    row.composite = Math.round((pct.reduce((a, b) => a + b, 0) / pct.length) * 10000) / 10000;
  }
  included.sort((a, b) => b.composite - a.composite || (a.symbol < b.symbol ? -1 : 1));
  included.forEach((row, i) => { row.rank = i + 1; });

  const n = included.length;
  const decileCut = Math.ceil(n / 10);
  const vigintileCut = Math.ceil(n / 20);
  for (const row of included) row.inTopDecile = row.rank <= decileCut;

  /* ----- regime gate ----- */
  const hy = readHyOas();
  const vix = readVix();
  const spx = spx200d(cache.benchmark);

  const T = { hyOasRed: 4.0, hyOasYellow: 3.5, vixYellow: 25, spxThinMargin: 0.02 };
  let gate, gateReason;
  const checks = [];
  const spxKnown = spx.ok && spx.above !== null;
  const redBySpx = spxKnown && !spx.above;
  const redByHy = hy.value !== null && hy.value >= T.hyOasRed;
  checks.push({ name: 'spx_below_200d', value: redBySpx, detail: spxKnown ? `SPX ${spx.price.toFixed(2)} vs 200D ${spx.sma200.toFixed(2)} (margin ${(spx.marginPct * 100).toFixed(2)}%) as of ${spx.asOf}` : 'SPX benchmark unavailable' });
  checks.push({ name: 'hy_oas_ge_4', value: redByHy, detail: hy.value !== null ? `HY OAS ${hy.value} (${hy.source}, ${hy.freshness})` : 'HY OAS unavailable' });

  if (redBySpx || redByHy) {
    gate = 'RED';
    gateReason = redBySpx && redByHy ? 'SPX below 200-day AND HY OAS >= 4.0'
      : redBySpx ? 'SPX below 200-day' : 'HY OAS >= 4.0 — credit stress';
  } else {
    const yellowByHy = hy.value !== null && hy.value >= T.hyOasYellow;
    const yellowByVix = vix.value !== null && vix.value >= T.vixYellow;
    const yellowByMargin = spxKnown && spx.marginPct < T.spxThinMargin;
    checks.push({ name: 'hy_oas_ge_3_5', value: yellowByHy, detail: `HY OAS ${hy.value} vs yellow threshold ${T.hyOasYellow}` });
    checks.push({ name: 'vix_ge_25', value: yellowByVix, detail: `VIX ${vix.value} (${vix.source}, ${vix.freshness})` });
    checks.push({ name: 'spx_200d_margin_lt_2pct', value: yellowByMargin, detail: spxKnown ? `margin ${(spx.marginPct * 100).toFixed(2)}%` : 'unknown' });
    if (yellowByHy || yellowByVix || yellowByMargin) {
      gate = 'YELLOW';
      const why = [];
      if (yellowByHy) why.push(`HY OAS ${hy.value} in yellow band [3.5, 4.0)`);
      if (yellowByVix) why.push(`VIX ${vix.value} >= 25`);
      if (yellowByMargin) why.push(`SPX only ${(spx.marginPct * 100).toFixed(2)}% above 200D (< 2% margin)`);
      gateReason = 'Mixed: ' + why.join('; ') + ' — list halved, cautious';
    } else {
      gate = 'GREEN';
      gateReason = 'SPX above 200-day, HY OAS < 4.0, no breadth stress — top-decile list active';
    }
  }

  const activeCut = gate === 'GREEN' ? decileCut : gate === 'YELLOW' ? vigintileCut : 0;
  const activeList = included
    .filter(r => r.rank <= activeCut)
    .map(r => ({ symbol: r.symbol, rank: r.rank, composite: r.composite, price: r.price, asOf: r.asOf }));

  const gateDoc = {
    generatedAt,
    gate,
    reason: gateReason,
    thresholds: {
      hyOasRed: T.hyOasRed,
      hyOasYellow: T.hyOasYellow,
      vixYellow: T.vixYellow,
      spxThinMarginPct: T.spxThinMargin * 100,
      rule: 'RED if SPX below 200-day OR HY OAS >= 4.0 (list EMPTY / cash). YELLOW if HY OAS >= 3.5 OR VIX >= 25 OR SPX within 2% of 200D (top 5% only, cautious). Else GREEN (top decile active).',
    },
    inputs: {
      spxVs200d: { above: spx.above, marginPct: spx.marginPct === null ? null : Math.round(spx.marginPct * 10000) / 10000, price: spx.price, sma200: spx.sma200, asOf: spx.asOf, source: 'cached ^GSPC Yahoo adjclose (same series family as engine history)' },
      hyOas: hy,
      vix,
    },
    checks,
    activeCount: activeList.length,
    dataHealth,
  };

  const stateDoc = {
    generatedAt,
    universe: cache.universe || 'sp500-constituents',
    universeCount: cache.universeCount,
    coverageCount,
    dataHealth,
    excluded,
    excludedCount: excluded.length,
    includedCount: n,
    decileCutoff: decileCut,
    methodology: {
      adjustedClose: 'All returns use Yahoo adjusted close (dividends/splits accounted for); raw closes are never used.',
      signals: {
        ret12m1m: 'adjclose[t-21]/adjclose[t-252] - 1',
        ret6m1m: 'adjclose[t-21]/adjclose[t-126] - 1',
        dist52wHigh: 'price / max(adjclose[t-252..t]) - 1',
        maStack: '1 if price > sma50 > sma200, 0.5 if price > sma50 only, else 0',
        volScaled: 'ret12m1m / (stdev of daily log returns over trailing 252d * sqrt(252))',
        composite: 'mean of cross-sectional percentile ranks of the five signals',
        rank: '1..N by composite descending; ties broken alphabetically by symbol (deterministic)',
      },
      limitations: [
        'SURVIVORSHIP BIAS: the universe is the CURRENT S&P 500 constituent list; names that were members during the 6-year lookback but were later removed (bankruptcies, delistings, takeovers) are absent, which flatters backfilled historical returns and momentum ranks.',
        'No transaction-cost drag in signal computation; churn is estimated only in the rebalance artifact (10 bps per side).',
        'First-run rebalance has no prior top-decile file, so turnover is null.',
        'Next-rebalance date is a weekday estimate; exchange holidays are not modeled.',
      ],
    },
    table: included.map(r => ({
      symbol: r.symbol,
      price: r.price,
      asOf: r.asOf,
      signals: r.signals,
      percentiles: r.percentiles,
      composite: r.composite,
      rank: r.rank,
      inTopDecile: r.inTopDecile,
    })),
  };

  const topDecileDoc = {
    generatedAt,
    gate,
    gateReason,
    activeCount: activeList.length,
    list: gate === 'RED' ? [] : activeList,
    ...(gate === 'RED' ? { reasonEmpty: 'Gate is RED — momentum list is intentionally empty (cash). ' + gateReason } : {}),
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'momentum-state.json'), JSON.stringify(stateDoc));
  fs.writeFileSync(path.join(outDir, 'momentum-top-decile.json'), JSON.stringify(topDecileDoc));
  fs.writeFileSync(path.join(outDir, 'momentum-gate.json'), JSON.stringify(gateDoc, null, 2));

  const lastDataDate = spx.asOf || new Date().toISOString().slice(0, 10);
  // Turnover compares against the previously COMMITTED top-decile file.
  const prevTopDecile = readJson(path.join(outDir, 'momentum-top-decile.json.prev')) || null;
  const rebFinal = computeRebalance(lastDataDate, prevTopDecile, activeList.map(e => e.symbol));
  fs.writeFileSync(path.join(outDir, 'momentum-rebalance.json'), JSON.stringify(rebFinal, null, 2));

  console.log(`generate-momentum-state: ${n} ranked, ${excluded.length} excluded, gate=${gate}, active=${activeList.length}, dataHealth=${dataHealth}`);
  console.log(`Wrote ${path.relative(root, outDir)}/*.json (4 committed artifacts)`);
}

main();
