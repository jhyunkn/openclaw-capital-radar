'use strict';

// Universe Scanner v2 — Five-Gate Criteria
//
// Gate 1: BUSINESS QUALITY — is this a real business worth owning?
//   Revenue growth rate, gross margin (pricing power), FCF generation.
//   Hard reject if revenue declining > 5% YoY.
//
// Gate 2: VALUATION — what are you actually paying?
//   Price/Sales and Price/FCF computed from live price × shares / revenue.
//   A moated trough business still priced at 30× revenue is not an opportunity.
//
// Gate 3: PRICE DISLOCATION — is the market giving a real discount?
//   % below 52-week high, RSI, rate of recent decline.
//   Hard reject if within 8% of 52-week high.
//
// Gate 4: MOAT DURABILITY — is the competitive advantage intact?
//   Encoded from supply chain level and competitive structure.
//   Level 2-3 supply chain (underappreciated) outscores Level 1 (obvious).
//
// Gate 5: DECLINE REASON — why is the stock actually down?
//   SENTIMENT_DRIVEN: revenue growing >15%, stock down >20% → classic opportunity
//   MULTIPLE_COMPRESSION: growth normalizing, market derating → investigate
//   ACUTE_CATALYST: sharp 1m drop >15% → specific event, needs explanation
//   FUNDAMENTAL_CONCERN: revenue declining → HARD REJECT regardless of score
//   INSUFFICIENT_DATA: no fundamentals available → conservative, no conviction
//
// Insider buying is a BONUS (+15 max), not a gate.
// Total max score: 155 pts.
// FULL_SIGNAL (conviction): ≥ 95 pts, all gates pass, decline ≠ FUNDAMENTAL_CONCERN
// PARTIAL_SIGNAL (watchlist): ≥ 65 pts, gates 1+2+3+4 pass
// WATCH: ≥ 40 pts, gates 1+3+4 pass

const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}
function write(rel, data) {
  const f = path.join(root, rel);
  fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
}
const num   = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const round = (n, d = 1) => Number.isFinite(n) ? Number(n.toFixed(d)) : null;

// ── DATA SOURCES ──────────────────────────────────────────────────────────────
const marketData     = readJson('outputs/watchlist-market-data.json');
const xbrlFull       = readJson('outputs/sec-xbrl-fundamentals.json');
const xbrlTrends     = readJson('outputs/xbrl-revenue-trends.json');
const form4Data      = readJson('outputs/form4-open-market.json');
const oppUniverse    = readJson('data/opportunity-universe.json');
const themeChains    = readJson('data/theme-supply-chains.json');
const macroMap       = readJson('outputs/market-orientation-map.json');

if (!marketData) throw new Error('Missing outputs/watchlist-market-data.json');

// ── BUILD LOOKUP TABLES ───────────────────────────────────────────────────────

// Merge both XBRL sources. sec-xbrl-fundamentals has full data (GM, FCF, shares).
// xbrl-revenue-trends has quarterly revenue data for a wider set of tickers.
// sec-xbrl-fundamentals wins on overlap; xbrl-revenue-trends fills in the gaps.
const xbrlByTicker = {};

// First pass: full fundamentals (sec-xbrl-fundamentals)
for (const r of (xbrlFull?.results || [])) {
  if (r.ticker && r.fundamentals) {
    const f = r.fundamentals;
    xbrlByTicker[r.ticker.toUpperCase()] = {
      revenue_ttm_usd_millions:    f.revenue_ttm_usd_millions ?? null,
      revenue_growth_pct:          f.revenue_growth_pct ?? null,
      gross_margin_pct:            f.gross_margin_pct ?? null,
      fcf_usd_millions:            f.fcf_usd_millions ?? null,
      shares_outstanding_millions: (f.shares_outstanding_millions && f.shares_outstanding_millions > 0)
                                     ? f.shares_outstanding_millions : null,
      dilution_flag:               f.dilution_flag ?? null,
      data_completeness:           'full',
    };
  }
}

