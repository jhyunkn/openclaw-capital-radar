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

function ageHours(timestamp) {
  const parsed = new Date(timestamp);
  return Number.isFinite(parsed.getTime()) ? (Date.now() - parsed.getTime()) / 3_600_000 : Infinity;
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
  const avgCostPrice = round(pos.avgCostPrice, sym === 'DOGE' ? 9 : 2);
  const totalCostBasis = Number.isFinite(pos.costBasis)
    ? round(pos.costBasis, 2)
    : (shares != null && avgCostPrice != null ? round(shares * avgCostPrice, 2) : null);

  const lh = liveHoldingsMap.get(sym);
  const wl = watchlist[sym] || watchlist.tickers?.[sym];
  // Price chain: the broker snapshot's own price FIRST. The account header
  // (inject-robinhood-sync-badge) prints the broker sync's portfolio block,
  // so the table must mark from the same snapshot or the two disagree —
  // they did: on 2026-10-16 this chain preferred report-state.live.json's
  // adapter marks (a different, unlabeled vintage) and the table total
  // ($87,281) matched neither header Equity ($86,035, equities only) nor
  // Equity + Crypto ($87,447) from the sync. Live state and the watchlist
  // cache remain fallbacks for lines the sync carries no price for.
  // A non-positive or missing price is "unavailable": renderers must show '—',
  // never $0.00 (a $0 price corrupts every total it touches).
  const livePriceRaw = pos.livePrice ?? lh?.livePrice ?? wl?.currentPrice;
  const livePrice = (Number(livePriceRaw) > 0) ? round(livePriceRaw, sym === 'DOGE' ? 8 : 4) : null;
  const priceSource = pos.livePrice != null && pos.priceAsOf ? 'broker-live-snapshot'
    : pos.livePrice != null ? 'broker-snapshot'
    : lh?.livePrice != null ? 'live-state'
    : wl?.currentPrice != null ? 'watchlist' : 'unavailable';
  const priceAsOf = pos.priceAsOf || lh?.priceAsOf || wl?.asOf || null;
  const priceStale = ageHours(priceAsOf) > 24;
  const currentValue = (livePrice != null && shares != null) ? round(livePrice * shares, 2) : null;
  const unrealizedGain = (currentValue != null && totalCostBasis != null) ? round(currentValue - totalCostBasis, 2) : null;
  const unrealizedPct = (unrealizedGain != null && totalCostBasis != null && totalCostBasis !== 0)
    ? round((unrealizedGain / totalCostBasis) * 100, 2) : null;

  return { symbol: sym, shares, avgCostPrice, totalCostBasis, livePrice, currentValue, unrealizedGain, unrealizedPct, signal: signalMap.get(sym) || null, priceSource, priceAsOf, priceStale };
}).sort((a, b) => (b.totalCostBasis ?? 0) - (a.totalCostBasis ?? 0));

const portfolio = rh.portfolio || {};
const { describeSyncBasis } = require(path.join(root, 'lib', 'price-basis.cjs'));

const state = {
  generatedAt: new Date().toISOString(),
  artifact: 'robinhood-execution-bridge-state',
  syncedAt: rh.syncedAt || null,
  // Price basis of the snapshot (intraday vs close), derived from syncedAt —
  // renderers print it next to the prices so a mid-session snapshot can
  // never pose as closing prices.
  priceBasis: describeSyncBasis(rh.syncedAt),
  portfolio: {
    totalValue: round(portfolio.totalValue, 2),
    equityValue: round(portfolio.equityValue, 2),
    cryptoValue: round(portfolio.cryptoValue, 2),
    cash: round(portfolio.cash, 2),
    buyingPower: round(portfolio.buyingPower, 2),
    positionCount: positions.length,
  },
  positions,
};

fs.mkdirSync(outputs, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`wrote ${path.relative(root, outPath)}: ${positions.length} positions`);
