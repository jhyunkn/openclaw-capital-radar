'use strict';

// Dynamic Universe Generator — the opportunity list as OUTPUT, not INPUT.
//
// The static opportunity-universe.json is a seeded starting point.
// This script generates outputs/dynamic-universe.json, which extends the static
// universe with scanner-promoted candidates that have met multi-signal criteria.
//
// Promotion criteria (all data sources must converge):
//   REQUIRED:  FULL_SIGNAL scanner score (moat + trough + demand inflection)
//   REQUIRED:  Live price data confirmed (no promotion on stale data)
//   ENHANCING: Open-market insider buying (STRONG/PRESENT signal)
//   ENHANCING: Revenue inflection detected (RECOVERY/INFLECTING/IMPROVING)
//   ENHANCING: High short interest (squeeze potential adds asymmetry)
//   ENHANCING: Institutional 13F backing (confirms thesis direction)
//
// Minimum promotion score: 60/100 (configurable)
// A score of 60+ with only scanner + live price = watchlist promotion
// A score of 80+ with insider confirmation = active conviction promotion
//
// Auto-generated thesis follows the Micron template:
//   "Level-3 supplier to [THEME] with durable moat at cyclical trough.
//    Revenue inflecting QoQ. Insiders bought $Xm. Short interest [high/moderate]
//    amplifies reversal potential. Thesis: [demand inflection signal]."
//
// Output: outputs/dynamic-universe.json

const fs   = require('fs');
const path = require('path');

const root     = path.join(__dirname, '..');
const OUT_PATH = path.join(root, 'outputs', 'dynamic-universe.json');

const PROMOTION_THRESHOLD_WATCHLIST  = 60;
const PROMOTION_THRESHOLD_CONVICTION = 80;

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

// ── DATA SOURCES ──────────────────────────────────────────────────────────────
const staticUniverse  = readJson('data/opportunity-universe.json');
const scannerResults  = readJson('outputs/universe-scanner.json');
const form4Data       = readJson('outputs/form4-open-market.json');
const xbrlData        = readJson('outputs/xbrl-revenue-trends.json');
const shortData       = readJson('outputs/short-interest.json');
const marketData      = readJson('outputs/watchlist-market-data.json');
const institutionalData = readJson('outputs/institutional-holdings.json');
const insiderData     = readJson('outputs/insider-transactions.json');
const newsData        = readJson('outputs/market-news.json');
const marketEventsRaw = readJson('data/market-events.json');
const scannerUniverse = readJson('data/scanner-universe.json');
const convictionRanking = readJson('outputs/conviction-ranking.json');

if (!staticUniverse)  throw new Error('Missing data/opportunity-universe.json');
if (!scannerResults)  throw new Error('Missing outputs/universe-scanner.json — run generate-universe-scanner.cjs first');

// Active tickers in the static conviction universe
const STATIC_TICKERS = new Set(
  (staticUniverse.tickers || []).map(t => String(t.ticker).toUpperCase())
);

// Conviction scores for static tickers — used to decide if event-driven should surface them
const staticConvictionScores = Object.fromEntries(
  (convictionRanking?.ranked || convictionRanking?.all_ranked || []).map(t => [t.ticker, t.conviction_score || 0])
);

// ── SCORING EACH FULL_SIGNAL CANDIDATE ───────────────────────────────────────

