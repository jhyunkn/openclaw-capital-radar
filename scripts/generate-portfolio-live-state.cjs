'use strict';

const fs = require('fs');
const path = require('path');
const { lastSessionClose, isMarketOpen } = require('./lib/market-session.cjs');

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

function timestampMs(timestamp) {
  const value = new Date(timestamp).getTime();
  return Number.isFinite(value) ? value : -Infinity;
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
const attestation = readJson('outputs/portfolio-positions-attestation.json');
const attestationMaxAgeHours = Number(process.env.CAPITAL_RADAR_MAX_POSITION_ATTESTATION_AGE_HOURS || 720);
const attestationMatchesSnapshot = Boolean(
  attestation?.status === 'UNCHANGED' &&
  attestation?.attestedAt &&
  attestation?.sourceSnapshotSyncedAt === rh.syncedAt
);
const attestationAgeHours = attestationMatchesSnapshot ? ageHours(attestation.attestedAt) : Infinity;
const attestationValid = attestationMatchesSnapshot && attestationAgeHours <= attestationMaxAgeHours;
const brokerSnapshotFresh = rhAgeHours <= maxAgeHours;
const useAttestation = !brokerSnapshotFresh && attestationValid;
const ownershipAsOf = useAttestation ? attestation.attestedAt : rh.syncedAt;
const ownershipAgeHours = ageHours(ownershipAsOf);
const ownershipMaxAgeHours = useAttestation ? attestationMaxAgeHours : maxAgeHours;
const maxQuoteAgeHours = Number(process.env.CAPITAL_RADAR_MAX_QUOTE_AGE_HOURS || 24);
const ownershipStale = ownershipAgeHours > ownershipMaxAgeHours;
if (ownershipStale) {
  // Degrade, don't die: a stale holdings feed must freeze only the portfolio block,
  // not take down macro/calendar/opportunities/deploy. Downstream renderers already
  // surface freshness.status === 'STALE' as a visible badge.
  console.warn(`WARN portfolio ownership stale: ${ownershipAgeHours.toFixed(1)}h old (max ${ownershipMaxAgeHours}h). Freezing portfolio block as STALE; continuing build.`);
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
  const avgCostPrice = round(pos.avgCostPrice, symbol === 'DOGE' ? 9 : 2);
  const suppliedCostBasis = Number(pos.costBasis);
  const costBasis = Number.isFinite(suppliedCostBasis)
    ? round(suppliedCostBasis, 2)
    : round(shares * avgCostPrice, 2);
  const reportPriceAsOf = live.priceAsOf || live.asOf || null;
  const brokerPriceAsOf = pos.priceAsOf || rh.syncedAt;
  const brokerHasPrice = Number.isFinite(Number(pos.livePrice));
  const reportHasPrice = Number.isFinite(Number(live.livePrice));
  const preferBrokerQuote = brokerHasPrice && (
    !reportHasPrice ||
    timestampMs(brokerPriceAsOf) >= timestampMs(reportPriceAsOf)
  );
  const quote = preferBrokerQuote ? pos : live;
  const fallbackQuote = preferBrokerQuote ? live : pos;
  const livePrice = round(quote.livePrice ?? fallbackQuote.livePrice, symbol === 'DOGE' ? 6 : 2);
  const prevClose = round(quote.prevClose ?? fallbackQuote.prevClose, symbol === 'DOGE' ? 6 : 2);
  const currentValue = round(livePrice * shares, 2);
  const unrealizedGain = round(currentValue - costBasis, 2);
  const unrealizedPct = costBasis ? round((unrealizedGain / costBasis) * 100, 2) : null;
  const dayChangePct = round(quote.dayChangePct ?? fallbackQuote.dayChangePct, 2);
  const dayChange = dayChangeFromPct(currentValue, dayChangePct);
  const signal = signalByTicker.get(symbol) || live.signal || live.computedSignal || null;
  const priceAsOf = preferBrokerQuote
    ? brokerPriceAsOf
    : (reportPriceAsOf || brokerPriceAsOf);
  // Market-time age: while the market is closed, only lag behind the last session close counts.
  const closeMs = isMarketOpen() ? null : lastSessionClose();
  const quoteAgeHours = closeMs == null
    ? ageHours(priceAsOf)
    : Math.max(0, (closeMs - timestampMs(priceAsOf)) / 3_600_000);

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
    priceSource: preferBrokerQuote ? 'broker-live-snapshot' : 'report-state-live',
    priceAsOf,
    priceFreshness: {
      status: quoteAgeHours <= maxQuoteAgeHours ? 'OK' : 'STALE',
      ageHours: round(quoteAgeHours, 1),
      maxAgeHours: maxQuoteAgeHours,
    },
  };
}).filter(pos => pos.symbol);

positions.sort((a, b) => (b.currentValue || 0) - (a.currentValue || 0));

