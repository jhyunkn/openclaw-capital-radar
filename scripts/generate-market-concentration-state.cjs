'use strict';
// Market concentration / breadth divergence check (added 2026-07-25).
//
// Background: index-level calm (low VIX, SPX near highs) can mask real weakness
// concentrated in the handful of mega-cap names that dominate the index's weight.
// This mirrors the "index_calm_masks_stock_dispersion" theme already used in
// narrative-reality synthesis this session, made into a permanent, numeric check
// rather than a one-off write-up.
//
// Verified reference points (2026-07-25 session): SLOOS net bank-tightening fell
// from ~45-51% in 2023 to ~8% by 2026-04-01 (see generate-credit-state.cjs) —
// historically, >=40% tightening preceded the dot-com, GFC, and 2022 drawdowns.
// The read below is conditional on that credit zone: divergence during LOOSE
// credit reads as rotation risk, not confirmed rollover; divergence during
// TIGHTENING_STRESS reads as the historical pre-drawdown pattern.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function read(f, fallback = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, f), 'utf8')); } catch { return fallback; }
}
function write(name, data) {
  for (const dir of ['outputs', 'public/outputs']) {
    const f = path.join(root, dir, name);
    fs.mkdirSync(path.dirname(f), { recursive: true });
    fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n');
  }
}
const round = (v, d = 2) => Number.isFinite(Number(v)) ? Number(Number(v).toFixed(d)) : null;

const MAG7 = ['AAPL', 'MSFT', 'GOOGL', 'AMZN', 'NVDA', 'META', 'TSLA'];
const wl = read('outputs/watchlist-market-data.json')?.tickers || {};
const creditState = read('outputs/credit-state.json');

const constituents = MAG7.map(ticker => {
  const t = wl[ticker] || {};
  return {
    ticker,
    current_price: Number.isFinite(t.currentPrice) ? t.currentPrice : null,
    pct_from_52w_high: Number.isFinite(t.pctFrom52wHigh) ? t.pctFrom52wHigh : null,
    trend_1m_pct: Number.isFinite(t.trend1mPct) ? t.trend1mPct : null,
  };
}).filter(c => c.pct_from_52w_high != null);

const spy = wl.SPY || {};
const spyPct52w = Number.isFinite(spy.pctFrom52wHigh) ? spy.pctFrom52wHigh : null;
const spyTrend1m = Number.isFinite(spy.trend1mPct) ? spy.trend1mPct : null;

const avg = arr => arr.length ? round(arr.reduce((s, v) => s + v, 0) / arr.length) : null;
const mag7AvgPct52w = avg(constituents.map(c => c.pct_from_52w_high));
const mag7AvgTrend1m = avg(constituents.filter(c => c.trend_1m_pct != null).map(c => c.trend_1m_pct));

const divergence52w = (mag7AvgPct52w != null && spyPct52w != null) ? round(mag7AvgPct52w - spyPct52w) : null;
const divergenceTrend1m = (mag7AvgTrend1m != null && spyTrend1m != null) ? round(mag7AvgTrend1m - spyTrend1m) : null;

// Dispersion within Mag7 itself matters — a single outlier (has repeatedly been
// AAPL in 2026) can mask that most of the group is weakening. Flag the spread.
const pct52wValues = constituents.map(c => c.pct_from_52w_high);
const mag7Min = pct52wValues.length ? Math.max(...pct52wValues) : null; // least negative = strongest
const mag7Max = pct52wValues.length ? Math.min(...pct52wValues) : null; // most negative = weakest
const strongest = constituents.find(c => c.pct_from_52w_high === mag7Min);
const weakest = constituents.find(c => c.pct_from_52w_high === mag7Max);

const DIVERGENCE_FLOOR = -8; // Mag7 underperforming SPY by 8+ points on 52w-high distance
const isDiverging = divergence52w != null && divergence52w <= DIVERGENCE_FLOOR;

const lendingZone = creditState?.derived?.lending_standards_zone?.zone || 'UNKNOWN';
const lendingValue = creditState?.derived?.lending_standards_zone?.value ?? null;

