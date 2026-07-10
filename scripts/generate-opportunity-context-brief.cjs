'use strict';
// Generates outputs/opportunity-context-brief.json
// Rule-based narrative synthesis from existing outputs — no AI call required.
// Runs every build cycle so the opportunity section always shows current context.

const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(f) {
  try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return null; }
}

const ots  = read('outputs/opportunity-technical-state.json') || {};
const cr   = read('outputs/conviction-ranking.json') || {};
const nr   = read('outputs/narrative-reality-brief.json') || {};
const ms   = read('outputs/macro-cycle-state.json') || {};
const ss   = read('outputs/strategy-state.json') || {};
const mps  = read('outputs/macro-prices-state.json') || {};

const tickers = ots.tickers || {};
const top10   = cr.top10 || [];
const themes  = nr.themes || [];

// --- RSI classification ---
function rsiLabel(rsi) {
  if (rsi == null) return null;
  if (rsi < 35)  return 'oversold';
  if (rsi < 42)  return 'deeply cooling';
  if (rsi < 50)  return 'cooling';
  if (rsi < 58)  return 'neutral';
  return 'extended';
}

// --- Entry quality for each ticker ---
const entries = Object.entries(tickers).map(([sym, td]) => ({
  sym,
  rsi: td.rsi14,
  rsiLabel: rsiLabel(td.rsi14),
  vsMa50: td.vsMa50Pct,
  vsMa200: td.vsMa200Pct,
  from52wH: td.pct_from_52w_high,
  price: td.price,
  isAsym: !!td.isAsymmetric,
  isPw: !!td.isPriceWindow,
  conviction: top10.find(t => t.ticker === sym)?.conviction_score || null,
  thesis: td.early_entry_signal || td.moat_summary || '',
  name: td.name || sym,
})).sort((a, b) => (a.rsi || 99) - (b.rsi || 99));

const asymEntries = entries.filter(e => e.isAsym);
const pwEntries   = entries.filter(e => e.isPw);

// --- Best entry picks ---
const bestPw   = pwEntries.filter(e => e.rsi != null && e.rsi < 50 && e.vsMa50 < 0).sort((a,b) => a.rsi - b.rsi);
const bestAsym = asymEntries.filter(e => e.rsi != null && e.rsi < 52).sort((a,b) => a.rsi - b.rsi);
const oversold = entries.filter(e => e.rsi != null && e.rsi < 40);
const extended = entries.filter(e => e.rsi != null && e.rsi > 58);

// --- Macro context sentence ---
const phase      = ms.cycle_phase || 'Expansion';
const confidence = ms.cycle_confidence || 80;
const posture    = ss.overall_posture || 'hold';
const spx        = mps.spx?.price || mps.indices?.spx?.price;
const vix        = mps.vix?.price || mps.indices?.vix?.price;
const hyOas      = mps.rates?.hyOas;

function postureLabel(p) {
  if (p === 'defensive_review') return 'defensive — protect capital first';
  if (p === 'risk_on')          return 'risk-on — lean into best setups';
  if (p === 'risk_off')         return 'risk-off — reduce exposure';
  return p;
}

// --- DATA_AHEAD themes ---
const dataAheadThemes = themes.filter(t => t.classification === 'DATA_AHEAD');
const narrativeAheadThemes = themes.filter(t => t.classification === 'NARRATIVE_AHEAD');

// --- Build headline ---
function buildHeadline() {
  if (oversold.length > 0 && bestPw.length > 0) {
    return `${oversold.map(e => e.sym).join(', ')} oversold. ${bestPw.slice(0,2).map(e => e.sym).join(' and ')} cooling below MA50. Entry window open.`;
  }
  if (bestPw.length > 0) {
    return `${bestPw.slice(0,3).map(e => `${e.sym} (RSI ${e.rsi})`).join(', ')} — below MA50, approaching entry range.`;
  }
  if (extended.length >= 3) {
    return `Most names extended. ${extended.map(e=>e.sym).join(', ')} above MA50 — wait for pullback.`;
  }
  return 'Monitor current setups. No urgent entry signal across Group A or B.';
}

