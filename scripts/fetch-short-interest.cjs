'use strict';

// Fetches short interest data from Yahoo Finance quoteSummary defaultKeyStatistics.
// Short interest at a cyclical trough = explosive reversal fuel.
// When a company has high short interest AND is at a trough AND insiders are
// buying, short squeeze amplifies the fundamental recovery.
//
// Yahoo Finance provides (via defaultKeyStatistics module):
//   shortPercentOfFloat  — % of float sold short (most meaningful metric)
//   shortRatio           — days to cover (shares short / avg daily volume)
//   sharesShort          — total shares short
//   sharesShortPriorMonth — shares short from prior month (trend)
//   dateShortInterest    — as-of date
//
// Signal thresholds:
//   shortPercentOfFloat ≥ 20% → HIGH short interest
//   shortPercentOfFloat ≥ 10% → ELEVATED
//   shortPercentOfFloat ≥  5% → MODERATE
//
// Output: outputs/short-interest.json

const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const UA       = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36';
const OUT_PATH = path.join(root, 'outputs', 'short-interest.json');

fs.mkdirSync(path.join(root, 'outputs'), { recursive: true });

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const universe   = readJson('data/opportunity-universe.json');
const scannerUni = readJson('data/scanner-universe.json');
const convictionTickers = (universe?.tickers     || []).map(t => String(t.ticker).toUpperCase());
const scannerTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker).toUpperCase());
const ALL_TICKERS       = [...new Set([...convictionTickers, ...scannerTickers])];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// Yahoo Finance quoteSummary for short interest data
async function fetchShortInterest(ticker, crumbInfo = null) {
  let url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${ticker}?modules=defaultKeyStatistics`;
  if (crumbInfo?.crumb) url += `&crumb=${encodeURIComponent(crumbInfo.crumb)}`;

  const headers = { 'user-agent': UA, 'accept': 'application/json' };
  if (crumbInfo?.cookie) headers['cookie'] = crumbInfo.cookie;

  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();

  const stats = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
  if (!stats) throw new Error('No defaultKeyStatistics in response');

  const shortPctFloat = stats.shortPercentOfFloat?.raw ?? null;
  const shortRatio    = stats.shortRatio?.raw ?? null;
  const sharesShort   = stats.sharesShort?.raw ?? null;
  const sharesShortPrior = stats.sharesShortPriorMonth?.raw ?? null;
  const dateShort     = stats.dateShortInterest?.raw
    ? new Date(stats.dateShortInterest.raw * 1000).toISOString().slice(0, 10)
    : null;

  // Short % of float as percentage
  const pctFloat = shortPctFloat != null ? +(shortPctFloat * 100).toFixed(1) : null;

  // Month-over-month change in shares short
  const momChange = (sharesShort && sharesShortPrior && sharesShortPrior > 0)
    ? +(((sharesShort - sharesShortPrior) / sharesShortPrior) * 100).toFixed(1)
    : null;

  // Signal classification by % of float
  const signal = pctFloat === null ? 'UNKNOWN'
    : pctFloat >= 25 ? 'EXTREME'
    : pctFloat >= 20 ? 'HIGH'
    : pctFloat >= 10 ? 'ELEVATED'
    : pctFloat >= 5  ? 'MODERATE'
    : 'LOW';

  // Squeeze potential: high short % + recent increase = more violent reversal
  const squeezePotential = pctFloat >= 20 ? 'HIGH'
    : pctFloat >= 12 ? 'MODERATE'
    : pctFloat >= 5  ? 'LOW'
    : 'MINIMAL';

  return {
    ticker,
    short_pct_of_float:     pctFloat,
    short_ratio_days:       shortRatio,
    shares_short:           sharesShort,
    shares_short_prior_month: sharesShortPrior,
    mom_change_pct:         momChange,
    date_short_interest:    dateShort,
    short_signal:           signal,
    squeeze_potential:      squeezePotential,
    // Rising short + trough = maximum squeeze setup
    rising_short: momChange !== null ? momChange > 5 : null,
  };
}

// Obtain a Yahoo Finance crumb (required for v10 API since mid-2024)
async function getYFCrumb() {
  try {
    // Fetch a quote page to get the session cookie and crumb
    const pageRes = await fetch('https://finance.yahoo.com/quote/AAPL', {
      headers: {
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
        'accept': 'text/html',
      },
      redirect: 'follow',
    });
    const html = await pageRes.text();
    // Crumb is embedded in the page JS as "crumb":"XXXXXX"
    const m = html.match(/"crumb"\s*:\s*"([^"]+)"/);
    if (m?.[1]) return { crumb: m[1], cookie: pageRes.headers.get('set-cookie') || '' };
  } catch { /* ignored */ }
  return null;
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  const results  = {};
  const highShort = [];
  const errors   = [];

  // Attempt to get YF crumb for v10 API access
  console.log('Obtaining Yahoo Finance session crumb...');
  await delay(1000);
  const crumbInfo = await getYFCrumb();

  if (crumbInfo?.crumb) {
    console.log(`Got crumb: ${crumbInfo.crumb.slice(0,8)}...`);
  } else {
    console.warn('Could not obtain YF crumb — attempting requests without crumb (best-effort)');
  }

  // Quick probe: test one ticker to check if v10 is accessible at all
  let v10Available = false;
  try {
    const probe = await fetchShortInterest('AAPL', crumbInfo);
    if (probe.short_pct_of_float !== null) v10Available = true;
  } catch { /* not available */ }

  if (!v10Available) {
    console.warn('Yahoo Finance v10/quoteSummary not accessible (requires auth) — writing empty output');
    console.warn('Short interest signal will contribute 0 to scanner/promotion scores this build.');
    const emptyOutput = {
      artifact:    'short-interest',
      generatedAt: new Date().toISOString(),
      status:      'unavailable',
      reason:      'Yahoo Finance v10/quoteSummary requires crumb authentication. Short interest contributes 0 to scoring this build.',
      total_tickers: ALL_TICKERS.length,
      high_short_tickers: [],
      tickers: Object.fromEntries(ALL_TICKERS.map(t => [t, { ticker: t, short_signal: 'UNKNOWN', squeeze_potential: 'UNKNOWN' }])),
    };
    fs.writeFileSync(OUT_PATH, JSON.stringify(emptyOutput, null, 2));
    console.log('short-interest: data unavailable this build — downstream scripts will run without short signal');
    process.exit(0);
  }

  for (const ticker of ALL_TICKERS) {
    await delay(200); // rate limit

    try {
      const data = await fetchShortInterest(ticker, crumbInfo);
      results[ticker] = data;

      const pct = data.short_pct_of_float;
      const bar = pct ? '█'.repeat(Math.min(20, Math.round(pct / 2))) : '';
      const mom = data.mom_change_pct != null ? `  MoM:${data.mom_change_pct > 0 ? '+' : ''}${data.mom_change_pct}%` : '';
      console.log(`${ticker.padEnd(5)} ${(data.short_signal || '').padEnd(8)} ${pct != null ? pct.toString().padStart(5) : '  N/A'}% float  days:${data.short_ratio_days ?? 'N/A'}${mom}  ${bar}`);

      if (['HIGH', 'EXTREME', 'ELEVATED'].includes(data.short_signal)) {
        highShort.push(data);
      }
    } catch (err) {
      errors.push({ ticker, error: err.message });
      results[ticker] = { ticker, short_signal: 'ERROR', squeeze_potential: 'UNKNOWN', error: err.message };
      console.warn(`WARN ${ticker}: ${err.message}`);
    }
  }

  highShort.sort((a, b) => (b.short_pct_of_float || 0) - (a.short_pct_of_float || 0));

  const output = {
    artifact:    'short-interest',
    generatedAt: new Date().toISOString(),
    source:      'Yahoo Finance quoteSummary defaultKeyStatistics (short interest data lags 2 weeks)',
    methodology: 'short_pct_of_float = shares_short / float_shares. Signal thresholds: EXTREME≥25%, HIGH≥20%, ELEVATED≥10%, MODERATE≥5%. Squeeze potential: HIGH if ≥20% float.',
    total_tickers: ALL_TICKERS.length,
    error_count: errors.length,
    high_short_tickers: highShort.map(t => ({
      ticker: t.ticker,
      pct_float: t.short_pct_of_float,
      signal:    t.short_signal,
      squeeze:   t.squeeze_potential,
      days_to_cover: t.short_ratio_days,
      mom_change: t.mom_change_pct,
    })),
    tickers: results,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nshort-interest: ${ALL_TICKERS.length} tickers  high-short: ${highShort.length}`);
  if (highShort.length) {
    console.log(`High/Extreme: ${highShort.slice(0,8).map(t=>`${t.ticker}(${t.short_pct_of_float}%)`).join('  ')}`);
  }
})();
