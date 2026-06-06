'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

// ── DATA SOURCES ──────────────────────────────────────────────────────────────
const universe        = readJson('data/opportunity-universe.json');
const macro           = readJson('outputs/market-orientation-map.json');
const candidateRank   = readJson('outputs/candidate-ranking.json');
const reportState     = readJson('data/report-state.live.json');
const watchlistData   = readJson('outputs/watchlist-market-data.json');  // live prices
const insiderData     = readJson('outputs/insider-transactions.json');    // SEC Form 4
const scannerResults  = readJson('outputs/universe-scanner.json');        // moat-at-trough candidates
const dynamicUniverse = readJson('outputs/dynamic-universe.json');        // auto-promoted candidates

if (!universe) throw new Error('Missing data/opportunity-universe.json');
if (!macro)    throw new Error('Missing outputs/market-orientation-map.json');

// Live price lookup helper — falls back to null if market data unavailable
function livePrice(ticker) {
  return watchlistData?.tickers?.[String(ticker).toUpperCase()]?.currentPrice ?? null;
}
function liveMarket(ticker) {
  return watchlistData?.tickers?.[String(ticker).toUpperCase()] ?? null;
}
function insiderSignal(ticker) {
  return insiderData?.tickers?.[String(ticker).toUpperCase()] ?? null;
}

// ── ENTRY ZONE DATA ───────────────────────────────────────────────────────────
// Entry zone = price range where the thesis becomes attractive without requiring
// continued momentum. Derived from: forward P/E at trough multiples, analyst
// targets discounted for margin of safety, or pullback % from fair value.
// currentEst = approximate price as of last data refresh (not live — label as est).
// status: "in_zone" / "above_zone" (wait) / "below_zone" (too cheap — verify thesis)
const ENTRY_DATA = {
  TSM:  { low: 160, high: 178, currentEst: 195,  target: 240,  rationale: '17-18x fwd EPS ~$10 — trough multiple with geopolitical discount; entry on further pullback' },
  ASML: { low: 620, high: 665, currentEst: 740,  target: 900,  rationale: '25-27x FY2026 EPS ~$24 — below historical average for EUV monopoly; patient entry' },
  AVGO: { low: 195, high: 215, currentEst: 234,  target: 285,  rationale: '30-32x FY2026 non-GAAP EPS ~$6.60 — post-earnings dip approaching zone' },
  APP:  { low: 285, high: 315, currentEst: 355,  target: 450,  rationale: '50x FY2026 EPS ~$5.75 — growth premium justified at 70%+ growth; wait for pullback' },
  NVDA: { low: 112, high: 130, currentEst: 128,  target: 175,  rationale: '27x FY2027 EPS ~$4.75 — pullback to ~$128 puts it at the top of entry zone; thesis intact' },
  AMAT: { low: 155, high: 172, currentEst: 178,  target: 225,  rationale: '18-20x FY2026 EPS ~$8.80 — reasonable for equipment duopoly + onshoring tailwind; near zone' },
  VRT:  { low:  82, high:  94, currentEst: 105,  target: 135,  rationale: '27-30x forward EPS — data center cooling premium; above zone, wait for pullback' },
  NXT:  { low:  32, high:  38, currentEst:  41,  target:  58,  rationale: '-13% dislocation active; entry zone is $32-38 — cause check needed before treating as buy' },
  VST:  { low: 135, high: 150, currentEst: 170,  target: 215,  rationale: '12-13x forward EPS — utility anchor for nuclear baseload; pullback creates entry' },
  NOW:  { low: 750, high: 805, currentEst: 920,  target: 1100, rationale: '36-39x FY2026 EPS ~$21 — premium for >98% retention; expensive, needs pullback' },
  GOOGL:{ low: 152, high: 168, currentEst: 185,  target: 218,  rationale: '18-20x FY2026 EPS ~$8.60 — quality compounder with AI optionality at discount' },
  ETN:  { low: 278, high: 308, currentEst: 342,  target: 395,  rationale: '24-26x forward EPS — infrastructure quality premium; near zone on pullback' },
  CCJ:  { low:  38, high:  44, currentEst:  44,  target:  62,  rationale: '-8.6% nuclear sector dislocation — touching top of entry zone; verify uranium demand thesis before adding' },
  PLTR: { low:  90, high: 108, currentEst: 125,  target: 150,  rationale: '65-75x forward EPS — very expensive; thesis requires continued acceleration' },
  DDOG: { low: 104, high: 118, currentEst: 135,  target: 168,  rationale: '55-65x FY2026 EPS ~$1.90 — expensive; needs pullback + AI observability confirmation' },
  PWR:  { low: 218, high: 242, currentEst: 265,  target: 308,  rationale: '22-24x forward EPS — grid construction backlog provides visibility; near zone' },
  RDDT: { low: 108, high: 125, currentEst: 148,  target: 185,  rationale: '50-55x 2026 FCF — data licensing premium; wait for pullback to entry' },
  GEV:  { low: 318, high: 348, currentEst: 388,  target: 455,  rationale: '30x forward EPS — grid hardware infrastructure premium; above zone currently' },
  TMDX: { low:  40, high:  48, currentEst:  55,  target:  78,  rationale: 'Q1 revenue miss — entry after Q2 volume recovery confirms thesis intact' },
  HIMS: { low:  16, high:  20, currentEst:  23,  target:  30,  rationale: 'Entry after GLP-1 regulatory clarity; pullback creates speculative zone' },
  RKLB: { low:  18, high:  23, currentEst:  28,  target:  42,  rationale: 'Pre-profit; entry only on Neutron development progress + cadence confirmation' },
  IBIT: { low:  48, high:  54, currentEst:  58,  target:  80,  rationale: 'Follows BTC spot; entry zone linked to BTC $85-95k accumulation range' },
  OKLO: { low:  25, high:  33, currentEst:  44,  target:  70,  rationale: 'Pre-commercial; entry only on NRC Aurora license progress; speculative only' },
};