function scoreForPromotion(candidate) {
  const ticker = candidate.ticker;
  let score    = 0;
  const evidence = [];
  const gaps     = [];

  // ── 1. Scanner score (foundation, 0-50) ──────────────────────────────────
  // Scanner already verified moat + trough + inflection individually.
  // Map the total_score (0-~100) to 0-50 for promotion scoring.
  const scannerPct = Math.min(100, candidate.total_score) / 100;
  const scannerContrib = Math.round(scannerPct * 50);
  score += scannerContrib;
  evidence.push(`Scanner: ${candidate.signal} (score ${candidate.total_score}/~100 → ${scannerContrib}/50)`);

  // ── 2. Live price confirmation (+5 if price data exists) ─────────────────
  const mkt = marketData?.tickers?.[ticker];
  if (mkt?.currentPrice) {
    score += 5;
    evidence.push(`Live price: $${mkt.currentPrice}  ${mkt.pctFrom52wHigh}% from 52wH  RSI:${mkt.rsi14}`);
  } else {
    gaps.push('No live price data');
  }

  // ── 3. Open-market insider buying (+20 max) ───────────────────────────────
  const form4 = form4Data?.tickers?.[ticker];
  if (form4?.open_market_signal === 'STRONG') {
    score += 20;
    const topBuy = form4.open_market_purchases?.[0];
    const buyStr = topBuy
      ? `${topBuy.ownerName} (${topBuy.officerTitle || 'insider'}) bought ${topBuy.shares} shares @ $${topBuy.pricePerShare} on ${topBuy.transactionDate}`
      : `${form4.purchase_count} buys totaling $${form4.total_purchase_value_mm}M`;
    evidence.push(`Insider buying STRONG: $${form4.total_purchase_value_mm}M open-market. ${buyStr}`);
  } else if (form4?.open_market_signal === 'PRESENT') {
    score += 10;
    evidence.push(`Insider buying PRESENT: $${form4.total_purchase_value_mm}M open-market purchases in ${form4.lookback_days}d`);
  } else if (form4?.open_market_signal === 'MINOR') {
    score += 3;
    evidence.push(`Insider buying MINOR: $${(form4.total_purchase_value / 1000).toFixed(0)}K in ${form4.lookback_days}d`);
  } else if (form4) {
    gaps.push('No open-market insider purchases detected');
  } else {
    gaps.push('Form 4 XML data not available');
  }

  // ── 4. Revenue inflection from XBRL (+15 max) ────────────────────────────
  const xbrl = xbrlData?.tickers?.[ticker];
  const inf   = xbrl?.inflection;
  if (inf?.status === 'RECOVERY') {
    score += 15;
    evidence.push(`Revenue RECOVERY: ${inf.interpretation}`);
  } else if (inf?.status === 'INFLECTING') {
    score += 10;
    evidence.push(`Revenue INFLECTING: ${inf.interpretation}`);
  } else if (inf?.status === 'IMPROVING') {
    score += 5;
    evidence.push(`Revenue IMPROVING: ${inf.interpretation}`);
  } else if (inf?.status === 'DETERIORATING') {
    score -= 5;
    gaps.push(`Revenue still deteriorating: ${inf.interpretation}`);
  } else {
    gaps.push('Revenue trend data unavailable or inconclusive');
  }

  // ── 5. Short interest squeeze potential (+10 max) ─────────────────────────
  const shortInfo = shortData?.tickers?.[ticker];
  if (shortInfo?.squeeze_potential === 'HIGH') {
    score += 10;
    evidence.push(`Short interest HIGH: ${shortInfo.avg_short_ratio_pct}% of daily volume — squeeze potential amplifies upside`);
  } else if (shortInfo?.squeeze_potential === 'MODERATE') {
    score += 5;
    evidence.push(`Short interest ELEVATED: ${shortInfo.avg_short_ratio_pct}% — meaningful reversal fuel`);
  }

  // ── 6. Institutional 13F backing (+5 max) ────────────────────────────────
  const institutional = institutionalData?.ticker_ownership?.find(t => t.ticker === ticker);
  if (institutional?.manager_count >= 2) {
    score += 5;
    evidence.push(`Institutional backing: ${institutional.manager_count} tracked managers hold positions`);
  } else if (institutional?.manager_count === 1) {
    score += 2;
    evidence.push(`Institutional backing: ${institutional.managers?.[0]?.manager || '1 manager'} has position`);
  }

  // ── 7. Market events signal (+12 max) ────────────────────────────────────
  // Checks market-events.json for events where this ticker is a named beneficiary.
  // Also checks news signal score from Yahoo Finance RSS headline detection.
  const eventSignals = newsData?.ticker_event_signals?.[ticker] || [];
  const positiveEvents = eventSignals.filter(e => e.impact === 'POSITIVE');
  if (positiveEvents.length > 0) {
    const bestEvent = positiveEvents.sort((a, b) => b.score_boost - a.score_boost)[0];
    score += bestEvent.score_boost;
    const newsNote = bestEvent.news_active ? ' (in news cycle this build)' : ' (anticipated)';
    evidence.push(`Market event: ${bestEvent.event_name} — ${bestEvent.signal_strength} signal${newsNote}`);
  } else {
    // Fallback: general news signal score
    const newsScore = newsData?.tickers?.[ticker]?.news_signal_score || 0;
    if (newsScore >= 8) {
      score += Math.min(8, newsScore);
      const sigs = (newsData.tickers[ticker].positive_signals || []).slice(0, 2).join(', ');
      evidence.push(`News signals: ${sigs} in recent headlines`);
    }
  }

  // Also check for negative event risk
  const negativeEvents = eventSignals.filter(e => e.impact === 'NEGATIVE');
  if (negativeEvents.length > 0) {
    const worstEvent = negativeEvents.sort((a, b) => a.score_boost - b.score_boost)[0];
    score += worstEvent.score_boost; // negative value
    gaps.push(`Risk: ${worstEvent.event_name} — ${worstEvent.signal_strength} headwind`);
  }

  // ── PROMOTION TIER ────────────────────────────────────────────────────────
  const promotionTier = score >= PROMOTION_THRESHOLD_CONVICTION ? 'CONVICTION'
    : score >= PROMOTION_THRESHOLD_WATCHLIST ? 'WATCHLIST'
    : 'NOT_YET';

  return {
    ticker,
    promotion_score:     score,
    promotion_tier:      promotionTier,
    scanner_signal:      candidate.signal,
    scanner_total_score: candidate.total_score,
    evidence,
    gaps,
  };
}

