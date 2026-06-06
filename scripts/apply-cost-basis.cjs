'use strict';
const fs   = require('fs');
const path = require('path');

const root          = path.join(__dirname, '..');
const costBasisPath = path.join(root, 'data', 'cost-basis.manual.json');
const statePath     = path.join(root, 'data', 'report-state.live.json');

if (!fs.existsSync(costBasisPath)) {
  console.log('apply-cost-basis: cost-basis.manual.json not found — skipping');
  process.exit(0);
}
if (!fs.existsSync(statePath)) {
  console.log('apply-cost-basis: report-state.live.json not found — skipping');
  process.exit(0);
}

const cb    = JSON.parse(fs.readFileSync(costBasisPath, 'utf8'));
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const basis = cb.holdings || {};

let applied = 0;
for (const h of (state.holdings || [])) {
  const b = basis[h.ticker];
  if (!b) continue;

  h.avgCostPrice    = b.avgCostPrice;
  h.totalCostBasis  = b.totalCostBasis;

  if (typeof h.livePrice === 'number' && typeof b.avgCostPrice === 'number' && b.avgCostPrice > 0) {
    const shares      = b.shares ?? h.shares ?? 0;
    h.unrealizedGain  = Math.round((h.livePrice - b.avgCostPrice) * shares * 100) / 100;
    h.unrealizedPct   = Math.round(((h.livePrice / b.avgCostPrice) - 1) * 10000) / 100;
  }

  // Seed broker total return from snapshot if not already set by a more recent apply script
  if (b.totalReturnUsd != null && h.totalReturnUsd == null) {
    h.totalReturnUsd    = b.totalReturnUsd;
    h.totalReturnPct    = b.totalReturnPct;
    h.totalReturnSource = cb.source;
    h.totalReturnCaveat = 'Point-in-time broker snapshot; use unrealizedGain/Pct for live mark-to-market P&L.';
  }

  applied++;
}

fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
console.log(`apply-cost-basis: enriched ${applied} / ${(state.holdings || []).length} holdings`);