// --- Build market context paragraph ---
function buildMarketContext() {
  const parts = [];

  // Cycle line
  parts.push(`Cycle is in ${phase} (confidence ${confidence}%) — posture is ${postureLabel(posture)}.`);

  // VIX / credit
  if (vix) {
    const vixNote = vix < 16 ? 'Volatility is low, downside protection is cheap' : vix < 20 ? 'Volatility is contained' : 'Elevated volatility — size carefully';
    parts.push(`${vixNote} (VIX ${vix}).`);
  }

  // DATA_AHEAD themes
  if (dataAheadThemes.length > 0) {
    const labels = dataAheadThemes.map(t => t.label).join(' and ');
    parts.push(`Fundamentals are running ahead of price in ${labels} — the market's fear is the opportunity.`);
  }

  // NARRATIVE_AHEAD warning
  if (narrativeAheadThemes.length > 0) {
    parts.push(`${narrativeAheadThemes.map(t => t.label).join(', ')} is priced ahead of fundamentals — don't chase.`);
  }

  return parts.join(' ');
}

// --- Build Group A context ---
function buildGroupAContext() {
  if (asymEntries.length === 0) return '';
  const cooling = asymEntries.filter(e => e.rsi < 52);
  const ext     = asymEntries.filter(e => e.rsi >= 58);

  const parts = [];
  if (cooling.length > 0) {
    const names = cooling.map(e => `${e.sym} (RSI ${e.rsi}, ${e.from52wH}% from peak)`).join(', ');
    parts.push(`${names} ${cooling.length === 1 ? 'is' : 'are'} cooling — early-entry thesis intact.`);
  }
  if (ext.length > 0) {
    parts.push(`${ext.map(e => e.sym).join(' and ')} ${ext.length === 1 ? 'is' : 'are'} extended (RSI ${ext.map(e=>e.rsi).join('/')}) — no new entry here, let momentum resolve.`);
  }
  // Best asym pick
  if (bestAsym.length > 0) {
    const b = bestAsym[0];
    parts.push(`Best setup: ${b.sym} at RSI ${b.rsi} — ${b.from52wH}% from 52-week high with narrative not yet priced by institutions.`);
  }
  return parts.join(' ');
}

// --- Build Group B context ---
function buildGroupBContext() {
  if (pwEntries.length === 0) return '';
  const parts = [];

  // Oversold in Group B
  const ob = pwEntries.filter(e => e.rsi < 40);
  if (ob.length > 0) {
    parts.push(`${ob.map(e => `${e.sym} (RSI ${e.rsi})`).join(', ')} ${ob.length === 1 ? 'is' : 'are'} technically oversold — historically a high-quality entry signal for moat names.`);
  }

  // Cooling below MA50
  const coolPw = pwEntries.filter(e => e.rsi >= 40 && e.rsi < 50 && e.vsMa50 < 0);
  if (coolPw.length > 0) {
    parts.push(`${coolPw.map(e => `${e.sym} (RSI ${e.rsi}, ${e.vsMa50?.toFixed(0)}% vs MA50)`).join(', ')} ${coolPw.length === 1 ? 'is' : 'are'} below MA50 with cooling RSI — approaching entry range.`);
  }

  // Extended in Group B
  const extPw = pwEntries.filter(e => e.rsi >= 58);
  if (extPw.length > 0) {
    parts.push(`${extPw.map(e => e.sym).join(' and ')} ${extPw.length === 1 ? 'is' : 'are'} extended above MA50 — not the entry.`);
  }

  // Top conviction
  const topConv = pwEntries.filter(e => e.conviction).sort((a,b) => (b.conviction||0)-(a.conviction||0));
  if (topConv.length > 0) {
    const tc = topConv[0];
    parts.push(`Highest conviction: ${tc.sym} (score ${tc.conviction}) — use RSI and MA50 levels to time entry, not to validate the thesis.`);
  }

  return parts.join(' ');
}

