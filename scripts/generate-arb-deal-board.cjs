'use strict';
/*
 * generate-arb-deal-board.cjs — Phase 3 arb trading brain: spread engine.
 *
 * Reads outputs/arb/arb-deals-mined.json (SEC 8-K miner) and
 * data/arb-deals.manual.json (user overrides), fetches current market prices
 * via the Yahoo chart pattern (see lib/capital-radar-live.cjs yahooChart),
 * and computes merger-arb spreads:
 *
 *   cash deal:  spreadPct = offerPrice / targetPrice - 1
 *   stock deal: impliedValue = exchangeRatio * acquirerPrice
 *               spreadPct = impliedValue / targetPrice - 1
 *   annualizedSpreadPct = (1 + spreadPct)^(252 / tradingDaysToClose) - 1
 *
 * Capacity math on every tradeable deal: expected gross at $10k/$25k/$50k
 * notionals, net of $0 commissions. Verdict "THIN — no romance" when the
 * annualized spread is under 8% — thin spreads are the norm and the board
 * says so honestly.
 *
 * The `tradeable` boolean on each deal is a loose pre-filter (terms + price +
 * not closed). The VERDICT is the single source of truth: the homepage
 * renderer counts and cards only verdicts starting with "TRADEABLE". The
 * verdict rules are documented in the verdictCriteria block of the output.
 *
 * Output: outputs/arb/arb-deal-board.json
 */
const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const MINED_PATH = path.join(root, 'outputs', 'arb', 'arb-deals-mined.json');
const MANUAL_PATH = path.join(root, 'data', 'arb-deals.manual.json');
const OUT_DIR = path.join(root, 'outputs', 'arb');
const OUT_PATH = path.join(OUT_DIR, 'arb-deal-board.json');

const YAHOO_UA = 'Mozilla/5.0 (compatible; CapitalRadar/1.0)';
const TRADEABLE_CONF = new Set(['HIGH', 'MEDIUM', 'MANUAL']);
const NOTIONALS = [10000, 25000, 50000];
const THIN_THRESHOLD = 0.08;

// Single source of truth for what "tradeable" means on the board.
// The homepage renderer counts and cards ONLY deals whose verdict starts with
// "TRADEABLE" — the `tradeable` boolean on each deal is a loose pre-filter
// (terms + price + not closed), not the display count. This block is written
// into the JSON so the rules travel with the data.
const VERDICT_CRITERIA = {
  version: 1,
  tradeablePreFilter: [
    'confidence in {HIGH, MEDIUM, MANUAL} (LOW-confidence items go to the watchlist)',
    'deal not completed (includes cross-filing completion notices)',
    'target price resolvable via Yahoo Finance with a priceAsOf timestamp',
    'consideration terms extracted: cash -> offerPricePerShare; stock/collar -> exchangeRatio + acquirer price; mixed -> cash leg at minimum (stock leg added when exchangeRatio + acquirer price resolve)',
    'expectedCloseDate not in the past',
  ],
  spreadFormulas: {
    cash: 'spreadPct = offerPricePerShare / targetPrice - 1',
    stockOrCollar: 'impliedValue = exchangeRatio * acquirerPrice; spreadPct = impliedValue / targetPrice - 1',
    mixed: 'impliedValue = offerPricePerShare + exchangeRatio * acquirerPrice when both legs resolve, else cash leg only (flagged in tradeableNote)',
    annualized: 'annualizedSpreadPct = (1 + spreadPct) ^ (252 / tradingDaysToClose) - 1; tradingDaysToClose ~= calendarDays * 5/7',
  },
  verdictLadder: [
    'NOT TRADEABLE — pre-filter failed (reason in tradeableReason)',
    'NO EDGE — merger of equals — no directional spread for this engine',
    'NEGATIVE — target above offer — spreadPct < 0',
    'NO TIMELINE — cannot annualize — spread computed but no expectedCloseDate',
    'THIN — no romance — annualizedSpreadPct < THIN_THRESHOLD',
    'TRADEABLE — {x}% annualized — annualizedSpreadPct >= THIN_THRESHOLD',
  ],
  thinThreshold: THIN_THRESHOLD,
  thinThresholdRationale: 'Annualized gross spread must clear 8% to compensate for binary deal-break downside (targets typically fall 20-40% on a break), opportunity cost vs ~4% T-bills, and unmodeled frictions (borrow cost on stock legs, taxes). Sub-8% spreads are the historical norm for announced deals; the board marks them THIN honestly rather than lowering the bar to manufacture TRADEABLEs.',
  capacityMath: 'Expected gross at $10k / $25k / $50k notionals, $0 commissions, gross of borrow costs and taxes. annualizedGross = notional * annualizedSpreadPct.',
  knownDataGaps: [
    'Borrow cost/availability for stock-deal short legs is not modeled (borrowData: unavailable).',
    'SEC 8-K coverage is PARTIAL: S&P 500 universe, ~120-day lookback; expected-close guidance often lives in press-release exhibits the miner only fetches when 8-K body terms are missing.',
    'Timeline gaps are filled via manual deals (data/arb-deals.manual.json) with the source language quoted in each deal thesis.',
  ],
  displayRule: 'The homepage renderer counts and cards only deals whose verdict starts with "TRADEABLE". The `tradeable` boolean is a pre-filter, not the display count.',
};

