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
  const basis    = Math.round(qty * avgCost * 100) / 100;
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
