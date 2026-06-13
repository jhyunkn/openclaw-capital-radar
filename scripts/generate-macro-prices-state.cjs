const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

const live = readJson(path.join(root, 'data', 'report-state.live.json'), {});
const commodities = readJson(path.join(root, 'outputs', 'macro-commodity-prices.json'), { assets: [] });

const liveMarket = Array.isArray(live.liveMarket) ? live.liveMarket : [];
const liveRates = Array.isArray(live.liveRatesCredit) ? live.liveRatesCredit : [];

function fromMarket(symbol) {
  return liveMarket.find(m => m.symbol === symbol) || null;
}

function fromCommodity(symbol) {
  return (commodities.assets || []).find(a => a.symbol === symbol) || null;
}

const gld = fromCommodity('GLD');
const uso = fromCommodity('USO');
const vix = fromMarket('^VIX');
const dxy = fromMarket('DX-Y.NYB');
const btc = fromMarket('BTC-USD');
const ten = liveRates.find(r => r.id === 'DGS10') || null;

const assets = [
  gld && {
    label: 'Gold',
    symbol: 'GLD',
    price: gld.price,
    changePct: gld.changePct,
    format: 'dollar',
    decimals: 0,
  },
  uso && {
    label: 'Oil',
    symbol: 'USO',
    price: uso.price,
    changePct: uso.changePct,
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
