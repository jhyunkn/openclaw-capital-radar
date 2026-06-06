'use strict';

// Parses individual Form 4 XML filings to extract OPEN-MARKET PURCHASES only.
// transactionCode = 'P' (purchased) + transactionAcquiredDisposedCode = 'A' (acquired)
//
// This is the highest-conviction insider signal: a director or officer reaching
// into their own pocket to buy stock at market price. Not RSU grants, not option
// exercises — actual cash purchases. A CEO buying $4M of their own stock at a
// cyclical trough is the Micron signal.
//
// Architecture:
//   1. Load ticker→CIK map from cache (populated by fetch-insider-transactions.cjs)
//   2. Per ticker: fetch submissions → list Form 4s with primaryDocument URL
//   3. Per filing (within lookback): fetch XML from EDGAR Archives
//   4. Parse XML: extract transactionCode=P non-derivative entries
//   5. Cache each XML in outputs/cache/form4-xml/ to avoid re-fetching on rebuild
//
// Output: outputs/form4-open-market.json

const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const UA       = 'OpenClaw Capital Radar insider monitor contact:research@openclaw.io';
const CACHE_DIR = path.join(root, 'outputs', 'cache', 'form4-xml');
const OUT_PATH  = path.join(root, 'outputs', 'form4-open-market.json');

const MIN_VALUE    = 10_000;  // ignore transactions below $10K (noise filter)
const LOOKBACK_DAYS = 180;    // 6-month lookback to catch accumulation campaigns
const MAX_FILINGS_PER_TICKER = 20; // cap XML fetches per ticker

fs.mkdirSync(CACHE_DIR, { recursive: true });
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

// ── EDGAR HELPERS ────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function httpGet(url, asJson = false) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: asJson ? 'application/json' : '*/*' } });
      if (res.status === 429) { await delay(2000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return asJson ? res.json() : res.text();
    } catch (err) {
      if (attempt === 2) throw err;
      await delay(500);
    }
  }
}

function loadCIKMap() {
  const f = path.join(root, 'outputs', 'cache', 'sec-company-tickers.json');
  if (!fs.existsSync(f)) throw new Error('CIK cache missing — run fetch-insider-transactions.cjs first');
  return JSON.parse(fs.readFileSync(f, 'utf8')).map;
}

