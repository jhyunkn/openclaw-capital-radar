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

// ── BASE SCORE NORMALIZATION ──────────────────────────────────────────────────
// Universe base scores span 39–85. Normalize to 30–75 so that macro + portfolio
// modifiers (max ~±20) can differentiate the top without everyone capping at 98.
// Formula: normalizedBase = 30 + round((base - 39) / 46 * 45)
const UNIVERSE_BASE_MIN = 39;
const UNIVERSE_BASE_MAX = 85;
const TARGET_MIN = 30;
const TARGET_RANGE = 45; // 30..75

function normalizeBase(rawBase) {
  const clamped = Math.max(UNIVERSE_BASE_MIN, Math.min(UNIVERSE_BASE_MAX, rawBase));
  return TARGET_MIN + Math.round((clamped - UNIVERSE_BASE_MIN) / (UNIVERSE_BASE_MAX - UNIVERSE_BASE_MIN) * TARGET_RANGE);
}

// ── PORTFOLIO CONTEXT ─────────────────────────────────────────────────────────
// Current holdings: MSFT, AMZN, CEG, META, TSLT, CONL, SPY, MA, BMNR, TSNF, NFLX
// Missing exposure themes drive the portfolio gap modifier below.
const HELD_TICKERS = new Set(
  (reportState?.holdings || []).map(h => String(h.ticker || '').toUpperCase())
);

// How large is the gap this ticker fills? (0–10)
const PORTFOLIO_GAP_SCORE = {
  foundry_infrastructure:          10, // TSM — zero foundry in portfolio
  semiconductor_equipment:         10, // ASML, AMAT — zero equipment
  ai_advertising_platform:         10, // APP — biggest gap vs. fund benchmarks
  ai_chip_networking:               8, // AVGO — custom ASIC / AI networking
  ai_accelerator_core:              8, // NVDA — center of AI stack
  enterprise_ai_software:           7, // NOW — MSFT partially covers
  ai_monitoring_infrastructure:     7, // DDOG — observability gap
  government_ai_software:           7, // PLTR — gov/defense AI, unique
  datacenter_cooling:               6, // VRT
  solar_grid_infrastructure:        6, // NXT
  power_infrastructure:             6, // ETN
  grid_hardware_infrastructure:     5, // GEV
  attention_data_asset:             5, // RDDT
  medical_infrastructure:           5, // TMDX — non-correlated
  nuclear_power_complement:         4, // VST — CEG exists but diversifies
  quality_platform_compounder:      4, // GOOGL — MSFT/AMZN partially covers
  grid_construction_labor:          4, // PWR
  space_launch_infrastructure:      4, // RKLB
  consumer_health_platform:         3, // HIMS
  uranium_fuel_supply:              3, // CCJ — nuclear already via CEG
  bitcoin_spot_exposure:            0, // IBIT — already overweight crypto
  speculative_nuclear_optionality: -3, // OKLO — CEG covers theme; spec risk
};

// ── MACRO ALIGNMENT MODIFIER ──────────────────────────────────────────────────
// From market-orientation-map.json:
//   leanInto: infrastructure, second-order AI, financial rails
//   avoid: crowded momentum, narrative speculation
// Posture: HOLD / WATCH. 10Y yield 4.46% — elevated.
const MACRO_ALIGNMENT_SCORE = {
  infrastructure:       10,
  second_order_ai:       8,
  financial_rails:       6,
  non_correlated:        2,
  second_order_defense:  3,
  risk_beta:            -8,
  speculative:         -12,
};

// Rate environment: 10Y @ 4.46% penalizes long-duration growth (high PE) names
function rateEnvAdj(forwardPE) {
  if (forwardPE == null)  return -8;  // Pre-revenue
  if (forwardPE > 75)     return -6;
  if (forwardPE > 50)     return -3;
  if (forwardPE <= 25)    return  4;
  return 0;
}

// ── BUILD CONVICTION SCORES ───────────────────────────────────────────────────
const existingMap = {};
if (candidateRank) {
  (candidateRank.ranked || []).forEach(c => {
    existingMap[String(c.ticker).toUpperCase()] = c;
  });
}

