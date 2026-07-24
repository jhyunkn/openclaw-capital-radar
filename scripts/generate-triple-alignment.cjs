// Triple-alignment engine (opportunity-framework v2):
// every ranked name is scored on three lenses — macro fit, quality math,
// momentum structure — and must clear ALL THREE floors to be TRIPLE_ALIGNED.
// One lens below floor = NEAR_MISS (published with the failing lens named).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(f) { try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; } }
const framework = read('data/intelligence/opportunity-framework.json') || {};
const cfg = framework.triple_alignment || {};
const ranked = read('outputs/conviction-ranking.json')?.ranked || [];
const wl = read('outputs/watchlist-market-data.json')?.tickers || {};
const scanner = Object.fromEntries((read('data/scanner-universe.json')?.candidates || []).map(c => [c.ticker, c]));
const oppUniverse = Object.fromEntries((read('data/opportunity-universe.json')?.tickers || []).map(t => [t.ticker, t]));
const holdings = new Set(((read('outputs/robinhood-positions.json')?.positions) || []).map(p => p.symbol || p.ticker));
const xbrlFullByTicker = Object.fromEntries((read('outputs/sec-xbrl-fundamentals.json')?.results || []).map(r => [r.ticker, r.fundamentals]));

// Market-wide discovery candidates (Track A: dislocated quality) — these did NOT
// come through hand-curation, so they carry no researched decline_reason or theme
// tag. Normalized below and scored through the SAME three lenses as the curated
// list; see 2026-07-23 note below on why that matters.
const discoveryTrackA = read('outputs/discovery-state.json')?.track_a_candidates || [];
const discoveryRanked = discoveryTrackA.map(c => ({
  ticker: c.ticker,
  name: c.name,
  // Provisional, not hand-verified: Track A's own selection criterion IS
  // "strong margins + oversold RSI", which is the operational definition of a
  // sentiment/multiple-compression decline rather than a fundamentals break.
  // The quality lens still gates on real XBRL coverage below — this label does
  // not bypass that, it only says "this decline pattern looks regime-driven."
  decline_reason: 'SENTIMENT_DRIVEN_UNVERIFIED',
  fundamental_signals: [],
  conviction_score: null,
  _discoverySource: c.track,
}));

// Regime theme weights — hawkish repricing (re-set these when the regime flips;
// authority: framework.current_regime_read). This is a BONUS for names riding a
// confirmed structural tailwind on top of a regime-consistent decline — it is
// deliberately NOT the only way to clear the macro floor (see scoreMacro below).
// 2026-07-23: previously this table's 8 AI/power/defense/space themes were the
// ONLY path to macro_fit >= floor (16) — anything else capped at 10 and was
// mathematically incapable of ever passing, regardless of quality or momentum.
// That's not "narrowly focused," it's a mechanical wall against every other
// sector. Fixed by making the SENTIMENT_DRIVEN signal (rate/multiple compression,
// not a broken business — the regime mechanism itself, independent of sector)
// sufficient on its own to clear the floor; theme membership remains a bonus for
// extra conviction, not a gate.
const THEME_WEIGHTS = {
  AI_INFRASTRUCTURE: 10, SEMICONDUCTOR_CAPEX: 9, AI_INFERENCE_DEMAND: 8,
  NUCLEAR_POWER: 8, GRID_MODERNIZATION: 8, DEFENSE_AI: 7,
  ENTERPRISE_AI_SOFTWARE: 5, SPACE_ECONOMY: 4,
};
// Fallback keyword map for opportunity-universe names without scanner themeAdjacency
const THEME_KEYWORDS = [
  [/semiconductor|foundry|memory|chip|lithography|wafer/i, 'SEMICONDUCTOR_CAPEX'],
  [/ai infra|data.?cent|hyperscaler|accelerator|gpu/i, 'AI_INFRASTRUCTURE'],
  [/nuclear|uranium/i, 'NUCLEAR_POWER'],
  [/grid|power|electri|utility|transmission/i, 'GRID_MODERNIZATION'],
  [/defense|military|drone|unmanned/i, 'DEFENSE_AI'],
  [/software|saas|platform/i, 'ENTERPRISE_AI_SOFTWARE'],
];

