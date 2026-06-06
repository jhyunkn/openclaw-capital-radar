'use strict';

// Fetches SEC Form 4 insider transactions using proper CIK-based EDGAR API.
// Step 1: Load ticker→CIK mapping from SEC (https://www.sec.gov/files/company_tickers.json)
// Step 2: For each ticker, fetch company submissions (https://data.sec.gov/submissions/CIK{cik}.json)
// Step 3: Filter for Form 4 filings within 90-day lookback
//
// This is accurate — we're querying by company CIK, not text search.
// Output: outputs/insider-transactions.json

const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const UA   = 'OpenClaw Capital Radar insider transaction monitor contact:research@openclaw.io';

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const universe   = readJson('data/opportunity-universe.json');
const scannerUni = readJson('data/scanner-universe.json');

const convictionTickers = (universe?.tickers || []).map(t => String(t.ticker).toUpperCase());
const scannerTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker).toUpperCase());
const ALL_TICKERS       = [...new Set([...convictionTickers, ...scannerTickers])];

// ── EDGAR API HELPERS ─────────────────────────────────────────────────────────

async function fetchJson(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          'accept': 'application/json',
        },
      });
      if (res.status === 429) {
        await new Promise(r => setTimeout(r, 2000 * (attempt + 1)));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
      return res.json();
    } catch (err) {
      if (attempt === retries) throw err;
      await new Promise(r => setTimeout(r, 500));
    }
  }
}

// Load full ticker→CIK mapping from SEC (single file, ~500KB)
async function loadTickerCIKMap() {
  const cacheFile = path.join(root, 'outputs', 'cache', 'sec-company-tickers.json');

  // Use cache if less than 24 hours old
  if (fs.existsSync(cacheFile)) {
    const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
    const age = Date.now() - new Date(cached.cachedAt || 0).getTime();
    if (age < 24 * 60 * 60 * 1000) {
      return cached.map;
    }
  }

  console.log('Fetching SEC ticker→CIK mapping...');
  const json = await fetchJson('https://www.sec.gov/files/company_tickers.json');

  // Response format: { "0": { cik_str: 320193, ticker: "AAPL", title: "Apple Inc." }, ... }
  const tickerMap = {};
  for (const entry of Object.values(json)) {
    if (entry.ticker) {
      tickerMap[String(entry.ticker).toUpperCase()] = {
        cik: String(entry.cik_str).padStart(10, '0'),
        name: entry.title,
      };
    }
  }

  fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify({ cachedAt: new Date().toISOString(), map: tickerMap }, null, 2));
  return tickerMap;
}

// Fetch recent submissions for a company by CIK
async function fetchCompanyForm4s(cik, lookbackDays = 90) {
  const url = `https://data.sec.gov/submissions/CIK${cik}.json`;
  const json = await fetchJson(url);

  const filings = json?.filings?.recent || {};
  const forms      = filings.form        || [];
  const dates      = filings.filingDate  || [];
  const accNums    = filings.accessionNumber || [];
  const primaryDocs = filings.primaryDocument || [];

  const cutoff = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const form4s = [];
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] !== '4' && forms[i] !== '4/A') continue;
    const filedDate = new Date(dates[i]);
    if (filedDate < cutoff) continue;

    form4s.push({
      filedDate:     dates[i],
      formType:      forms[i],
      accessionNum:  accNums[i],
      docUrl: accNums[i]
        ? `https://www.sec.gov/Archives/edgar/full-index/${dates[i]?.slice(0,4)}/${accNums[i]?.replace(/-/g, '')}/`
        : null,
    });
  }

  return form4s.sort((a, b) => b.filedDate.localeCompare(a.filedDate));
}

