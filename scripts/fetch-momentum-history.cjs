'use strict';

/*
 * fetch-momentum-history.cjs
 *
 * Phase 1 momentum engine — price history fetcher.
 *
 * Fetches 6y daily adjusted closes for every S&P 500 constituent from the
 * Yahoo chart API (same endpoint + UA pattern as lib/capital-radar-live.cjs)
 * plus the ^GSPC benchmark series used for the regime gate's 200-day check.
 *
 * Output is EPHEMERAL cache: outputs/cache/momentum/price-history.json
 * (gitignored via outputs/cache/). Never committed.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const universePath = path.join(root, 'data', 'sp500-constituents.json');
const outDir = path.join(root, 'outputs', 'cache', 'momentum');
const outPath = path.join(outDir, 'price-history.json');

const UA = 'OpenClaw Capital Radar/1.0 jun.hn.nam@gmail.com'; // mirror of repo helper
const CONCURRENCY = 5;
const MAX_RETRIES = 4;
const COVERAGE_FLOOR = 0.9;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url, attempt = 0) {
  const res = await fetch(url, { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(30000) });
  if (res.status === 429 && attempt < MAX_RETRIES) {
    const backoff = 2000 * Math.pow(2, attempt);
    console.log(`  429 throttled — backing off ${(backoff / 1000).toFixed(0)}s`);
    await sleep(backoff);
    return fetchJson(url, attempt + 1);
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function chartUrl(symbol) {
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=6y&interval=1d&includePrePost=false&events=div%2Csplits`;
}

async function fetchSymbol(symbol) {
  const json = await fetchJson(chartUrl(symbol));
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('empty chart result');
  const timestamps = result.timestamp || [];
  const adj = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const dates = [];
  const closes = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = adj[i];
    if (c === null || c === undefined || !Number.isFinite(c)) continue;
    dates.push(timestamps[i]);
    closes.push(Math.round(c * 10000) / 10000);
  }
  if (closes.length < 60) throw new Error(`only ${closes.length} bars`);
  return { symbol, dates, closes };
}

async function run() {
  const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));
  const symbols = universe.symbols;
  console.log(`fetch-momentum-history: ${symbols.length} symbols (+ ^GSPC benchmark), concurrency ${CONCURRENCY}`);

  const cache = {};
  const failed = [];
  let done = 0;

  const queue = [...symbols];
  async function worker() {
    while (queue.length) {
      const symbol = queue.shift();
      try {
        const series = await fetchSymbol(symbol);
        cache[symbol] = { dates: series.dates, adj: series.closes };
      } catch (e) {
        failed.push({ symbol, error: e.message });
      }
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${symbols.length} (+${failed.length} failed)`);
      await sleep(120); // polite pacing between requests per worker
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  // Benchmark series for the regime gate (SPX 200-day check)
  let benchmark = null;
  try {
    const spx = await fetchSymbol('^GSPC');
    benchmark = { dates: spx.dates, adj: spx.closes };
    console.log('  ^GSPC benchmark OK');
  } catch (e) {
    console.log(`  ^GSPC benchmark FAILED: ${e.message}`);
  }

  const universeCount = symbols.length;
  const coverageCount = Object.keys(cache).length;
  const coverage = coverageCount / universeCount;
  const dataHealth = coverage >= COVERAGE_FLOOR ? 'FULL' : 'PARTIAL';

  const out = {
    generatedAt: new Date().toISOString(),
    universe: 'sp500-constituents',
    universeAsOf: universe.asOf,
    universeCount,
    coverageCount,
    coveragePct: Math.round(coverage * 10000) / 100,
    dataHealth,
    failedSymbols: failed,
    benchmark,
    symbols: cache,
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(out));
  console.log(`fetch-momentum-history: ${coverageCount}/${universeCount} (${(coverage * 100).toFixed(1)}%) — dataHealth=${dataHealth}`);
  console.log(`Wrote ${path.relative(root, outPath)} (ephemeral cache, gitignored)`);
  if (failed.length) console.log(`Failed symbols: ${failed.map(f => f.symbol).join(', ')}`);
}

run().catch(err => { console.error('fetch-momentum-history FAILED:', err.message); process.exit(1); });