function themesFor(ticker) {
  if (scanner[ticker]?.themeAdjacency?.length) return scanner[ticker].themeAdjacency;
  const themeText = `${oppUniverse[ticker]?.theme || ''} ${oppUniverse[ticker]?.whyCore || ''}`;
  const hits = THEME_KEYWORDS.filter(([re]) => re.test(themeText)).map(([, t]) => t);
  return hits.length ? hits : [];
}

function parseRevGrowth(signals) {
  for (const s of signals || []) {
    const m = /Revenue \+?(-?[\d.]+)% YoY/.exec(s);
    if (m) return Number(m[1]);
  }
  return null;
}

function scoreMacro(r) {
  const themes = themesFor(r.ticker);
  const themeScore = Math.max(0, ...themes.map(t => THEME_WEIGHTS[t] || 0));
  let score = themeScore * 2;
  const notes = [`themes: ${themes.join('/') || 'none mapped'} (${themeScore}x2)`];
  // Sentiment/multiple-compression decline is the regime mechanism itself, not a
  // sector-specific signal — raised to clear the floor (16) on its own so a real
  // regime-consistent dislocation isn't walled out just for lacking a theme tag.
  // Verified and unverified get the SAME credit here: the quality lens is where
  // "unverified" actually gets penalized (no scanner gates / no XBRL coverage
  // scores 0 there, a hard floor-fail on its own) — discounting macro_fit too
  // for the same reason would be double-penalizing the same coverage gap.
  if (r.decline_reason === 'SENTIMENT_DRIVEN' || r.decline_reason === 'SENTIMENT_DRIVEN_UNVERIFIED') {
    score += 16; notes.push(`decline is rate/sentiment compression — the regime mechanism (+16${r.decline_reason.endsWith('UNVERIFIED') ? ', pattern-matched not hand-verified' : ''})`);
  }
  if (r.catalyst_note || scanner[r.ticker]?.catalystWindow) { score += 2; notes.push('dated catalyst in window (+2)'); }
  return { score: Math.min(30, score), notes };
}

const xbrlByTicker = (() => {
  const src = read('outputs/xbrl-revenue-trends.json');
  const map = {};
  const walk = v => {
    if (Array.isArray(v)) return v.forEach(walk);
    if (v && typeof v === 'object') {
      if (v.ticker && v.inflection) map[v.ticker] = v.inflection;
      Object.values(v).forEach(walk);
    }
  };
  walk(src);
  return map;
})();

