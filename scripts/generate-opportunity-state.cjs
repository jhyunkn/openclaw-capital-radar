'use strict';

/*
 * Opportunity decision surface — engine-fed rebuild (2026-10-01).
 *
 * Jun's directive: the opportunity list is his add/continue decision surface.
 * It is fed ONLY by:
 *   - momentum-fit: recognizable (top-200 S&P 500 by market cap) momentum
 *     leaders with GOOD entries (lower end of recent range, not the peak)
 *   - arb-fit:      TRADEABLE merger-arb deals
 * No dislocation/quality leg. No hand-picked names. No BWXT-style drift.
 *
 * Two tiers:
 *   board     — actionable now. Full trade cards:
 *               entry / ceiling (→ approx margin) / invalidation (→ approx risk)
 *               / duration / catalyst / strategy / evidence.
 *               A card missing any field does not render (fail-closed in validator).
 *   watchlist — recognizable momentum names with FAIR/POOR entries.
 *               WAIT state: what we're waiting for (entry flips to GOOD).
 *
 * Mechanical engine outputs are untouched; this file only reads them.
 */

const fs   = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const MOM_STATE   = path.join(root, 'outputs', 'momentum', 'momentum-state.json');
const PRICE_CACHE = path.join(root, 'outputs', 'cache', 'momentum', 'price-history.json');
const MCAP_RANK   = path.join(root, 'data', 'sp500-marketcap-rank.json');
const ARB_BOARD   = path.join(root, 'outputs', 'arb', 'arb-deal-board.json');
const REBALANCE   = path.join(root, 'outputs', 'momentum', 'momentum-rebalance.json');
const OUT_DIR     = path.join(root, 'outputs', 'opportunity');
const OUT_PATH    = path.join(OUT_DIR, 'opportunity-state.json');

const RECOGNIZABLE_MAX_RANK = 200; // top-200 S&P 500 by market cap

const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const r2 = v => Math.round(v * 100) / 100;
const r1 = v => Math.round(v * 10) / 10;
const unesc = s => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"');

function fail(msg) { console.error(`opportunity-state: FATAL — ${msg}`); process.exit(1); }

// ── load inputs ──────────────────────────────────────────────────────────────
for (const [p, label] of [[MOM_STATE,'momentum-state'],[PRICE_CACHE,'price cache'],[MCAP_RANK,'market-cap rank']]) {
  if (!fs.existsSync(p)) fail(`${label} missing at ${p}`);
}
const momState = readJson(MOM_STATE);
const cache    = readJson(PRICE_CACHE);
const mcapRank = readJson(MCAP_RANK);
const arbBoard = fs.existsSync(ARB_BOARD) ? readJson(ARB_BOARD) : null;
const rebal    = fs.existsSync(REBALANCE) ? readJson(REBALANCE) : null;

const mcapBySym = {};
for (const e of (mcapRank.ranked || [])) mcapBySym[e.symbol] = { rank: e.rank, name: unesc(e.name) };

const closesBySym = {};
for (const [sym, s] of Object.entries(cache.symbols || {})) {
  if (Array.isArray(s.adj) && s.adj.length >= 50) closesBySym[sym] = s.adj;
}

// Duration: next monthly rebalance strictly after the generation date.
function nextRebalanceAfter(todayYYYYMMDD) {
  let d = rebal && rebal.nextRebalanceDate ? rebal.nextRebalanceDate : null;
  if (!d) return null;
  while (d <= todayYYYYMMDD) {
    const dt = new Date(d + 'T12:00:00Z');
    dt.setUTCMonth(dt.getUTCMonth() + 1);
    dt.setUTCDate(1);
    d = dt.toISOString().slice(0, 10);
  }
  return d;
}
const TODAY = new Date().toISOString().slice(0, 10);

// ── momentum leg ─────────────────────────────────────────────────────────────
const board = [];
const watchlist = [];
const excluded = [];