// Second pass: fill in revenue growth from trends for tickers missing from full file
for (const [ticker, td] of Object.entries(xbrlTrends?.tickers || {})) {
  const tk = ticker.toUpperCase();
  if (!xbrlByTicker[tk]) {
    // Only revenue data available — mark partial
    const yoy = td.inflection?.yoy_latest ?? null;
    xbrlByTicker[tk] = {
      revenue_ttm_usd_millions:    null,
      revenue_growth_pct:          yoy,
      gross_margin_pct:            null,
      fcf_usd_millions:            null,
      shares_outstanding_millions: null,
      dilution_flag:               null,
      data_completeness:           'revenue_only',
    };
  } else {
    // Already have full data — enrich revenue growth with quarterly data if better
    const yoy = td.inflection?.yoy_latest ?? null;
    if (yoy !== null && xbrlByTicker[tk].revenue_growth_pct === null) {
      xbrlByTicker[tk].revenue_growth_pct = yoy;
    }
  }
}

const moatByTicker = {};
for (const t of (oppUniverse?.tickers || [])) {
  moatByTicker[String(t.ticker).toUpperCase()] = t;
}

// Build supply chain level map from theme-supply-chains.json
const chainLevelByTicker = {};
const chainThemesByTicker = {};
if (themeChains?.themes) {
  for (const [themeId, td] of Object.entries(themeChains.themes)) {
    const assign = (level, tickers) => {
      for (const t of (tickers || [])) {
        const tk = String(t).toUpperCase();
        if (!chainLevelByTicker[tk] || chainLevelByTicker[tk] > level) {
          chainLevelByTicker[tk] = level;
        }
        if (!chainThemesByTicker[tk]) chainThemesByTicker[tk] = [];
        if (!chainThemesByTicker[tk].includes(themeId)) chainThemesByTicker[tk].push(themeId);
      }
    };
    assign(1, td.level1?.tickers);
    assign(2, td.level2?.tickers);
    assign(3, td.level3?.tickers);
    assign(4, td.level4?.tickers);
  }
}

// Build Form 4 lookup
const form4ByTicker = form4Data?.tickers || {};

// ── ACTIVE THEMES ─────────────────────────────────────────────────────────────
const ALWAYS_ON = new Set([
  'AI_INFRASTRUCTURE', 'AI_INFERENCE_DEMAND', 'NUCLEAR_POWER', 'SEMICONDUCTOR_CAPEX',
  'GRID_MODERNIZATION', 'ENTERPRISE_AI_SOFTWARE', 'SPACE_ECONOMY',
]);

// ── SKIP NON-STOCK INSTRUMENTS ────────────────────────────────────────────────
const SKIP = new Set(['CONL','BMNR','TSLT','TSNF','IBIT','SPY','AEHR']);