// --- Top entry pick ---
function buildTopEntry() {
  const allCooling = entries.filter(e => e.rsi != null && e.rsi < 50 && e.vsMa50 != null && e.vsMa50 < 0);
  if (allCooling.length === 0) return null;
  // Prefer highest conviction among cooling
  const withConv = allCooling.filter(e => e.conviction).sort((a,b) => (b.conviction||0)-(a.conviction||0));
  const pick = withConv[0] || allCooling[0];
  return {
    ticker: pick.sym,
    name: pick.name,
    rsi: pick.rsi,
    rsiLabel: pick.rsiLabel,
    vsMa50Pct: pick.vsMa50,
    from52wH: pick.from52wH,
    conviction: pick.conviction,
    why: `RSI ${pick.rsi} (${pick.rsiLabel}), ${Math.abs(pick.vsMa50 || 0).toFixed(1)}% below MA50, ${pick.from52wH}% from 52-week high. ${pick.conviction ? `Conviction score ${pick.conviction}.` : ''} ${pick.thesis ? pick.thesis.slice(0, 120) + (pick.thesis.length > 120 ? '…' : '') : ''}`.trim(),
  };
}

// --- Watch for ---
const watchFor = nr.watchFor || [];

// --- Market-wide discovery (opportunity-framework Tracks A/B) ---
const ds = read('outputs/discovery-state.json') || {};
const discovery = (ds.track_a_candidates || ds.track_b_candidates) ? {
  generatedAt: ds.generatedAt || null,
  snapshot_status: `${ds.snapshots?.track_a?.status || 'MISSING'}/${ds.snapshots?.track_b?.status || 'MISSING'}`,
  new_counts: { dislocated_quality: ds.full_counts?.track_a_new || 0, inflection_leaders: ds.full_counts?.track_b_new || 0 },
  top_dislocated: (ds.track_a_candidates || []).slice(0, 3).map(c => ({ ticker: c.ticker, name: c.name, rsi: c.rsi, why: c.why })),
  top_leaders: (ds.track_b_candidates || []).slice(0, 3).map(c => ({ ticker: c.ticker, name: c.name, rsi: c.rsi, why: c.why })),
  line: `Market-wide discovery: ${ds.full_counts?.track_a_new || 0} new dislocated-quality names (top: ${(ds.track_a_candidates || []).slice(0, 3).map(c => c.ticker).join(', ') || '—'}), ${ds.full_counts?.track_b_new || 0} new inflection leaders (top: ${(ds.track_b_candidates || []).slice(0, 3).map(c => c.ticker).join(', ') || '—'}). These passed the screen, not yet the evidence gates — research queue, not buy list.`,
} : null;

// --- Triple alignment (framework v2: macro fit + quality math + momentum, all floors) ---
const ta = read('outputs/triple-alignment-state.json') || {};
const tripleAlignment = ta.aligned ? {
  regime: ta.regime || null,
  floors: ta.floors || null,
  aligned: (ta.aligned || []).map(r => ({ ticker: r.ticker, total: r.total, macro: r.macro_fit, quality: r.quality_math, momentum: r.momentum_structure, shape: r.momentum_shape, coverage: r.quality_coverage })),
  near_miss: (ta.near_miss || []).map(r => ({ ticker: r.ticker, failing_lens: r.failing_lens })),
} : null;