function entryStatus(entry, ticker) {
  if (!entry) return 'unknown';
  // Prefer live price; fall back to static estimate
  const live = livePrice(ticker);
  const cur  = live ?? entry.currentEst;
  if (cur <= entry.low)  return 'in_zone_deep'; // below zone low — very attractive, verify thesis
  if (cur <= entry.high) return 'in_zone';
  return 'above_zone';
}

// ── TIMING CALENDAR ───────────────────────────────────────────────────────────
// Next known earnings / catalyst window per ticker (as of Jun 2026).
// Format: nextEarnings = calendar quarter label, catalyst = the thing to watch.
const TIMING = {
  TSM:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 AI chip demand + N2-node ramp update' },
  ASML: { nextEarnings: 'Jul 2026',  catalyst: 'EUV order book + 2027 High-NA rollout update' },
  AVGO: { nextEarnings: 'Sep 2026',  catalyst: 'Q3 FY2026: custom ASIC pipeline + AI rev guide' },
  APP:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 AXON revenue + connected TV expansion' },
  NVDA: { nextEarnings: 'Aug 2026',  catalyst: 'Blackwell B200/GB200 ramp + Q2 data center rev' },
  AMAT: { nextEarnings: 'Aug 2026',  catalyst: 'Q3 FY2026 equipment orders + TSMC Arizona tooling' },
  VRT:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 data center cooling order rate + margins' },
  NXT:  { nextEarnings: 'Jul 2026',  catalyst: 'Q1 FY2027 tracker shipments + tariff impact' },
  VST:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 nuclear generation revenue + new PPA deals' },
  NOW:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 cRPO + AI workflow adoption rate' },
  GOOGL:{ nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 GCP growth + Search AI overview impact' },
  ETN:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 data center electrical order backlog' },
  CCJ:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 uranium delivery volumes + contract pricing' },
  PLTR: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 AIP commercial + US gov contract pipeline' },
  DDOG: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 AI observability ARR + net retention' },
  PWR:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 grid construction backlog + transmission wins' },
  RDDT: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 DAU + data licensing renewal pipeline' },
  GEV:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 gas turbine orders + wind margin recovery' },
  TMDX: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 OCS volume + Q1 revenue miss recovery read' },
  HIMS: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 compound GLP-1 regulatory + subscriber growth' },
  RKLB: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 Electron cadence + Neutron development update' },
  IBIT: { nextEarnings: null,        catalyst: 'Bitcoin price action + ETF net flow trajectory' },
  OKLO: { nextEarnings: 'Aug 2026',  catalyst: 'NRC Aurora demonstration license decision' },
};

// ── TIMING WINDOW ASSESSMENT ──────────────────────────────────────────────────
// Returns { status, note, window_score (1=wait 2=watch 3=active) }
// Sources: active_signal in universe, high_materiality_news in candidateRank,
// macro posture, and timing calendar proximity.
function assessTiming(ticker, item, existing) {
  // Active price dislocation = best entry window
  if (item.activeSignal) {
    return {
      status: 'Active entry window',
      note: item.activeSignal,
      window_score: 3,
    };
  }

  // Recent material negative news = wait for clarity
  const news = existing?.high_materiality_news;
  if (news && news.count > 0) {
    return {
      status: 'Recent catalyst — review first',
      note: `Recent: "${(news.latest || '').slice(0, 80)}". Verify thesis holds before sizing.`,
      window_score: 1,
    };
  }

  // Known positive catalyst within ~60 days
  const timing = TIMING[ticker];
  if (timing && timing.nextEarnings) {
    // All earnings are Jul–Aug 2026 from today (Jun 6 2026), 1-8 weeks out
    const isClose = timing.nextEarnings === 'Jul 2026'; // ~4-8 weeks
    if (isClose) {
      return {
        status: 'Earnings in Jul 2026 — build research now',
        note: `Watch: ${timing.catalyst}. Thesis confirmation or denial arrives this quarter.`,
        window_score: 2,
      };
    }
    return {
      status: `Earnings ${timing.nextEarnings}`,
      note: `Watch: ${timing.catalyst}. Use the wait time to complete evidence review.`,
      window_score: 2,
    };
  }

  // Default under HOLD/WATCH
  return {
    status: 'Research phase — no entry signal',
    note: 'Macro posture is HOLD/WATCH. Build evidence and monitor for dislocation or catalyst.',
    window_score: 1,
  };
}

// ── BASE SCORE NORMALIZATION ──────────────────────────────────────────────────
// Universe base scores span 39–85. Normalize to 30–75 so that macro + portfolio
// modifiers (max ~±20) produce spread across tiers without everyone capping at 98.
const UNIVERSE_BASE_MIN = 39;
const UNIVERSE_BASE_MAX = 85;
function normalizeBase(raw) {
  const c = Math.max(UNIVERSE_BASE_MIN, Math.min(UNIVERSE_BASE_MAX, raw));
  return 30 + Math.round((c - UNIVERSE_BASE_MIN) / (UNIVERSE_BASE_MAX - UNIVERSE_BASE_MIN) * 45);
}

// ── PORTFOLIO CONTEXT ─────────────────────────────────────────────────────────
// Current holdings: MSFT, AMZN, CEG, META, TSLT, CONL, SPY, MA, BMNR, TSNF, NFLX
const HELD_TICKERS = new Set(
  (reportState?.holdings || []).map(h => String(h.ticker || '').toUpperCase())
);

const PORTFOLIO_GAP_SCORE = {
  foundry_infrastructure:          10,
  semiconductor_equipment:         10,
  ai_advertising_platform:         10,
  ai_chip_networking:               8,
  ai_accelerator_core:              8,
  enterprise_ai_software:           7,
  ai_monitoring_infrastructure:     7,
  government_ai_software:           7,
  datacenter_cooling:               6,
  solar_grid_infrastructure:        6,
  power_infrastructure:             6,
  grid_hardware_infrastructure:     5,
  attention_data_asset:             5,
  medical_infrastructure:           5,
  nuclear_power_complement:         4,
  quality_platform_compounder:      4,
  grid_construction_labor:          4,
  space_launch_infrastructure:      4,
  consumer_health_platform:         3,
  uranium_fuel_supply:              3,
  bitcoin_spot_exposure:            0,
  speculative_nuclear_optionality: -3,
};

// ── MACRO ALIGNMENT ───────────────────────────────────────────────────────────
const MACRO_ALIGNMENT_SCORE = {
  infrastructure:       10,
  second_order_ai:       8,
  financial_rails:       6,
  non_correlated:        2,
  second_order_defense:  3,
  risk_beta:            -8,
  speculative:         -12,
};

function rateEnvAdj(forwardPE) {
  if (forwardPE == null) return -8;
  if (forwardPE > 75)    return -6;
  if (forwardPE > 50)    return -3;
  if (forwardPE <= 25)   return  4;
  return 0;
}

// ── BUILD SCORES ──────────────────────────────────────────────────────────────
const existingMap = {};
if (candidateRank) {
  (candidateRank.ranked || []).forEach(c => {
    existingMap[String(c.ticker).toUpperCase()] = c;
  });
}

const scored = universe.tickers.map(item => {
  const ticker = String(item.ticker).toUpperCase();
  const existing = existingMap[ticker];

  let score = normalizeBase(item.baseScore);
  const macroMod = MACRO_ALIGNMENT_SCORE[item.macroAlignment] ?? 0;
  const rateMod  = rateEnvAdj(item.forwardPE ?? null);
  const gapMod   = PORTFOLIO_GAP_SCORE[item.portfolioRole] ?? 0;
  score = Math.min(98, Math.max(0, Math.round(score + macroMod + rateMod + gapMod)));

  const timing = assessTiming(ticker, item, existing);

  const signals = [];
  if (existing?.fundamental_signals?.length) {
    signals.push(...existing.fundamental_signals.slice(0, 4));
  } else {
    if (item.revenueGrowthPct != null) signals.push(`rev +${item.revenueGrowthPct}%`);
    if (item.grossMarginPct != null)   signals.push(`GM ${item.grossMarginPct}%`);
    if (item.fcfPositive)              signals.push('FCF positive');
    if (item.forwardPE != null)        signals.push(`P/E ~${item.forwardPE}x`);
  }

  const macroReasons = [];
  if (macroMod > 0)  macroReasons.push(`Macro leanInto: ${item.macroAlignment.replace(/_/g, ' ')}`);
  if (macroMod < 0)  macroReasons.push(`Macro avoid: ${item.macroAlignment.replace(/_/g, ' ')}`);
  if (rateMod < 0)   macroReasons.push(`High-rate env penalizes P/E ${item.forwardPE ?? 'pre-rev'}x at 4.46% 10Y`);
  if (rateMod > 0)   macroReasons.push(`Reasonable valuation rewarded at 4.46% 10Y`);

  const gapReasons = [];
  if (gapMod >= 8)       gapReasons.push(`Major gap — no ${item.theme} in portfolio`);
  else if (gapMod >= 5)  gapReasons.push(`Gap — ${item.theme} not covered`);
  else if (gapMod >= 3)  gapReasons.push(`Partial gap — ${item.theme} adds diversification`);
  else if (gapMod < 0)   gapReasons.push(`Portfolio already covers this theme`);
  else                   gapReasons.push(`Low gap — portfolio partially covers ${item.theme}`);

  const timingEntry = TIMING[ticker] || {};

  return {
    ticker,
    name: item.name,
    theme: item.theme,
    conviction_score: score,
    normalized_base: normalizeBase(item.baseScore),
    macro_modifier: macroMod + rateMod,
    portfolio_gap_modifier: gapMod,
    fundamental_signals: signals,
    moat: item.moat || null,
    why_core: item.whyCore || null,
    risk_note: item.riskNote || null,
    timing_status: timing.status,
    timing_note: timing.note,
    window_score: timing.window_score,
    next_catalyst: timingEntry.catalyst || null,
    next_earnings: timingEntry.nextEarnings || null,
    entry: (() => {
      const e = ENTRY_DATA[ticker];
      if (!e) return null;
      const live = livePrice(ticker);
      const mkt  = liveMarket(ticker);
      return {
        ...e,
        currentPrice: live ?? e.currentEst,          // live if available
        currentEst:   e.currentEst,                  // always keep the static estimate for reference
        priceSource:  live != null ? 'live' : 'est',
        pctFrom52wHigh: mkt?.pctFrom52wHigh ?? null,
        trend1mPct:     mkt?.trend1mPct ?? null,
        rsi14:          mkt?.rsi14 ?? null,
        status: entryStatus(e, ticker),
      };
    })(),
    insider_activity: (() => {
      const ins = insiderSignal(ticker);
      if (!ins) return null;
      return {
        signal:        ins.insider_signal,
        filings_90d:   ins.total_filings,
        note:          ins.signal_note,
        edgar_url:     ins.edgar_url,
        recent:        (ins.recent_filings || []).slice(0, 3),
      };
    })(),
    macro_alignment: item.macroAlignment,
    portfolio_role: item.portfolioRole,
    coverage_gap: item.coverageGap === true,
    forward_pe: item.forwardPE ?? null,
    analyst_rating: item.analystRating || null,
    macro_reasons: macroReasons,
    portfolio_gap_reasons: gapReasons,
    action_permission: 'RESEARCH_ONLY_NO_BUY_PERMISSION',
  };
});

scored.sort((a, b) =>
  b.conviction_score - a.conviction_score || b.normalized_base - a.normalized_base
);

function tier(s) {
  if (s >= 90) return 'S';
  if (s >= 80) return 'A';
  if (s >= 70) return 'B';
  if (s >= 55) return 'C';
  return 'D';
}

const ranked = scored.map((item, i) => ({ rank: i + 1, conviction_tier: tier(item.conviction_score), ...item }));
const top10  = ranked.slice(0, 10);

const majorGaps = ranked
  .filter(r => r.portfolio_gap_modifier >= 8)
  .map(r => ({ ticker: r.ticker, name: r.name, theme: r.theme, gap_score: r.portfolio_gap_modifier }));

// ── PULLBACK CONTEXT ──────────────────────────────────────────────────────────
// Synthesize what is happening across portfolio + watchlist right now.
// This is the "briefing" the user needs before looking at any individual ticker.
function buildPullbackContext() {
  // Holdings affected — extract from market-orientation-map themes (trend1mPct)
  const holdingsMoves = [];
  if (macro.themes) {
    macro.themes.forEach(theme => {
      (theme.tickers || []).forEach(t => {
        if (t.trend1mPct != null && t.trend1mPct <= -5) {
          holdingsMoves.push({
            ticker: t.ticker,
            trend1mPct: t.trend1mPct,
            signal: t.signal || null,
            thesis: t.thesis || null,
            theme: theme.title,
          });
        }
      });
    });
  }
  holdingsMoves.sort((a, b) => a.trend1mPct - b.trend1mPct); // worst first

  // Watchlist dislocations — live price data first, fall back to seeded activeSignal
  const watchlistDislocations = universe.tickers
    .filter(t => {
      const mkt = liveMarket(t.ticker);
      if (mkt) return mkt.sharpDislocation || mkt.nearTrough || t.activeSignal;
      return !!t.activeSignal;
    })
    .map(t => {
      const mkt = liveMarket(t.ticker);
      return {
        ticker:     t.ticker,
        name:       t.name,
        theme:      t.theme,
        note:       t.activeSignal || null,
        livePrice:  mkt?.currentPrice ?? null,
        trend1mPct: mkt?.trend1mPct ?? null,
        pctFrom52wHigh: mkt?.pctFrom52wHigh ?? null,
        rsi14:      mkt?.rsi14 ?? null,
        priceSource: mkt ? 'live' : 'est',
      };
    });

  // SPY baseline for context
  const spyTrend = (macro.themes || [])
    .flatMap(t => t.tickers || [])
    .find(t => t.ticker === 'SPY')?.trend1mPct ?? null;

  const isThematicNotBroad = spyTrend != null && spyTrend > -3 && holdingsMoves.some(h => h.trend1mPct < -10);

  return {
    has_pullback: holdingsMoves.length > 0 || watchlistDislocations.length > 0,
    spy_trend_1m_pct: spyTrend,
    market_summary: isThematicNotBroad
      ? 'Thematic correction, not broad market failure. S&P 500 held roughly flat while AI/energy/nuclear names corrected -10% to -25%. This is sector rotation — the underlying thesis has not broken.'
      : 'Sector pullback across portfolio and watchlist. Monitor for thesis changes.',
    posture_on_pullback: 'HOLD / WATCH: do not panic, do not broad-buy the dip. Selectively investigate dislocated tickers where the thesis is provably intact. Every entry window requires cause verification before sizing.',
    holdings_affected: holdingsMoves,
    watchlist_dislocations: watchlistDislocations,
    data_note: 'Holdings price data from live Yahoo Finance feed. Watchlist dislocation flags seeded from last evidence refresh — verify current prices before treating any flag as actionable.',
    action_items: [
      'Watchlist dislocations (AVGO, NXT, CCJ): verify cause before treating as entry window',
      'Holdings drawdowns (CEG -21%, AMZN -10%): thesis intact per market orientation — no action required yet',
      'Do not add new positions until evidence review completes and posture shifts to ADD-ALLOWED',
    ],
  };
}

const pullbackContext = buildPullbackContext();

const output = {
  artifact: 'conviction-ranking',
  generated_at: new Date().toISOString(),
  version: 3,
  data_sources: [
    'data/opportunity-universe.json',
    'outputs/market-orientation-map.json',
    'outputs/candidate-ranking.json',
    'data/report-state.live.json',
    watchlistData    ? 'outputs/watchlist-market-data.json (live)'        : 'outputs/watchlist-market-data.json (not available)',
    dynamicUniverse  ? 'outputs/dynamic-universe.json (scanner promotions)' : null,
  ].filter(Boolean),
  dynamic_universe: dynamicUniverse ? {
    available: true,
    generatedAt: dynamicUniverse.generatedAt,
    conviction_promotions: dynamicUniverse.conviction_promotions || [],
    watchlist_promotions:  dynamicUniverse.watchlist_promotions  || [],
    summary: dynamicUniverse.summary,
  } : { available: false },
  live_price_coverage: watchlistData
    ? { available: true, ticker_count: watchlistData.tickerCount, as_of: watchlistData.generatedAt }
    : { available: false, note: 'Run fetch-watchlist-market-data.cjs to enable live prices' },
  methodology: {
    formula: 'conviction_score = normalizeBase(base) + macro_modifier + rate_env_adj + portfolio_gap_modifier. Cap 98.',
    timing: 'timing_status derived from active_signal (price dislocation), high_materiality_news (recent catalyst), and earnings calendar proximity. window_score: 3=active, 2=watch, 1=wait.',
    tiers: 'S ≥ 90 (exceptional fit), A 80–89 (high conviction), B 70–79 (watchlist), C 55–69 (monitor), D < 55',
  },
  macro_context: {
    posture: macro.macroWeather?.posture,
    ten_year_yield: macro.macroWeather?.tenYearYield,
    high_yield_oas: macro.macroWeather?.highYieldOAS,
    lean_into: macro.directionalThesis?.leanInto,
    avoid: macro.directionalThesis?.avoid,
    posture_note: 'HOLD / WATCH: Research and complete evidence. No new positions without dislocation entry or regime shift.',
  },
  portfolio_context: {
    held_tickers: [...HELD_TICKERS].sort(),
    major_gaps: majorGaps,
  },
  pullback_context: pullbackContext,
  summary: {
    total_universe: ranked.length,
    tier_s: ranked.filter(r => r.conviction_tier === 'S').length,
    tier_a: ranked.filter(r => r.conviction_tier === 'A').length,
    tier_b: ranked.filter(r => r.conviction_tier === 'B').length,
    tier_c: ranked.filter(r => r.conviction_tier === 'C').length,
    tier_d: ranked.filter(r => r.conviction_tier === 'D').length,
    new_tickers: ranked.filter(r => r.coverage_gap).length,
    active_windows: ranked.filter(r => r.window_score === 3).length,
    watch_windows: ranked.filter(r => r.window_score === 2).length,
  },
  top10,
  ranked,
};

const outPath = path.join(root, 'outputs', 'conviction-ranking.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

const summary = top10.map(t => `${t.rank}. ${t.ticker}(${t.conviction_score}/${t.conviction_tier})`).join('  ');
console.log(`conviction-ranking: ${ranked.length} tickers → top10: ${summary}`);
console.log(`Active windows: ${output.summary.active_windows}  Watch: ${output.summary.watch_windows}`);