// ── GATE 1: BUSINESS QUALITY (0-40) ──────────────────────────────────────────
function scoreBusinessQuality(xbrl, ticker) {
  if (!xbrl) return { score: 0, passed: false, signals: [], gaps: ['No SEC fundamentals — ticker not in XBRL coverage'] };
  const partial = xbrl.data_completeness === 'revenue_only';

  const signals = [];
  const gaps    = [];
  let score     = 0;

  const revGrowth = num(xbrl.revenue_growth_pct);
  const gm        = num(xbrl.gross_margin_pct);
  const fcf       = num(xbrl.fcf_usd_millions);
  const rev       = num(xbrl.revenue_ttm_usd_millions);
  const dilution  = xbrl.dilution_flag;

  // ── Revenue growth (0-20) ──────────────────────────────────────────────────
  if (revGrowth === null) {
    gaps.push('Revenue growth unknown');
  } else if (revGrowth < -5) {
    return { score: 0, passed: false, hardReject: 'FUNDAMENTAL_CONCERN',
      signals: [], gaps: [`Revenue declining ${round(revGrowth, 1)}% YoY — hard reject`] };
  } else if (revGrowth >= 40)  { score += 20; signals.push(`Revenue +${round(revGrowth,1)}% YoY (high growth)`); }
  else if (revGrowth >= 25)    { score += 16; signals.push(`Revenue +${round(revGrowth,1)}% YoY (strong growth)`); }
  else if (revGrowth >= 15)    { score += 12; signals.push(`Revenue +${round(revGrowth,1)}% YoY (solid growth)`); }
  else if (revGrowth >= 8)     { score +=  7; signals.push(`Revenue +${round(revGrowth,1)}% YoY (moderate growth)`); }
  else if (revGrowth >= 2)     { score +=  3; signals.push(`Revenue +${round(revGrowth,1)}% YoY (slow growth)`); }
  else if (revGrowth >= -5)    { score +=  1; signals.push(`Revenue ${round(revGrowth,1)}% YoY (flat — watch closely)`); }

  // ── Gross margin (0-12) ────────────────────────────────────────────────────
  if (gm === null) {
    if (partial) gaps.push('Gross margin: not in XBRL coverage (revenue-only data)');
    else gaps.push('Gross margin not reported in filings');
  } else if (gm >= 65) { score += 12; signals.push(`Gross margin ${round(gm,1)}% — platform-level pricing power`); }
  else if (gm >= 50)   { score +=  9; signals.push(`Gross margin ${round(gm,1)}% — strong`); }
  else if (gm >= 35)   { score +=  6; signals.push(`Gross margin ${round(gm,1)}% — solid`); }
  else if (gm >= 20)   { score +=  3; signals.push(`Gross margin ${round(gm,1)}% — adequate`); }
  else                  { score +=  0; gaps.push(`Gross margin ${round(gm,1)}% — thin, possible commodity risk`); }

  // ── FCF generation (0-8) ──────────────────────────────────────────────────
  const fcfMargin = (fcf !== null && rev !== null && rev > 0) ? (fcf / rev) * 100 : null;
  if (fcf === null) {
    if (partial) gaps.push('FCF: not in XBRL coverage (revenue-only data)');
    else gaps.push('FCF not available in SEC filings');
  } else if (fcf > 0 && fcfMargin !== null && fcfMargin >= 15) {
    score += 8; signals.push(`FCF $${round(fcf,0)}M (${round(fcfMargin,1)}% FCF margin) — strong cash generation`);
  } else if (fcf > 0 && fcfMargin !== null && fcfMargin >= 5) {
    score += 5; signals.push(`FCF $${round(fcf,0)}M (${round(fcfMargin,1)}% margin) — positive`);
  } else if (fcf > 0) {
    score += 3; signals.push(`FCF positive ($${round(fcf,0)}M)`);
  } else {
    gaps.push(`FCF negative ($${round(fcf,0)}M) — burning cash`);
    if (dilution === 'elevated') gaps.push('Elevated dilution + negative FCF: high risk');
  }

  // ── Dilution adjustment ───────────────────────────────────────────────────
  if (dilution === 'low')      { score += 2; }
  else if (dilution === 'elevated' && fcf !== null && fcf < 0) { score -= 4; gaps.push('Elevated dilution with no FCF offset'); }

  // For partial data (revenue-only), lower the floor — we can't penalise missing GM/FCF
  const floor  = partial ? 7 : 12;
  const passed = score >= floor;
  if (!passed) gaps.push(`Business quality too low (${score}/40, need ${floor}+)`);

  return { score: clamp(score, 0, 40), passed, signals, gaps, partial };
}