const scored = universe.tickers.map(item => {
  const ticker = String(item.ticker).toUpperCase();
  const existing = existingMap[ticker];

  // Normalized intrinsic quality base (30–75)
  let score = normalizeBase(item.baseScore);

  // Macro alignment modifier
  const macroMod = MACRO_ALIGNMENT_SCORE[item.macroAlignment] ?? 0;
  score += macroMod;

  // Rate environment adjustment
  const rateMod = rateEnvAdj(item.forwardPE ?? null);
  score += rateMod;

  // Portfolio gap modifier
  const gapMod = PORTFOLIO_GAP_SCORE[item.portfolioRole] ?? 0;
  score += gapMod;

  // Cap 98 (always some uncertainty; 100 reserved for certainty that doesn't exist)
  score = Math.min(98, Math.max(0, Math.round(score)));

  // Fundamental signal chips — use XBRL data where available, universe estimates otherwise
  const signals = [];
  if (existing?.fundamental_signals?.length) {
    signals.push(...existing.fundamental_signals.slice(0, 4));
  } else {
    if (item.revenueGrowthPct != null) signals.push(`rev +${item.revenueGrowthPct}%`);
    if (item.grossMarginPct != null)   signals.push(`GM ${item.grossMarginPct}%`);
    if (item.fcfPositive)              signals.push('FCF positive');
    if (item.forwardPE != null)        signals.push(`P/E ~${item.forwardPE}x`);
  }

  // Human-readable modifier explanations
  const macroReasons = [];
  if (macroMod > 0)  macroReasons.push(`Macro leanInto: ${item.macroAlignment.replace(/_/g, ' ')}`);
  if (macroMod < 0)  macroReasons.push(`Macro avoid: ${item.macroAlignment.replace(/_/g, ' ')}`);
  if (rateMod < 0)   macroReasons.push(`High-rate env penalizes valuation (P/E ${item.forwardPE ?? 'pre-revenue'}x at 4.46% 10Y)`);
  if (rateMod > 0)   macroReasons.push(`Reasonable valuation rewarded at 4.46% 10Y yield`);

  const gapReasons = [];
  if (gapMod >= 8)        gapReasons.push(`Major gap — no ${item.theme} in portfolio`);
  else if (gapMod >= 5)   gapReasons.push(`Gap — ${item.theme} not covered`);
  else if (gapMod >= 3)   gapReasons.push(`Partial gap — ${item.theme} adds diversification`);
  else if (gapMod <= -3)  gapReasons.push(`Portfolio already covers this theme — limited incremental value`);
  else                    gapReasons.push(`Low gap — portfolio partially covers ${item.theme}`);

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
    active_signal: item.activeSignal || null,
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

// Sort: conviction_score desc, normalized_base as tiebreaker
scored.sort((a, b) =>
  b.conviction_score - a.conviction_score ||
  b.normalized_base - a.normalized_base
);

function tier(score) {
  if (score >= 90) return 'S';  // Must research — exceptional fit
  if (score >= 80) return 'A';  // High conviction
  if (score >= 70) return 'B';  // Watchlist
  if (score >= 55) return 'C';  // Monitor
  return 'D';
}

const ranked = scored.map((item, i) => ({ rank: i + 1, conviction_tier: tier(item.conviction_score), ...item }));
const top10  = ranked.slice(0, 10);

// ── PORTFOLIO GAPS SUMMARY ────────────────────────────────────────────────────
const majorGaps = ranked
  .filter(r => r.portfolio_gap_modifier >= 8)
  .map(r => ({ ticker: r.ticker, name: r.name, theme: r.theme, gap_score: r.portfolio_gap_modifier }));

// ── OUTPUT ────────────────────────────────────────────────────────────────────
const output = {
  artifact: 'conviction-ranking',
  generated_at: new Date().toISOString(),
  version: 2,
  data_sources: [
    'data/opportunity-universe.json',
    'outputs/market-orientation-map.json',
    'outputs/candidate-ranking.json (XBRL signals)',
    'data/report-state.live.json (portfolio context)',
  ],
  methodology: {
    formula: 'conviction_score = normalizeBase(base_score) + macro_modifier + rate_env_adj + portfolio_gap_modifier. Cap 98.',
    base_normalization: 'Universe base scores (39–85) normalized to 30–75 so modifiers (max ±20) produce a spread across tiers without capping everything.',
    macro_modifier: 'From market-orientation-map.json leanInto/avoid. Infrastructure +10, second-order AI +8. Avoid signals negative.',
    rate_env_adj: '10Y yield 4.46%: P/E>75 = -6, P/E>50 = -3, P/E≤25 = +4, pre-revenue = -8.',
    portfolio_gap: 'Gap between current holdings and ideal diversification. Major unmet exposure themes get +8 to +10.',
    tiers: 'S ≥ 90 (exceptional, must research), A 80–89 (high conviction), B 70–79 (watchlist), C 55–69 (monitor), D < 55',
    note: 'Score reflects opportunity priority given current macro + portfolio context. Not a price target or buy signal.',
  },
  macro_context: {
    posture: macro.macroWeather?.posture,
    ten_year_yield: macro.macroWeather?.tenYearYield,
    high_yield_oas: macro.macroWeather?.highYieldOAS,
    lean_into: macro.directionalThesis?.leanInto,
    avoid: macro.directionalThesis?.avoid,
    posture_note: 'HOLD / WATCH: Build research on Tier S/A candidates. No new positions without clear dislocation entry or macro regime shift.',
  },
  portfolio_context: {
    held_tickers: [...HELD_TICKERS].sort(),
    major_gaps: majorGaps,
    gap_note: 'Tickers boosted when portfolio has zero exposure to their theme.',
  },
  summary: {
    total_universe: ranked.length,
    tier_s: ranked.filter(r => r.conviction_tier === 'S').length,
    tier_a: ranked.filter(r => r.conviction_tier === 'A').length,
    tier_b: ranked.filter(r => r.conviction_tier === 'B').length,
    tier_c: ranked.filter(r => r.conviction_tier === 'C').length,
    tier_d: ranked.filter(r => r.conviction_tier === 'D').length,
    new_tickers: ranked.filter(r => r.coverage_gap).length,
  },
  top10,
  ranked,
};

const outPath = path.join(root, 'outputs', 'conviction-ranking.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

const summary = top10.map(t => `${t.rank}. ${t.ticker}(${t.conviction_score}/${t.conviction_tier})`).join('  ');
console.log(`conviction-ranking: ${ranked.length} tickers → top10: ${summary}`);
console.log(`Tiers — S: ${output.summary.tier_s}  A: ${output.summary.tier_a}  B: ${output.summary.tier_b}  C: ${output.summary.tier_c}  D: ${output.summary.tier_d}`);
console.log(`Major portfolio gaps in top10: ${majorGaps.filter(g => top10.find(t => t.ticker === g.ticker)).map(g => g.ticker).join(', ')}`);