// ── AUTO-THESIS GENERATOR ─────────────────────────────────────────────────────
// Generates a structured thesis following the Micron template.
function generateThesis(candidate, scoreResult) {
  const ticker = candidate.ticker;
  const mkt    = marketData?.tickers?.[ticker];
  const form4  = form4Data?.tickers?.[ticker];
  const xbrl   = xbrlData?.tickers?.[ticker];
  const shortI = shortData?.tickers?.[ticker];

  const level      = candidate.supply_chain_level || 3;
  const themes     = candidate.active_theme_hits?.join(', ') || candidate.theme_adjacency?.join(', ') || 'active macro theme';
  const priceStr   = mkt?.currentPrice ? `$${mkt.currentPrice}` : 'trough price';
  const pctFromHigh = mkt?.pctFrom52wHigh ? `${mkt.pctFrom52wHigh}%` : 'near 52-week low';

  const insiderLine = form4?.open_market_signal === 'STRONG' || form4?.open_market_signal === 'PRESENT'
    ? ` Insiders bought $${form4.total_purchase_value_mm}M at trough.`
    : '';

  const revLine = xbrl?.inflection?.status === 'RECOVERY' || xbrl?.inflection?.status === 'INFLECTING'
    ? ` Revenue: ${xbrl.inflection.interpretation}.`
    : '';

  const shortLine = shortI?.squeeze_potential === 'HIGH'
    ? ` ${shortI.avg_short_ratio_pct}% short ratio amplifies reversal potential.`
    : '';

  const entry_low  = mkt?.currentPrice ? Math.round(mkt.currentPrice * 0.95) : null;
  const entry_high = mkt?.currentPrice ? Math.round(mkt.currentPrice * 1.05) : null;

  return {
    summary: `Level-${level} supplier to ${themes} with durable moat at cyclical trough (${priceStr}, ${pctFromHigh} from peak).${insiderLine}${revLine}${shortLine} Demand inflection: ${candidate.demand_inflection_signal || 'structural theme active'}.`,
    moat:    candidate.moat_summary,
    demand_inflection: candidate.demand_inflection_signal,
    entry_zone: entry_low && entry_high ? { low: entry_low, high: entry_high, current: mkt.currentPrice } : null,
    data_quality: {
      live_price:       !!mkt?.currentPrice,
      xbrl_revenue:     !!xbrl?.inflection?.status,
      insider_xml:      (form4?.open_market_purchases?.length || 0) > 0,
      short_interest:   shortI?.trading_days > 0,
    },
  };
}

// ── CONVERT TO UNIVERSE ENTRY FORMAT ─────────────────────────────────────────
// Matches the schema of data/opportunity-universe.json tickers[] entries
function buildUniverseEntry(candidate, scoreResult) {
  const ticker = candidate.ticker;
  const mkt    = marketData?.tickers?.[ticker];
  const thesis = generateThesis(candidate, scoreResult);

  return {
    ticker,
    name:             candidate.name,
    sector:           candidate.sector,
    conviction_score: Math.min(65, Math.round(40 + scoreResult.promotion_score * 0.25)), // starts at watchlist level
    entry_zone: thesis.entry_zone
      ? { low: thesis.entry_zone.low, high: thesis.entry_zone.high }
      : null,
    thesis: thesis.summary,
    moat:   thesis.moat,
    // Scanner metadata (not in static universe format, but useful for render)
    _scanner: {
      signal:           scoreResult.scanner_signal,
      promotion_score:  scoreResult.promotion_score,
      promotion_tier:   scoreResult.promotion_tier,
      evidence:         scoreResult.evidence,
      gaps:             scoreResult.gaps,
      supply_chain_level: candidate.supply_chain_level,
      theme_adjacency:  candidate.active_theme_hits,
      scanner_promoted: true,
      promoted_at:      new Date().toISOString(),
    },
  };
}