let read_state = 'INSUFFICIENT_DATA';
let interpretation = 'Not enough Mag7/SPY data to assess concentration divergence.';
if (isDiverging && lendingZone === 'TIGHTENING_STRESS') {
  read_state = 'CONCENTRATION_UNWIND_RISK';
  interpretation = `Mag7 is underperforming SPY by ${Math.abs(divergence52w)} points on distance from 52-week highs, AND bank lending standards are in the tightening-stress zone (SLOOS ${lendingValue}%). This is the combination that historically preceded the dot-com, GFC, and 2022 drawdowns — treat as a real rollover risk, not just rotation.`;
} else if (isDiverging && lendingZone === 'LOOSE') {
  read_state = 'ROTATION_NOT_ROLLOVER';
  interpretation = `Mag7 is underperforming SPY by ${Math.abs(divergence52w)} points on distance from 52-week highs, but bank lending standards are LOOSE (SLOOS ${lendingValue}%, well below the ~40% stress threshold). Historically this combination reads as index-leadership rotation, not a confirmed broad rollover — but the divergence itself is real and worth tracking, since credit conditions can flip.`;
} else if (isDiverging) {
  read_state = 'DIVERGENCE_UNCONFIRMED';
  interpretation = `Mag7 is underperforming SPY by ${Math.abs(divergence52w)} points, but lending-standards zone is ${lendingZone} — insufficient credit context to classify as rotation vs. rollover risk.`;
} else {
  read_state = 'NO_SIGNIFICANT_DIVERGENCE';
  interpretation = `Mag7 and SPY are not meaningfully diverging on 52-week-high distance (gap ${divergence52w ?? 'unknown'} points).`;
}

const state = {
  artifact: 'market-concentration-state',
  version: 1,
  generatedAt: new Date().toISOString(),
  methodology: 'Compares Magnificent 7 (AAPL/MSFT/GOOGL/AMZN/NVDA/META/TSLA) average distance from 52-week high and 1-month trend against SPY, cross-referenced with the SLOOS bank-lending-tightening zone from credit-state.json. Concentration risk in a cap-weighted index shows up first as leader weakness while the index itself stays calm — this makes that divergence a permanent, numeric check instead of a one-off observation.',
  source_credit: 'Cross-checked against a market-narrative video (Bravos Research) that proposed this same divergence-plus-credit framework; the underlying SLOOS and price data were independently verified against FRED and live market data before being encoded here — this artifact reflects the verified data, not the video itself.',
  mag7: {
    constituents,
    avg_pct_from_52w_high: mag7AvgPct52w,
    avg_trend_1m_pct: mag7AvgTrend1m,
    strongest: strongest ? { ticker: strongest.ticker, pct_from_52w_high: strongest.pct_from_52w_high } : null,
    weakest: weakest ? { ticker: weakest.ticker, pct_from_52w_high: weakest.pct_from_52w_high } : null,
  },
  spy: {
    pct_from_52w_high: spyPct52w,
    trend_1m_pct: spyTrend1m,
  },
  divergence: {
    pct_from_52w_high_gap: divergence52w,
    trend_1m_gap: divergenceTrend1m,
    floor_used: DIVERGENCE_FLOOR,
    is_diverging: isDiverging,
  },
  credit_context: {
    lending_standards_zone: lendingZone,
    lending_standards_value: lendingValue,
  },
  read_state,
  interpretation,
  invalidation: 'This read flips from ROTATION_NOT_ROLLOVER to CONCENTRATION_UNWIND_RISK if SLOOS net tightening rises back above ~40% while the Mag7/SPY divergence persists — re-run after each quarterly SLOOS release and any meaningful market move.',
};

write('market-concentration-state.json', state);
console.log(`market-concentration: read=${read_state} mag7_avg_52wH=${mag7AvgPct52w}% spy_52wH=${spyPct52w}% gap=${divergence52w}pts lending_zone=${lendingZone} (${lendingValue}%)`);
