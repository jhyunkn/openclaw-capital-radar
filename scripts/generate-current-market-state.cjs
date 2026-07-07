const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outPaths = [
  path.join(root, 'outputs', 'current-market-state.json'),
  path.join(root, 'public', 'outputs', 'current-market-state.json')
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
}
function round(value, digits = 2) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
}
function rows(cache, id) {
  return Array.isArray(cache?.series?.[id])
    ? cache.series[id].filter(row => row && row.date && Number.isFinite(Number(row.value))).map(row => ({ date: row.date, value: Number(row.value) }))
    : [];
}
function latest(series) {
  return Array.isArray(series) && series.length ? series.at(-1) : null;
}
function percentile(series, value) {
  const vals = series.map(row => row.value).filter(Number.isFinite).sort((a, b) => a - b);
  if (!vals.length || !Number.isFinite(Number(value))) return null;
  return round(vals.filter(x => x <= value).length / vals.length * 100, 1);
}
function direction(series) {
  const last = latest(series);
  const prev = series.length > 5 ? series.at(-6) : series.at(-2);
  if (!last || !prev) return 'flat';
  const delta = last.value - prev.value;
  if (Math.abs(delta) < Math.max(0.01, Math.abs(last.value) * 0.002)) return 'flat';
  return delta > 0 ? 'up' : 'down';
}
function history(series, limit = 12) {
  if (!series.length) return [];
  const stride = Math.max(1, Math.floor(series.length / limit));
  const sampled = series.filter((_, index) => index % stride === 0).slice(-limit);
  const last = latest(series);
  if (sampled.at(-1)?.date !== last.date) sampled.push(last);
  return sampled.slice(-limit).map(row => round(row.value));
}
function fmt(value, digits = 2) {
  const n = round(value, digits);
  return n == null ? null : String(n);
}
function metric({ id, label, unit, state, basis, series, valueOverride, freshnessOverride }) {
  const last = latest(series);
  const value = valueOverride ?? last?.value ?? null;
  return {
    id,
    label,
    value: fmt(value, unit === 'pctile' || unit === 'index' ? 1 : 2),
    unit,
    percentile: percentile(series, value) ?? 50,
    direction: direction(series),
    state,
    freshness: freshnessOverride || (last?.date ? `PUBLIC_REFRESHED ${last.date}` : 'missing'),
    basis,
    history: history(series)
  };
}
function marketSeries(state, symbol) {
  const item = (state.liveMarket || []).find(row => row.symbol === symbol);
  const sparkline = Array.isArray(item?.sparkline) ? item.sparkline.map(Number).filter(Number.isFinite) : [];
  return sparkline.map((value, index) => ({ date: String(index).padStart(2, '0'), value }));
}
function cacheMeta(cache, id) {
  const meta = cache.refresh_meta?.[id];
  return meta?.latest_date ? `PUBLIC_REFRESHED ${meta.latest_date}` : cache.cache_status || 'PUBLIC_REFRESHED';
}

const live = readJson('data/report-state.live.json');
const duration = readJson('data/cache/duration-series.json');
const credit = readJson('data/cache/credit-series.json');
const money = readJson('data/cache/money-cash-series.json');
const volatility = readJson('data/cache/volatility-series.json');
const equity = readJson('data/cache/equity-ownership-series.json');
const commodities = readJson('data/cache/commodities-series.json');

const dgs10 = rows(duration, 'DGS10');
const real10 = rows(duration, 'DFII10');
const dgs2 = rows(duration, 'DGS2');
const dff = rows(money, 'DFF');
const hy = rows(credit, 'BAMLH0A0HYM2');
const ig = rows(credit, 'BAMLC0A0CM');
const spx = rows(equity, 'SPX');
const qqq = marketSeries(live, 'QQQ');
const iwm = rows(equity, 'IWM_PROXY');
const vix = rows(volatility, 'VIX');
const move = rows(volatility, 'MOVE');
const copper = rows(commodities, 'COPPER');
const oil = rows(commodities, 'OIL');
const silver = rows(commodities, 'SILVER');

