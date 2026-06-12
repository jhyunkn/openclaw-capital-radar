'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const outPath = path.join(outputs, 'robinhood-execution-bridge-state.json');

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { return fallback; }
}

function round(v, d = 2) {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}

const rh = readJson('outputs/robinhood-positions.json', {});
const liveState = readJson('data/report-state.live.json', {});
const watchlist = readJson('outputs/watchlist-market-data.json', {});
const zones = readJson('outputs/holding-decision-zones.json', {});

const liveHoldingsMap = new Map();
for (const h of (liveState.holdings || [])) {
  if (h.ticker) liveHoldingsMap.set(h.ticker.toUpperCase(), h);
}

const signalMap = new Map();
for (const z of (zones.holdings || zones.zones || [])) {
  if (z.ticker) signalMap.set(z.ticker.toUpperCase(), z.signal || null);
}

const positions = (rh.positions || []).map(pos => {
  const sym = String(pos.symbol).toUpperCase();
  const shares = round(pos.quantity, 6);
  const avgCostPrice = round(pos.avgCostPrice, 2);
  const totalCostBasis = round(pos.costBasis, 2);

  const lh = liveHoldingsMap.get(sym);
  const wl = watchlist[sym] || watchlist.tickers?.[sym];
  const livePrice = round(lh?.livePrice ?? wl?.currentPrice, 2);
  const currentValue = (livePrice != null && shares != null) ? round(livePrice * shares, 2) : null;
  const unrealizedGain = (currentValue != null && totalCostBasis != null) ? round(currentValue - totalCostBasis, 2) : null;
  const unrealizedPct = (unrealizedGain != null && totalCostBasis != null && totalCostBasis !== 0)
    ? round((unrealizedGain / totalCostBasis) * 100, 2) : null;

  return { symbol: sym, shares, avgCostPrice, totalCostBasis, livePrice, currentValue, unrealizedGain, unrealizedPct, signal: signalMap.get(sym) || null };
}).sort((a, b) => (b.totalCostBasis ?? 0) - (a.totalCostBasis ?? 0));

const portfolio = rh.portfolio || {};

const state = {
  generatedAt: new Date().toISOString(),
  artifact: 'robinhood-execution-bridge-state',
  syncedAt: rh.syncedAt || null,
  portfolio: {
    totalValue: round(portfolio.totalValue, 2),
    equityValue: round(portfolio.equityValue, 2),
    cash: round(portfolio.cash, 2),
    buyingPower: round(portfolio.buyingPower, 2),
    positionCount: positions.length,
  },
  positions,
};

fs.mkdirSync(outputs, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`wrote ${path.relative(root, outPath)}: ${positions.length} positions`);