const totalCostBasis = round(positions.reduce((sum, pos) => sum + (pos.costBasis || 0), 0), 2);
const totalCurrentValue = round(positions.reduce((sum, pos) => sum + (pos.currentValue || 0), 0), 2);
const totalUnrealizedGain = round(totalCurrentValue - totalCostBasis, 2);
const totalUnrealizedPct = totalCostBasis ? round((totalUnrealizedGain / totalCostBasis) * 100, 2) : null;
const totalDayChange = round(positions.reduce((sum, pos) => sum + (pos.dayChange || 0), 0), 2);
// Day-change % base = prior-day TOTAL portfolio value (equity + crypto +
// cash), not prior-day positions value: the header prints this % next to the
// total-portfolio figure, and the positions-only base matched neither the
// portfolio base nor the equity base (Batch 2 A6). portfolio.totalValue is
// the broker-synced total; the fallback mirrors state.portfolio.totalValue.
const portfolio = rh.portfolio || {};
const displayEquityValue = round(portfolio.equityValue ?? totalCurrentValue, 2);
const displayCryptoValue = round(portfolio.cryptoValue, 2);
const displayCashValue = round(portfolio.cash, 2);
const displayComponentsSum = round(
  displayEquityValue +
  (Number.isFinite(displayCryptoValue) ? displayCryptoValue : 0) +
  (Number.isFinite(displayCashValue) ? displayCashValue : 0), 2);
const brokerTotalValue = Number(portfolio.totalValue);
const brokerTotalDiscrepancy = Number.isFinite(brokerTotalValue)
  ? round(brokerTotalValue - displayComponentsSum, 2)
  : null;
if (brokerTotalDiscrepancy != null && Math.abs(brokerTotalDiscrepancy) > 1) {
  console.warn(`WARN broker portfolio total disagrees with its components by $${brokerTotalDiscrepancy.toFixed(2)} (total $${brokerTotalValue.toFixed(2)} vs equity+crypto+cash $${displayComponentsSum.toFixed(2)}); displaying the components sum.`);
}
// The broker snapshot's own total must equal its components. When it does
// not (the 2026-11-13 sync read totalValue $730 above equity+crypto+cash),
// the displayed total is the sum of the displayed components so the account
// strip can never print a self-contradictory total. The broker total and
// the discrepancy are recorded, not discarded.
const portfolioTotalValue = (brokerTotalDiscrepancy != null && Math.abs(brokerTotalDiscrepancy) > 1)
  ? displayComponentsSum
  : round(brokerTotalValue ?? (totalCurrentValue + Number(portfolio.cash || 0) + Number(portfolio.cryptoValue || 0)), 2);
const totalDayChangePct = portfolioTotalValue ? round((totalDayChange / (portfolioTotalValue - totalDayChange)) * 100, 2) : null;

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

const staleQuoteCount = positions.filter(position => position.priceFreshness?.status !== 'OK').length;
const state = {
  generatedAt: new Date().toISOString(),
  fetchedAt: rh.syncedAt,
  source: 'robinhood-positions + report-state.live market prices',
  ownership: {
    status: ownershipStale ? 'STALE' : 'OK',
    asOf: ownershipAsOf,
    method: useAttestation ? 'MANUAL_UNCHANGED_ATTESTATION' : 'BROKER_SYNC',
    sourceSnapshotSyncedAt: rh.syncedAt,
    attestedAt: useAttestation ? attestation.attestedAt : null,
    ageHours: round(ownershipAgeHours, 1),
    maxAgeHours: ownershipMaxAgeHours,
  },
  freshness: {
    status: ownershipStale || staleQuoteCount ? 'STALE' : 'OK',
    degraded: ownershipStale || staleQuoteCount > 0,
    ageHours: round(ownershipAgeHours, 1),
    maxAgeHours: ownershipMaxAgeHours,
    staleQuoteCount,
    ...(ownershipStale || staleQuoteCount ? { note: `Portfolio changes blocked: ownership verification age ${ownershipAgeHours.toFixed(1)}h; ${staleQuoteCount} quote(s) exceed ${maxQuoteAgeHours}h.` } : {}),
  },
  portfolio: {
    totalValue: portfolioTotalValue,
    equityValue: displayEquityValue,
    cryptoValue: displayCryptoValue,
    cash: displayCashValue,
    buyingPower: round(portfolio.buyingPower ?? portfolio.cash, 2),
    positionCount: positions.length,
    brokerTotalValue: Number.isFinite(brokerTotalValue) ? round(brokerTotalValue, 2) : null,
    brokerTotalDiscrepancy,
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
console.log(`wrote outputs/portfolio-live-state.json: ${positions.length} positions; ownership ${useAttestation ? 'attested' : 'broker-synced'} ${ownershipAgeHours.toFixed(1)}h ago`);
