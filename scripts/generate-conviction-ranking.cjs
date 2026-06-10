'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(rel) {
  const full = path.join(root, rel);
  if (!fs.existsSync(full)) return null;
  return JSON.parse(fs.readFileSync(full, 'utf8'));
}

const scanner    = readJson('outputs/universe-scanner.json');
const macro      = readJson('outputs/market-orientation-map.json');
const watchlist  = readJson('outputs/watchlist-market-data.json');
const reportState = readJson('data/report-state.live.json');
const oppUniverse = readJson('data/opportunity-universe.json');

if (!scanner) throw new Error('Missing outputs/universe-scanner.json — run generate-universe-scanner.cjs first');
if (!macro)   throw new Error('Missing outputs/market-orientation-map.json');

// Build opportunity-universe lookup
const oppByTicker = {};
for (const t of (oppUniverse?.tickers || [])) {
  oppByTicker[String(t.ticker).toUpperCase()] = t;
}

// Capital preservation hard-excludes.
// These explicitly fail our capital preservation filter — do NOT show in opportunity list
// regardless of trough depth or revenue growth score from the scanner.
// HUBS: management itself warned on AI seat-based CRM disruption (not narrative mismatch — genuine fundamental)
// TMDX: not FCF positive — fails capital preservation filter
// RDDT: not FCF positive, ad-cycle sensitivity
// HIMS: speculative growth, pre-profitability at scale
const CAPITAL_PRESERVATION_EXCLUDE = new Set(['HUBS', 'TMDX', 'RDDT', 'HIMS']);

// Timing excludes — algorithm valid but entry thesis has expired (already consensus/crowded).
// MU:   Insider bought at $337 in Jan 2026. Now $895 (+170%). Crowd arrived. Entry passed.
// UBER: Up 40% YTD, no trough entry, high institutional crowding.
const TIMING_EXCLUDE = new Set(['MU', 'UBER']);

