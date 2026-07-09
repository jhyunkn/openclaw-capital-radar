'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const outPath = path.join(outputs, 'portfolio-live-state.json');

function readJson(rel, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { return fallback; }
}

function round(value, decimals = 2) {
  const n = Number(value);
  return Number.isFinite(n) ? Number(n.toFixed(decimals)) : null;
}

function ageHours(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return Infinity;
  return (Date.now() - date.getTime()) / 3_600_000;
}

function signalClass(signal) {
  const s = String(signal || '').toLowerCase();
  if (s.includes('exit')) return 'exit';
  if (s.includes('trim')) return 'trim';
  if (s.includes('investigate') || s.includes('review')) return 'investigate';
  if (s.includes('watch')) return 'watch';
  return 'hold';
}

function dayChangeFromPct(currentValue, changePct) {
  const value = Number(currentValue);
  const pct = Number(changePct);
  if (!Number.isFinite(value) || !Number.isFinite(pct) || pct <= -99.9) return null;
  return round(value * (pct / (100 + pct)), 2);
}

const rh = readJson('outputs/robinhood-positions.json');
if (!rh?.syncedAt || !Array.isArray(rh.positions)) {
  throw new Error('outputs/robinhood-positions.json is missing syncedAt or positions');
}

const rhAgeHours = ageHours(rh.syncedAt);
const maxAgeHours = Number(process.env.CAPITAL_RADAR_MAX_ROBINHOOD_AGE_HOURS || 72);
if (rhAgeHours > maxAgeHours) {
  throw new Error(`Robinhood positions are stale: ${rhAgeHours.toFixed(1)}h old; max ${maxAgeHours}h`);
}

const liveState = readJson('data/report-state.live.json', {});
const liveByTicker = new Map();
for (const holding of (liveState.holdings || [])) {
  if (holding.ticker) liveByTicker.set(String(holding.ticker).toUpperCase(), holding);
}

const zones = readJson('outputs/holding-decision-zones.json', {});
const signalByTicker = new Map();
for (const zone of (zones.holdings || zones.zones || [])) {
  if (zone.ticker) signalByTicker.set(String(zone.ticker).toUpperCase(), zone.signal || null);
}

const positions = rh.positions.map(pos => {
  const symbol = String(pos.symbol || '').toUpperCase();
  const live = liveByTicker.get(symbol) || {};
  const shares = round(pos.quantity, 6);
  const avgCostPrice = round(pos.avgCostPrice, 2);
  const costBasis = round(shares * avgCostPrice, 2);
  const livePrice = round(live.livePrice ?? pos.livePrice, symbol === 'DOGE' ? 6 : 2);
  const prevClose = round(live.prevClose ?? pos.prevClose, symbol === 'DOGE' ? 6 : 2);
  const currentValue = round(livePrice * shares, 2);
  const unrealizedGain = round(currentValue - costBasis, 2);
  const unrealizedPct = costBasis ? round((unrealizedGain / costBasis) * 100, 2) : null;
  const dayChangePct = round(live.dayChangePct ?? pos.dayChangePct, 2);
  const dayChange = dayChangeFromPct(currentValue, dayChangePct);
  const signal = signalByTicker.get(symbol) || live.signal || live.computedSignal || null;

  return {
    symbol,
    shares,
    avgCostPrice,
    livePrice,
    prevClose,
    currentValue,
    costBasis,
    unrealizedGain,
    unrealizedPct,
    dayChange,
    dayChangePct,
    signal,
    signalClass: signalClass(signal),
  };
}).filter(pos => pos.symbol);

positions.sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

const totalCostBasis = round(positions.reduce((sum, pos) => sum + (pos.costBasis || 0), 0), 2);
const totalCurrentValue = round(positions.reduce((sum, pos) => sum + (pos.currentValue || 0), 0), 2);
const totalUnrealizedGain = round(totalCurrentValue - totalCostBasis, 2);
const totalUnrealizedPct = totalCostBasis ? round((totalUnrealizedGain / totalCostBasis) * 100, 2) : null;
const totalDayChange = round(positions.reduce((sum, pos) => sum + (pos.dayChange || 0), 0), 2);
const totalDayChangePct = totalCurrentValue ? round((totalDayChange / (totalCurrentValue - totalDayChange)) * 100, 2) : null;

const actionRank = { exit: 0, trim: 1, investigate: 2, watch: 3, hold: 4 };
const actionQueue = positions
  .filter(pos => pos.signalClass !== 'hold')
  .sort((a, b) => (actionRank[a.signalClass] ?? 9) - (actionRank[b.signalClass] ?? 9))
  .map(pos => ({
    symbol: pos.symbol,
    signal: pos.signal,
    signalClass: pos.signalClass,
    unrealizedPct: pos.unrealizedPct,
  }));

const portfolio = rh.portfolio || {};
const state = {
  generatedAt: rh.syncedAt,
  fetchedAt: rh.syncedAt,
  source: 'robinhood-positions + report-state.live market prices',
  freshness: {
    status: rhAgeHours <= maxAgeHours ? 'OK' : 'STALE',
    ageHours: round(rhAgeHours, 1),
    maxAgeHours,
  },
  portfolio: {
    totalValue: round(portfolio.totalValue ?? (totalCurrentValue + Number(portfolio.cash || 0) + Number(portfolio.cryptoValue || 0)), 2),
    equityValue: round(portfolio.equityValue ?? totalCurrentValue, 2),
    cryptoValue: round(portfolio.cryptoValue, 2),
    cash: round(portfolio.cash, 2),
    buyingPower: round(portfolio.buyingPower ?? portfolio.cash, 2),
    positionCount: positions.length,
  },
  positions,
  summary: {
    totalCostBasis,
    totalCurrentValue,
    totalUnrealizedGain,
    totalUnrealizedPct,
    totalDayChange,
    totalDayChangePct,
    actionQueue,
  },
};

fs.mkdirSync(outputs, { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(state, null, 2) + '\n');
console.log(`wrote outputs/portfolio-live-state.json: ${positions.length} positions; Robinhood age ${rhAgeHours.toFixed(1)}h`);