// ── GATE 2: VALUATION (0-30) ─────────────────────────────────────────────────
function scoreValuation(xbrl, mkt, ticker) {
  const signals = [];
  const gaps    = [];
  let score     = 0;

  if (!xbrl || !mkt) {
    return { score: 8, passed: true, signals: [], gaps: ['Insufficient data for valuation — no penalty, no credit'], ps: null, pFcf: null };
  }

  const price  = num(mkt.currentPrice);
  const shares = num(xbrl.shares_outstanding_millions);
  const rev    = num(xbrl.revenue_ttm_usd_millions);
  const fcf    = num(xbrl.fcf_usd_millions);

  let ps   = null;
  let pFcf = null;

  // P/S — primary valuation anchor
  if (price !== null && shares !== null && shares > 0 && rev !== null && rev > 0) {
    ps = round((price * shares) / rev, 1);
    if      (ps < 3)  { score += 20; signals.push(`P/S ${ps}× — cheap by any standard`); }
    else if (ps < 6)  { score += 15; signals.push(`P/S ${ps}× — reasonable`); }
    else if (ps < 10) { score += 10; signals.push(`P/S ${ps}× — moderate premium`); }
    else if (ps < 15) { score +=  6; signals.push(`P/S ${ps}× — paying up, needs strong growth`); }
    else if (ps < 25) { score +=  3; signals.push(`P/S ${ps}× — expensive, high growth required`); }
    else              { score +=  0; gaps.push(`P/S ${ps}× — very expensive, high conviction needed`); }
  } else {
    score += 5;
    gaps.push('P/S not computable (missing shares or revenue)');
  }

  // P/FCF — secondary, only if FCF positive
  if (price !== null && shares !== null && fcf !== null && fcf > 0) {
    pFcf = round((price * shares) / fcf, 1);
    if      (pFcf < 20)  { score += 10; signals.push(`P/FCF ${pFcf}× — attractively priced on cash`); }
    else if (pFcf < 30)  { score +=  8; signals.push(`P/FCF ${pFcf}× — reasonable`); }
    else if (pFcf < 40)  { score +=  5; signals.push(`P/FCF ${pFcf}× — moderate`); }
    else if (pFcf < 60)  { score +=  2; signals.push(`P/FCF ${pFcf}× — paying a premium`); }
    else                  { score +=  0; gaps.push(`P/FCF ${pFcf}× — expensive on cash`); }
  } else if (fcf !== null && fcf < 0) {
    gaps.push('No P/FCF — company not yet FCF positive');
  } else {
    score += 2;
    gaps.push('P/FCF not computable');
  }

  const passed = score >= 5;
  return { score: clamp(score, 0, 30), passed, signals, gaps, ps, pFcf };
}

// ── GATE 3: PRICE DISLOCATION (0-30) ─────────────────────────────────────────
function scoreDislocation(mkt, ticker) {
  if (!mkt) return { score: 0, passed: false, hardReject: 'NO_MARKET_DATA', signals: [], gaps: ['No live market data'] };

  const signals = [];
  const gaps    = [];
  let score     = 0;

  const pctDown = num(mkt.pctFrom52wHigh);  // negative number
  const rsi     = num(mkt.rsi14);
  const trend1m = num(mkt.trend1mPct);      // negative = falling

  // ── Distance from 52-week high (0-20) ─────────────────────────────────────
  if (pctDown === null) {
    return { score: 0, passed: false, hardReject: 'NO_52W_DATA', signals: [], gaps: ['52-week high data unavailable'] };
  }
  const pctDownAbs = Math.abs(pctDown);

  if (pctDownAbs < 8) {
    return { score: 0, passed: false, hardReject: 'NEAR_PEAK',
      signals: [], gaps: [`Only ${round(pctDownAbs,1)}% from 52-week high — not at trough, market agrees with current price`] };
  }

  if      (pctDownAbs >= 50) { score += 20; signals.push(`Down ${round(pctDownAbs,1)}% from 52wH — deep value territory`); }
  else if (pctDownAbs >= 35) { score += 16; signals.push(`Down ${round(pctDownAbs,1)}% from 52wH — significant dislocation`); }
  else if (pctDownAbs >= 25) { score += 12; signals.push(`Down ${round(pctDownAbs,1)}% from 52wH — meaningful discount`); }
  else if (pctDownAbs >= 15) { score +=  8; signals.push(`Down ${round(pctDownAbs,1)}% from 52wH — moderate dislocation`); }
  else if (pctDownAbs >= 8)  { score +=  4; signals.push(`Down ${round(pctDownAbs,1)}% from 52wH — slight pullback`); }

  // ── RSI (0-8) ─────────────────────────────────────────────────────────────
  if (rsi === null) {
    gaps.push('RSI unavailable');
  } else if (rsi < 30) { score += 8; signals.push(`RSI ${rsi} — extreme oversold, fear/capitulation signal`); }
  else if (rsi < 40)   { score += 5; signals.push(`RSI ${rsi} — oversold`); }
  else if (rsi < 50)   { score += 2; signals.push(`RSI ${rsi} — below neutral`); }
  else                  { gaps.push(`RSI ${rsi} — momentum not depressed yet`); }

  // ── 1-month rate of decline (0-5) ─────────────────────────────────────────
  if (trend1m === null) {
    gaps.push('1-month trend unavailable');
  } else if (trend1m <= -20) { score += 5; signals.push(`1m: ${round(trend1m,1)}% — acute dislocation`); }
  else if (trend1m <= -10)   { score += 3; signals.push(`1m: ${round(trend1m,1)}% — sharp recent drop`); }
  else if (trend1m <= -5)    { score += 1; signals.push(`1m: ${round(trend1m,1)}% — modest pullback`); }
  else if (trend1m >= 20)    { gaps.push(`1m: +${round(trend1m,1)}% — already recovering, entry less urgent`); }

  const passed = score >= 8;
  if (!passed) gaps.push(`Dislocation too small (${score}/30, need 8+)`);

  return { score: clamp(score, 0, 30), passed, signals, gaps };
}

