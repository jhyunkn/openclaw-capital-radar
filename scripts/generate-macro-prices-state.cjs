const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

const live = readJson(path.join(root, 'data', 'report-state.live.json'), {});
const commodities = readJson(path.join(root, 'outputs', 'macro-commodity-prices.json'), { assets: [] });
const commoditiesCache = readJson(path.join(root, 'data', 'cache', 'commodities-series.json'), { series: {} });

const liveMarket = Array.isArray(live.liveMarket) ? live.liveMarket : [];
const liveRates = Array.isArray(live.liveRatesCredit) ? live.liveRatesCredit : [];

function fromMarket(symbol) {
  return liveMarket.find(m => m.symbol === symbol) || null;
}

function fromCommodity(symbol) {
  return (commodities.assets || []).find(a => a.symbol === symbol) || null;
}

// Spot prices from the Yahoo commodities cache (refreshed by refresh-public-data-caches).
// Preferred over outputs/macro-commodity-prices.json, which is a hand-seeded snapshot with no refresh path.
function fromCache(key) {
  const rows = (commoditiesCache.series || {})[key];
  if (!Array.isArray(rows) || rows.length < 2) return null;
  const valid = rows.filter(r => r && r.date && Number.isFinite(Number(r.value)));
  if (valid.length < 2) return null;
  const last = valid[valid.length - 1];
  const prev = valid[valid.length - 2];
  return {
    price: Number(last.value),
    changePct: (Number(last.value) / Number(prev.value) - 1) * 100,
    asOf: last.date,
  };
}

const gold = fromCache('GOLD') || fromCommodity('GLD');
const oil = fromCache('OIL') || fromCommodity('USO');
const silver = fromCache('SILVER');
const vix = fromMarket('^VIX');
const dxy = fromMarket('DX-Y.NYB');
const btc = fromMarket('BTC-USD');
const ten = liveRates.find(r => r.id === 'DGS10') || null;

const assets = [
  gold && {
    label: 'Gold',
    symbol: 'GC=F',
    price: gold.price,
    changePct: gold.changePct,
    format: 'dollar',
    decimals: 0,
  },
  silver && {
    label: 'Silver',
    symbol: 'SI=F',
    price: silver.price,
    changePct: silver.changePct,
    format: 'dollar',
    decimals: 1,
  },
  oil && {
    label: 'Oil',
    symbol: 'CL=F',
    price: oil.price,
    changePct: oil.changePct,
    format: 'dollar',
    decimals: 0,
  },
  vix && {
    label: 'VIX',
    symbol: '^VIX',
    price: vix.price,
    changePct: vix.changePct,
    format: 'number',
    decimals: 1,
  },
  dxy && {
    label: 'Dollar',
    symbol: 'DXY',
    price: dxy.price,
    changePct: dxy.changePct,
    format: 'number',
    decimals: 1,
  },
  btc && {
    label: 'Bitcoin',
    symbol: 'BTC',
    price: btc.price,
    changePct: btc.changePct,
    format: 'dollar',
    decimals: 0,
  },
  ten && {
    label: '10Y',
    symbol: 'DGS10',
    price: ten.value,
    changePct: null,
    format: 'rate',
    decimals: 2,
  },
].filter(Boolean);

const state = {
  generatedAt: new Date().toISOString(),
  assets,
};

fs.writeFileSync(path.join(root, 'outputs', 'macro-prices-state.json'), JSON.stringify(state, null, 2));
console.log(`generated macro-prices-state: ${assets.map(a => a.label).join(', ')}`);