const groups = [
  {
    id: 'rates',
    label: 'Rates / cost of capital',
    purpose: 'Are discount rates helping or hurting risk assets?',
    metrics: [
      metric({ id: 'real_yield_10y', label: '10Y Real Yield', unit: '%', state: 'Restrictive', basis: 'FRED DFII10 TIPS real-yield series', series: real10, freshnessOverride: cacheMeta(duration, 'DFII10') }),
      metric({ id: 'fed_funds', label: 'Fed Funds', unit: '%', state: 'Policy rate', basis: 'FRED DFF effective federal funds rate', series: dff, freshnessOverride: cacheMeta(money, 'DFF') }),
      metric({ id: '2y_treasury', label: '2Y Treasury', unit: '%', state: 'Front-end pressure', basis: 'FRED DGS2 Treasury yield', series: dgs2, freshnessOverride: cacheMeta(duration, 'DGS2') }),
      metric({ id: '10y_treasury', label: '10Y Treasury', unit: '%', state: 'Long-rate pressure', basis: 'FRED DGS10 Treasury yield', series: dgs10, freshnessOverride: cacheMeta(duration, 'DGS10') })
    ]
  },
  {
    id: 'credit',
    label: 'Credit / repayment trust',
    purpose: 'Is borrower trust confirming or denying risk appetite?',
    metrics: [
      metric({ id: 'hy_oas', label: 'HY OAS', unit: '%', state: 'Default-risk gate', basis: 'FRED ICE BofA High Yield OAS', series: hy, freshnessOverride: cacheMeta(credit, 'BAMLH0A0HYM2') }),
      metric({ id: 'ig_oas', label: 'IG OAS', unit: '%', state: 'Investment-grade stress', basis: 'FRED ICE BofA Corporate OAS', series: ig, freshnessOverride: cacheMeta(credit, 'BAMLC0A0CM') })
    ]
  },
  {
    id: 'equity',
    label: 'Equity participation',
    purpose: 'Is risk appetite broad or narrow?',
    metrics: [
      metric({ id: 'spx', label: 'S&P 500', unit: 'index', state: 'Broad market', basis: 'Yahoo ^GSPC public chart proxy', series: spx, freshnessOverride: cacheMeta(equity, 'SPX') }),
      metric({ id: 'nasdaq', label: 'Nasdaq 100 / QQQ', unit: 'index', state: 'Growth leadership', basis: 'Yahoo QQQ live public chart sparkline', series: qqq, freshnessOverride: live.liveMarket?.find(x => x.symbol === 'QQQ')?.asOf || 'LIVE_PUBLIC_DATA' }),
      metric({ id: 'russell', label: 'Russell 2000', unit: 'index', state: 'Small-cap breadth', basis: 'Yahoo IWM public chart proxy', series: iwm, freshnessOverride: cacheMeta(equity, 'IWM_PROXY') })
    ]
  },
  {
    id: 'volatility',
    label: 'Volatility / shock pricing',
    purpose: 'Is protection demand rising or fading?',
    metrics: [
      metric({ id: 'vix', label: 'VIX', unit: 'index', state: 'Equity insurance', basis: 'Yahoo ^VIX public chart proxy', series: vix, freshnessOverride: cacheMeta(volatility, 'VIX') }),
      metric({ id: 'move', label: 'MOVE', unit: 'index', state: 'Rates insurance', basis: 'Yahoo ^MOVE public chart proxy', series: move, freshnessOverride: cacheMeta(volatility, 'MOVE') })
    ]
  },
  {
    id: 'physical',
    label: 'Physical / inflation pressure',
    purpose: 'Are physical-world inputs tightening?',
    metrics: [
      metric({ id: 'copper', label: 'Copper', unit: 'index', state: 'Industrial constraint', basis: 'Yahoo HG=F copper futures proxy', series: copper, freshnessOverride: cacheMeta(commodities, 'COPPER') }),
      metric({ id: 'oil', label: 'Oil', unit: 'index', state: 'Energy input', basis: 'Yahoo CL=F crude futures proxy', series: oil, freshnessOverride: cacheMeta(commodities, 'OIL') }),
      metric({ id: 'silver', label: 'Silver', unit: 'index', state: 'Monetary/industrial metal', basis: 'Yahoo SI=F silver futures proxy', series: silver, freshnessOverride: cacheMeta(commodities, 'SILVER') })
    ]
  }
];

const allMetrics = groups.flatMap(group => group.metrics);
const anomalies = allMetrics
  .map(item => ({ id: item.id, label: item.label, score: Math.round(Math.abs((item.percentile || 50) - 50)), why: `${item.label} sits at ${item.percentile} percentile with ${item.freshness}.`, series: [item.basis] }))
  .sort((a, b) => b.score - a.score)
  .slice(0, 3);

const output = {
  artifact: 'current-market-state',
  generatedAt: new Date().toISOString(),
  asOf: new Date().toISOString(),
  sourcePolicy: 'Generated from refreshed public cache artifacts and live report-state data. No stale seed labels are permitted.',
  groups,
  anomalies
};

for (const file of outPaths) writeJson(file, output);
console.log(`generated current-market-state with ${allMetrics.length} metrics`);
