'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const candleDir = path.join(root, 'data', 'market-candles');
const liveStatePath = path.join(root, 'data', 'report-state.live.json');
const outPath = path.join(root, 'outputs', 'holding-decision-zones.json');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

// Profile assignments
const PROFILES = {
  MSFT: 'core_or_quality',
  AMZN: 'core_or_quality',
  CEG:  'core_or_quality',
  META: 'core_or_quality',
  SPY:  'core_or_quality',
  MA:   'core_or_quality',
  NFLX: 'core_or_quality',
  TSLT: 'tactical_risk',
  CONL: 'tactical_risk',
  BMNR: 'speculative_verification',
  TSNF: 'speculative_verification',
};

function round2(v) {
  if (v === null || v === undefined || !Number.isFinite(v)) return null;
  return Math.round(v * 100) / 100;
}

function computeMA(candles, period) {
  if (candles.length < period) return null;
  const slice = candles.slice(-period);
  return slice.reduce((sum, c) => sum + c.close, 0) / period;
}

function computeZones(ticker, profile, candles, livePrice) {
  const last90 = candles.slice(-90);
  const low90  = last90.length ? Math.min(...last90.map(c => c.low))  : null;
  const high90 = last90.length ? Math.max(...last90.map(c => c.high)) : null;
  const ma50   = computeMA(candles, 50);
  const ma200  = computeMA(candles, 200);
  const current = livePrice || (candles.length ? candles[candles.length - 1].close : null);

  const above_ma50  = ma50  !== null && current !== null && current > ma50;
  const above_ma200 = ma200 !== null && current !== null && current > ma200;

  const base = {
    ticker,
    profile,
    current:     round2(current),
    ma50:        round2(ma50),
    ma200:       round2(ma200),
    low90:       round2(low90),
    high90:      round2(high90),
    above_ma50,
    above_ma200,
  };

  if (profile === 'tactical_risk') {
    const distance_from_200d = ma200 !== null && current !== null
      ? round2(((current - ma200) / ma200) * 100)
      : null;
    return {
      ...base,
      buy_zone:       null,
      trim_zone:      null,
      stop:           null,
      trigger:        round2(ma200),
      trigger_label:  '200D MA (distant)',
      zone_rationale: 'Leveraged decay instrument — exit on phase shift or underlying break',
      has_buy_zone:   false,
      exit_only:      true,
      distance_from_200d,
    };
  }

  if (profile === 'speculative_verification') {
    if (low90 === null || high90 === null) {
      return {
        ...base,
        buy_zone:       null,
        trim_zone:      null,
        stop:           null,
        trigger:        null,
        trigger_label:  'key swing level',
        zone_rationale: 'Thesis gate basis — insufficient candle data',
        has_buy_zone:   false,
        exit_only:      false,
      };
    }
    return {
      ...base,
      buy_zone:       { low: round2(low90 * 1.01), high: round2(low90 * 1.08) },
      trim_zone:      { low: round2(high90 * 0.96), high: round2(high90 * 1.02) },
      stop:           round2(low90 * 0.93),
      trigger:        round2(low90),
      trigger_label:  '90D swing low',
      zone_rationale: 'Thesis gate basis — swing support',
      has_buy_zone:   true,
      exit_only:      false,
    };
  }

  // core_or_quality — three-case logic
  if (above_ma200) {
    // Price above 200D MA: 200D is the support floor
    return {
      ...base,
      buy_zone:       { low: round2(ma200 * 0.98), high: round2(ma200 * 1.02) },
      trim_zone:      high90 !== null
        ? { low: round2(high90 * 0.97), high: round2(high90 * 1.03) }
        : { low: round2(ma200 * 1.12), high: round2(ma200 * 1.20) },
      stop:           round2(ma200 * 0.93),
      trigger:        round2(ma200),
      trigger_label:  '200D MA defend',
      zone_rationale: '200D MA support',
      has_buy_zone:   true,
      exit_only:      false,
    };
  } else if (above_ma50) {
    // Price between MA50 and MA200: MA50 is immediate support, MA200 is the reclaim target
    return {
      ...base,
      buy_zone:       { low: round2(ma50 * 0.96), high: round2(ma50 * 1.01) },
      trim_zone:      { low: round2(ma200 * 0.97), high: round2(ma200 * 1.03) },
      stop:           round2(ma50 * 0.90),
      trigger:        round2(ma200),
      trigger_label:  '200D MA reclaim',
      zone_rationale: 'MA50 support — 200D MA reclaim needed',
      has_buy_zone:   true,
      exit_only:      false,
    };
  } else {
    // Price below MA50: both MAs are above, use 90D swing low as structural support
    // Trim zone is above MA50 (meaningful recovery, not just touching it)
    return {
      ...base,
      buy_zone:       low90 !== null
        ? { low: round2(low90 * 1.01), high: round2(low90 * 1.06) }
        : null,
      trim_zone:      ma50 !== null
        ? { low: round2(ma50 * 1.02), high: round2(ma50 * 1.08) }
        : null,
      stop:           low90 !== null ? round2(low90 * 0.95) : null,
      trigger:        round2(ma50),
      trigger_label:  'MA50 reclaim',
      zone_rationale: '90D swing support — MA50 reclaim needed',
      has_buy_zone:   low90 !== null,
      exit_only:      false,
    };
  }
}

// Load live report
const liveState = readJson(liveStatePath, {});
const holdings = liveState.holdings || [];

const results = [];

for (const holding of holdings) {
  const ticker = String(holding.ticker || '').toUpperCase();
  const profile = PROFILES[ticker] || 'core_or_quality';
  const livePrice = holding.livePrice || null;

  const candlePath = path.join(candleDir, `${ticker}.json`);
  const candleData = readJson(candlePath, null);
  const rawCandles = (candleData?.candles || []);

  // Normalize candle fields: support both {time/date, open, high, low, close}
  const candles = rawCandles.map(c => ({
    date:   c.time || c.date,
    open:   Number(c.open),
    high:   Number(c.high),
    low:    Number(c.low),
    close:  Number(c.close),
    volume: Number(c.volume || 0),
  })).filter(c => Number.isFinite(c.close) && c.close > 0);

  const zone = computeZones(ticker, profile, candles, livePrice);

  results.push({
    ...zone,
    dayChangePct:    holding.dayChangePct    ?? null,
    perf3mPct:       holding.perf3mPct       ?? null,
    healthScore:     holding.healthScore     ?? null,
    signal:          holding.signal          ?? null,
    thesis:          holding.thesis          ?? null,
    watch:           holding.watch           ?? null,
    role:            holding.role            ?? holding.portfolio_role ?? null,
    actionRationale: holding.actionRationale ?? null,
  });
}

const output = {
  as_of: new Date().toISOString(),
  holdings: results,
};

fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`generate-holding-decision-zones: wrote ${results.length} holdings → outputs/holding-decision-zones.json`);
for (const h of results) {
  const bz = h.buy_zone ? `$${h.buy_zone.low}–$${h.buy_zone.high}` : 'none';
  console.log(`  ${h.ticker.padEnd(6)} ${h.profile.padEnd(26)} price=$${h.current} ma200=$${h.ma200} buy_zone=${bz}`);
}
