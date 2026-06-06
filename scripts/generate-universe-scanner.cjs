'use strict';

// Universe Scanner: Moat-at-Trough Detector
//
// Scans the extended scanner-universe.json for candidates that simultaneously have:
//   1. Durable moat (encoded in scanner-universe.json per ticker)
//   2. Cyclical trough signals (near 52-week low, RSI oversold, sharp recent drop)
//   3. Demand inflection signal (active macro theme aligns with their supply chain level)
//
// This is the system that would have surfaced Micron (MU) before its 2024 rally:
//   - HBM demand inflecting in AI_INFRASTRUCTURE theme (Level 3 adjacency)
//   - MU was near 52-week low, RSI < 40, down -35% from peak
//   - Insider buying appearing in Form 4 filings
//
// Output: outputs/universe-scanner.json
//   - candidates: tickers passing all three criteria (promote to watch)
//   - watch: tickers passing 2/3 criteria (monitor)
//   - inactive: tickers not yet signaling

const fs   = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(rel) {
  const f = path.join(root, rel);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

// ── DATA SOURCES ──────────────────────────────────────────────────────────────
const scanUniverse   = readJson('data/scanner-universe.json');
const themeChains    = readJson('data/theme-supply-chains.json');
const marketData     = readJson('outputs/watchlist-market-data.json');
const macroMap       = readJson('outputs/market-orientation-map.json');
const convictionUni  = readJson('data/opportunity-universe.json');
const insiderData    = readJson('outputs/insider-transactions.json');

if (!scanUniverse) throw new Error('Missing data/scanner-universe.json');
if (!themeChains)  throw new Error('Missing data/theme-supply-chains.json');

// Tickers already in active conviction universe — skip them in scanner output
const ACTIVE_UNIVERSE = new Set(
  (convictionUni?.tickers || []).map(t => String(t.ticker).toUpperCase())
);

// ── ACTIVE MACRO THEMES ───────────────────────────────────────────────────────
// Derive which themes are currently "strengthening" from the macro map.
// Fallback to a default set if macro map isn't available.
function deriveActiveThemes() {
  const active = new Set();
  if (macroMap?.directionalThesis?.leanInto) {
    const lean = macroMap.directionalThesis.leanInto;
    if (typeof lean === 'string') {
      // Map macro keywords to our theme IDs
      if (/infra|semiconductor|chip|AI/i.test(lean))    active.add('AI_INFRASTRUCTURE');
      if (/inference|AI/i.test(lean))                    active.add('AI_INFERENCE_DEMAND');
      if (/nuclear|power|energy/i.test(lean))            active.add('NUCLEAR_POWER');
      if (/grid|utility|electrical/i.test(lean))         active.add('GRID_MODERNIZATION');
      if (/semiconductor|fab|equipment/i.test(lean))     active.add('SEMICONDUCTOR_CAPEX');
      if (/defense|government|gov/i.test(lean))          active.add('DEFENSE_AI');
      if (/enterprise|software|saas/i.test(lean))        active.add('ENTERPRISE_AI_SOFTWARE');
    }
  }
  // Also check themes array in macro map
  if (macroMap?.themes) {
    macroMap.themes.forEach(t => {
      const title = (t.title || '').toLowerCase();
      if (title.includes('ai') || title.includes('infra'))     active.add('AI_INFRASTRUCTURE');
      if (title.includes('inference'))                          active.add('AI_INFERENCE_DEMAND');
      if (title.includes('nuclear') || title.includes('power')) active.add('NUCLEAR_POWER');
      if (title.includes('grid') || title.includes('electric')) active.add('GRID_MODERNIZATION');
      if (title.includes('semiconductor') || title.includes('chip')) active.add('SEMICONDUCTOR_CAPEX');
    });
  }
  // Always include the core AI infrastructure theme — it's been active since 2023
  active.add('AI_INFRASTRUCTURE');
  active.add('AI_INFERENCE_DEMAND');
  active.add('NUCLEAR_POWER');
  active.add('SEMICONDUCTOR_CAPEX');
  return active;
}

const activeThemes = deriveActiveThemes();

// ── SCORE EACH CANDIDATE ──────────────────────────────────────────────────────

function scoreCandidate(candidate) {
  const ticker  = String(candidate.ticker).toUpperCase();
  const mktData = marketData?.tickers?.[ticker] ?? null;

  const signals   = [];
  const gaps      = [];
  let   moatScore = 0;
  let   troughScore   = 0;
  let   inflectionScore = 0;

  // ── 1. MOAT SCORE (0-40) ─────────────────────────────────────────────────
  // Moat is encoded qualitatively; we score by supply chain level and cyclical nature
  const supplyLevel = candidate.supplyChainLevel ?? 4;
  // Level 1 (obvious) scores lower — market has already priced this
  // Level 2-3 (underappreciated) scores higher — the scanner's target
  const levelScores = { 1: 20, 2: 35, 3: 40, 4: 25 };
  moatScore = levelScores[supplyLevel] ?? 20;

  // Adjust for cyclical nature: highly cyclical = higher trough opportunity
  if (candidate.cyclicalNature === 'highly_cyclical')   moatScore += 5;
  if (candidate.cyclicalNature === 'moderately_cyclical') moatScore += 2;

  signals.push(`Moat: Level-${supplyLevel} supply chain (${candidate.sector})`);

  // ── 2. TROUGH SIGNALS (0-40) ─────────────────────────────────────────────
  if (mktData) {
    const pctFromHigh    = mktData.pctFrom52wHigh ?? null;
    const trend1m        = mktData.trend1mPct     ?? null;
    const rsi            = mktData.rsi14          ?? null;
    const threshold      = candidate.troughThresholdPctFrom52wHigh ?? -30;

    if (pctFromHigh != null && pctFromHigh <= threshold) {
      troughScore += 20;
      signals.push(`Near 52-week low: ${pctFromHigh}% from peak (threshold ${threshold}%)`);
    } else if (pctFromHigh != null && pctFromHigh <= threshold * 0.7) {
      troughScore += 10;
      signals.push(`Approaching trough: ${pctFromHigh}% from peak`);
    } else {
      gaps.push(`Price not at trough: ${pctFromHigh ?? '?'}% from 52wH (need ≤${threshold}%)`);
    }

    if (rsi != null && rsi < 35) {
      troughScore += 12;
      signals.push(`RSI oversold: ${rsi} (fear/capitulation signal)`);
    } else if (rsi != null && rsi < 45) {
      troughScore += 5;
      signals.push(`RSI depressed: ${rsi}`);
    }

    if (trend1m != null && trend1m <= -10) {
      troughScore += 8;
      signals.push(`Sharp 1-month dislocation: ${trend1m}%`);
    } else if (trend1m != null && trend1m <= -5) {
      troughScore += 4;
      signals.push(`Meaningful 1-month pullback: ${trend1m}%`);
    }
  } else {
    gaps.push('No live price data — trough signals cannot be assessed');
    troughScore = 0;
  }

  // ── 3. DEMAND INFLECTION (0-20) ───────────────────────────────────────────
  // Does any active macro theme align with this ticker's supply chain adjacency?
  const adjacencies  = candidate.themeAdjacency || [];
  const hitThemes    = adjacencies.filter(t => activeThemes.has(t));

  if (hitThemes.length > 0) {
    inflectionScore += 15;
    // Bonus: if ticker appears explicitly in a theme's supply chain at level 2-3
    hitThemes.forEach(themeId => {
      const chain = themeChains.themes[themeId];
      if (!chain) return;
      const inL2  = (chain.level2?.tickers || []).includes(ticker);
      const inL3  = (chain.level3?.tickers || []).includes(ticker);
      const inL4  = (chain.level4?.tickers || []).includes(ticker);
      if (inL3)     { inflectionScore += 5; signals.push(`Level-3 adjacency confirmed in ${themeId}`); }
      else if (inL2){ inflectionScore += 3; signals.push(`Level-2 adjacency confirmed in ${themeId}`); }
      else if (inL4){ inflectionScore += 2; signals.push(`Level-4 adjacency in ${themeId}`); }
    });
    inflectionScore = Math.min(inflectionScore, 20);
    signals.push(`Active theme alignment: ${hitThemes.join(', ')}`);
  } else if (adjacencies.length === 0) {
    inflectionScore = 10; // Standalone moat — not theme-driven but still a moat
    signals.push('Standalone moat — not theme-driven');
  } else {
    gaps.push(`No active theme overlap (adjacencies: ${adjacencies.join(', ')})`);
  }

  // ── 4. INSIDER CONFIRMATION (bonus) ──────────────────────────────────────
  // Insider buying at trough = strongest possible confirmation signal.
  // We can only count filing frequency here — open-market buys require XML parse.
  const insiderInfo = insiderData?.tickers?.[ticker];
  let insiderBonus  = 0;
  if (insiderInfo) {
    // Notable activity at a trough price = positive signal
    if (insiderInfo.insider_signal === 'NOTABLE' && mktData?.nearTrough) {
      insiderBonus = 5;
      signals.push(`Insider activity (${insiderInfo.total_filings} Form 4s) during trough — verify buy/sell split`);
    } else if (insiderInfo.insider_signal === 'LOW' && mktData?.nearTrough) {
      insiderBonus = 2;
      signals.push(`Insider quiet (${insiderInfo.total_filings} Form 4s) — no heavy selling detected`);
    } else if (insiderInfo.insider_signal === 'QUIET') {
      // No activity — neutral for trough, slight negative if not at trough
      insiderBonus = mktData?.nearTrough ? 1 : 0;
    }
  }

  // ── COMPOSITE SCORE ───────────────────────────────────────────────────────
  const totalScore = moatScore + troughScore + inflectionScore + insiderBonus;

  // Determine signal strength
  let signal;
  const hasTrough     = troughScore >= 20;
  const hasInflection = inflectionScore >= 15;
  const hasMoat       = moatScore >= 30;

  if (hasMoat && hasTrough && hasInflection) {
    signal = 'FULL_SIGNAL'; // All three criteria met — Micron-type setup
  } else if (hasMoat && (hasTrough || hasInflection)) {
    signal = 'PARTIAL_SIGNAL'; // Two of three — monitor
  } else if (hasMoat) {
    signal = 'MOAT_ONLY'; // Good business, not at trough yet
  } else {
    signal = 'WATCH';
  }

  const currentPrice    = mktData?.currentPrice    ?? null;
  const pctFrom52wHigh  = mktData?.pctFrom52wHigh  ?? null;
  const trend1mPct      = mktData?.trend1mPct      ?? null;
  const rsi14           = mktData?.rsi14           ?? null;
  const nextEarnings    = mktData?.nextEarningsDate ?? null;

  return {
    ticker,
    name:          candidate.name,
    sector:        candidate.sector,
    signal,
    total_score:   totalScore,
    moat_score:    moatScore,
    trough_score:  troughScore,
    inflection_score: inflectionScore,
    supply_chain_level: supplyLevel,
    theme_adjacency: adjacencies,
    active_theme_hits: hitThemes,
    moat_summary:  candidate.moat,
    demand_inflection_signal: candidate.demandInflectionSignal,
    promotion_criteria: candidate.promotionCriteria,
    insider_signal:    insiderInfo?.insider_signal ?? null,
    insider_filings_90d: insiderInfo?.total_filings ?? null,
    insider_edgar_url: insiderInfo?.edgar_url ?? null,
    signals_detected: signals,
    gaps: gaps,
    live_price:         currentPrice,
    pct_from_52w_high:  pctFrom52wHigh,
    trend_1m_pct:       trend1mPct,
    rsi14,
    next_earnings_date: nextEarnings,
    already_in_universe: ACTIVE_UNIVERSE.has(ticker),
  };
}

// ── COVERAGE GAP DETECTOR ─────────────────────────────────────────────────────
// Are there active themes with zero coverage in the active conviction universe?
function detectCoverageGaps() {
  const gaps = [];
  for (const [themeId, chain] of Object.entries(themeChains.themes)) {
    if (!activeThemes.has(themeId)) continue;

    const allChainTickers = [
      ...(chain.level1?.tickers || []),
      ...(chain.level2?.tickers || []),
      ...(chain.level3?.tickers || []),
      ...(chain.level4?.tickers || []),
    ];
    const covered = allChainTickers.filter(t => ACTIVE_UNIVERSE.has(t));
    const coverageRatio = covered.length / Math.max(allChainTickers.length, 1);

    if (coverageRatio < 0.15) {
      gaps.push({
        theme: themeId,
        description: chain.description,
        covered_tickers: covered,
        missing_levels: {
          level2: (chain.level2?.tickers || []).filter(t => !ACTIVE_UNIVERSE.has(t)),
          level3: (chain.level3?.tickers || []).filter(t => !ACTIVE_UNIVERSE.has(t)),
        },
        urgency: 'HIGH — active theme with <15% coverage',
      });
    } else if (coverageRatio < 0.35) {
      gaps.push({
        theme: themeId,
        description: chain.description,
        covered_tickers: covered,
        missing_levels: {
          level2: (chain.level2?.tickers || []).filter(t => !ACTIVE_UNIVERSE.has(t)),
          level3: (chain.level3?.tickers || []).filter(t => !ACTIVE_UNIVERSE.has(t)),
        },
        urgency: 'MEDIUM — active theme with partial coverage',
      });
    }
  }
  return gaps;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
const scored = scanUniverse.candidates
  .filter(c => !ACTIVE_UNIVERSE.has(String(c.ticker).toUpperCase()))
  .map(scoreCandidate);

scored.sort((a, b) => b.total_score - a.total_score);

const fullSignal    = scored.filter(s => s.signal === 'FULL_SIGNAL');
const partialSignal = scored.filter(s => s.signal === 'PARTIAL_SIGNAL');
const moatOnly      = scored.filter(s => s.signal === 'MOAT_ONLY');
const watchOnly     = scored.filter(s => s.signal === 'WATCH');

const coverageGaps = detectCoverageGaps();

const output = {
  artifact:     'universe-scanner',
  generatedAt:  new Date().toISOString(),
  version:      1,
  methodology:  {
    description: 'Moat-at-Trough screen: score candidates on (1) moat durability, (2) cyclical trough signals, (3) demand inflection from active macro themes. FULL_SIGNAL requires all three.',
    full_signal_criteria: 'moat_score ≥ 30 AND trough_score ≥ 20 AND inflection_score ≥ 15',
    thematic_detection:   'Active themes derived from market-orientation-map.json + always-on core themes (AI_INFRASTRUCTURE, AI_INFERENCE_DEMAND, NUCLEAR_POWER, SEMICONDUCTOR_CAPEX)',
  },
  active_themes: [...activeThemes],
  coverage_gaps: coverageGaps,
  summary: {
    total_scanned:    scored.length,
    full_signal:      fullSignal.length,
    partial_signal:   partialSignal.length,
    moat_only:        moatOnly.length,
    watch_only:       watchOnly.length,
  },
  full_signal_candidates: fullSignal,
  partial_signal_candidates: partialSignal,
  moat_only: moatOnly,
  all_scored: scored,
};

const outPath = path.join(root, 'outputs', 'universe-scanner.json');
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log(`universe-scanner: scanned ${scored.length} candidates`);
console.log(`  FULL_SIGNAL (all 3 criteria): ${fullSignal.map(s => s.ticker).join(', ') || 'none'}`);
console.log(`  PARTIAL_SIGNAL (2/3 criteria): ${partialSignal.map(s => s.ticker).join(', ') || 'none'}`);
console.log(`  Coverage gaps in active themes: ${coverageGaps.length}`);
if (coverageGaps.length) {
  coverageGaps.forEach(g => console.log(`    ${g.theme}: ${g.urgency}`));
}