// Valuation discipline (2026-07-23): quality math alone isn't a real "quality"
// assessment — a growth story at any price isn't investing, it's speculation
// on continued multiple expansion. This computes P/S and P/FCF from SEC XBRL
// (shares outstanding × price / revenue or FCF), bands them the same way
// generate-universe-scanner.cjs's Gate 2 does (proven, reused rather than
// reinvented), and — critically — makes the result a genuine constraint on
// scoreQuality below, not an easily-outweighed additive line. Nothing in
// revenue growth or FCF-positive flags can rescue a name that fails this.
function scoreValuation(ticker) {
  // >0 guards, not just isFinite: a mis-tagged SEC filing can report shares
  // outstanding as literally 0, which passes isFinite and would otherwise
  // silently produce a nonsensical $0 market cap / "free" valuation.
  const price = Number.isFinite(wl[ticker]?.currentPrice) && wl[ticker].currentPrice > 0 ? wl[ticker].currentPrice : null;
  const xf = xbrlFullByTicker[ticker];
  const shares = xf && Number.isFinite(xf.shares_outstanding_millions) && xf.shares_outstanding_millions > 0 ? xf.shares_outstanding_millions : null;
  const rev = xf && Number.isFinite(xf.revenue_ttm_usd_millions) ? xf.revenue_ttm_usd_millions : null;
  const fcf = xf && Number.isFinite(xf.fcf_usd_millions) ? xf.fcf_usd_millions : null;

  if (price == null || shares == null) {
    return { ps: null, pFcf: null, label: 'UNVERIFIED', points: 0, hardCapBreach: false, notes: ['valuation unmeasured — missing price or shares outstanding'] };
  }
  const marketCapM = price * shares;
  const ps = rev != null && rev > 0 ? Math.round((marketCapM / rev) * 10) / 10 : null;
  const pFcf = fcf != null && fcf > 0 ? Math.round((marketCapM / fcf) * 10) / 10 : null;

  const notes = [];
  let points = 0;

  if (ps != null) {
    if (ps < 3) { points += 20; notes.push(`P/S ${ps}x — cheap by any standard`); }
    else if (ps < 6) { points += 15; notes.push(`P/S ${ps}x — reasonable`); }
    else if (ps < 10) { points += 10; notes.push(`P/S ${ps}x — moderate premium`); }
    else if (ps < 15) { points += 6; notes.push(`P/S ${ps}x — paying up, needs strong growth`); }
    else if (ps < 25) { points += 3; notes.push(`P/S ${ps}x — expensive, high conviction needed`); }
    else { notes.push(`P/S ${ps}x — very expensive by sales`); }
  } else {
    notes.push('P/S not computable — no revenue coverage');
  }

  if (pFcf != null) {
    if (pFcf < 20) { points += 10; notes.push(`P/FCF ${pFcf}x — attractively priced on cash`); }
    else if (pFcf < 30) { points += 8; notes.push(`P/FCF ${pFcf}x — reasonable on cash`); }
    else if (pFcf < 40) { points += 5; notes.push(`P/FCF ${pFcf}x — moderate`); }
    else if (pFcf < 60) { points += 2; notes.push(`P/FCF ${pFcf}x — paying a premium on cash`); }
    else { notes.push(`P/FCF ${pFcf}x — expensive on cash`); }
  } else if (fcf != null && fcf < 0) {
    notes.push(`FCF negative ($${Math.round(fcf).toLocaleString()}M) — burning cash, not generating it`);
  } else {
    notes.push('P/FCF not computable — no FCF coverage');
  }

  if (fcf != null && rev != null && rev > 0 && fcf > 0) {
    const fcfMargin = (fcf / rev) * 100;
    if (fcfMargin >= 40) { points += 8; notes.push(`FCF margin ${Math.round(fcfMargin * 10) / 10}% — strong cash conversion offsets the multiple`); }
    else if (fcfMargin >= 25) { points += 4; notes.push(`FCF margin ${Math.round(fcfMargin * 10) / 10}% — decent cash conversion`); }
  }

  // The hard line: paying 100+ years of CURRENT free cash flow, or burning
  // cash outright at real scale, isn't "expensive" — it's a bet on a
  // multiple that has nothing to do with today's business. No amount of
  // revenue growth or moat should be able to buy this back.
  const burningCashAtScale = fcf != null && fcf < -50;
  const hardCapBreach = (pFcf != null && pFcf >= 100) || burningCashAtScale;
  if (hardCapBreach) notes.push('VALUATION HARD CAP — price paid is disconnected from current cash generation, capping quality regardless of growth story');

  let label = 'UNVERIFIED';
  if (ps != null || pFcf != null) {
    label = hardCapBreach ? 'EXTREME'
      : (ps != null && ps >= 15) || (pFcf != null && pFcf >= 60) ? 'VERY_EXPENSIVE'
      : (ps != null && ps >= 6) || (pFcf != null && pFcf >= 30) ? 'MODERATE_PREMIUM'
      : 'REASONABLE';
  }

  return { ps, pFcf, label, points: Math.min(38, points), hardCapBreach, notes };
}