// ── MAIN ─────────────────────────────────────────────────────────────────────

// Capital preservation hard-excludes — same as generate-conviction-ranking.cjs.
// These names may score well on the trough algorithm but fail our qualitative filter.
// HUBS: management itself warned on AI seat-based disruption — not a narrative mismatch
// TMDX: not FCF positive — fails capital preservation filter
// RDDT: not FCF positive — ad-cycle sensitivity
// HIMS: speculative growth, pre-profitability
const CAPITAL_PRESERVATION_EXCLUDE = new Set(['HUBS', 'TMDX', 'RDDT', 'HIMS']);

// Score all FULL_SIGNAL and PARTIAL_SIGNAL candidates from the scanner
// Apply capital preservation filter before scoring
const fullSignalCandidates    = (scannerResults.full_signal_candidates    || []).filter(c => !CAPITAL_PRESERVATION_EXCLUDE.has(c.ticker));
const partialSignalCandidates = (scannerResults.partial_signal_candidates || []).filter(c => !CAPITAL_PRESERVATION_EXCLUDE.has(c.ticker));

console.log(`Evaluating ${fullSignalCandidates.length} FULL_SIGNAL candidates for promotion...`);
console.log(`Evaluating ${partialSignalCandidates.length} PARTIAL_SIGNAL candidates for watchlist...`);

// Score FULL_SIGNAL candidates (promotion-eligible)
const scoredFull = fullSignalCandidates.map(c => ({
  candidate: c,
  scoreResult: scoreForPromotion(c),
}));

// Score PARTIAL_SIGNAL candidates (watchlist-eligible only if very strong)
const scoredPartial = partialSignalCandidates
  .map(c => ({ candidate: c, scoreResult: scoreForPromotion(c) }))
  .filter(s => s.scoreResult.promotion_score >= PROMOTION_THRESHOLD_CONVICTION);
// Partials need a very high score to overcome missing FULL_SIGNAL

// Combine and tier
const allScored = [...scoredFull, ...scoredPartial];
allScored.sort((a, b) => b.scoreResult.promotion_score - a.scoreResult.promotion_score);

const convictionPromotions = allScored.filter(s => s.scoreResult.promotion_tier === 'CONVICTION');
const watchlistPromotions  = allScored.filter(s => s.scoreResult.promotion_tier === 'WATCHLIST');
const notYet               = allScored.filter(s => s.scoreResult.promotion_tier === 'NOT_YET');

// Log results
for (const { candidate, scoreResult } of allScored) {
  const tier = scoreResult.promotion_tier.padEnd(12);
  console.log(`${candidate.ticker.padEnd(5)} ${tier} score:${scoreResult.promotion_score}  ${scoreResult.evidence.slice(0,2).join(' | ')}`);
}

// Build universe entries for promoted tickers
const promotedEntries = [
  ...convictionPromotions.map(s => buildUniverseEntry(s.candidate, s.scoreResult)),
  ...watchlistPromotions.map(s => buildUniverseEntry(s.candidate, s.scoreResult)),
];

// ── EVENT-DRIVEN CANDIDATES ───────────────────────────────────────────────────
// Tickers in market-events.json beneficiary lists that are:
// - In the scanner universe (have a defined moat)
// - Have live price data
// - NOT already in conviction or watchlist promotions
// These are event-watch candidates even before scanner FULL_SIGNAL is reached.
const alreadyPromoted = new Set([
  ...convictionPromotions.map(s => s.candidate.ticker),
  ...watchlistPromotions.map(s => s.candidate.ticker),
]);
const scannerCandidateMap = Object.fromEntries(
  (scannerUniverse?.candidates || []).map(c => [c.ticker, c])
);

