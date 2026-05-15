const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const p = path.join(root, 'data/report-state.live.json');
const state = JSON.parse(fs.readFileSync(p, 'utf8'));
const asOf = '2026-05-14T22:12:00-04:00';
const source = 'Robinhood new-holding screenshots OCR/manual baseline 2026-05-14 22:12 ET';
const map = new Map((state.holdings || []).map(h => [h.ticker, h]));
const livePrices = {
  VST: 141.90
};
const vst = map.get('VST') || {
  ticker: 'VST',
  role: 'Power / AI electricity demand infrastructure',
  signal: 'ADD WATCH',
  health: 'New holding / thesis needed',
  thesis: 'Power generation and electricity demand exposure tied to data-center/AI load growth; validate valuation, merchant power risk, regulatory exposure, and overlap with CEG.',
  watch: 'Power prices, data-center demand, regulatory/political risk, valuation crowding, overlap with CEG.',
  actionRationale: 'New position; define thesis, entry quality, and risk budget before adding further.',
  exposureBucket: 'Power / AI infrastructure',
  ratingBreakdown: [{ label: 'New holding', impact: 0, note: 'Added from user screenshot; requires thesis/risk-band validation.' }],
  sparkline: []
};
Object.assign(vst, {
  shares: 8,
  livePrice: livePrices.VST,
  priceAsOf: '2026-05-14T20:00:02.000Z',
  dayChangePct: null,
  marketValue: +(8 * livePrices.VST).toFixed(2),
  totalReturnUsd: -2.40,
  totalReturnPct: -0.21,
  liveDataSource: 'Yahoo Finance chart API public/unofficial endpoint + Robinhood screenshot quantity/return',
  totalReturnSource: source
});
if (!vst.sparkline || vst.sparkline.length < 2) vst.sparkline = [livePrices.VST];
map.set('VST', vst);
const returns = {
  DOGE: { totalReturnUsd: -2573.89, totalReturnPct: -55.47 },
  MSFT: { totalReturnUsd: 56.85, totalReturnPct: 4.88 },
  AMZN: { totalReturnUsd: 3187.47, totalReturnPct: 56.17 },
  CEG: { totalReturnUsd: -97.02, totalReturnPct: -10.54 },
  META: { totalReturnUsd: 1084.81, totalReturnPct: 26.88 },
  TSLT: { totalReturnUsd: -348.75, totalReturnPct: -50.54 },
  CONL: { totalReturnUsd: -2402.00, totalReturnPct: -86.42 },
  SPY: { totalReturnUsd: 7982.38, totalReturnPct: 32.92 },
  MA: { totalReturnUsd: -357.53, totalReturnPct: -15.38 },
  BMNR: { totalReturnUsd: -610.07, totalReturnPct: -7.65 },
  TSNF: { totalReturnUsd: 160.80, totalReturnPct: 14.80 },
  NFLX: { totalReturnUsd: -30.98, totalReturnPct: -1.40 },
  VST: { totalReturnUsd: -2.40, totalReturnPct: -0.21 }
};
for (const [ticker, r] of Object.entries(returns)) {
  const h = map.get(ticker);
  if (h) Object.assign(h, r, { totalReturnSource: source });
}
const order = ['VOYG-35C-2027','DOGE','MSFT','AMZN','CEG','META','TSLT','CONL','SPY','MA','BMNR','TSNF','NFLX','VST'];
state.holdings = order.map(t => map.get(t)).filter(Boolean);
const holdingsTotal = state.holdings.reduce((s,h)=>s + Number(h.marketValue || ((+h.shares||0)*(+h.livePrice||0)) || 0),0);
for (const h of state.holdings) h.portfolioWeightPct = holdingsTotal ? +(Number(h.marketValue || 0) / holdingsTotal * 100).toFixed(2) : 0;
state.meta.reportDate = '2026-05-14';
state.meta.generatedAt = new Date().toISOString();
state.meta.newHoldingSource = source;
state.meta.accountTotalFromScreenshot = 68645;
state.meta.accountAllTimeReturnUsd = 4346.03;
state.meta.accountAllTimeReturnPct = 5.95;
state.meta.cashEarningInterest = 3744.50;
state.meta.cashInterestRatePct = 3.35;
state.meta.cashInterestAccruedThisMonth = 1.17;
state.meta.newHoldingCaveat = 'OCR/manual baseline: VST quantity and return visible; current VST price filled from public Yahoo chart endpoint. Buying power/cash labels were partially ambiguous in screenshot.';
fs.writeFileSync(p, JSON.stringify(state, null, 2));
console.log(`added/updated VST; holdings ${state.holdings.length}; holdings total ${Math.round(holdingsTotal).toLocaleString()}; account screenshot ${state.meta.accountTotalFromScreenshot.toLocaleString()}`);