// ── GATE 4: MOAT DURABILITY (0-40) ───────────────────────────────────────────
function scoreMoat(ticker, moatMeta) {
  const signals = [];
  const gaps    = [];
  let score     = 0;

  const chainLevel  = chainLevelByTicker[ticker] ?? null;
  const chainThemes = chainThemesByTicker[ticker] ?? [];

  // ── Supply chain position (0-25) ──────────────────────────────────────────
  if (chainLevel === 1) {
    score += 20;
    signals.push(`Level-1 supply chain — core/obvious play, moat real but widely known`);
  } else if (chainLevel === 2) {
    score += 28;
    signals.push(`Level-2 supply chain — underappreciated, 2-4 competitors, high switching costs`);
  } else if (chainLevel === 3) {
    score += 25;
    signals.push(`Level-3 supply chain — critical infrastructure, spec-qualified, harder to replicate`);
  } else if (chainLevel === 4) {
    score += 12;
    signals.push(`Level-4 supply chain — adjacent beneficiary, commodity risk`);
  } else if (moatMeta) {
    // Not in supply chain but has moat metadata — standalone moat
    score += 18;
    signals.push('Standalone moat — not in supply chain hierarchy');
  } else {
    score += 10;
    gaps.push('Moat not assessed — no supply chain or moat data');
  }

  // ── Moat quality from description (0-15) ──────────────────────────────────
  if (moatMeta?.moat) {
    const moatText = moatMeta.moat.toLowerCase();
    if (/monopoly|only.*manufacturer|only.*licensed|no substitute/i.test(moatMeta.moat)) {
      score += 15;
      signals.push(`Monopoly/sole supplier — highest moat tier`);
    } else if (/switching cost|lock.in|ecosystem|customer.*integrat|embedded/i.test(moatMeta.moat)) {
      score += 12;
      signals.push(`High switching costs / ecosystem lock-in`);
    } else if (/network effect|flywheel|platform.*sticky|data.*flywheel/i.test(moatMeta.moat)) {
      score += 10;
      signals.push(`Network effects / platform flywheel`);
    } else if (/oligopoly|duopoly|2.*compan|3.*compan|few.*competitors/i.test(moatMeta.moat)) {
      score += 9;
      signals.push(`Oligopoly structure — limited competition`);
    } else if (/ip|patent|process.*advantage|proprietary/i.test(moatMeta.moat)) {
      score += 7;
      signals.push(`IP / process advantage`);
    } else {
      score += 5;
      signals.push(`Moat: ${moatMeta.moat.slice(0, 60)}`);
    }
  } else {
    gaps.push('No moat description — cannot assess quality');
  }

  // Theme alignment bonus
  const activeHits = chainThemes.filter(t => ALWAYS_ON.has(t));
  if (activeHits.length > 0) {
    score += 3;
    signals.push(`Active theme alignment: ${activeHits.slice(0,2).join(', ')}`);
  }

  const passed = score >= 15;
  if (!passed) gaps.push(`Moat score too low (${score}/40, need 15+)`);

  return { score: clamp(score, 0, 40), passed, signals, gaps };
}