for (const row of (momState.table || [])) {
  if (!row.inTopDecile) continue;
  const sym = row.symbol;
  const mc = mcapBySym[sym];
  if (!mc || mc.rank > RECOGNIZABLE_MAX_RANK) { excluded.push({ symbol: sym, reason: `market-cap rank ${mc ? mc.rank : 'unknown'} — outside top-200 recognizability gate` }); continue; }
  const closes = closesBySym[sym];
  if (!closes) { excluded.push({ symbol: sym, reason: 'insufficient price history for ceiling/invalidation math' }); continue; }

  const price = row.price;
  const last20 = closes.slice(-20);
  const last50 = closes.slice(-50);
  const ceiling = Math.max(...last20);
  const sma50 = last50.reduce((a, b) => a + b, 0) / last50.length;
  const rating = row.entryQuality && row.entryQuality.rating;
  const entryReason = (row.entryQuality && row.entryQuality.reasons && row.entryQuality.reasons[0]) || '';
  const offHighPct = (price - ceiling) / ceiling * 100;

  const common = {
    symbol: sym,
    name: mc.name || sym,
    strategy: 'momentum-fit',
    marketCapRank: mc.rank,
    momentumRank: row.rank,
    composite: r2(row.composite),
    entryRating: rating,
    priceAsOf: row.asOf || null,
    evidence: {
      engine: 'momentum',
      momentumRank: row.rank,
      composite: r2(row.composite),
      entryRating: rating,
      off20dHighPct: r1((row.entryQuality.inputs.off20dHigh || 0) * 100),
      distSMA50Pct: r1((row.entryQuality.inputs.distSMA50 || 0) * 100),
      source: 'outputs/momentum/momentum-state.json',
    },
  };

  // Lower-end rule (Jun): a GOOD rating alone is not enough — the entry must
  // sit below the recent ceiling with real room to it. A name parked at its
  // 20-day high is "momentum stock, but no pullback/no trade" — it waits.
  const LOWER_END_MAX_OFFHIGH_PCT = -0.5;
  const onLowerEnd = offHighPct <= LOWER_END_MAX_OFFHIGH_PCT;

  if (rating === 'GOOD' && onLowerEnd) {
    const marginPct = (ceiling - price) / price * 100;
    const riskPct = (price - sma50) / price * 100;
    const durationThrough = nextRebalanceAfter(TODAY);
    if (!durationThrough) { excluded.push({ symbol: sym, reason: 'rebalance calendar unavailable — duration cannot be set, card disqualified' }); continue; }
    board.push({
      ...common,
      state: 'ACTIONABLE',
      entry: { price: r2(price), note: `Lower end of recent range — ${entryReason}`.slice(0, 220) },
      ceiling: { price: r2(ceiling), basis: '20-day high (top of the recent range)', marginPct: r1(marginPct) },
      invalidation: { price: r2(sma50), basis: '50-day mean — trend breaks below it', riskPct: r1(riskPct) },
      duration: { through: durationThrough, basis: 'next monthly momentum rebalance' },
      catalyst: `Price reclaims the $${r2(ceiling).toLocaleString()} ceiling (20-day high)`,
    });
  } else if (rating === 'GOOD' && !onLowerEnd) {
    watchlist.push({
      ...common,
      state: 'WAIT',
      current: { price: r2(price), offHighPct: r1(offHighPct), ceiling20d: r2(ceiling), sma50: r2(sma50) },
      waitingFor: `At/near its 20-day high (${r1(offHighPct)}% off the ceiling) — the entry is not on the lower end of the range. Becomes actionable on a pullback that leaves real room to the $${r2(ceiling).toLocaleString()} ceiling.`,
    });
  } else if (rating === 'FAIR' || rating === 'POOR') {
    watchlist.push({
      ...common,
      state: 'WAIT',
      current: { price: r2(price), offHighPct: r1(offHighPct), ceiling20d: r2(ceiling), sma50: r2(sma50) },
      waitingFor: rating === 'POOR'
        ? 'Parabolic — at the peak of its momentum. Wait for the pullback: becomes actionable when the entry rating flips to GOOD (price back on the lower end of its range).'
        : 'Extended or consolidating — not a fresh entry here. Becomes actionable when the entry rating flips to GOOD (constructive pullback in the intact trend).',
    });
  } else {
    excluded.push({ symbol: sym, reason: `entry rating ${rating} not actionable` });
  }
}

board.sort((a, b) => a.momentumRank - b.momentumRank);
watchlist.sort((a, b) =>
  (a.entryRating === 'FAIR' ? 0 : 1) - (b.entryRating === 'FAIR' ? 0 : 1) || a.momentumRank - b.momentumRank);

