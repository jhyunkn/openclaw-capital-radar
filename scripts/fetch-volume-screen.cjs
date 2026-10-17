'use strict';

/*
 * fetch-volume-screen.cjs (one-off, ephemeral)
 *
 * Fetches 3mo daily OHLCV for every S&P 500 constituent from the Yahoo chart
 * API — same endpoint + UA pattern as the repo's own fetch-momentum-history.cjs.
 * Volume + adjusted close are needed for the abnormal-volume screen.
 *
 * Output is EPHEMERAL cache: outputs/cache/volume-screen/history.json
 * (gitignored via outputs/cache/). Never committed.
 */

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const universePath = path.join(root, 'data', 'sp500-constituents.json');
const outDir = path.join(root, 'outputs', 'cache', 'volume-screen');
const outPath = path.join(outDir, 'history.json');

const UA = 'OpenClaw Capital Radar/1.0 jun.hn.nam@gmail.com'; // mirror of repo helper
const CONCURRENCY = 5;
const MAX_RETRIES = 4;

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
  return `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=3mo&interval=1d&includePrePost=false&events=div%2Csplits`;
}

async function fetchSymbol(symbol) {
  const json = await fetchJson(chartUrl(symbol));
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error('empty chart result');
  const timestamps = result.timestamp || [];
  const adj = result?.indicators?.adjclose?.[0]?.adjclose || [];
  const quote = result?.indicators?.quote?.[0] || {};
  const vols = quote.volume || [];
  const bars = [];
  for (let i = 0; i < timestamps.length; i++) {
    const c = adj[i];
    const v = vols[i];
    if (c === null || c === undefined || !Number.isFinite(c)) continue;
    if (v === null || v === undefined || !Number.isFinite(v)) continue;
    const d = new Date(timestamps[i] * 1000);
    const date = d.toISOString().slice(0, 10);
    bars.push({ date, close: Math.round(c * 10000) / 10000, volume: v });
  }
  if (bars.length < 45) throw new Error(`only ${bars.length} bars`);
  return { symbol, bars };
}

async function run() {
  const universe = JSON.parse(fs.readFileSync(universePath, 'utf8'));
  const symbols = universe.symbols.filter(s => s !== '^GSPC');
  console.log(`fetch-volume-screen: ${symbols.length} symbols, concurrency ${CONCURRENCY}`);

  const cache = {};
  const failed = [];
  let done = 0;

  const queue = [...symbols];
  async function worker() {
    while (queue.length) {
      const symbol = queue.shift();
      try {
        const series = await fetchSymbol(symbol);
        cache[symbol] = series.bars;
      } catch (e) {
        failed.push({ symbol, error: String(e.message || e) });
      }
      done++;
      if (done % 50 === 0) console.log(`  ${done}/${symbols.length} done, ${failed.length} failed`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify({ fetchedAt: new Date().toISOString(), bars: cache }, null, 1));
  console.log(`wrote ${outPath}: ${Object.keys(cache).length} ok, ${failed.length} failed`);
  if (failed.length) {
    console.log('failed:', failed.slice(0, 20).map(f => `${f.symbol}(${f.error})`).join(' '));
  }
}

run().catch(e => { console.error('FATAL', e); process.exit(1); });