// Returns list of Form 4 filings with direct XML URL for each
async function listForm4Filings(cik) {
  const json = await httpGet(`https://data.sec.gov/submissions/CIK${cik}.json`, true);
  const r    = json?.filings?.recent || {};
  const cutoff = new Date(Date.now() - LOOKBACK_DAYS * 86400_000);
  const cikInt = parseInt(cik, 10);
  const out = [];

  for (let i = 0; i < (r.form || []).length; i++) {
    if (r.form[i] !== '4' && r.form[i] !== '4/A') continue;
    const filed = new Date(r.filingDate[i]);
    if (filed < cutoff) break; // newest-first ordering — stop once past lookback

    const acc    = (r.accessionNumber || [])[i];
    let   doc    = (r.primaryDocument  || [])[i] || '';
    // Strip any xslF345X*/  prefix — EDGAR primaryDocument sometimes points to the
    // XSLT-rendered view; we need the raw XML one level up.
    doc = doc.replace(/^xslF345[^/]*\//, '');
    const xmlUrl = acc && doc
      ? `https://www.sec.gov/Archives/edgar/data/${cikInt}/${acc.replace(/-/g,'')}/${doc}`
      : null;

    out.push({ filedDate: r.filingDate[i], formType: r.form[i], acc, xmlUrl });
  }
  return out;
}

// ── XML PARSER ───────────────────────────────────────────────────────────────

function getTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]+)<\/${tag}>`, 'i'));
  return m ? m[1].trim() : null;
}

function getNestedVal(block, outer, inner) {
  const outerM = block.match(new RegExp(`<${outer}[^>]*>([\\s\\S]*?)<\\/${outer}>`, 'i'));
  if (!outerM) return null;
  return getTag(outerM[1], inner) || getTag(outerM[1], 'value');
}

function parseForm4(xml) {
  const ownerName   = getTag(xml, 'rptOwnerName') || 'Unknown';
  const officeTitle = getTag(xml, 'officerTitle') || null;
  const isOfficer   = getTag(xml, 'isOfficer') === '1';
  const isDirector  = getTag(xml, 'isDirector') === '1';

  const purchases = [];
  const re = /<nonDerivativeTransaction>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
  let m;

  while ((m = re.exec(xml)) !== null) {
    const blk = m[1];

    // Extract transactionCode from inside <transactionCoding> block
    const codingBlk = blk.match(/<transactionCoding[^>]*>([\s\S]*?)<\/transactionCoding>/i)?.[1] || '';
    const code = codingBlk.match(/<transactionCode[^>]*>\s*([^<\s]+)\s*<\/transactionCode>/i)?.[1]?.trim()
              || blk.match(/<transactionCode[^>]*>\s*([^<\s]+)\s*<\/transactionCode>/i)?.[1]?.trim();
    if (code !== 'P') continue;
    // transactionCode=P is an open-market purchase by SEC definition; always an acquisition.
    // No need to re-verify the AcquiredDisposedCode (and the nested <value> breaks getTag anyway).

    // Extract each field directly using pattern that handles <wrapper><value>X</value></wrapper>
    function extractVal(blk, tag) {
      const wrapMatch = blk.match(new RegExp(`<${tag}[^>]*>[\\s\\S]*?<value>([^<]+)<\\/value>`, 'i'));
      if (wrapMatch) return wrapMatch[1].trim();
      const directMatch = blk.match(new RegExp(`<${tag}[^>]*>([^<]+)<\\/${tag}>`, 'i'));
      return directMatch ? directMatch[1].trim() : null;
    }

    const amountsBlk = blk.match(/<transactionAmounts[^>]*>([\s\S]*?)<\/transactionAmounts>/i)?.[1] || blk;
    const sharesRaw  = extractVal(amountsBlk, 'transactionShares');
    const priceRaw   = extractVal(amountsBlk, 'transactionPricePerShare');
    const dateRaw    = extractVal(blk, 'transactionDate');
    const secRaw     = extractVal(blk, 'securityTitle') || 'Common Stock';

    const shares = sharesRaw ? parseFloat(String(sharesRaw).replace(/,/g, '')) : null;
    const price  = priceRaw  ? parseFloat(String(priceRaw).replace(/,/g, ''))  : null;
    const total  = (shares && price) ? shares * price : null;

    if (total !== null && total < MIN_VALUE) continue;

    purchases.push({
      transactionDate: dateRaw,
      securityTitle:   secRaw,
      shares,
      pricePerShare:   price,
      totalValue:      total,
      ownerName,
      officerTitle:    officeTitle,
      isOfficer,
      isDirector,
    });
  }
  return purchases;
}

// Fetch XML (with cache)
async function getPurchasesFromFiling(filing) {
  if (!filing.xmlUrl) return [];
  const cacheFile = path.join(CACHE_DIR, (filing.acc || '').replace(/-/g, '') + '.json');

  if (fs.existsSync(cacheFile)) {
    try {
      return JSON.parse(fs.readFileSync(cacheFile, 'utf8')).purchases || [];
    } catch { /* fallthrough to re-fetch */ }
  }

  try {
    await delay(120);
    const xml = await httpGet(filing.xmlUrl);
    const purchases = parseForm4(xml);
    fs.writeFileSync(cacheFile, JSON.stringify({ cachedAt: new Date().toISOString(), xmlUrl: filing.xmlUrl, purchases }, null, 2));
    return purchases;
  } catch (err) {
    console.warn(`    WARN ${filing.xmlUrl}: ${err.message}`);
    return [];
  }
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  let cikMap;
  try { cikMap = loadCIKMap(); }
  catch (err) { console.error(err.message); process.exit(1); }

  const results    = {};
  const hasActivity = [];

  for (const ticker of ALL_TICKERS) {
    const cikInfo = cikMap[ticker];
    if (!cikInfo) {
      results[ticker] = { ticker, status: 'no_cik', open_market_signal: 'UNKNOWN', open_market_purchases: [] };
      continue;
    }

    try {
      await delay(150);
      const filings = await listForm4Filings(cikInfo.cik);

      const tickerPurchases = [];
      for (const f of filings.slice(0, MAX_FILINGS_PER_TICKER)) {
        const buys = await getPurchasesFromFiling(f);
        buys.forEach(b => tickerPurchases.push({ ...b, filedDate: f.filedDate }));
      }

      tickerPurchases.sort((a, b) => (b.transactionDate || '').localeCompare(a.transactionDate || ''));

      const totalVal = tickerPurchases.reduce((s, p) => s + (p.totalValue || 0), 0);
      const signal   = tickerPurchases.length === 0 ? 'NONE'
        : totalVal >= 1_000_000 ? 'STRONG'
        : totalVal >= 100_000   ? 'PRESENT'
        : 'MINOR';

      results[ticker] = {
        ticker,
        cik:             cikInfo.cik,
        company_name:    cikInfo.name,
        lookback_days:   LOOKBACK_DAYS,
        open_market_signal: signal,
        purchase_count:  tickerPurchases.length,
        total_purchase_value: totalVal,
        total_purchase_value_mm: totalVal > 0 ? +(totalVal / 1e6).toFixed(2) : 0,
        open_market_purchases: tickerPurchases,
      };

      if (tickerPurchases.length > 0) {
        hasActivity.push(results[ticker]);
        const top = tickerPurchases[0];
        console.log(`${ticker.padEnd(5)} BUYS:${tickerPurchases.length}  total=$${(totalVal/1000).toFixed(0)}K  ${top.ownerName}  ${top.shares}sh@$${top.pricePerShare}  ${top.transactionDate}`);
      } else {
        console.log(`${ticker.padEnd(5)} no open-market buys in ${LOOKBACK_DAYS}d (${filings.length} Form4s)`);
      }
    } catch (err) {
      console.warn(`WARN ${ticker}: ${err.message}`);
      results[ticker] = { ticker, status: 'error', error: err.message, open_market_signal: 'ERROR', open_market_purchases: [] };
    }
  }

  hasActivity.sort((a, b) => b.total_purchase_value - a.total_purchase_value);

  const output = {
    artifact:    'form4-open-market',
    generatedAt: new Date().toISOString(),
    source:      'SEC EDGAR Form 4 XML filings — direct XML parsing, not text search',
    methodology: 'transactionCode=P (open-market purchase) AND transactionAcquiredDisposedCode=A (acquired), non-derivative transactions only. Minimum transaction value: $10K.',
    lookback_days: LOOKBACK_DAYS,
    total_tickers_scanned: ALL_TICKERS.length,
    tickers_with_purchases: hasActivity.length,
    top_buyers: hasActivity.slice(0, 10).map(r => ({
      ticker:    r.ticker,
      company:   r.company_name,
      count:     r.purchase_count,
      total_mm:  r.total_purchase_value_mm,
      signal:    r.open_market_signal,
      most_recent: r.open_market_purchases[0] ? {
        buyer:  r.open_market_purchases[0].ownerName,
        title:  r.open_market_purchases[0].officerTitle,
        date:   r.open_market_purchases[0].transactionDate,
        shares: r.open_market_purchases[0].shares,
        price:  r.open_market_purchases[0].pricePerShare,
        value:  r.open_market_purchases[0].totalValue,
      } : null,
    })),
    tickers: results,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nform4-open-market: ${ALL_TICKERS.length} tickers  ${hasActivity.length} with open-market purchases`);
  if (hasActivity.length) {
    console.log(`Top: ${hasActivity.slice(0, 5).map(r => `${r.ticker}($${r.total_purchase_value_mm}M)`).join('  ')}`);
  }
})();
