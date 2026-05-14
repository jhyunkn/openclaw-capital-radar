const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const p = path.join(root, 'data/report-state.live.json');
const state = JSON.parse(fs.readFileSync(p, 'utf8'));
const asOf = '2026-05-14T19:08:00.000Z';
const source = 'Robinhood screenshot OCR/manual baseline 2026-05-14 15:08 ET';
const incoming = [
  { ticker:'VOYG-35C-2027', displayName:'VOYG $35 Call 1/15/2027', shares:1, livePrice:1090.00, dayChangePct:15.96, role:'Long-dated call option / tactical asymmetric bet', signal:'SPECULATIVE REVIEW', health:'Option risk', thesis:'Asymmetric upside through a dated call option; requires underlying VOYG thesis and catalyst path.', watch:'Time decay, spread/liquidity, implied volatility, underlying thesis quality.', actionRationale:'Treat as high-risk option exposure; hold only with explicit catalyst and defined loss tolerance.', exposureBucket:'Options / convex speculation', liveDataSource:source },
  { ticker:'DOGE', displayName:'Dogecoin', shares:17737.75, livePrice:0.117485, dayChangePct:4.54, role:'Crypto/speculative liquidity beta', signal:'TACTICAL WATCH', health:'High volatility', thesis:'Speculative crypto beta; useful only as small risk bucket, not core compounder.', watch:'Crypto liquidity, BTC trend, meme-coin risk appetite, drawdown control.', actionRationale:'Monitor as tactical risk exposure; size must remain controlled.', exposureBucket:'Crypto / speculative beta', liveDataSource:source },
  { ticker:'MSFT', shares:3, livePrice:409.57, dayChangePct:1.08 },
  { ticker:'AMZN', shares:33.31, livePrice:267.54, dayChangePct:-0.96 },
  { ticker:'CEG', shares:3, livePrice:274.76, dayChangePct:-0.05 },
  { ticker:'META', shares:8.33, livePrice:617.47, dayChangePct:0.14 },
  { ticker:'TSLT', shares:15, livePrice:23.46, dayChangePct:0.09 },
  { ticker:'CONL', shares:40, livePrice:10.25, dayChangePct:16.48 },
  { ticker:'SPY', shares:43.23, livePrice:748.30, dayChangePct:0.81 },
  { ticker:'MA', shares:4.01, livePrice:489.38, dayChangePct:-0.26 },
  { ticker:'BMNR', shares:340, livePrice:22.22, dayChangePct:4.91 },
  { ticker:'TSNF', shares:40, livePrice:31.18, dayChangePct:0.94 },
  { ticker:'NFLX', shares:25, livePrice:87.09, dayChangePct:-0.54 }
];
const map = new Map((state.holdings || []).map(h => [h.ticker, h]));
for (const x of incoming) {
  const h = map.get(x.ticker) || { ticker:x.ticker, ratingBreakdown:[{label:'Manual baseline', impact:0, note:'Added from user-provided holdings screenshot; needs deeper research.'}], sparkline:[] };
  Object.assign(h, x, { priceAsOf: asOf });
  h.marketValue = +(Number(h.shares || 0) * Number(h.livePrice || 0)).toFixed(2);
  if (!h.sparkline || h.sparkline.length < 2) h.sparkline = [Number(h.livePrice || 0)];
  map.set(x.ticker, h);
}
const order = ['VOYG-35C-2027','DOGE','MSFT','AMZN','CEG','META','TSLT','CONL','SPY','MA','BMNR','TSNF','NFLX'];
state.holdings = order.map(t => map.get(t)).filter(Boolean);
const total = state.holdings.reduce((s,h)=>s + Number(h.marketValue || 0),0);
for (const h of state.holdings) h.portfolioWeightPct = total ? +(Number(h.marketValue || 0) / total * 100).toFixed(2) : 0;
state.meta.generatedAt = new Date().toISOString();
state.meta.reportDate = '2026-05-14';
state.meta.holdingsSource = source;
state.meta.ocrCaveat = 'Screenshot OCR extracted quantities and current prices; cost basis, unrealized P/L, buying power, and option greeks were not visible.';
fs.writeFileSync(p, JSON.stringify(state, null, 2));
console.log(`updated ${state.holdings.length} holdings from screenshot; total ${Math.round(total).toLocaleString()}`);
