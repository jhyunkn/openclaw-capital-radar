'use strict';

// Fetches quarterly revenue data from SEC EDGAR XBRL facts API.
// Detects the revenue rate-of-change inflection — the moment quarterly decline
// slows or reverses — which historically precedes stock recovery by 2-4 quarters.
//
// This is the Micron signal: MU revenue bottomed in mid-2023 (QoQ/YoY inflected),
// the stock ran well before the street realized the turn was in.
//
// XBRL concept priority (tried in order):
//   1. RevenueFromContractWithCustomerExcludingAssessedTax (ASC 606, most companies)
//   2. Revenues (legacy GAAP)
//   3. SalesRevenueNet (older filers)
//   4. RevenueFromContractWithCustomerIncludingAssessedTax
//
// Output: outputs/xbrl-revenue-trends.json

const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const UA       = 'OpenClaw Capital Radar XBRL research contact:research@openclaw.io';
const OUT_PATH = path.join(root, 'outputs', 'xbrl-revenue-trends.json');

const REVENUE_CONCEPTS = [
  'RevenueFromContractWithCustomerExcludingAssessedTax',
  'Revenues',
  'SalesRevenueNet',
  'RevenueFromContractWithCustomerIncludingAssessedTax',
  'SalesRevenueGoodsNet',
];

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

const universe   = readJson('data/opportunity-universe.json');
const scannerUni = readJson('data/scanner-universe.json');
const discovery  = readJson('outputs/discovery-state.json');
const convictionTickers = (universe?.tickers     || []).map(t => String(t.ticker).toUpperCase());
const scannerTickers    = (scannerUni?.candidates || []).map(c => String(c.ticker).toUpperCase());
// Track A discovery candidates need XBRL coverage too, or their quality lens
// reads "unmeasured" (0) purely from a data gap, not a real quality signal.
const discoveryTickers  = (discovery?.track_a_candidates || []).map(c => String(c.ticker).toUpperCase());
const ALL_TICKERS       = [...new Set([...convictionTickers, ...scannerTickers, ...discoveryTickers])];

// ── EDGAR XBRL API ────────────────────────────────────────────────────────────

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(url) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'user-agent': UA, accept: 'application/json' } });
      if (res.status === 429) { await delay(3000 * (attempt + 1)); continue; }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json();
    } catch (err) {
      if (attempt === 2) throw err;
      await delay(600);
    }
  }
}

function loadCIKMap() {
  const f = path.join(root, 'outputs', 'cache', 'sec-company-tickers.json');
  if (!fs.existsSync(f)) throw new Error('CIK cache missing — run fetch-insider-transactions.cjs first');
  return JSON.parse(fs.readFileSync(f, 'utf8')).map;
}

// Extract quarterly revenue entries from companyfacts XBRL JSON
function extractQuarterlyRevenue(facts, cik) {
  const gaap = facts?.facts?.['us-gaap'] || {};

  for (const concept of REVENUE_CONCEPTS) {
    const usd = gaap[concept]?.units?.USD;
    if (!usd || usd.length === 0) continue;

    // Filter to quarterly + annual 10-Q/10-K filings only; exclude amendments
    const quarterly = usd.filter(e =>
      (e.form === '10-Q' || e.form === '10-K') &&
      e.end &&
      e.val != null &&
      e.val > 0
    );

    if (quarterly.length < 2) continue;

    // Sort by end date (most recent first)
    quarterly.sort((a, b) => b.end.localeCompare(a.end));

    // Deduplicate: keep only the most recent filing per period-end
    const seen = new Set();
    const deduped = [];
    for (const e of quarterly) {
      const key = e.end + '-' + e.form;
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(e);
      }
    }

    // Separate 10-K (annual) and 10-Q (quarterly)
    const tenQs  = deduped.filter(e => e.form === '10-Q').slice(0, 12); // last 3 years
    const tenKs  = deduped.filter(e => e.form === '10-K').slice(0, 5);  // last 5 annual

    // Use 10-Qs for QoQ trend; fall back to annuals if no quarterlies
    const primary = tenQs.length >= 4 ? tenQs : [...deduped].slice(0, 8);

    return { concept, entries: primary, annuals: tenKs };
  }

  return null;
}

// Compute quarter-over-quarter and year-over-year revenue change
function computeRevenueTrend(entries) {
  if (!entries || entries.length < 2) return null;

  const sorted = [...entries].sort((a, b) => a.end.localeCompare(b.end));

  const periods = sorted.map((e, i) => {
    const prev = sorted[i - 1];
    const qoqPct = prev ? +(((e.val - prev.val) / Math.abs(prev.val)) * 100).toFixed(1) : null;

    // YoY: find entry with similar end date ~1 year ago
    const oneYearAgo = new Date(e.end);
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const yearAgoStr = oneYearAgo.toISOString().slice(0, 7); // YYYY-MM

    const yearAgoEntry = sorted.find(x => x.end.slice(0, 7) === yearAgoStr);
    const yoyPct = yearAgoEntry
      ? +(((e.val - yearAgoEntry.val) / Math.abs(yearAgoEntry.val)) * 100).toFixed(1)
      : null;

    return {
      period_end: e.end,
      form: e.form,
      revenue: e.val,
      revenue_mm: +(e.val / 1e6).toFixed(0),
      qoq_pct: qoqPct,
      yoy_pct: yoyPct,
    };
  });

  return periods.reverse(); // most recent first
}