// --- Framework panel: v2 doctrine + tested macro + calibration findings ---
const fw = read('data/intelligence/opportunity-framework.json') || {};
const mt = read('outputs/macro-thesis-test.json') || {};
const ws = read('outputs/wide-alignment-scan.json') || {};
const tested = fw.current_regime_read?.thesis_tested_against_history || {};
const disTable = ws.calibration?.dislocation_at_t0 || [];
const deepDis = disTable[0], nearHigh = disTable[disTable.length - 1];
const frameworkPanel = (mt.generatedAt || ws.generatedAt) ? {
  version: fw.version || null,
  thesis: 'Plateau rates ~3-3.5%, no zero-rate rescue, adjustment risk elevated (Jun)',
  verdict: tested.verdict || null,
  sizing: tested.sizing_translation ? tested.sizing_translation.split('.')[0] + '.' : null,
  activation: `Activation trigger: Baa-10Y credit spread widening past ~2.5 while Fed holds (now ${mt.current?.hy_now?.v ?? '?'})`,
  plateau_episodes: (mt.test_3_fed_plateau_episodes || []).filter(p => p.spx_fwd_12m != null)
    .map(p => ({ from: (p.plateau_from || '').slice(0, 7), rate: p.fed_funds, fwd12m: p.spx_fwd_12m, maxDD: p.max_drawdown_18m })),
  calibration_finding: (deepDis?.win_rate != null && nearHigh?.win_rate != null)
    ? `Measured across ${ws.universe || '?'} names (6m forward): deep dislocation (>35% below high) won only ${deepDis.win_rate}% of the time; names within 10% of highs won ${nearHigh.win_rate}% (median ${nearHigh.median_fwd}%). Dislocation depth has been NEGATIVE alpha in this regime — buy stabilization, not depth.`
    : null,
  calibrated_top: (ws.finalists || []).filter(f => !f.hard_reject && f.ticker).slice(0, 6)
    .map(f => ({ ticker: f.ticker, p: f.p_positive_6m, rev: f.sec?.ok ? f.sec.yoy : null })),
  tested_at: (mt.generatedAt || '').slice(0, 10),
  scanned_at: (ws.generatedAt || '').slice(0, 10),
} : null;

// --- Duration books (Jun's consolidated action plan) ---
const db = read('data/intelligence/duration-books-state.json') || {};
const durationBooks = db.book_1_long_term ? {
  as_of: db.as_of || null,
  split: db.capital_split ? `${db.capital_split.book_1_long_term} long-term / ${db.capital_split.book_2_tactical} tactical` : null,
  book1: (db.book_1_long_term || []).map(b => ({ ticker: b.ticker, zone: b.buy_zone, crash_add: b.crash_add, why: b.why })),
  book2: (db.book_2_tactical || []).map(b => ({ ticker: b.ticker, entry: b.entry, exit: b.exit, catalyst: b.catalyst })),
  protocol: db.crash_avoidance_protocol ? [db.crash_avoidance_protocol.rule_1, db.crash_avoidance_protocol.rule_2] : [],
} : null;

// --- Assemble brief ---
const brief = {
  generatedAt: new Date().toISOString(),
  headline: buildHeadline(),
  marketContext: buildMarketContext(),
  groupAContext: buildGroupAContext(),
  groupBContext: buildGroupBContext(),
  topEntry: buildTopEntry(),
  frameworkPanel,
  durationBooks,
  tripleAlignment,
  discovery,
  watchFor: watchFor.slice(0, 3),
  entryScoreboard: entries.map(e => ({
    ticker: e.sym,
    rsi: e.rsi,
    rsiLabel: e.rsiLabel,
    vsMa50Pct: e.vsMa50,
    from52wH: e.from52wH,
    entryQuality: e.rsi < 40 ? 'oversold' : e.rsi < 50 && e.vsMa50 < 0 ? 'approaching' : e.rsi >= 58 ? 'extended' : 'neutral',
    group: e.isAsym ? 'A' : 'B',
  })),
};

fs.writeFileSync(path.join(root, 'outputs/opportunity-context-brief.json'), JSON.stringify(brief, null, 2));
console.log(`opportunity context brief generated: headline="${brief.headline.slice(0,60)}…"`);
console.log(`topEntry: ${brief.topEntry?.ticker || 'none'}, groupA: ${asymEntries.length} tickers, groupB: ${pwEntries.length} tickers`);