// ── arb leg ──────────────────────────────────────────────────────────────────
const arbCards = [];
let arbEmptyReason = null;
if (!arbBoard) {
  arbEmptyReason = 'Arb board state unavailable — arb leg skipped this cycle.';
} else {
  const deals = arbBoard.deals || [];
  for (const d of deals) {
    if (d.verdict !== 'TRADEABLE') continue;
    const entry = d.targetPrice, ceiling = d.offerPricePerShare;
    if (!Number.isFinite(entry) || !Number.isFinite(ceiling) || entry <= 0 || ceiling <= 0) continue;
    arbCards.push({
      symbol: d.targetSymbol || d.target,
      name: d.targetName || d.target,
      strategy: 'arb-fit',
      state: 'ACTIONABLE',
      entry: { price: r2(entry), note: `Target last price${d.targetPriceAsOf ? ` (${String(d.targetPriceAsOf).slice(0, 10)})` : ''}` },
      ceiling: { price: r2(ceiling), basis: `${d.considerationType || 'deal'} consideration — ${d.acquirer || 'acquirer'}`, marginPct: r1((ceiling - entry) / entry * 100) },
      invalidation: { condition: 'Deal breaks or spread blows out — exit on termination news or a regulatory/financing failure' },
      duration: { through: d.expectedCloseDate || null, label: d.expectedCloseLabel || d.expectedCloseDate || 'close date unconfirmed', basis: 'expected deal close' },
      catalyst: 'Deal closes — collect the spread',
      evidence: {
        engine: 'arb',
        acquirer: d.acquirer || null,
        considerationType: d.considerationType || null,
        spreadPct: d.spreadPct ?? null,
        annualizedSpreadPct: d.annualizedSpreadPct ?? null,
        filingUrl: d.filingUrl || d.exhibitUrl || null,
        source: 'outputs/arb/arb-deal-board.json',
      },
    });
  }
  if (!arbCards.length) arbEmptyReason = `No TRADEABLE arb deals right now (${deals.length} mined, 0 tradeable) — arb leg is empty this cycle, not broken.`;
}
board.push(...arbCards);
board.sort((a, b) => (a.strategy === b.strategy) ? (a.momentumRank || 999) - (b.momentumRank || 999) : a.strategy === 'momentum-fit' ? -1 : 1);

// ── alerts vs previous ───────────────────────────────────────────────────────
let prev = null;
if (fs.existsSync(OUT_PATH)) { try { prev = readJson(OUT_PATH); } catch {} }
const prevBoard = new Set((prev?.board || []).map(c => c.symbol));
const prevWatch = new Set((prev?.watchlist || []).map(c => c.symbol));
const nowBoard  = new Set(board.map(c => c.symbol));
const nowWatch  = new Set(watchlist.map(c => c.symbol));
const alerts = {
  newlyActionable: board.filter(c => !prevBoard.has(c.symbol)).map(c => c.symbol),
  graduatedToBoard: board.filter(c => prevWatch.has(c.symbol) && !prevBoard.has(c.symbol)).map(c => c.symbol),
  newlyWaiting: watchlist.filter(c => !prevWatch.has(c.symbol) && !prevBoard.has(c.symbol)).map(c => c.symbol),
  demotedToWait: watchlist.filter(c => prevBoard.has(c.symbol)).map(c => c.symbol),
  removed: [...prevBoard, ...prevWatch].filter(s => !nowBoard.has(s) && !nowWatch.has(s)),
};

// ── write ────────────────────────────────────────────────────────────────────
const asOfDate = (momState.table || []).find(r => r.asOf)?.asOf || null;
const state = {
  artifact: 'opportunity-state',
  generatedAt: new Date().toISOString(),
  asOf: asOfDate,
  recognitionGate: {
    type: 'sp500-marketcap-top200',
    asOf: mcapRank.asOf,
    source: mcapRank.source,
    sourceUrl: mcapRank.source_url,
    note: 'Top-200 S&P 500 by market cap — the recognizability gate. Momentum engine itself is unfiltered.',
  },
  counts: {
    board: board.length,
    momentumFit: board.filter(c => c.strategy === 'momentum-fit').length,
    arbFit: board.filter(c => c.strategy === 'arb-fit').length,
    watchlist: watchlist.length,
    excluded: excluded.length,
  },
  board,
  watchlist,
  excluded,
  alerts,
  emptyReasons: {
    momentum: board.filter(c => c.strategy === 'momentum-fit').length === 0
      ? 'No recognizable momentum names on the lower end of their range right now — every top-decile name is at/near its peak or extended.'
      : null,
    arb: arbEmptyReason,
  },
};

fs.mkdirSync(OUT_DIR, { recursive: true });
if (fs.existsSync(OUT_PATH)) fs.copyFileSync(OUT_PATH, OUT_PATH + '.prev');
fs.writeFileSync(OUT_PATH, JSON.stringify(state, null, 2) + '\n');
console.log(`opportunity-state: board=${state.counts.board} (mom=${state.counts.momentumFit}, arb=${state.counts.arbFit}) watchlist=${state.counts.watchlist} excluded=${state.counts.excluded} alerts: +actionable=[${alerts.newlyActionable}] graduated=[${alerts.graduatedToBoard}] +waiting=[${alerts.newlyWaiting}] demoted=[${alerts.demotedToWait}] removed=[${alerts.removed}]`);