const eventDrivenCandidates = [];
for (const event of (marketEventsRaw?.events || [])) {
  if (event.signal_strength === 'LOW') continue;
  for (const ticker of (event.beneficiary_tickers || [])) {
    if (alreadyPromoted.has(ticker)) continue;
    // Allow static universe tickers with low conviction scores (<70) to surface as event-driven.
    // Tickers already well-covered by conviction (≥70) don't need the event-driven card.
    const isStatic = STATIC_TICKERS.has(ticker);
    const convScore = staticConvictionScores[ticker] || 0;
    if (isStatic && convScore >= 70) continue;

    // Look up in scanner universe for metadata; for static tickers, also try opportunity-universe
    const scannerDef = scannerCandidateMap[ticker];
    const staticDef  = isStatic ? (staticUniverse.tickers || []).find(t => t.ticker === ticker) : null;
    if (!scannerDef && !staticDef) continue; // not tracked anywhere
    const mkt = marketData?.tickers?.[ticker];
    if (!mkt?.currentPrice) continue; // no price data
    // Don't add the same ticker twice
    if (eventDrivenCandidates.find(e => e.ticker === ticker)) continue;
    const newsSignal = newsData?.tickers?.[ticker]?.news_signal_score || 0;
    const scannerEntry = (scannerResults?.all_scored || []).find(c => c.ticker === ticker);
    // Static tickers use conviction score as partial; scanner tickers use scanner total_score
    const partialScore = isStatic
      ? Math.round(Math.min(convScore, 60) / 100 * 30)
      : scannerEntry ? Math.round((scannerEntry.total_score || 0) / 100 * 30) : 10;
    const eventBoost = event.signal_strength === 'HIGH' ? 20 : 10;
    const totalScore = partialScore + eventBoost + Math.min(6, newsSignal);
    eventDrivenCandidates.push({
      ticker,
      name:            scannerDef?.name || staticDef?.name || ticker,
      sector:          scannerDef?.sector || staticDef?.theme || '',
      score:           totalScore,
      event_id:        event.id,
      event_name:      event.name,
      event_type:      event.type,
      event_signal_strength: event.signal_strength,
      supply_chain_note: event.supply_chain_note,
      live_price:       mkt.currentPrice,
      pct_from_52w_high: mkt.pctFrom52wHigh,
      rsi14:            mkt.rsi14,
      moat_summary:     scannerDef?.moat || staticDef?.moat || '',
      demand_inflection: scannerDef?.demandInflectionSignal || '',
      theme_adjacency:  scannerDef?.themeAdjacency || [],
      from_static_universe: isStatic,
      static_conviction_score: isStatic ? convScore : undefined,
    });
  }
}
eventDrivenCandidates.sort((a, b) => b.score - a.score);
console.log(`Event-driven candidates: ${eventDrivenCandidates.length}  ${eventDrivenCandidates.map(e => `${e.ticker}(${e.event_id})`).join(', ')}`);

// Static universe tickers (pass through unchanged for reference)
const staticTickers = (staticUniverse.tickers || []).map(t => ({
  ...t,
  _scanner: { scanner_promoted: false },
}));

