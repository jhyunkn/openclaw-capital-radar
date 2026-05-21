const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const p = path.join(root, 'data/report-state.live.json');
const state = JSON.parse(fs.readFileSync(p, 'utf8'));
const asOf = '2026-05-20T19:54:00-04:00';
const source = 'Robinhood screenshots OCR/manual extraction 2026-05-20 19:54 ET';
const n = v => (v === null || v === undefined || v === '') ? null : Number(v);
const round = (v, d = 2) => Number.isFinite(Number(v)) ? Number(Number(v).toFixed(d)) : null;
const totalReturnPct = (marketValue, totalReturnUsd) => {
  const mv = n(marketValue), tr = n(totalReturnUsd);
  if (!Number.isFinite(mv) || !Number.isFinite(tr)) return null;
  const cost = mv - tr;
  return cost > 0 ? round((tr / cost) * 100, 2) : null;
};
const incoming = [
  { ticker:'VOYG-35C-2027', displayName:'VOYG $35 Call 1/15/2027', shares:1, livePrice:1340.00, marketValue:1340.00, dayChangeUsd:175.00, dayChangePct:15.02, totalReturnUsd:-80.00, totalReturnPct:-5.63, role:'Long-dated call option / tactical asymmetric bet', signal:'SPECULATIVE REVIEW', health:'Option risk', thesis:'Asymmetric upside through a dated call option; requires underlying VOYG thesis and catalyst path.', watch:'Time decay, spread/liquidity, implied volatility, underlying thesis quality.', actionRationale:'Treat as high-risk option exposure; hold only with explicit catalyst and defined loss tolerance.', exposureBucket:'Options / convex speculation', optionDetails:{underlying:'VOYG', strike:35, expiration:'2027-01-15', contracts:1, averageCost:14.20, currentContractPrice:13.40, breakeven:49.20, underlyingPrice:39.00, dateBought:'2026-01-23'} },
  { ticker:'DOGE', displayName:'Dogecoin', shares:17737.75, livePrice:0.103515, marketValue:1836.12, dayChangeUsd:12.76, dayChangePct:0.70, totalReturnUsd:-2804.25, totalReturnPct:-60.43, role:'Crypto/speculative liquidity beta', signal:'TACTICAL WATCH', health:'High volatility', thesis:'Speculative crypto beta; useful only as small risk bucket, not core compounder.', watch:'Crypto liquidity, BTC trend, meme-coin risk appetite, drawdown control.', actionRationale:'Monitor as tactical risk exposure; size must remain controlled.', exposureBucket:'Crypto / speculative beta' },
  { ticker:'SPY', shares:43.23, marketValue:31919.99, totalReturnUsd:7671.71 },
  { ticker:'AMZN', shares:33.31, marketValue:8799.95, totalReturnUsd:3126.52 },
  { ticker:'BMNR', shares:340, marketValue:6548.91, totalReturnUsd:-1428.96 },
  { ticker:'META', shares:8.33, marketValue:5024.53, totalReturnUsd:988.30 },
  { ticker:'NFLX', shares:25, marketValue:2196.75, totalReturnUsd:-8.48 },
  { ticker:'MA', shares:4.01, marketValue:1992.68, totalReturnUsd:-332.69 },
  { ticker:'MSFT', shares:3, marketValue:1255.08, totalReturnUsd:89.91 },
  { ticker:'TSNF', shares:40, marketValue:1199.60, totalReturnUsd:113.20 },
  { ticker:'VST', shares:8, marketValue:1150.88, totalReturnUsd:17.20, role:'Power / AI electricity demand infrastructure', signal:'ADD WATCH', health:'New holding / thesis needed', thesis:'Power generation and electricity demand exposure tied to data-center/AI load growth; validate valuation, merchant power risk, regulatory exposure, and overlap with CEG.', watch:'Power prices, data-center demand, regulatory/political risk, valuation crowding, overlap with CEG.', actionRationale:'New position; define thesis, entry quality, and risk budget before adding further.', exposureBucket:'Power / AI infrastructure' },
  { ticker:'CEG', shares:3, marketValue:843.00, totalReturnUsd:-77.73 },
  { ticker:'CONL', shares:40, marketValue:311.61, totalReturnUsd:-2467.99 },
  { ticker:'TSLT', shares:15, marketValue:303.02, totalReturnUsd:-386.99 }
];
const roles = {
  VOYG:'Long-dated call option / tactical asymmetric bet', DOGE:'Crypto/speculative liquidity beta', SPY:'Index ballast / broad-market core', AMZN:'Core compounder', BMNR:'Speculative verification', META:'Core compounder', NFLX:'Hold/watch compounder', MA:'Quality compounder / diversifier', MSFT:'Core AI/cloud compounder', TSNF:'Speculative verification', VST:'Power / AI infrastructure', CEG:'AI power infrastructure watch', CONL:'Tactical leveraged swing only', TSLT:'Tactical leveraged TSLA product'
};
const map = new Map((state.holdings || []).map(h => [String(h.ticker).toUpperCase(), h]));
for (const x of incoming) {
  const key = String(x.ticker).toUpperCase();
  const h = map.get(key) || { ticker:x.ticker, ratingBreakdown:[{label:'Screenshot baseline', impact:0, note:'Added from user-provided Robinhood screenshot; requires deeper research.'}], sparkline:[] };
  const marketValue = n(x.marketValue);
  const shares = n(x.shares);
  const livePrice = n(x.livePrice) ?? (marketValue && shares ? round(marketValue / shares, key === 'DOGE' ? 6 : 2) : null);
  Object.assign(h, x, {
    ticker: x.ticker,
    shares,
    livePrice,
    marketValue,
    priceAsOf: asOf,
    liveDataSource: source,
    holdingsSource: source,
    totalReturnSource: source,
    screenshotExtracted: true,
    dayChangePct: x.dayChangePct ?? null,
    dayChangeUsd: x.dayChangeUsd ?? null,
    totalReturnPct: x.totalReturnPct ?? totalReturnPct(marketValue, x.totalReturnUsd),
    role: x.role || h.role || roles[key] || 'Holding',
    exposureBucket: x.exposureBucket || h.exposureBucket || roles[key] || 'Holding'
  });
  if (!h.sparkline || h.sparkline.length < 2) h.sparkline = [livePrice].filter(Number.isFinite);
  else if (Number.isFinite(livePrice)) h.sparkline[h.sparkline.length - 1] = livePrice;
  map.set(key, h);
}
const order = ['VOYG-35C-2027','DOGE','SPY','AMZN','BMNR','META','NFLX','MA','MSFT','TSNF','VST','CEG','CONL','TSLT'];
state.holdings = order.map(t => map.get(t)).filter(Boolean);
const total = state.holdings.reduce((s,h)=>s + Number(h.marketValue || 0),0);
for (const h of state.holdings) h.portfolioWeightPct = total ? round(Number(h.marketValue || 0) / total * 100, 2) : 0;
state.meta.reportDate = '2026-05-20';
state.meta.generatedAt = new Date().toISOString();
state.meta.holdingsSource = source;
state.meta.totalReturnSource = source;
state.meta.ocrCaveat = 'Local/degraded update from user screenshots. Stocks/ETF values and total returns were visible; most stock day returns were not visible and are set null. DOGE and VOYG option day returns were visible. No fresh web research was performed.';
state.meta.accountStocksEtfsValueFromScreenshot = 61546.00;
state.meta.accountCryptoValueFromScreenshot = 1836.12;
state.meta.accountOptionsValueFromScreenshot = 1340.00;
state.meta.accountMappedHoldingsValue = round(total, 2);
state.meta.cashInterestRatePct = 3.35;
state.meta.cashInterestAccruedThisMonth = 2.68;
state.meta.cashLifetimeInterestPaid = 3.58;
fs.writeFileSync(p, JSON.stringify(state, null, 2) + '\n');
console.log(`updated ${state.holdings.length} holdings from current screenshots; mapped value $${round(total,2).toLocaleString()}`);