// ── GATE 5: DECLINE REASON (classification, gates FUNDAMENTAL_CONCERN) ───────
function classifyDeclineReason(xbrl, mkt) {
  const pctDown = num(mkt?.pctFrom52wHigh);
  const trend1m = num(mkt?.trend1mPct);
  const revGrowth = num(xbrl?.revenue_growth_pct);
  const pctDownAbs = pctDown !== null ? Math.abs(pctDown) : null;

  if (revGrowth !== null && revGrowth < -5) {
    return {
      reason: 'FUNDAMENTAL_CONCERN',
      label: 'Revenue declining',
      explanation: `Revenue is contracting ${round(revGrowth,1)}% YoY while stock falls — the decline may be pricing in real deterioration, not sentiment.`,
      hard_reject: true,
    };
  }

  if (trend1m !== null && trend1m <= -15 && pctDownAbs !== null && pctDownAbs < 35) {
    return {
      reason: 'ACUTE_CATALYST',
      label: 'Sharp recent drop — investigate',
      explanation: `Stock dropped ${round(Math.abs(trend1m),1)}% in one month, but fundamentals appear intact. A specific event likely triggered this — understand the catalyst before acting.`,
      hard_reject: false,
    };
  }

  if (revGrowth !== null && revGrowth >= 15 && pctDownAbs !== null && pctDownAbs >= 20) {
    return {
      reason: 'SENTIMENT_DRIVEN',
      label: 'Sentiment disconnect',
      explanation: `Revenue growing ${round(revGrowth,1)}% while stock is ${round(pctDownAbs,1)}% below its high — the fundamentals and price are moving in opposite directions. This is the setup.`,
      hard_reject: false,
    };
  }

  if (revGrowth !== null && revGrowth >= 5 && pctDownAbs !== null && pctDownAbs >= 15) {
    return {
      reason: 'MULTIPLE_COMPRESSION',
      label: 'Multiple compression',
      explanation: `Revenue growing ${round(revGrowth,1)}% but the market is derating the multiple — likely rate environment or growth-rate deceleration from a prior peak. Valuation now matters.`,
      hard_reject: false,
    };
  }

  if (revGrowth === null) {
    return {
      reason: 'INSUFFICIENT_DATA',
      label: 'No fundamental data',
      explanation: 'Cannot determine why the stock is down without revenue data. Treat as high uncertainty — do not act without understanding the thesis.',
      hard_reject: false,
    };
  }

  return {
    reason: 'MIXED_SIGNAL',
    label: 'Mixed signals',
    explanation: `Revenue growth ${round(revGrowth ?? 0, 1)}% is insufficient to clearly explain the ${round(pctDownAbs ?? 0, 1)}% price decline. Needs deeper investigation.`,
    hard_reject: false,
  };
}

// ── INSIDER BONUS (0-15) ─────────────────────────────────────────────────────
function insiderBonus(ticker) {
  const f4 = form4ByTicker[ticker];
  if (!f4) return { bonus: 0, signals: [], note: 'No Form 4 data' };

  if (f4.open_market_signal === 'STRONG') {
    const top = f4.open_market_purchases?.[0];
    const who = top
      ? `${top.ownerName}${top.officerTitle ? ` (${top.officerTitle})` : ''} bought ${Number(top.shares).toLocaleString()} shares @ $${top.pricePerShare} on ${top.transactionDate}`
      : `$${f4.total_purchase_value_mm}M total across ${f4.purchase_count} transactions`;
    return { bonus: 15, signals: [`Insider STRONG: $${f4.total_purchase_value_mm}M open-market — ${who}`], note: 'STRONG' };
  }
  if (f4.open_market_signal === 'PRESENT') {
    return { bonus: 10, signals: [`Insider PRESENT: $${f4.total_purchase_value_mm}M open-market`], note: 'PRESENT' };
  }
  if (f4.open_market_signal === 'MINOR') {
    return { bonus: 5, signals: [`Insider MINOR: small open-market purchases`], note: 'MINOR' };
  }
  return { bonus: 0, signals: [], note: 'NONE' };
}

// ── CLASSIFY SIGNAL ───────────────────────────────────────────────────────────
function classifySignal(total, gates, declineReason) {
  if (declineReason.hard_reject) return 'REJECT';
  if (Object.values(gates).some(g => g.hardReject)) return 'REJECT';
  const allPass = gates.quality.passed && gates.valuation.passed && gates.dislocation.passed && gates.moat.passed;
  const q3pass  = gates.quality.passed && gates.dislocation.passed && gates.moat.passed;
  if (allPass && total >= 95)  return 'FULL_SIGNAL';
  if (allPass && total >= 65)  return 'PARTIAL_SIGNAL';
  if (q3pass  && total >= 40)  return 'WATCH';
  return 'RESEARCH_ONLY';
}

