'use strict';

// Fetches live market data for every ticker in the opportunity universe.
// Uses Yahoo Finance v8/chart (proven reliable) for price/52w data.
// Tries Yahoo Finance v10/quoteSummary for PE + earnings dates — graceful fallback.
// Output: outputs/watchlist-market-data.json

const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const UA   = 'OpenClaw Capital Radar market data (public Yahoo Finance endpoint)';

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const universe    = readJson('data/opportunity-universe.json');
const scannerUni  = readJson('data/scanner-universe.json');
if (!universe) throw new Error('Missing data/opportunity-universe.json');

// Combine conviction universe + scanner universe (deduped)
const convictionTickers = universe.tickers.map(t => String(t.ticker).toUpperCase());
const scannerTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker).toUpperCase());
const TICKERS = [...new Set([...convictionTickers, ...scannerTickers])];

// ── FETCH HELPERS ─────────────────────────────────────────────────────────────

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, 'accept': 'application/json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
  return res.json();
}

// v8/chart: returns current price, 52w data, 1-year price history for trend computation
async function fetchChartData(ticker) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&includePrePost=false`;
  const json = await fetchJson(url);
  const result = json?.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${ticker}`);

  const meta   = result.meta || {};
  const quote  = result.indicators?.quote?.[0] || {};
  const closes = (result.timestamp || [])
    .map((_, i) => quote.close?.[i])
    .filter(v => Number.isFinite(v));

  const currentPrice  = meta.regularMarketPrice ?? closes.at(-1) ?? null;
  const high52w       = meta.fiftyTwoWeekHigh ?? (closes.length ? Math.max(...closes) : null);
  const low52w        = meta.fiftyTwoWeekLow  ?? (closes.length ? Math.min(...closes) : null);
  const pctFrom52wHigh = (currentPrice && high52w) ? Math.round((currentPrice / high52w - 1) * 1000) / 10 : null;
  const pctFrom52wLow  = (currentPrice && low52w)  ? Math.round((currentPrice / low52w  - 1) * 1000) / 10 : null;

  // 1-month trend (approx 21 trading days)
  const trend1mPct = closes.length >= 22
    ? Math.round((closes.at(-1) / closes.at(-22) - 1) * 1000) / 10
    : null;

  // RSI-14
  const rsi14 = computeRSI(closes, 14);

  // Is this ticker near its 52-week low? (within 20% of low) — key "trough" signal
  const nearTrough = pctFrom52wHigh != null && pctFrom52wHigh <= -25;
  // Big dislocation — sharp recent drop
  const sharpDislocation = trend1mPct != null && trend1mPct <= -10;

  return {
    ticker,
    source: 'yahoo-chart-v8',
    currentPrice,
    price52wHigh: high52w,
    price52wLow:  low52w,
    pctFrom52wHigh,
    pctFrom52wLow,
    trend1mPct,
    rsi14,
    nearTrough,
    sharpDislocation,
    volume: meta.regularMarketVolume ?? null,
  };
}

// v10/quoteSummary: PE ratio, earnings dates, short interest — best effort only
async function fetchFundamentals(ticker) {
  const mods = 'summaryDetail,defaultKeyStatistics,calendarEvents';
  const url  = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=${mods}`;
  try {
    const json = await fetchJson(url);
    const r    = json?.quoteSummary?.result?.[0];
    if (!r) return null;

    const sd  = r.summaryDetail          || {};
    const ks  = r.defaultKeyStatistics   || {};
    const cal = r.calendarEvents         || {};

    const earningsDates = cal.earnings?.earningsDate || [];
    const nextEarningsTs   = earningsDates.find(d => d.raw * 1000 > Date.now())?.raw ?? null;
    const nextEarningsDate = nextEarningsTs
      ? new Date(nextEarningsTs * 1000).toISOString().slice(0, 10)
      : null;

    return {
      forwardPE:     sd.forwardPE?.raw ?? null,
      trailingPE:    sd.trailingPE?.raw != null ? Math.round(sd.trailingPE.raw * 10) / 10 : null,
      forwardEPS:    ks.forwardEps?.raw ?? null,
      shortPct:      ks.shortPercentOfFloat?.raw != null
        ? Math.round(ks.shortPercentOfFloat.raw * 1000) / 10
        : null,
      nextEarningsDate,
    };
  } catch {
    return null; // v10 is best-effort — not all environments have access
  }
}

// ── RSI ───────────────────────────────────────────────────────────────────────
function computeRSI(closes, n = 14) {
  if (closes.length <= n) return null;
  let gains = 0, losses = 0;
  for (let i = 1; i <= n; i++) {
    const d = closes[i] - closes[i - 1];
    gains   += Math.max(d, 0);
    losses  += Math.max(-d, 0);
  }
  gains /= n; losses /= n;
  for (let i = n + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gains  = (gains  * (n - 1) + Math.max(d, 0)) / n;
    losses = (losses * (n - 1) + Math.max(-d, 0)) / n;
  }
  const rs = gains / Math.max(losses, 0.000001);
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  const results = {};
  const errors  = [];

  for (const ticker of TICKERS) {
    try {
      const [chart, fundamentals] = await Promise.all([
        fetchChartData(ticker),
        fetchFundamentals(ticker),
      ]);

      results[ticker] = {
        ...chart,
        ...(fundamentals || {}),
        fundamentalsSource: fundamentals ? 'yahoo-v10' : 'unavailable',
        fetchedAt: new Date().toISOString(),
      };

      const p = results[ticker];
      const flags = [
        p.nearTrough        ? 'NEAR_TROUGH'         : null,
        p.sharpDislocation  ? `SHARP_DROP_${p.trend1mPct}%` : null,
        p.rsi14 != null && p.rsi14 < 35 ? `RSI_OVERSOLD_${p.rsi14}` : null,
      ].filter(Boolean).join(' ');

      console.log(`${ticker.padEnd(5)} $${String(p.currentPrice ?? '?').padEnd(8)} 52wH:${p.pctFrom52wHigh ?? '?'}%  1m:${p.trend1mPct ?? '?'}%  RSI:${p.rsi14 ?? '?'}  ${flags}`);
    } catch (err) {
      errors.push({ ticker, error: err.message });
      console.warn(`WARN ${ticker}: ${err.message}`);
    }
  }

  const output = {
    artifact:      'watchlist-market-data',
    generatedAt:   new Date().toISOString(),
    sources:       ['yahoo-finance-v8-chart', 'yahoo-finance-v10-quotesummary-best-effort'],
    tickerCount:   Object.keys(results).length,
    errorCount:    errors.length,
    errors,
    tickers:       results,
  };

  const outPath = path.join(root, 'outputs', 'watchlist-market-data.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nwatchlist-market-data: ${output.tickerCount}/${TICKERS.length} tickers fetched  errors:${errors.length}`);

  // Surface any active dislocations for build log
  const dislocations = Object.values(results).filter(r => r.nearTrough || r.sharpDislocation);
  if (dislocations.length) {
    console.log(`Dislocations detected: ${dislocations.map(d => `${d.ticker}(52wH:${d.pctFrom52wHigh}%,1m:${d.trend1mPct}%)`).join('  ')}`);
  }
})();
