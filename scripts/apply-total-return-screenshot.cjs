const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const p = path.join(root, 'data/report-state.live.json');
const state = JSON.parse(fs.readFileSync(p, 'utf8'));
const source = 'Robinhood total-return screenshot OCR/manual baseline 2026-05-14 15:09 ET';
// OCR aligned these total-return rows to the visible stock holdings list. Option/DOGE total return was not clearly visible.
const returns = {
  MSFT: { totalReturnUsd: 63.74, totalReturnPct: 5.47 },
  AMZN: { totalReturnUsd: 3235.43, totalReturnPct: 57.01 },
  CEG: { totalReturnUsd: -96.26, totalReturnPct: -10.45 },
  META: { totalReturnUsd: 1106.08, totalReturnPct: 27.40 },
  TSLT: { totalReturnUsd: -338.10, totalReturnPct: -49.00 },
  CONL: { totalReturnUsd: -2367.80, totalReturnPct: -85.18 },
  SPY: { totalReturnUsd: 8105.15, totalReturnPct: 33.43 },
  MA: { totalReturnUsd: -360.90, totalReturnPct: -15.52 },
  BMNR: { totalReturnUsd: -405.73, totalReturnPct: -5.09 },
  TSNF: { totalReturnUsd: 160.80, totalReturnPct: 14.80 },
  NFLX: { totalReturnUsd: -27.25, totalReturnPct: -1.24 }
};
for (const h of state.holdings || []) {
  const r = returns[h.ticker];
  if (r) Object.assign(h, r, { totalReturnSource: source });
}
state.meta.totalReturnSource = source;
state.meta.totalReturnCaveat = 'Total return OCR mapped to stock rows; option and DOGE total return were not clearly visible in the screenshot.';
state.meta.generatedAt = new Date().toISOString();
fs.writeFileSync(p, JSON.stringify(state, null, 2));
console.log(`applied total returns for ${Object.keys(returns).length} holdings`);