// ── SCORE EACH CANDIDATE ──────────────────────────────────────────────────────
function scoreCandidate(ticker) {
  const mkt      = marketData.tickers?.[ticker] ?? null;
  const xbrl     = xbrlByTicker[ticker] ?? null;
  const moatMeta = moatByTicker[ticker] ?? null;

  const quality     = scoreBusinessQuality(xbrl, ticker);
  const valuation   = scoreValuation(xbrl, mkt, ticker);
  const dislocation = scoreDislocation(mkt, ticker);
  const moat        = scoreMoat(ticker, moatMeta);
  const decline     = classifyDeclineReason(xbrl, mkt);
  const insider     = insiderBonus(ticker);

  // Hard reject propagation
  if (quality.hardReject || dislocation.hardReject) {
    const reason = quality.hardReject || dislocation.hardReject;
    return {
      ticker, signal: 'REJECT', reject_reason: reason, total_score: 0,
      gate_scores: { quality: 0, valuation: 0, dislocation: 0, moat: 0, insider_bonus: 0 },
      decline_reason: decline,
      signals: [...quality.gaps, ...dislocation.gaps].filter(Boolean),
      gaps: [],
      live_price: mkt?.currentPrice ?? null,
      pct_from_52w_high: mkt?.pctFrom52wHigh ?? null,
      rsi14: mkt?.rsi14 ?? null,
      trend_1m_pct: mkt?.trend1mPct ?? null,
      revenue_growth_pct: xbrl?.revenue_growth_pct ?? null,
      gross_margin_pct: xbrl?.gross_margin_pct ?? null,
      fcf_usd_millions: xbrl?.fcf_usd_millions ?? null,
      ps: null, p_fcf: null,
      moat_summary: moatMeta?.moat ?? null,
      theme_adjacency: chainThemesByTicker[ticker] ?? [],
      supply_chain_level: chainLevelByTicker[ticker] ?? null,
    };
  }

  const total = quality.score + valuation.score + dislocation.score + moat.score + insider.bonus;
  const signal = classifySignal(total, { quality, valuation, dislocation, moat }, decline);

  const allSignals = [
    ...quality.signals,
    ...valuation.signals,
    ...dislocation.signals,
    ...moat.signals,
    ...insider.signals,
  ].filter(Boolean);

  const allGaps = [
    ...quality.gaps,
    ...valuation.gaps,
    ...dislocation.gaps,
    ...moat.gaps,
  ].filter(Boolean);

  return {
    ticker,
    name: moatMeta?.name ?? ticker,
    signal,
    total_score: total,
    gate_scores: {
      quality:       quality.score,
      valuation:     valuation.score,
      dislocation:   dislocation.score,
      moat:          moat.score,
      insider_bonus: insider.bonus,
    },
    gate_passed: {
      quality:    quality.passed,
      valuation:  valuation.passed,
      dislocation: dislocation.passed,
      moat:       moat.passed,
    },
    decline_reason: decline,
    signals: allSignals,
    gaps: allGaps,
    // Market data
    live_price:         mkt?.currentPrice ?? null,
    pct_from_52w_high:  mkt?.pctFrom52wHigh ?? null,
    rsi14:              mkt?.rsi14 ?? null,
    trend_1m_pct:       mkt?.trend1mPct ?? null,
    // Fundamentals
    revenue_growth_pct: xbrl ? round(num(xbrl.revenue_growth_pct), 1) : null,
    gross_margin_pct:   xbrl ? round(num(xbrl.gross_margin_pct), 1) : null,
    fcf_usd_millions:   xbrl ? round(num(xbrl.fcf_usd_millions), 0) : null,
    ps:                 valuation.ps,
    p_fcf:              valuation.pFcf,
    // Context
    moat_summary:       moatMeta?.moat ?? null,
    theme_adjacency:    chainThemesByTicker[ticker] ?? [],
    supply_chain_level: chainLevelByTicker[ticker] ?? null,
    insider_signal:     insider.note,
    open_market_value_mm: form4ByTicker[ticker]?.total_purchase_value_mm ?? 0,
  };
}