function scoreQuality(r) {
  const gates = r.gate_passed;
  const scannerScored = gates && !Array.isArray(gates) && typeof gates === 'object';
  let score = 0;
  const notes = [];
  let rev = parseRevGrowth(r.fundamental_signals);

  if (scannerScored) {
    if (gates.quality) { score += 12; notes.push('quality gate (+12)'); }
    if (gates.moat) { score += 10; notes.push('moat gate (+10)'); }
  } else {
    // OPP_UNIVERSE injection — never went through scanner XBRL scoring.
    // Fall back to raw XBRL so a coverage gap doesn't read as failed math.
    const x = xbrlByTicker[r.ticker];
    if (x && Number.isFinite(x.yoy_latest)) {
      rev = rev ?? x.yoy_latest;
      if (x.yoy_latest > 10 && /RECOVERY|IMPROVING|INFLECTING/i.test(x.status || '')) {
        score += 12; notes.push(`quality via XBRL fallback: ${x.interpretation} (+12)`);
      }
    } else {
      notes.push('no scanner gates AND no XBRL coverage — quality unmeasured');
    }
    if (oppUniverse[r.ticker]?.moat) { score += 5; notes.push('moat from curated universe only — not scanner-verified (+5, capped)'); }
  }

  if (rev != null && rev < 0) return { score: 0, notes: [`revenue declining ${rev}% — hard reject`], hardReject: true };
  if (rev != null) {
    const pts = rev > 25 ? 10 : rev > 15 ? 7 : rev > 5 ? 4 : rev > 0 ? 2 : 0;
    score += pts; notes.push(`revenue +${rev}% YoY (+${pts})`);
  }
  if ((r.fundamental_signals || []).some(s => /FCF \$[\d,]+M.*(strong|positive)/i.test(s))) { score += 8; notes.push('FCF positive (+8)'); }

  const valuation = scoreValuation(r.ticker);
  const preValuationScore = Math.min(40, score);
  let finalScore = preValuationScore;
  if (valuation.hardCapBreach) {
    // Growth/moat/gate points are real signal, just disqualified from being
    // called "cheap quality" by the price paid — cap well under the 22 floor
    // so the ticker reads as NEAR_MISS(quality_math), not silently excluded.
    finalScore = Math.min(preValuationScore, 15);
  } else if (valuation.label === 'VERY_EXPENSIVE') {
    finalScore = Math.max(0, preValuationScore - 8);
  } else if (valuation.label === 'MODERATE_PREMIUM') {
    finalScore = Math.max(0, preValuationScore - 3);
  }
  notes.push(...valuation.notes);

  return {
    score: Math.min(40, finalScore),
    notes,
    coverage: scannerScored ? 'SCANNER' : 'XBRL_FALLBACK',
    valuation: { ps: valuation.ps, p_fcf: valuation.pFcf, label: valuation.label },
  };
}

function scoreMomentum(ticker) {
  const w = wl[ticker] || {};
  const rsi = Number.isFinite(w.rsi14) ? w.rsi14 : null;
  const trend = Number.isFinite(w.trend1mPct) ? w.trend1mPct : null;
  const pct52 = Number.isFinite(w.pctFrom52wHigh) ? w.pctFrom52wHigh : null;
  if (rsi == null || pct52 == null) return { score: 0, shape: 'NO_DATA', notes: ['no watchlist technicals — cannot score momentum'] };
  const reversion =
    (rsi >= 33 && rsi <= 52 ? 12 : rsi > 52 && rsi <= 58 ? 6 : 0) +
    (trend != null && trend >= -8 && trend <= 8 ? 8 : trend != null && trend > 8 ? 4 : 0) +
    (pct52 <= -18 ? 10 : pct52 <= -12 ? 5 : 0);
  const leadership =
    (rsi >= 50 && rsi <= 70 ? 12 : 0) +
    (trend != null && trend > 0 ? 8 : 0) +
    (pct52 >= -15 ? 10 : pct52 >= -20 ? 4 : 0);
  const shape = reversion >= leadership ? 'REVERSION' : 'LEADERSHIP';
  const score = Math.max(reversion, leadership);
  return { score, shape, notes: [`RSI ${rsi}, 1m ${trend != null ? trend + '%' : '?'}, ${pct52}% from 52wH → ${shape} shape ${score}/30`] };
}