// ── INSIDER SIGNAL CLASSIFICATION ─────────────────────────────────────────────
function classifyInsiderSignal(count, ticker) {
  // Large company = more filings expected (option grants, RSUs, etc.)
  // The meaningful signal is OPEN MARKET PURCHASES at trough prices.
  // Without parsing each XML, we classify by frequency as a first signal.
  if (count === 0)  return { signal: 'QUIET',   note: 'No Form 4 activity in 90 days' };
  if (count >= 15)  return { signal: 'ACTIVE',  note: `${count} Form 4 filings — check edgar.sec.gov for buy/sell split` };
  if (count >= 6)   return { signal: 'NOTABLE', note: `${count} Form 4 filings — worth reviewing for open-market purchases` };
  return               { signal: 'LOW',    note: `${count} Form 4 filing(s) in 90 days` };
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
(async () => {
  let tickerCIKMap;
  try {
    tickerCIKMap = await loadTickerCIKMap();
  } catch (err) {
    console.error(`Failed to load SEC ticker map: ${err.message}`);
    process.exit(1);
  }

  const results = {};
  const errors  = [];
  const LOOKBACK = 90;

  for (const ticker of ALL_TICKERS) {
    await new Promise(r => setTimeout(r, 150)); // respect EDGAR rate limit

    const cikInfo = tickerCIKMap[ticker];
    if (!cikInfo) {
      results[ticker] = {
        ticker,
        cik: null,
        error: 'CIK not found in SEC ticker map (may be foreign-listed or ETF)',
        total_filings: 0,
        insider_signal: 'UNKNOWN',
        signal_note: 'Ticker not found in SEC EDGAR company registry',
        recent_filings: [],
      };
      console.log(`${ticker.padEnd(5)} CIK not found`);
      continue;
    }

    try {
      const form4s = await fetchCompanyForm4s(cikInfo.cik, LOOKBACK);
      const sig    = classifyInsiderSignal(form4s.length, ticker);

      results[ticker] = {
        ticker,
        cik:           cikInfo.cik,
        company_name:  cikInfo.name,
        fetchedAt:     new Date().toISOString(),
        lookback_days: LOOKBACK,
        total_filings: form4s.length,
        insider_signal: sig.signal,
        signal_note:    sig.note,
        recent_filings: form4s.slice(0, 8),
        edgar_url:     `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${cikInfo.cik}&type=4&dateb=&owner=include&count=20`,
      };

      const flag = sig.signal !== 'QUIET' && sig.signal !== 'UNKNOWN' ? ` ← ${sig.signal}` : '';
      console.log(`${ticker.padEnd(5)} CIK:${cikInfo.cik}  Form4: ${form4s.length} filings (90d)${flag}`);
    } catch (err) {
      errors.push({ ticker, cik: cikInfo.cik, error: err.message });
      console.warn(`WARN ${ticker}: ${err.message}`);
    }
  }

  // High-value signals: notable or active filings for tickers near trough
  const highActivity = Object.values(results)
    .filter(r => r.insider_signal === 'ACTIVE' || r.insider_signal === 'NOTABLE')
    .sort((a, b) => b.total_filings - a.total_filings);

  const output = {
    artifact:       'insider-transactions',
    generatedAt:    new Date().toISOString(),
    source:         'SEC EDGAR company submissions API (data.sec.gov — free, authoritative)',
    lookback_days:  LOOKBACK,
    tickerCount:    Object.keys(results).length,
    errorCount:     errors.length,
    interpretation: 'Form 4 counts include all insider transactions: open-market purchases, option exercises, RSU vests, and sales. Open-market purchases at trough prices are the highest-conviction signal. Check edgar_url per ticker to review transaction types.',
    high_activity:  highActivity.map(r => ({
      ticker: r.ticker,
      filings: r.total_filings,
      signal: r.insider_signal,
      note: r.signal_note,
      edgar_url: r.edgar_url,
    })),
    errors,
    tickers: results,
  };

  const outPath = path.join(root, 'outputs', 'insider-transactions.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\ninsider-transactions: ${output.tickerCount} tickers  notable-activity: ${highActivity.length}`);
  if (highActivity.length) {
    console.log(`Notable: ${highActivity.slice(0, 10).map(r => `${r.ticker}(${r.total_filings})`).join('  ')}`);
  }
})();
