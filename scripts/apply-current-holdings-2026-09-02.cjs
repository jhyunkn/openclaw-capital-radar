'use strict';
// One-off correction: report-state.live.json's holdings array had drifted from the
// live Robinhood account — MSFT, CEG, TSNF were no longer held (stale from an earlier
// snapshot), and IAU, VST, UBER, AVGO, VRT (all real current positions) were missing
// entirely. This seeds the array to match the live account; downstream pipeline stages
// (fundamentals, signals, sparklines, XBRL) enrich the new tickers on the next full build.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const p = path.join(root, 'data/report-state.live.json');
const state = JSON.parse(fs.readFileSync(p, 'utf8'));

const rh = JSON.parse(fs.readFileSync(path.join(root, 'outputs/robinhood-positions.json'), 'utf8'));
const live = new Map(rh.positions.map(pos => [pos.symbol, pos]));

const STALE_NOT_HELD = new Set(['MSFT', 'CEG', 'TSNF']);
const NEW_SEEDS = ['IAU', 'VST', 'UBER', 'AVGO', 'VRT'];

const map = new Map((state.holdings || []).map(h => [h.ticker, h]));
for (const t of STALE_NOT_HELD) map.delete(t);

for (const ticker of NEW_SEEDS) {
  const pos = live.get(ticker);
  if (!pos) continue;
  const shares = parseFloat(pos.quantity);
  const avgCostPrice = parseFloat(pos.avgCostPrice);
  const livePrice = pos.livePrice;
  const existing = map.get(ticker);
  const seed = existing || {
    ticker,
    role: 'Pending thesis review',
    signal: 'REVIEW',
    health: 'New to tracked holdings / thesis needed',
    thesis: 'Newly synced from live Robinhood account; needs thesis, risk-band, and fundamentals review.',
    watch: 'Pending review.',
    actionRationale: 'Newly synced holding; validate thesis and risk budget before further pipeline signal generation.',
    exposureBucket: 'Pending classification',
    ratingBreakdown: [{ label: 'New holding', impact: 0, note: 'Synced live from Robinhood; requires thesis/risk-band validation.' }],
    sparkline: [],
  };
  Object.assign(seed, {
    shares,
    avgCostPrice,
    totalCostBasis: Math.round(shares * avgCostPrice * 100) / 100,
    livePrice,
    priceAsOf: rh.syncedAt,
    marketValue: Math.round(shares * livePrice * 100) / 100,
    liveDataSource: 'Robinhood MCP live sync (Claude session)',
    totalReturnSource: rh.source,
  });
  if (!seed.sparkline || seed.sparkline.length < 2) seed.sparkline = [livePrice];
  map.set(ticker, seed);
}

// Preserve existing order, then append newly-seeded tickers not already present.
const order = (state.holdings || []).map(h => h.ticker).filter(t => !STALE_NOT_HELD.has(t));
for (const t of NEW_SEEDS) if (!order.includes(t) && map.has(t)) order.push(t);

state.holdings = order.map(t => map.get(t)).filter(Boolean);

const holdingsTotal = state.holdings.reduce((s, h) => s + Number(h.marketValue || ((+h.shares || 0) * (+h.livePrice || 0)) || 0), 0);
for (const h of state.holdings) {
  h.portfolioWeightPct = holdingsTotal ? +(Number(h.marketValue || 0) / holdingsTotal * 100).toFixed(2) : 0;
}

state.meta = state.meta || {};
state.meta.generatedAt = new Date().toISOString();
state.meta.holdingsSyncSource = rh.source;
state.meta.holdingsSyncedAt = rh.syncedAt;
state.meta.holdingsSyncNote = `Removed stale non-held tickers (${[...STALE_NOT_HELD].join(', ')}); added live tickers missing from holdings array (${NEW_SEEDS.join(', ')}).`;

fs.writeFileSync(p, JSON.stringify(state, null, 2));
console.log(`holdings corrected: ${state.holdings.length} tickers -> ${state.holdings.map(h => h.ticker).join(', ')}`);