const FLOORS = { macro: cfg.lenses?.macro_fit?.floor ?? 16, quality: cfg.lenses?.quality_math?.floor ?? 22, momentum: cfg.lenses?.momentum_structure?.floor ?? 16 };

// Curated (hand-picked, 33-name universe) + discovery (market-wide scan, Track A)
// scored through the identical three lenses. Curated entries win on ticker
// collision (shouldn't happen — ingest already excludes tracked tickers — but
// hand-researched evidence should take precedence if it ever does).
const seen = new Set();
const scoringInput = [];
for (const r of ranked) { if (!seen.has(r.ticker)) { seen.add(r.ticker); scoringInput.push({ ...r, _source: 'curated' }); } }
for (const r of discoveryRanked) { if (!seen.has(r.ticker)) { seen.add(r.ticker); scoringInput.push({ ...r, _source: 'discovery' }); } }

const results = [];
for (const r of scoringInput) {
  if (holdings.has(r.ticker)) continue;
  const macro = scoreMacro(r);
  const quality = scoreQuality(r);
  const momentum = scoreMomentum(r.ticker);
  if (quality.hardReject) continue;
  const fails = [
    macro.score < FLOORS.macro ? 'macro_fit' : null,
    quality.score < FLOORS.quality ? 'quality_math' : null,
    momentum.score < FLOORS.momentum ? 'momentum_structure' : null,
  ].filter(Boolean);
  const verdict = fails.length === 0 ? 'TRIPLE_ALIGNED' : fails.length === 1 ? 'NEAR_MISS' : 'FILTERED';
  results.push({
    ticker: r.ticker, name: r.name, verdict,
    total: macro.score + quality.score + momentum.score,
    macro_fit: macro.score, quality_math: quality.score, momentum_structure: momentum.score,
    quality_coverage: quality.coverage || 'SCANNER',
    valuation: quality.valuation || { ps: null, p_fcf: null, label: 'UNVERIFIED' },
    momentum_shape: momentum.shape,
    failing_lens: fails.length === 1 ? fails[0] : (fails.length > 1 ? fails.join('+') : null),
    conviction: r.conviction_score ?? null,
    source: r._source,
    detail: { macro: macro.notes, quality: quality.notes, momentum: momentum.notes },
  });
}
results.sort((a, b) => (a.verdict === b.verdict ? b.total - a.total : a.verdict === 'TRIPLE_ALIGNED' ? -1 : b.verdict === 'TRIPLE_ALIGNED' ? 1 : a.verdict === 'NEAR_MISS' ? -1 : 1));
if (process.env.DEBUG_DISCOVERY) {
  for (const r of results.filter(x => x.source === 'discovery')) {
    console.error(`DEBUG ${r.ticker} verdict=${r.verdict} macro=${r.macro_fit} quality=${r.quality_math} momentum=${r.momentum_structure}`);
    console.error('  macro:', r.detail.macro.join(' | '));
    console.error('  quality:', r.detail.quality.join(' | '));
    console.error('  momentum:', r.detail.momentum.join(' | '));
  }
}

const state = {
  artifact: 'triple-alignment-state',
  version: 1,
  generatedAt: new Date().toISOString(),
  framework_version: framework.version || null,
  regime: framework.current_regime_read?.regime || 'unset',
  floors: FLOORS,
  doctrine: cfg.principle || 'All three lenses must clear their floors.',
  aligned: results.filter(r => r.verdict === 'TRIPLE_ALIGNED'),
  near_miss: results.filter(r => r.verdict === 'NEAR_MISS'),
  filtered_count: results.filter(r => r.verdict === 'FILTERED').length,
};
for (const f of ['outputs/triple-alignment-state.json', 'public/outputs/triple-alignment-state.json']) {
  const p = path.join(root, f);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
}
console.log(`TRIPLE_ALIGNED: ${state.aligned.map(r => `${r.ticker}(${r.total})`).join(', ') || 'none'}`);
console.log(`NEAR_MISS: ${state.near_miss.map(r => `${r.ticker}(fails ${r.failing_lens})`).join(', ') || 'none'}`);
console.log(`filtered: ${state.filtered_count}`);