// Detect inflection: is the YoY/QoQ decline rate slowing?
function detectInflection(periods) {
  if (!periods || periods.length < 3) return { status: 'INSUFFICIENT_DATA', signal: null };

  const recent = periods.slice(0, 4); // last 4 quarters

  // Check YoY trend (most robust signal)
  const yoyValues = recent.map(p => p.yoy_pct).filter(v => v !== null);
  const qoqValues = recent.map(p => p.qoq_pct).filter(v => v !== null);

  if (yoyValues.length >= 3) {
    const [latest, prev, prev2] = yoyValues;

    // Revenue acceleration: improving each quarter
    if (latest > prev && prev > prev2 && latest > -30) {
      const status = latest >= 0 ? 'RECOVERY' : 'IMPROVING';
      return {
        status,
        signal: latest >= 0 ? 'STRONG' : 'MODERATE',
        yoy_latest: latest,
        yoy_previous: prev,
        yoy_two_qtrs_ago: prev2,
        interpretation: latest >= 0
          ? `Revenue growing ${latest}% YoY — recovery confirmed`
          : `YoY decline improving: ${prev2}% → ${prev}% → ${latest}% — inflection in progress`,
      };
    }

    // Bottoming: latest at trough, prev declining
    if (latest > prev && latest < 0) {
      return {
        status: 'INFLECTING',
        signal: 'MODERATE',
        yoy_latest: latest,
        yoy_previous: prev,
        yoy_two_qtrs_ago: prev2,
        interpretation: `YoY decline slowing — ${prev}% → ${latest}%, inflection forming`,
      };
    }

    // Deteriorating
    if (latest < prev) {
      return {
        status: 'DETERIORATING',
        signal: 'NEGATIVE',
        yoy_latest: latest,
        yoy_previous: prev,
        interpretation: `YoY decline worsening: ${prev}% → ${latest}%`,
      };
    }
  }

  // Fallback to QoQ
  if (qoqValues.length >= 2) {
    const [latest, prev] = qoqValues;
    if (latest > 0 && prev < 0) {
      return { status: 'INFLECTING', signal: 'MODERATE', interpretation: `QoQ turned positive: ${prev}% → ${latest}%` };
    }
    if (latest > prev) {
      return { status: 'IMPROVING', signal: 'MODERATE', interpretation: `QoQ improving: ${prev}% → ${latest}%` };
    }
    return { status: 'STABLE_OR_DECLINING', signal: null, interpretation: `QoQ: ${latest}%` };
  }

  return { status: 'INSUFFICIENT_DATA', signal: null };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────
(async () => {
  let cikMap;
  try { cikMap = loadCIKMap(); }
  catch (err) { console.error(err.message); process.exit(1); }

  const results    = {};
  const inflecting = [];

  for (const ticker of ALL_TICKERS) {
    const cikInfo = cikMap[ticker];
    if (!cikInfo) {
      results[ticker] = { ticker, status: 'no_cik', inflection: null };
      continue;
    }

    try {
      await delay(200); // EDGAR XBRL is heavier — be gentle
      const url  = `https://data.sec.gov/api/xbrl/companyfacts/CIK${cikInfo.cik}.json`;
      const data = await fetchJson(url);

      const extracted = extractQuarterlyRevenue(data, cikInfo.cik);
      if (!extracted) {
        console.log(`${ticker.padEnd(5)} no XBRL revenue data`);
        results[ticker] = { ticker, status: 'no_data', inflection: null };
        continue;
      }

      const periods   = computeRevenueTrend(extracted.entries);
      const inflection = detectInflection(periods);

      results[ticker] = {
        ticker,
        cik:          cikInfo.cik,
        company_name: cikInfo.name,
        concept_used: extracted.concept,
        fetchedAt:    new Date().toISOString(),
        inflection,
        recent_periods: periods?.slice(0, 6) || [],
        annual_periods: extracted.annuals?.map(e => ({ end: e.end, revenue_mm: +(e.val / 1e6).toFixed(0) })) || [],
      };

      const inf = inflection?.status || 'UNKNOWN';
      const yoy = inflection?.yoy_latest != null ? ` YoY:${inflection.yoy_latest}%` : '';
      console.log(`${ticker.padEnd(5)} ${inf.padEnd(15)}${yoy}  ${inflection?.interpretation || ''}`);

      if (['RECOVERY', 'INFLECTING', 'IMPROVING'].includes(inf)) {
        inflecting.push({ ticker, status: inf, signal: inflection.signal, yoy: inflection.yoy_latest });
      }
    } catch (err) {
      console.warn(`WARN ${ticker}: ${err.message}`);
      results[ticker] = { ticker, status: 'error', error: err.message, inflection: null };
    }
  }

  inflecting.sort((a, b) => {
    const order = { RECOVERY: 0, INFLECTING: 1, IMPROVING: 2 };
    return (order[a.status] ?? 3) - (order[b.status] ?? 3);
  });

  const output = {
    artifact:    'xbrl-revenue-trends',
    generatedAt: new Date().toISOString(),
    source:      'SEC EDGAR XBRL companyfacts API (data.sec.gov/api/xbrl/companyfacts)',
    methodology: 'Quarterly revenue from 10-Q/10-K XBRL facts. YoY comparison of same fiscal quarter. Inflection = rate of YoY decline slowing or turning positive.',
    total_tickers: ALL_TICKERS.length,
    inflecting_tickers: inflecting.length,
    inflection_summary: inflecting,
    tickers: results,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));
  console.log(`\nxbrl-revenue-trends: ${ALL_TICKERS.length} tickers scanned`);
  console.log(`Revenue inflecting/recovering: ${inflecting.map(t => `${t.ticker}(${t.status})`).join('  ') || 'none'}`);
})();
