'use strict';
const fs   = require('fs');
const path = require('path');

const root  = path.join(__dirname, '..');
const rhPath = path.join(root, 'outputs', 'robinhood-positions.json');
const cbPath = path.join(root, 'data', 'cost-basis.manual.json');

if (!fs.existsSync(rhPath)) {
  console.log('sync-robinhood-positions: robinhood-positions.json not found — skipping');
  process.exit(0);
}

const rh = JSON.parse(fs.readFileSync(rhPath, 'utf8'));
const ageHours = (Date.now() - new Date(rh.syncedAt).getTime()) / 3_600_000;

if (ageHours > 72) {
  console.log(`sync-robinhood-positions: data is ${ageHours.toFixed(1)}h old — skipping (run a new Claude session to refresh)`);
  process.exit(0);
}

const cb       = fs.existsSync(cbPath) ? JSON.parse(fs.readFileSync(cbPath, 'utf8')) : {};
const existing = cb.holdings || {};
const updated  = { ...existing };

for (const pos of (rh.positions || [])) {
  const sym      = String(pos.symbol).toUpperCase();
  const qty      = parseFloat(pos.quantity);
  const avgCost  = parseFloat(pos.avgCostPrice);
  const suppliedBasis = Number(pos.costBasis);
  const basis    = Number.isFinite(suppliedBasis)
    ? Math.round(suppliedBasis * 100) / 100
    : Math.round(qty * avgCost * 100) / 100;
  updated[sym]   = { ...(existing[sym] || {}), avgCostPrice: avgCost, shares: qty, totalCostBasis: basis };
}

const asOf = new Date(rh.syncedAt).toISOString().slice(0, 10);
fs.writeFileSync(cbPath, JSON.stringify({
  ...cb,
  source: `Robinhood live sync ${asOf}`,
  policy: 'avgCostPrice and shares are live from Robinhood API. totalReturnUsd/Pct are stale point-in-time — use unrealizedGain/Pct for live P&L.',
  asOf,
  rhSyncedAt: rh.syncedAt,
  holdings: updated,
}, null, 2));

console.log(`sync-robinhood-positions: synced ${rh.positions.length} positions → cost-basis.manual.json  (${ageHours.toFixed(1)}h old)`);

// Also push live prices into report-state.live.json's holdings — nothing else in the
// regular pipeline refreshes h.livePrice/priceAsOf/marketValue, so without this they
// freeze at whatever a one-off script last set them to.
const statePath = path.join(root, 'data', 'report-state.live.json');
if (fs.existsSync(statePath)) {
  const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
  const rhBySym = new Map((rh.positions || []).map(p => [String(p.symbol).toUpperCase(), p]));
  const stateBySym = new Map((state.holdings || []).map(h => [String(h.ticker || '').toUpperCase(), h]));
  let holdingsAdded = 0;
  for (const pos of (rh.positions || [])) {
    const sym = String(pos.symbol || '').toUpperCase();
    if (!sym || stateBySym.has(sym)) continue;
    const qty = Number(pos.quantity);
    const avgCost = Number(pos.avgCostPrice);
    const livePrice = Number(pos.livePrice);
    const costBasis = Number.isFinite(Number(pos.costBasis))
      ? Number(pos.costBasis)
      : (Number.isFinite(qty) && Number.isFinite(avgCost) ? qty * avgCost : null);
    const isCrypto = pos.assetClass === 'crypto' || sym === 'DOGE';
    const seeded = {
      ticker: sym,
      ...(sym === 'DOGE' ? { displayName: 'Dogecoin' } : {}),
      shares: qty,
      role: isCrypto ? 'Crypto/speculative liquidity beta' : 'Broker-synced holding pending classification',
      signal: isCrypto ? 'TACTICAL WATCH' : 'INVESTIGATE',
      health: isCrypto ? 'High volatility' : 'Pending classification',
      thesis: isCrypto
        ? 'Speculative crypto beta; keep as a capped risk bucket, not a core compounder.'
        : 'New broker-synced position requires thesis and risk classification.',
      watch: isCrypto
        ? 'Crypto liquidity, BTC trend, meme-coin risk appetite, and drawdown control.'
        : 'Thesis, liquidity, concentration, and invalidation.',
      actionRationale: isCrypto
        ? 'Monitor as tactical risk exposure; do not average down without crypto confirmation.'
        : 'Freeze adds until the position is classified.',
      exposureBucket: isCrypto ? 'Crypto / speculative beta' : 'Unclassified broker holding',
      livePrice: Number.isFinite(livePrice) ? livePrice : null,
      priceAsOf: pos.priceAsOf || rh.syncedAt,
      dayChangePct: Number.isFinite(Number(pos.dayChangePct)) ? Number(pos.dayChangePct) : null,
      marketValue: Number.isFinite(Number(pos.currentValue)) ? Number(pos.currentValue) : null,
      liveDataSource: 'Robinhood MCP live sync (read-only)',
      sourceConfidence: 'high: authenticated broker position and quote snapshot',
      avgCostPrice: Number.isFinite(avgCost) ? avgCost : null,
      totalCostBasis: Number.isFinite(costBasis) ? Math.round(costBasis * 100) / 100 : null,
    };
    if (seeded.marketValue != null && seeded.totalCostBasis != null) {
      seeded.unrealizedGain = Math.round((seeded.marketValue - seeded.totalCostBasis) * 100) / 100;
      seeded.unrealizedPct = seeded.totalCostBasis
        ? Math.round((seeded.unrealizedGain / seeded.totalCostBasis) * 10000) / 100
        : null;
    }
    state.holdings = [...(state.holdings || []), seeded];
    stateBySym.set(sym, seeded);
    holdingsAdded++;
  }
  let priceUpdated = 0;
  for (const h of (state.holdings || [])) {
    const pos = rhBySym.get(String(h.ticker || '').toUpperCase());
    if (!pos) continue;
    const price = Number(pos.livePrice);
    if (!Number.isFinite(price)) continue;
    h.livePrice = price;
    h.priceAsOf = rh.syncedAt;
    h.marketValue = Math.round(price * parseFloat(pos.quantity) * 100) / 100;
    priceUpdated++;
  }
  const portfolioTotal = Number(rh.portfolio?.totalValue);
  if (Number.isFinite(portfolioTotal) && portfolioTotal > 0) {
    for (const h of (state.holdings || [])) {
      const marketValue = Number(h.marketValue);
      h.portfolioWeightPct = Number.isFinite(marketValue)
        ? Math.round((marketValue / portfolioTotal) * 10000) / 100
        : null;
    }
  }
  state.meta = state.meta || {};
  state.meta.holdingsSyncedAt = rh.syncedAt;
  state.meta.holdingsSource = 'Robinhood MCP live sync (read-only)';
  state.meta.holdingsSyncNote = `${(rh.positions || []).length} live broker positions reconciled; quantities, exact cost basis, cash, buying power, and portfolio totals refreshed.`;
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
  console.log(`sync-robinhood-positions: refreshed ${priceUpdated} holdings and added ${holdingsAdded} missing broker holding(s) in report-state.live.json`);
}