// ── RUN ───────────────────────────────────────────────────────────────────────
const allTickers = Object.keys(marketData.tickers || {}).filter(t => !SKIP.has(t));
const results    = allTickers.map(scoreCandidate);

const full_signal    = results.filter(r => r.signal === 'FULL_SIGNAL').sort((a, b) => b.total_score - a.total_score);
const partial_signal = results.filter(r => r.signal === 'PARTIAL_SIGNAL').sort((a, b) => b.total_score - a.total_score);
const watch          = results.filter(r => r.signal === 'WATCH').sort((a, b) => b.total_score - a.total_score);
const rejected       = results.filter(r => r.signal === 'REJECT').sort((a, b) => b.total_score - a.total_score);

const output = {
  artifact: 'universe-scanner',
  version: 2,
  generatedAt: new Date().toISOString(),
  methodology: {
    description: 'Five-gate criteria: (1) business quality, (2) valuation, (3) price dislocation, (4) moat durability, (5) decline reason. Insider buying is a bonus signal, not a gate.',
    full_signal_criteria: 'All 4 gates pass AND total ≥ 95 AND decline reason ≠ FUNDAMENTAL_CONCERN',
    partial_signal_criteria: 'All 4 gates pass AND total ≥ 65',
    hard_rejects: 'Revenue declining >5% YoY | Within 8% of 52wH | No market data',
    max_score: 155,
    score_breakdown: 'Quality 0-40 | Valuation 0-30 | Dislocation 0-30 | Moat 0-40 | Insider bonus 0-15',
  },
  summary: {
    total_evaluated:  results.length,
    full_signal:      full_signal.length,
    partial_signal:   partial_signal.length,
    watch:            watch.length,
    rejected:         rejected.length,
  },
  full_signal_candidates:    full_signal,
  partial_signal_candidates: partial_signal,
  watch_candidates:          watch,
  coverage_gaps:             [],
  active_themes:             [...ALWAYS_ON],
};

write('outputs/universe-scanner.json', output);

// Console summary
console.log('\nUniverse Scanner v2 — Five-Gate Results');
console.log('═'.repeat(90));
console.log('FULL SIGNAL (conviction candidates):');
for (const r of full_signal) {
  console.log(`  ${r.ticker.padEnd(6)} score=${r.total_score.toString().padStart(3)}  Q=${r.gate_scores.quality} V=${r.gate_scores.valuation} D=${r.gate_scores.dislocation} M=${r.gate_scores.moat} I=${r.gate_scores.insider_bonus}  decline=${r.decline_reason.reason}  rev=${r.revenue_growth_pct ?? '?'}%  gm=${r.gross_margin_pct ?? '?'}%  P/S=${r.ps ?? '?'}  pct52wH=${r.pct_from_52w_high}%`);
}
console.log('\nPARTIAL SIGNAL (watchlist):');
for (const r of partial_signal) {
  console.log(`  ${r.ticker.padEnd(6)} score=${r.total_score.toString().padStart(3)}  Q=${r.gate_scores.quality} V=${r.gate_scores.valuation} D=${r.gate_scores.dislocation} M=${r.gate_scores.moat} I=${r.gate_scores.insider_bonus}  decline=${r.decline_reason.reason}  rev=${r.revenue_growth_pct ?? '?'}%  gm=${r.gross_margin_pct ?? '?'}%  P/S=${r.ps ?? '?'}`);
}
console.log('\nWATCH:');
for (const r of watch) {
  console.log(`  ${r.ticker.padEnd(6)} score=${r.total_score.toString().padStart(3)}  decline=${r.decline_reason.reason}  rev=${r.revenue_growth_pct ?? '?'}%  pct52wH=${r.pct_from_52w_high}%`);
}
console.log('\nREJECTED:');
for (const r of rejected) {
  const reason = r.reject_reason ?? r.decline_reason?.reason;
  console.log(`  ${r.ticker.padEnd(6)} reason=${reason}`);
}
console.log('═'.repeat(90));
console.log(`Wrote outputs/universe-scanner.json — ${full_signal.length} full signal, ${partial_signal.length} partial, ${watch.length} watch, ${rejected.length} rejected`);