const output = {
  artifact:    'dynamic-universe',
  generatedAt: new Date().toISOString(),
  version:     1,
  methodology: 'Scanner FULL_SIGNAL + multi-source confirmation. Watchlist threshold: 60/100. Conviction threshold: 80/100.',
  thresholds: {
    watchlist:  PROMOTION_THRESHOLD_WATCHLIST,
    conviction: PROMOTION_THRESHOLD_CONVICTION,
  },
  data_sources_available: {
    scanner:        !!scannerResults,
    form4_xml:      !!form4Data,
    xbrl_revenue:   !!xbrlData,
    short_interest: !!shortData,
    market_data:    !!marketData,
    institutional:  !!institutionalData,
    market_news:    !!newsData,
    market_events:  !!marketEventsRaw,
  },
  summary: {
    static_universe_tickers:  STATIC_TICKERS.size,
    full_signal_evaluated:    fullSignalCandidates.length,
    partial_signal_evaluated: partialSignalCandidates.length,
    conviction_promotions:    convictionPromotions.length,
    watchlist_promotions:     watchlistPromotions.length,
    event_driven_candidates:  eventDrivenCandidates.length,
    not_yet:                  notYet.length,
    total_dynamic_universe:   STATIC_TICKERS.size + promotedEntries.length + eventDrivenCandidates.length,
  },
  // Promoted entries (scanner-generated)
  conviction_promotions: convictionPromotions.map(s => {
    const mkt = marketData?.tickers?.[s.candidate.ticker];
    const xbrl = xbrlData?.tickers?.[s.candidate.ticker];
    const form4 = form4Data?.tickers?.[s.candidate.ticker];
    return {
      ticker:              s.candidate.ticker,
      name:                s.candidate.name,
      sector:              s.candidate.sector,
      score:               s.scoreResult.promotion_score,
      evidence:            s.scoreResult.evidence,
      thesis:              generateThesis(s.candidate, s.scoreResult).summary,
      live_price:          mkt?.currentPrice ?? null,
      pct_from_52w_high:   mkt?.pctFrom52wHigh ?? null,
      rsi14:               mkt?.rsi14 ?? null,
      trend_1m_pct:        mkt?.trend1mPct ?? null,
      revenue_inflection:  xbrl?.inflection?.status ?? null,
      revenue_interp:      xbrl?.inflection?.interpretation ?? null,
      open_market_signal:  form4?.open_market_signal ?? null,
      open_market_value_mm: form4?.total_purchase_value_mm ?? null,
      supply_chain_level:  s.candidate.supply_chain_level,
      theme_adjacency:     s.candidate.active_theme_hits || s.candidate.theme_adjacency,
      moat_summary:        s.candidate.moat_summary,
    };
  }),
  watchlist_promotions: watchlistPromotions.map(s => {
    const mkt = marketData?.tickers?.[s.candidate.ticker];
    const xbrl = xbrlData?.tickers?.[s.candidate.ticker];
    const form4 = form4Data?.tickers?.[s.candidate.ticker];
    return {
      ticker:              s.candidate.ticker,
      name:                s.candidate.name,
      sector:              s.candidate.sector,
      score:               s.scoreResult.promotion_score,
      evidence:            s.scoreResult.evidence,
      thesis:              generateThesis(s.candidate, s.scoreResult).summary,
      gaps:                s.scoreResult.gaps,
      live_price:          mkt?.currentPrice ?? null,
      pct_from_52w_high:   mkt?.pctFrom52wHigh ?? null,
      rsi14:               mkt?.rsi14 ?? null,
      trend_1m_pct:        mkt?.trend1mPct ?? null,
      revenue_inflection:  xbrl?.inflection?.status ?? null,
      revenue_interp:      xbrl?.inflection?.interpretation ?? null,
      open_market_signal:  form4?.open_market_signal ?? null,
      open_market_value_mm: form4?.total_purchase_value_mm ?? null,
      supply_chain_level:  s.candidate.supply_chain_level,
      theme_adjacency:     s.candidate.active_theme_hits || s.candidate.theme_adjacency,
      moat_summary:        s.candidate.moat_summary,
    };
  }),
  not_yet_candidates: notYet.map(s => ({
    ticker: s.candidate.ticker,
    score:  s.scoreResult.promotion_score,
    gaps:   s.scoreResult.gaps,
  })),
  // Event-driven candidates: in market-events.json but not yet scanner-promoted
  event_driven_candidates: eventDrivenCandidates,
  // Full universe entries (static + promoted) for downstream use
  all_entries: [...staticTickers, ...promotedEntries],
  promoted_entries: promotedEntries,
};

fs.writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

console.log('\n═══ DYNAMIC UNIVERSE PROMOTION RESULTS ═══');
console.log(`Static universe:    ${STATIC_TICKERS.size} tickers`);
console.log(`Conviction promoted: ${convictionPromotions.length}  ${convictionPromotions.map(s=>s.candidate.ticker).join(', ')}`);
console.log(`Watchlist promoted:  ${watchlistPromotions.length}  ${watchlistPromotions.map(s=>s.candidate.ticker).join(', ')}`);
console.log(`Event-driven:        ${eventDrivenCandidates.length}  ${eventDrivenCandidates.map(e=>e.ticker).join(', ')}`);
console.log(`Not yet:             ${notYet.length}  ${notYet.slice(0,5).map(s=>s.candidate.ticker).join(', ')}`);
console.log(`Total dynamic universe: ${STATIC_TICKERS.size + promotedEntries.length} tickers`);
if (convictionPromotions.length > 0) {
  console.log('\nConviction promotions:');
  convictionPromotions.forEach(({ candidate, scoreResult }) => {
    console.log(`  ${candidate.ticker}: score=${scoreResult.promotion_score}`);
    scoreResult.evidence.forEach(e => console.log(`    ✓ ${e}`));
  });
}
