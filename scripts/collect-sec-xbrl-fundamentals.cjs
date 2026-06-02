'use strict';
const fs   = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const out  = path.join(root, 'outputs', 'sec-xbrl-fundamentals.json');

// ── Tickers ──────────────────────────────────────────────────────────────────
const EQUITY_TICKERS = [
  'MSFT','AMZN','CEG','META','MA','NFLX',         // core holdings with GAAP
  'RDDT','RKLB','NXT','ETN','GOOGL','PWR','GEV',  // candidates
  'TMDX','NVDA','AVGO','CCJ','PLTR','VRT','HIMS', // candidates
  'OKLO','TSLA','COIN',                            // speculative / context
];

// These don't file 10-Ks with GAAP XBRL (ETFs, leveraged, OTC foreign)
const SKIP_TICKERS = new Set(['SPY','TSLT','CONL','IBIT','BMNR','TSNF','SMR','ASTS','URA']);

// ── Concepts to extract (try each in order) ──────────────────────────────────
const REVENUE_CONCEPTS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues', 'SalesRevenueNet', 'SalesRevenueGoodsNet',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'RevenueNotFromContractWithCustomer', 'OtherRevenue',
];
const NET_INCOME_CONCEPTS   = ['NetIncomeLoss','ProfitLoss'];
const GROSS_PROFIT_CONCEPTS = ['GrossProfit'];
const EPS_DILUTED_CONCEPTS  = ['EarningsPerShareDiluted'];
const SHARES_CONCEPTS       = ['CommonStockSharesOutstanding','EntityCommonStockSharesOutstanding'];
const OP_CF_CONCEPTS        = ['NetCashProvidedByUsedInOperatingActivities'];
const CAPEX_CONCEPTS        = ['PaymentsToAcquirePropertyPlantAndEquipment','CapitalExpenditureDiscontinuedOperations'];
const DEBT_CONCEPTS         = ['LongTermDebt','LongTermDebtNoncurrent','LongTermDebtCurrent'];

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function getJson(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'CapitalRadar/1.0 jun.hn.nam@gmail.com', 'Accept': 'application/json' },
      timeout: 40000
    }, res => {
      if (res.statusCode === 404) { resolve(null); return; }
      if (res.statusCode !== 200) { reject(new Error(`HTTP ${res.statusCode}`)); return; }
      const chunks = [];
      res.on('data', d => chunks.push(d));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

// Extract the most recent annual (10-K) values for a concept.
// Some filers use fp="FY"; others (e.g. NVDA) use fp="Q4" for their annual 10-K.
function extractAnnual(facts, conceptNames) {
  let best = null;
  for (const name of conceptNames) {
    const concept = facts?.['us-gaap']?.[name];
    if (!concept) continue;
    const units = concept.units;
    if (!units) continue;
    const currency = units.USD || units.shares || units['USD/shares'] || Object.values(units)[0];
    if (!Array.isArray(currency)) continue;
    // Accept 10-K rows with fp=FY or fp=Q4 (NVDA-style fiscal-year filings)
    const annuals = currency
      .filter(r => r.form === '10-K' && (r.fp === 'FY' || r.fp === 'Q4') && r.end)
      .sort((a, b) => b.end.localeCompare(a.end));
    if (annuals.length === 0) continue;
    // Prefer the concept with the most recent data
    if (!best || annuals[0].end > best.rows[0].end) {
      best = { name, rows: annuals.slice(0, 3) };
    }
  }
  return best;
}

// Extract latest quarterly value for a concept (most recent 10-Q)
function extractLatestQuarter(facts, conceptNames) {
  for (const name of conceptNames) {
    const concept = facts?.['us-gaap']?.[name];
    if (!concept) continue;
    const units = concept.units;
    if (!units) continue;
    const currency = units.USD || units.shares || Object.values(units)[0];
    if (!Array.isArray(currency)) continue;
    const quarters = currency
      .filter(r => ['10-Q', '10-K'].includes(r.form) && r.end)
      .sort((a, b) => b.end.localeCompare(a.end));
    if (quarters.length === 0) continue;
    return { name, row: quarters[0] };
  }
  return null;
}

function round2(n) { return typeof n === 'number' && isFinite(n) ? Math.round(n * 100) / 100 : null; }
function pct(n) { return typeof n === 'number' && isFinite(n) ? round2(n * 100) : null; }
function millions(n) { return typeof n === 'number' && isFinite(n) ? round2(n / 1e6) : null; }

async function enrichTicker(ticker, cik) {
  const url = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`;
  let data;
  try { data = await getJson(url); }
  catch (e) { return { ticker, cik, status: 'fetch_error', error: e.message }; }
  if (!data) return { ticker, cik, status: 'not_found' };

  const f = data.facts;
  const entityName = data.entityName || ticker;

  // Revenue
  const revResult = extractAnnual(f, REVENUE_CONCEPTS);
  const revLatest  = revResult?.rows[0]  || null;
  const revPrior   = revResult?.rows[1]  || null;
  const revUSD     = revLatest ? millions(revLatest.val) : null;
  const revPriorUSD = revPrior ? millions(revPrior.val) : null;
  const revenueGrowthPct = (revUSD != null && revPriorUSD != null && revPriorUSD !== 0)
    ? pct((revLatest.val - revPrior.val) / Math.abs(revPrior.val))
    : null;

  // Net income
  const niResult = extractAnnual(f, NET_INCOME_CONCEPTS);
  const niUSD    = niResult?.rows[0] ? millions(niResult.rows[0].val) : null;

  // Gross profit
  const gpResult = extractAnnual(f, GROSS_PROFIT_CONCEPTS);
  const gpUSD    = gpResult?.rows[0] ? millions(gpResult.rows[0].val) : null;
  const grossMarginPct = (gpUSD != null && revUSD != null && revUSD !== 0)
    ? round2((gpResult.rows[0].val / revLatest.val) * 100)
    : null;

  // EPS diluted
  const epsResult = extractAnnual(f, EPS_DILUTED_CONCEPTS);
  const epsDiluted = epsResult?.rows[0]?.val ?? null;

  // Shares outstanding
  const sharesResult = extractLatestQuarter(f, SHARES_CONCEPTS);
  const sharesOutM   = sharesResult?.row ? millions(sharesResult.row.val) : null;

  // Operating cash flow
  const ocfResult = extractAnnual(f, OP_CF_CONCEPTS);
  const ocfUSD    = ocfResult?.rows[0] ? millions(ocfResult.rows[0].val) : null;

  // CapEx
  const capexResult = extractAnnual(f, CAPEX_CONCEPTS);
  const capexUSD    = capexResult?.rows[0] ? millions(capexResult.rows[0].val) : null;
  const fcfUSD      = (ocfUSD != null && capexUSD != null) ? round2(ocfUSD - Math.abs(capexUSD)) : null;

  // Long-term debt
  const debtResult = extractLatestQuarter(f, DEBT_CONCEPTS);
  const debtUSD    = debtResult?.row ? millions(debtResult.row.val) : null;

  // Dilution check: compare current shares to prior annual
  const sharesAnnual = extractAnnual(f, SHARES_CONCEPTS);
  const sharesNow    = sharesAnnual?.rows[0]?.val ?? null;
  const sharesPrior  = sharesAnnual?.rows[1]?.val ?? null;
  const dilutionPct  = (sharesNow != null && sharesPrior != null && sharesPrior !== 0)
    ? pct((sharesNow - sharesPrior) / Math.abs(sharesPrior))
    : null;
  const dilutionFlag = dilutionPct != null && dilutionPct > 3 ? 'elevated' : dilutionPct != null && dilutionPct > 1 ? 'moderate' : 'low';

  const latestFiscalYear = revLatest?.end?.slice(0, 7) || niResult?.rows[0]?.end?.slice(0, 7) || null;
  const latestFilingDate = revLatest?.filed || null;

  const missingFields = [];
  if (revUSD == null)           missingFields.push('revenue');
  if (niUSD == null)            missingFields.push('net_income');
  if (epsDiluted == null)       missingFields.push('eps_diluted');
  if (grossMarginPct == null)   missingFields.push('gross_margin');
  if (fcfUSD == null)           missingFields.push('fcf');
  if (debtUSD == null)          missingFields.push('long_term_debt');
  if (revenueGrowthPct == null) missingFields.push('revenue_growth');

  return {
    ticker,
    cik,
    entityName,
    status: missingFields.length > 4 ? 'thin' : 'ok',
    latestFiscalYear,
    latestFilingDate,
    fundamentals: {
      revenue_ttm_usd_millions:   revUSD,
      revenue_prior_usd_millions: revPriorUSD,
      revenue_growth_pct:         revenueGrowthPct,
      net_income_usd_millions:    niUSD,
      gross_profit_usd_millions:  gpUSD,
      gross_margin_pct:           grossMarginPct,
      eps_diluted:                typeof epsDiluted === 'number' ? round2(epsDiluted) : null,
      shares_outstanding_millions: sharesOutM,
      operating_cf_usd_millions:  ocfUSD,
      capex_usd_millions:         capexUSD != null ? round2(Math.abs(capexUSD)) : null,
      fcf_usd_millions:           fcfUSD,
      long_term_debt_usd_millions: debtUSD,
      dilution_pct_yoy:           dilutionPct,
      dilution_flag:              dilutionFlag
    },
    concepts_used: {
      revenue:        revResult?.name    || null,
      net_income:     niResult?.name     || null,
      gross_profit:   gpResult?.name     || null,
      eps_diluted:    epsResult?.name    || null,
      shares:         sharesResult?.name || null,
      operating_cf:   ocfResult?.name    || null,
      capex:          capexResult?.name  || null,
      long_term_debt: debtResult?.name   || null,
    },
    missing_fields: missingFields,
    source: 'SEC EDGAR XBRL company-facts API',
    source_url: url,
    enriched_at: new Date().toISOString()
  };
}

async function main() {
  const now = new Date().toISOString();
  console.log(`sec-xbrl: fetching CIK map`);

  // Load CIK map
  let cikMap;
  try {
    cikMap = await getJson('https://www.sec.gov/files/company_tickers.json');
  } catch (e) {
    console.error('Failed to load SEC CIK map:', e.message);
    process.exit(1);
  }
  const tickerToCik = {};
  for (const row of Object.values(cikMap || {})) {
    if (row?.ticker && row?.cik_str) tickerToCik[String(row.ticker).toUpperCase()] = String(row.cik_str).padStart(10, '0');
  }

  const results = [];
  const skipped = [];
  const notFound = [];

  const toEnrich = EQUITY_TICKERS.filter(t => !SKIP_TICKERS.has(t));
  console.log(`sec-xbrl: enriching ${toEnrich.length} equity tickers (skipping ${SKIP_TICKERS.size} ETF/leveraged)`);

  for (const ticker of toEnrich) {
    const cik = tickerToCik[ticker];
    if (!cik) { notFound.push(ticker); process.stdout.write('?'); continue; }

    process.stdout.write(`\n  ${ticker} `);
    const result = await enrichTicker(ticker, cik);
    results.push(result);
    process.stdout.write(result.status === 'ok' ? '✓' : result.status === 'thin' ? '~' : '✗');
    await delay(200); // SEC rate limit: max 10 req/s, stay conservative
  }
  console.log('\n');

  for (const ticker of [...SKIP_TICKERS]) {
    if (EQUITY_TICKERS.includes(ticker) || [...HOLDINGS_REF].includes(ticker)) {
      skipped.push({ ticker, reason: 'etf_or_leveraged_no_gaap_xbrl' });
    }
  }

  const ok   = results.filter(r => r.status === 'ok');
  const thin = results.filter(r => r.status === 'thin');
  const err  = results.filter(r => ['fetch_error','not_found'].includes(r.status));

  const state = {
    artifact: 'sec-xbrl-fundamentals',
    generated_at: now,
    source: 'SEC EDGAR XBRL company-facts API',
    source_id: 'sec-xbrl-companyfacts',
    stale_after_hours: 48,
    tickers_enriched: results.map(r => r.ticker),
    tickers_skipped: skipped.map(s => s.ticker),
    tickers_not_found: notFound,
    results,
    skipped,
    summary: {
      total_attempted: toEnrich.length,
      ok:              ok.length,
      thin:            thin.length,
      errors:          err.length,
      skipped:         skipped.length,
      not_found:       notFound.length,
    }
  };

  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(state, null, 2) + '\n');
  console.log(`sec-xbrl: ok=${ok.length} thin=${thin.length} errors=${err.length} skipped=${skipped.length} not_found=${notFound.length}`);
  console.log(`wrote ${path.relative(root, out)}`);
}

// Reference for skipped logic
const HOLDINGS_REF = new Set(['MSFT','AMZN','CEG','META','TSLT','CONL','SPY','MA','BMNR','TSNF','NFLX']);

main().catch(e => { console.error(e); process.exit(1); });
