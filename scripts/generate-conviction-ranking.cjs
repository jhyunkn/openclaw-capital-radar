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
const universe      = readJson('data/opportunity-universe.json');
const macro         = readJson('outputs/market-orientation-map.json');
const candidateRank = readJson('outputs/candidate-ranking.json');
const reportState   = readJson('data/report-state.live.json');

if (!universe) throw new Error('Missing data/opportunity-universe.json');
if (!macro)    throw new Error('Missing outputs/market-orientation-map.json');

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

const output = {
  artifact: 'conviction-ranking',
  generated_at: new Date().toISOString(),
  version: 3,
  data_sources: [
    'data/opportunity-universe.json',
    'outputs/market-orientation-map.json',
    'outputs/candidate-ranking.json',
    'data/report-state.live.json',
  ],
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
