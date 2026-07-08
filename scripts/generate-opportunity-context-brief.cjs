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

// --- Assemble brief ---
const brief = {
  generatedAt: new Date().toISOString(),
  headline: buildHeadline(),
  marketContext: buildMarketContext(),
  groupAContext: buildGroupAContext(),
  groupBContext: buildGroupBContext(),
  topEntry: buildTopEntry(),
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