// ── TIMING CALENDAR ──────────────────────────────────────────────────────────
// Next earnings / catalyst per ticker (Jun 2026).
const TIMING = {
  TMDX: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 OCS volume + Q1 revenue miss recovery read' },
  HIMS: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 compound GLP-1 regulatory + subscriber growth' },
  NXT:  { nextEarnings: 'Jul 2026',  catalyst: 'Q1 FY2027 tracker shipments + tariff impact' },
  RDDT: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 DAU + data licensing renewal pipeline' },
  HUBS: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 SMB ARR + AI CRM adoption rate' },
  ET:   { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 DCF confirms AI data center gas volume ramp — $25B contracted fee revenue' },
  KNSL: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 combined ratio below 80% confirms underwriting quality intact through E&S softening' },
  CLS:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 FY guide raised above $19B — AI hardware manufacturing demand confirmation' },
  GE:   { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 backlog growth + FCF trajectory — aviation supercycle confirmation' },
  UBER: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 Gross Bookings + AV city expansion announcement' },
  NTRA: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 FCF trajectory — must show narrowing losses to promote' },
  SCCO: { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 copper volume + China infrastructure demand signals' },
  APO:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 FRE growth + AUM inflows from AI infrastructure private credit' },
  FIX:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 data center construction backlog confirmation' },
  CACI: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 contract win rate + defense AI program awards' },
  VRT:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 data center cooling order rate + margins' },
  MU:   { nextEarnings: 'Jun 2026',  catalyst: 'Q3 FY2026 earnings Jun 24 — HBM pricing + 2027 commitments' },
  GTLB: { nextEarnings: 'Jun 2026',  catalyst: 'Q1 FY2027 ARR + AI Duo attach rate' },
  NOW:  { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 cRPO + AI workflow adoption rate' },
  BWXT: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 microreactor contract pipeline' },
  PWR:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 grid construction backlog + transmission wins' },
  DDOG: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 AI observability ARR + net retention' },
  PLTR: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 AIP commercial + US gov contract pipeline' },
  AVGO: { nextEarnings: 'Sep 2026',  catalyst: 'Q3 FY2026: custom ASIC pipeline + AI rev guide' },
  RKLB: { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 Electron cadence + Neutron development update' },
  MRVL: { nextEarnings: 'Jun 2026',  catalyst: 'Q1 FY2027 AI ASIC design wins + electro-optics ramp' },
  APP:  { nextEarnings: 'Aug 2026',  catalyst: 'Q2 2026 AXON revenue + connected TV expansion' },
  HUBB: { nextEarnings: 'Jul 2026',  catalyst: 'Q2 2026 grid solutions order intake + margin' },
};

// ── THEME MACRO BONUS ─────────────────────────────────────────────────────────
// Small bonus for tickers aligned with the current macro lean (AI infrastructure,
// grid buildout). Keeps signal ordering but rewards macro-relevant exposures.
const THEME_BONUS = {
  AI_INFRASTRUCTURE:       8,
  AI_INFERENCE_DEMAND:     7,
  AI_CHIP_NETWORKING:      7,
  ENTERPRISE_AI_SOFTWARE:  6,
  GOVERNMENT_AI_SOFTWARE:  5,
  SOLAR_GRID:              4,
  NUCLEAR_POWER:           3,
  SPACE_LAUNCH:            3,
};

function themeBonus(themes) {
  if (!Array.isArray(themes) || themes.length === 0) return 0;
  const best = Math.max(...themes.map(t => THEME_BONUS[t] ?? 0));
  return best;
}

// ── SCORE CONVERSION ─────────────────────────────────────────────────────────
// Scanner total_score range: [40 (WATCH floor), ~155 (theoretical max)].
// Map to conviction [40, 90], then add signal tier bonus and theme bonus.
const SCANNER_FLOOR = 40;
const SCANNER_RANGE = 115; // 155 - 40
const CONV_FLOOR    = 40;
const CONV_RANGE    = 50;  // 40 → 90

function scannerToConviction(item) {
  const clamped = Math.max(SCANNER_FLOOR, Math.min(155, item.total_score));
  const base    = CONV_FLOOR + Math.round(((clamped - SCANNER_FLOOR) / SCANNER_RANGE) * CONV_RANGE);
  const signalBonus = item.signal === 'FULL_SIGNAL' ? 5 : 0;
  const tBonus      = themeBonus(item.theme_adjacency);
  return Math.min(95, base + signalBonus + tBonus);
}

function tier(s) {
  if (s >= 90) return 'S';
  if (s >= 80) return 'A';
  if (s >= 70) return 'B';
  if (s >= 55) return 'C';
  return 'D';
}

function assessTiming(ticker) {
  const t = TIMING[ticker];
  if (!t) return { status: 'No earnings data', note: 'Verify next catalyst.', window_score: 1 };
  const isJun = t.nextEarnings === 'Jun 2026';
  const isJul = t.nextEarnings === 'Jul 2026';
  if (isJun) return { status: 'Earnings THIS MONTH — high urgency', note: `Watch: ${t.catalyst}`, window_score: 3 };
  if (isJul) return { status: 'Earnings Jul 2026 — build research now', note: `Watch: ${t.catalyst}`, window_score: 2 };
  return { status: `Earnings ${t.nextEarnings}`, note: `Watch: ${t.catalyst}`, window_score: 2 };
}

// ── FLATTEN SCANNER CANDIDATES ────────────────────────────────────────────────
const allCandidates = [
  ...(scanner.full_signal_candidates    || []),
  ...(scanner.partial_signal_candidates || []),
  ...(scanner.watch_candidates          || []),
  ...(scanner.research_only             || []),
];

const ranked = allCandidates.map(item => {
  const ticker  = item.ticker;
  const conv    = scannerToConviction(item);
  const timing  = assessTiming(ticker);
  const mkt     = watchlist?.tickers?.[ticker] ?? null;
  const timingEntry = TIMING[ticker] || {};

  return {
    rank: 0, // filled after sort
    ticker,
    name: item.name,
    conviction_score: conv,
    conviction_tier: tier(conv),
    scanner_signal: item.signal,
    scanner_score: item.total_score,
    gate_passed: item.gate_passed,
    decline_reason: item.decline_reason?.reason ?? null,
    decline_label: item.decline_reason?.label ?? null,
    decline_explanation: item.decline_reason?.explanation ?? null,
    fundamental_signals: item.signals || [],
    gaps: item.gaps || [],
    moat_summary: item.moat_summary ?? null,
    theme_adjacency: item.theme_adjacency || [],
    timing_status: timing.status,
    timing_note: timing.note,
    window_score: timing.window_score,
    next_catalyst: timingEntry.catalyst ?? null,
    next_earnings: timingEntry.nextEarnings ?? null,
    live_price: item.live_price ?? null,
    pct_from_52w_high: item.pct_from_52w_high ?? null,
    trend_1m_pct: item.trend_1m_pct ?? null,
    rsi14: item.rsi14 ?? null,
    ps: item.ps ?? null,
    p_fcf: item.p_fcf ?? null,
    revenue_growth_pct: item.revenue_growth_pct ?? null,
    gross_margin_pct: item.gross_margin_pct ?? null,
    insider_signal: item.insider_signal ?? null,
    open_market_value_mm: item.open_market_value_mm ?? 0,
    action_permission: item.signal === 'FULL_SIGNAL' || item.signal === 'PARTIAL_SIGNAL'
      ? 'RESEARCH_SCREENED — verify thesis before sizing'
      : 'WATCH_ONLY — entry not signaled',
  };
}).sort((a, b) => b.conviction_score - a.conviction_score || b.scanner_score - a.scanner_score);

// ── CAPITAL PRESERVATION FILTER ───────────────────────────────────────────────
// Remove names that explicitly fail our capital preservation mandate.
// These may score well on the trough algorithm (high drawdown + revenue growth)
// but are disqualified for fundamental reasons the scanner cannot see.
const filteredRanked = ranked.filter(r => !CAPITAL_PRESERVATION_EXCLUDE.has(r.ticker) && !TIMING_EXCLUDE.has(r.ticker));

// ── OPPORTUNITY-UNIVERSE INJECTION ────────────────────────────────────────────
// Include opportunity-universe framework picks that the scanner rejected or
// classified as NEAR_PEAK/FUNDAMENTAL_CONCERN due to data gaps or model mismatch.
// (ET: contractual income thesis — NEAR_PEAK is expected and correct for income plays)
// (GE: XBRL data issue — $211B backlog is real)
// (AVGO: -3% post-earnings dip is a valid entry but not a scanner trough)
const scannerTickers = new Set(allCandidates.map(c => c.ticker));
for (const opp of (oppUniverse?.tickers || [])) {
  const t = String(opp.ticker).toUpperCase();
  if (scannerTickers.has(t)) {
    // Already in scanner — boost conviction score if opportunity-universe baseScore is high,
    // and enrich with qualitative framework fields (thesis, crowding, invalidation).
    const item = filteredRanked.find(r => r.ticker === t);
    if (item) {
      if (opp.baseScore >= 80) {
        const oppConv = Math.min(88, Math.round(opp.baseScore * 0.92));
        if (oppConv > item.conviction_score) {
          item.conviction_score = oppConv;
          item.conviction_tier  = tier(oppConv);
        }
      }
      if (opp.earlyEntrySignal)      item.early_entry_signal    = opp.earlyEntrySignal;
      if (opp.institutionalCrowding) item.institutional_crowding = opp.institutionalCrowding;
      if (opp.invalidation)          item.invalidation           = opp.invalidation;
      if (opp.catalystWindow)        item.next_catalyst          = opp.catalystWindow;
    }
    continue;
  }
  if (CAPITAL_PRESERVATION_EXCLUDE.has(t)) continue;
  if (TIMING_EXCLUDE.has(t)) continue;
  if (!watchlist?.tickers?.[t]) continue;
  if (!opp.fcfPositive) continue; // capital preservation: FCF positive required
  const mkt      = watchlist.tickers[t];
  const oppConv  = Math.min(88, Math.round(opp.baseScore * 0.92));
  const timing   = assessTiming(t);
  filteredRanked.push({
    rank: 0,
    ticker: t,
    name: opp.name,
    conviction_score: oppConv,
    conviction_tier: tier(oppConv),
    scanner_signal: 'OPP_UNIVERSE',
    scanner_score: opp.baseScore,
    gate_passed: ['opportunity-universe-framework', 'capital-preservation-filter'],
    decline_reason: null,
    fundamental_signals: [opp.earlyEntrySignal ?? ''].filter(Boolean),
    gaps: ['institutional_crowding: ' + (opp.institutionalCrowding ?? 'unknown')],
    moat_summary: opp.moat,
    theme_adjacency: [opp.macroAlignment].filter(Boolean),
    timing_status: timing.status,
    timing_note: timing.note,
    window_score: timing.window_score,
    next_catalyst: opp.catalystWindow ?? (TIMING[t]?.catalyst ?? null),
    next_earnings: TIMING[t]?.nextEarnings ?? null,
    live_price: mkt?.currentPrice ?? null,
    pct_from_52w_high: mkt?.pctFrom52wHigh ?? null,
    trend_1m_pct: mkt?.trend1mPct ?? null,
    rsi14: mkt?.rsi14 ?? null,
    action_permission: 'RESEARCH_SCREENED — pre-consensus opportunity-universe pick. Crowding: ' + (opp.institutionalCrowding ?? 'unknown'),
    early_entry_signal: opp.earlyEntrySignal ?? null,
    institutional_crowding: opp.institutionalCrowding ?? null,
    invalidation: opp.invalidation ?? null,
  });
}

filteredRanked.sort((a, b) => b.conviction_score - a.conviction_score || b.scanner_score - a.scanner_score);
filteredRanked.forEach((r, i) => { r.rank = i + 1; });

const top10 = filteredRanked.slice(0, 10);

// ── PULLBACK CONTEXT ──────────────────────────────────────────────────────────
function buildPullbackContext() {
  const watchlistDislocations = allCandidates
    .filter(t => t.signal === 'FULL_SIGNAL' || t.signal === 'PARTIAL_SIGNAL')
    .map(t => ({
      ticker: t.ticker,
      name: t.name,
      signal: t.signal,
      decline_reason: t.decline_reason?.reason ?? null,
      livePrice: t.live_price ?? null,
      trend1mPct: t.trend_1m_pct ?? null,
      pctFrom52wHigh: t.pct_from_52w_high ?? null,
      rsi14: t.rsi14 ?? null,
    }));

  const spyTrend = (macro.themes || [])
    .flatMap(t => t.tickers || [])
    .find(t => t.ticker === 'SPY')?.trend1mPct ?? null;

  return {
    has_pullback: watchlistDislocations.length > 0,
    spy_trend_1m_pct: spyTrend,
    posture_on_pullback: 'RESEARCH_SCREENED: All candidates passed 5-gate screening. Verify thesis before sizing any position.',
    watchlist_dislocations: watchlistDislocations,
    data_note: 'Scanner evaluates revenue growth, P/S, P/FCF, dislocation depth, moat, and insider buying. Entry requires thesis verification — price action alone is not sufficient.',
  };
}

const output = {
  artifact: 'conviction-ranking',
  generated_at: new Date().toISOString(),
  version: 4,
  methodology: {
    description: 'Conviction scores derived from five-gate screener + opportunity-universe framework. Capital preservation filter removes pre-FCF and explicitly flagged names. Opportunity-universe tickers inject pre-consensus picks with low institutional crowding even if scanner classifies them as NEAR_PEAK.',
    scoring: 'conviction_score = f(scanner_total_score) + signal_tier_bonus + macro_theme_bonus; OR f(baseScore * 0.92) for OPP_UNIVERSE injections. Range 40–95.',
    tiers: 'S ≥ 90, A ≥ 80, B ≥ 70, C ≥ 55, D < 55',
    capital_preservation_exclude: [...CAPITAL_PRESERVATION_EXCLUDE],
    hard_rejects: 'Tickers within 8% of 52wH or revenue declining >5% YoY removed by scanner unless present in opportunity-universe framework list.',
  },
  data_sources: [
    'outputs/universe-scanner.json (five-gate screener — primary)',
    'data/opportunity-universe.json (framework overrides + pre-consensus injections)',
    'outputs/market-orientation-map.json',
    watchlist ? 'outputs/watchlist-market-data.json (live)' : 'outputs/watchlist-market-data.json (not available)',
  ],
  macro_context: {
    posture: macro.macroWeather?.posture,
    lean_into: macro.directionalThesis?.leanInto,
    avoid: macro.directionalThesis?.avoid,
    posture_note: 'GET IN EARLY: Pre-consensus positions with low institutional crowding. Capital preservation first — FCF positive, no binary risk, clear invalidation defined.',
  },
  pullback_context: buildPullbackContext(),
  summary: {
    total_ranked: filteredRanked.length,
    full_signal: allCandidates.filter(c => c.signal === 'FULL_SIGNAL').length,
    partial_signal: allCandidates.filter(c => c.signal === 'PARTIAL_SIGNAL').length,
    watch: allCandidates.filter(c => c.signal === 'WATCH').length,
    opp_universe_injected: filteredRanked.filter(r => r.scanner_signal === 'OPP_UNIVERSE').length,
    capital_preservation_excluded: [...CAPITAL_PRESERVATION_EXCLUDE].length,
    tier_s: filteredRanked.filter(r => r.conviction_tier === 'S').length,
    tier_a: filteredRanked.filter(r => r.conviction_tier === 'A').length,
    tier_b: filteredRanked.filter(r => r.conviction_tier === 'B').length,
    tier_c: filteredRanked.filter(r => r.conviction_tier === 'C').length,
    tier_d: filteredRanked.filter(r => r.conviction_tier === 'D').length,
  },
  top10,
  ranked: filteredRanked,
};

const outPath = path.join(root, 'outputs', 'conviction-ranking.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

const summary = top10.map(t => `${t.rank}. ${t.ticker}(${t.conviction_score}/${t.conviction_tier} — ${t.scanner_signal})`).join('  ');
console.log(`conviction-ranking v4: ${ranked.length} tickers ranked from scanner → top10: ${summary}`);
