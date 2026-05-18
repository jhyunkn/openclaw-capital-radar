const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const state = JSON.parse(fs.readFileSync(path.join(root, 'data', 'report-state.live.json'), 'utf8'));
const list = v => Array.isArray(v) ? v : [];
const by = Object.fromEntries(list(state.liveMarket).map(x => [x.symbol, x]));
const rates = Object.fromEntries(list(state.liveRatesCredit).map(x => [x.id, x]));
const n = v => typeof v === 'number' && Number.isFinite(v) ? v : null;
const fmtPct = v => n(v) == null ? 'n/a' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`;
const quote = s => by[s] || {};
const watch = ['SPY','QQQ','IWM','NVDA','AVGO','VRT','GOOGL','TSLA','COIN','BTC-USD','GEV','ETN','PWR','NXT','CCJ','OKLO','RKLB','PLTR','RDDT','HIMS','TMDX'];
const rows = watch.map(symbol => ({ symbol, price: quote(symbol).price ?? null, dayChangePct: quote(symbol).changePct ?? null, perf5dPct: quote(symbol).perf5dPct ?? null, perf1mPct: quote(symbol).perf1mPct ?? null, asOf: quote(symbol).asOf ?? null })).filter(x => x.price != null || x.dayChangePct != null);
const decliners = rows.filter(x => n(x.dayChangePct) != null && x.dayChangePct < 0).sort((a,b) => a.dayChangePct - b.dayChangePct);
const advancers = rows.filter(x => n(x.dayChangePct) != null && x.dayChangePct > 0).sort((a,b) => b.dayChangePct - a.dayChangePct);
const severe = decliners.filter(x => x.dayChangePct <= -3);
const broad = ['SPY','QQQ','IWM'].map(symbol => rows.find(x => x.symbol === symbol)).filter(Boolean);
const broadAvg = broad.length ? broad.reduce((s,x)=>s+(x.dayChangePct||0),0)/broad.length : null;
const vix = quote('^VIX');
const dgs10 = rates.DGS10;
const hy = rates.BAMLH0A0HYM2;
const btc = quote('BTC-USD');
const coin = quote('COIN');
const diagnosis = [];
if (broadAvg != null && broadAvg < -0.5) diagnosis.push('Broad tape is negative, with small caps / high beta usually giving the cleaner risk-appetite read.');
if ((quote('IWM').dayChangePct ?? 0) < (quote('SPY').dayChangePct ?? 0) - 0.4) diagnosis.push('Small caps are underperforming SPY, which points to risk-budget tightening rather than a calm mega-cap-only rotation.');
if ((quote('QQQ').dayChangePct ?? 0) < 0 && (quote('QQQ').perf1mPct ?? 0) > 5) diagnosis.push('QQQ is down today after a strong 1M run, consistent with profit-taking / duration-multiple sensitivity rather than thesis failure by itself.');
if ((dgs10?.value ?? 0) > 4.25) diagnosis.push('The 10Y remains above 4.25%, so long-duration growth and crowded AI infrastructure names have less valuation cushion.');
if ((hy?.value ?? 0) < 3.5) diagnosis.push('HY spreads are not flashing credit stress; this looks more like equity risk repricing / crowding than systemic credit stress from the available public data.');
if ((vix.price ?? 0) < 20) diagnosis.push('VIX is below panic territory; this is a risk-watch day, not a confirmed crash signal from volatility alone.');
if ((coin.changePct ?? 0) < -3 || (btc.changePct ?? 0) < -1) diagnosis.push('Crypto-beta is weak, directly relevant to CONL and any levered/path-dependent crypto exposure.');
if (severe.some(x => ['VRT','COIN','OKLO','SMR','RKLB','RDDT','HIMS'].includes(x.symbol))) diagnosis.push('Speculative / crowded thematic names are being marked down harder than the broad index, which argues for patience and evidence gates in Opportunity Scout.');
const implications = [
  'Do not average down in CONL/TSLT-style products just because price is lower; action still requires reclaim/confirmation and risk budget.',
  'Treat the day as an opportunity-screening day, not a buying day: look for relative strength, controlled pullbacks, and names where the thesis improves while price weakens.',
  'For existing core holdings, avoid thesis changes based only on one red tape session unless levels/invalidation are breached.',
  'For Opportunity Scout, favor creative non-overlapping candidates: grid, nuclear fuel, infrastructure services, medical infrastructure, and data/attention assets — but keep them behind evidence gates.'
];
const output = {
  generatedAt: new Date().toISOString(),
  runMode: 'PUBLIC_PRICE_RATE_CREDIT_ONLY_NO_WEB_SEARCH',
  sourceCaveat: 'This diagnoses market behavior from local Yahoo/FRED public adapters only. No fresh news/search causality is claimed.',
  headline: broadAvg != null && broadAvg < -0.5 ? 'Bad tape / risk-off watch' : 'Mixed tape with pockets of stress',
  posture: state.marketRegime?.posture || 'HOLD / WATCH',
  readings: {
    broadAvgDayChangePct: broadAvg == null ? null : Number(broadAvg.toFixed(2)),
    spy: rows.find(x => x.symbol === 'SPY') || null,
    qqq: rows.find(x => x.symbol === 'QQQ') || null,
    iwm: rows.find(x => x.symbol === 'IWM') || null,
    vix: { price: vix.price ?? null, dayChangePct: vix.changePct ?? null, asOf: vix.asOf ?? null },
    tenYear: dgs10 ? { value: dgs10.value, latestDate: dgs10.latestDate } : null,
    highYieldOas: hy ? { value: hy.value, latestDate: hy.latestDate } : null,
    worstDecliners: decliners.slice(0, 8),
    relativeStrength: advancers.slice(0, 6)
  },
  diagnosis,
  implications,
  actionPermission: {
    portfolio: 'HOLD / WATCH; no broad risk increase from a red day alone.',
    tactical: 'Only act on predefined reclaim/support/trim/exit rules; no emotional averaging down.',
    scout: 'Promote ideas only after evidence gates; today is for discovery and relative-strength sorting.'
  }
};
for (const rel of ['outputs/market-stress-brief.json', 'public/outputs/market-stress-brief.json']) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ headline: output.headline, broadAvg: output.readings.broadAvgDayChangePct, worst: output.readings.worstDecliners.slice(0,4).map(x=>`${x.symbol} ${fmtPct(x.dayChangePct)}`), wrote: 'outputs/market-stress-brief.json' }, null, 2));