const sleep = ms => new Promise(r => setTimeout(r, ms));
const r2 = v => (v == null || !isFinite(v) ? null : Math.round(v * 100) / 100);
const r4 = v => (v == null || !isFinite(v) ? null : Math.round(v * 10000) / 10000);

function yahooPrice(symbol) {
  return new Promise(resolve => {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5d&interval=1d&includePrePost=false`;
    const req = https.get(url, { headers: { 'User-Agent': YAHOO_UA } }, res => {
      if (res.statusCode !== 200) { res.resume(); return resolve({ ok: false, error: `HTTP ${res.statusCode}` }); }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => body += d);
      res.on('end', () => {
        try {
          const j = JSON.parse(body);
          const result = j.chart && j.chart.result && j.chart.result[0];
          if (!result) return resolve({ ok: false, error: 'no result' });
          const closes = ((result.indicators && result.indicators.quote && result.indicators.quote[0] && result.indicators.quote[0].close) || []).filter(v => typeof v === 'number');
          const meta = result.meta || {};
          const price = meta.regularMarketPrice || closes[closes.length - 1] || null;
          const ts = meta.regularMarketTime || (result.timestamp || [])[(result.timestamp || []).length - 1] || null;
          if (price == null) return resolve({ ok: false, error: 'no price' });
          resolve({
            ok: true,
            price: r4(price),
            priceAsOf: ts ? new Date(ts * 1000).toISOString() : new Date().toISOString(),
            currency: meta.currency || null,
            exchange: meta.exchangeName || meta.fullExchangeName || null,
          });
        } catch (e) { resolve({ ok: false, error: 'parse error' }); }
      });
    });
    req.on('error', e => resolve({ ok: false, error: e.message }));
    req.setTimeout(15000, () => { req.destroy(); resolve({ ok: false, error: 'timeout' }); });
  });
}

function tradingDaysBetween(fromISODate, toISODate) {
  const from = new Date(fromISODate + 'T12:00:00Z');
  const to = new Date(toISODate + 'T12:00:00Z');
  const calDays = Math.round((to - from) / 86400000);
  return { calDays, tradingDays: Math.max(0, Math.round(calDays * 5 / 7)) };
}

function norm(s) { return String(s || '').toUpperCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim(); }

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const mined = JSON.parse(fs.readFileSync(MINED_PATH, 'utf8'));
  let manual = { deals: [] };
  try { manual = JSON.parse(fs.readFileSync(MANUAL_PATH, 'utf8')); } catch { /* empty */ }
  const todayISO = new Date().toISOString().slice(0, 10);
  const now = new Date().toISOString();

  // index mined deals; manual takes precedence on same targetSymbol
  const manualTargets = new Set((manual.deals || []).map(d => String(d.target || '').toUpperCase()));
  const minedDeals = (mined.deals || []).filter(d => !manualTargets.has(String(d.targetSymbol || d.target || '').toUpperCase()));
  const superseded = (mined.deals || []).length - minedDeals.length;

  const manualDeals = (manual.deals || []).map(d => ({
    target: String(d.target).toUpperCase(), targetSymbol: String(d.target).toUpperCase(),
    targetName: d.targetName || String(d.target).toUpperCase(),
    acquirer: d.acquirer, acquirerSymbol: d.acquirerSymbol || null,
    considerationType: d.considerationType, offerPricePerShare: d.offerPricePerShare ?? null,
    exchangeRatio: d.exchangeRatio ?? null,
    expectedCloseDate: d.expectedCloseDate || null, expectedCloseLabel: d.expectedCloseLabel || d.expectedCloseDate || null,
    terminationFeeUSD: d.terminationFeeUSD ?? null, dealValueUSD: d.dealValueUSD ?? null,
    confidence: 'MANUAL', confidenceReason: 'user-entered manual deal',
    status: 'pending', thesis: d.thesis || null, addedAt: d.addedAt || null,
    riskFlags: { regulatory: 'standard', financing: 'not-stated', goShop: false, shareholderVote: 'not-stated' },
    filingUrl: null, exhibitUrl: null, source: 'manual', minedAt: null,
  }));

  const all = [...manualDeals, ...minedDeals];

  // cross-filing completion check: a completed notice for the same acquirer+target
  // marks the announcement entry completed too.
  const completedPairs = new Set();
  for (const d of all) {
    if (d.status === 'completed') completedPairs.add(`${norm(d.targetName)}|${norm(d.acquirer)}`);
  }
  for (const d of all) {
    if (d.status !== 'completed' && completedPairs.has(`${norm(d.targetName)}|${norm(d.acquirer)}`)) {
      d.status = 'completed';
      d.confidenceReason = (d.confidenceReason || '') + ' [cross-filed completion notice]';
    }
  }

  const watchlist = all.filter(d => !TRADEABLE_CONF.has(d.confidence)).map(d => ({
    target: d.target, targetSymbol: d.targetSymbol, targetName: d.targetName,
    acquirer: d.acquirer, acquirerSymbol: d.acquirerSymbol,
    confidence: d.confidence, confidenceReason: d.confidenceReason,
    status: d.status, filingUrl: d.filingUrl, filingDate: d.filingDate || null,
    source: d.source || 'sec-8k',
  }));

  const candidates = all.filter(d => TRADEABLE_CONF.has(d.confidence));

  // fetch prices (targets + acquirers for stock deals)
  const symbols = [...new Set(candidates.flatMap(d => [d.targetSymbol, d.acquirerSymbol]).filter(Boolean))];
  const prices = {};
  let yahooOk = 0, yahooFail = 0;
  const priceQueue = [...symbols];
  const workers = Array.from({ length: 4 }, async () => {
    while (priceQueue.length) {
      const sym = priceQueue.shift();
      const p = await yahooPrice(sym);
      await sleep(150);
      prices[sym] = p.ok ? p : { ok: false, error: p.error };
      if (p.ok) yahooOk++; else yahooFail++;
    }
  });
  await Promise.all(workers);

  const deals = candidates.map(d => {
    const out = {
      target: d.target, targetSymbol: d.targetSymbol, targetName: d.targetName,
      acquirer: d.acquirer, acquirerSymbol: d.acquirerSymbol,
      filerRole: d.filerRole || null,
      considerationType: d.considerationType,
      offerPricePerShare: d.offerPricePerShare, exchangeRatio: d.exchangeRatio,
      expectedCloseDate: d.expectedCloseDate, expectedCloseLabel: d.expectedCloseLabel,
      terminationFeeUSD: d.terminationFeeUSD, dealValueUSD: d.dealValueUSD,
      confidence: d.confidence, confidenceReason: d.confidenceReason,
      status: d.status, riskFlags: d.riskFlags,
      thesis: d.thesis || null,
      filingUrl: d.filingUrl, exhibitUrl: d.exhibitUrl || null,
      evidenceUrls: d.evidenceUrls || (d.filingUrl ? [d.filingUrl] : []),
      source: d.source || 'sec-8k', minedAt: d.minedAt || null, addedAt: d.addedAt || null,
    };

    const tp = d.targetSymbol ? prices[d.targetSymbol] : null;
    out.targetPrice = tp && tp.ok ? tp.price : null;
    out.targetPriceAsOf = tp && tp.ok ? tp.priceAsOf : null;
    out.targetPriceError = tp && !tp.ok ? tp.error : (d.targetSymbol ? null : 'no target symbol resolved');
    const ap = d.acquirerSymbol ? prices[d.acquirerSymbol] : null;
    out.acquirerPrice = ap && ap.ok ? ap.price : null;
    out.acquirerPriceAsOf = ap && ap.ok ? ap.priceAsOf : null;

    out.tradeable = false;
    out.tradeableReason = null;
    out.spreadPct = null; out.impliedValue = null; out.annualizedSpreadPct = null;
    out.tradingDaysToClose = null; out.shortRequired = false; out.borrowData = null;
    if (d.mergerOfEquals) {
      out.tradeableReason = 'merger of equals — no directional spread for this engine';
      out.verdict = 'NO EDGE — merger of equals';
      return out;
    }

    if (d.status === 'completed') {
      out.tradeableReason = 'deal completed — no longer tradeable';
    } else if (out.targetPrice == null) {
      out.tradeableReason = `no target price (${out.targetPriceError || 'unknown'})`;
    } else if (d.considerationType === 'cash' && d.offerPricePerShare) {
      out.spreadPct = r4(d.offerPricePerShare / out.targetPrice - 1);
      out.tradeable = true;
    } else if ((d.considerationType === 'stock' || d.considerationType === 'collar') && d.exchangeRatio && out.acquirerPrice != null) {
      out.impliedValue = r4(d.exchangeRatio * out.acquirerPrice);
      out.spreadPct = r4(out.impliedValue / out.targetPrice - 1);
      out.shortRequired = true;
      out.borrowData = 'unavailable';
      out.tradeable = true;
    } else if (d.considerationType === 'mixed' && d.offerPricePerShare) {
      if (d.exchangeRatio && out.acquirerPrice != null) {
        out.impliedValue = r4(d.offerPricePerShare + d.exchangeRatio * out.acquirerPrice);
        out.spreadPct = r4(out.impliedValue / out.targetPrice - 1);
        out.shortRequired = true;
        out.borrowData = 'unavailable';
      } else {
        out.spreadPct = r4(d.offerPricePerShare / out.targetPrice - 1);
        out.tradeableNote = 'mixed consideration: spread computed on cash leg only (stock leg unpriced)';
      }
      out.tradeable = true;
    } else {
      out.tradeableReason = 'terms not extracted — cannot compute spread';
    }

    if (out.tradeable && d.expectedCloseDate) {
      const { calDays, tradingDays } = tradingDaysBetween(todayISO, d.expectedCloseDate);
      if (calDays < 0) {
        out.tradeable = false;
        out.tradeableReason = 'expected close date has passed — likely closed or stale';
        out.tradingDaysToClose = 0;
      } else {
        out.tradingDaysToClose = tradingDays;
        if (tradingDays > 0 && out.spreadPct != null && out.spreadPct > -1) {
          out.annualizedSpreadPct = r4(Math.pow(1 + out.spreadPct, 252 / tradingDays) - 1);
        }
      }
    }

    out.capacityTable = NOTIONALS.map(n => {
      const row = { notional: n, commissionUSD: 0 };
      if (out.tradeable && out.spreadPct != null) {
        row.expectedGross = r2(n * out.spreadPct);
        row.annualizedGross = out.annualizedSpreadPct != null ? r2(n * out.annualizedSpreadPct) : null;
      } else { row.expectedGross = null; row.annualizedGross = null; }
      return row;
    });

    if (!out.tradeable) out.verdict = 'NOT TRADEABLE';
    else if (out.spreadPct < 0) out.verdict = 'NEGATIVE — target above offer';
    else if (out.annualizedSpreadPct == null) out.verdict = 'NO TIMELINE — cannot annualize';
    else if (out.annualizedSpreadPct < THIN_THRESHOLD) out.verdict = 'THIN — no romance';
    else out.verdict = `TRADEABLE — ${(out.annualizedSpreadPct * 100).toFixed(1)}% annualized`;
    return out;
  });

  deals.sort((a, b) => (b.annualizedSpreadPct == null ? -Infinity : b.annualizedSpreadPct) - (a.annualizedSpreadPct == null ? -Infinity : a.annualizedSpreadPct));

  const priceStale = deals.some(d => d.tradeable && (!d.targetPriceAsOf || (Date.now() - new Date(d.targetPriceAsOf).getTime()) > 36 * 3600 * 1000));
  // SEC coverage errors were previously dropped: the miner records them at
  // top level (mined.errors), but the board only spread mined.coverage.
  const secErrors = Array.isArray(mined.errors) ? mined.errors : [];
  const reasons = [];
  if (yahooFail > 0 && yahooOk === 0) reasons.push('Yahoo price fetch failed for all symbols — spreads not computed');
  else if (yahooFail > 0) reasons.push(`${yahooFail} symbol(s) without price; affected deals marked not tradeable`);
  if (secErrors.length > 0) reasons.push(`SEC submissions unavailable for ${secErrors.length} symbol(s): ${secErrors.map(e => e.symbol).join(', ')} — 8-K coverage incomplete`);
  if (priceStale) reasons.push('one or more tradeable deals has a stale price (>36h)');
  const dataHealth = {
    status: priceStale ? 'STALE'
      : (yahooFail > 0 && yahooOk === 0) ? 'DOWN'
      : (yahooFail > 0 || secErrors.length > 0) ? 'PARTIAL'
      : 'OK',
    yahooPricesOk: yahooOk, yahooPricesFailed: yahooFail,
    symbolsRequested: symbols.length,
    secCoverageErrors: secErrors.length,
    reasons,
    note: reasons.length ? reasons.join(' · ') : 'all requested prices resolved; full SEC coverage',
  };

  const board = {
    generatedAt: now,
    universe: mined.universe || null,
    minerGeneratedAt: mined.generatedAt || null,
    verdictCriteria: VERDICT_CRITERIA,
    coverage: {
      ...(mined.coverage || {}),
      secErrors: secErrors.slice(0, 100),
      manualDeals: manualDeals.length,
      manualSupersededMined: superseded,
      boardDeals: deals.length,
      watchlist: watchlist.length,
    },
    dataHealth,
    deals,
    watchlist,
  };
  fs.writeFileSync(OUT_PATH, JSON.stringify(board, null, 2) + '\n');
  const tradeable = deals.filter(d => String(d.verdict).startsWith('TRADEABLE')).length;
  console.log(`arb deal board: deals=${deals.length} TRADEABLE(verdict)=${tradeable} watchlist=${watchlist.length} yahoo ok=${yahooOk} fail=${yahooFail}`);
  console.log(`wrote ${path.relative(root, OUT_PATH)}`);
}
main().catch(e => { console.error(e); process.exit(1); });
