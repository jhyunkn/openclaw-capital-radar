const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const symbols = [...new Set([...(state.holdings || []).map(h => h.ticker), 'SPY', 'QQQ', 'IWM', '^VIX', 'BTC-USD', 'ETH-USD', 'NVDA', 'AVGO', 'VRT', 'GOOGL', 'IBIT'])];
const outRoots = [path.join(root, 'data', 'market-candles'), path.join(root, 'public', 'data', 'market-candles')];
for (const d of outRoots) fs.mkdirSync(d, { recursive: true });
function safeName(symbol) { return String(symbol).replace(/[^A-Za-z0-9._-]/g, '_').toUpperCase(); }
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'OpenClaw Capital Radar candle builder' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}
async function candlesFor(symbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=5y&interval=1d&includePrePost=false&events=div%2Csplits`;
  const json = await fetchJson(url);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${symbol}`);
  const q = result.indicators?.quote?.[0] || {};
  const candles = (result.timestamp || []).map((t, i) => ({
    time: new Date(t * 1000).toISOString().slice(0, 10),
    open: Number.isFinite(q.open?.[i]) ? Number(q.open[i].toFixed(4)) : null,
    high: Number.isFinite(q.high?.[i]) ? Number(q.high[i].toFixed(4)) : null,
    low: Number.isFinite(q.low?.[i]) ? Number(q.low[i].toFixed(4)) : null,
    close: Number.isFinite(q.close?.[i]) ? Number(q.close[i].toFixed(4)) : null,
    volume: Number.isFinite(q.volume?.[i]) ? q.volume[i] : 0
  })).filter(c => c.open != null && c.high != null && c.low != null && c.close != null);
  return { symbol, source: 'Yahoo Finance chart API public/unofficial endpoint', asOf: new Date().toISOString(), candles };
}
(async () => {
  const errors = [];
  for (const symbol of symbols) {
    try {
      const payload = await candlesFor(symbol);
      for (const d of outRoots) fs.writeFileSync(path.join(d, `${safeName(symbol)}.json`), JSON.stringify(payload, null, 2));
      console.log(`candles ${symbol} ${payload.candles.length}`);
    } catch (error) {
      errors.push({ symbol, error: error.message });
      console.warn(`candles failed ${symbol}: ${error.message}`);
    }
  }
  const manifest = { generatedAt: new Date().toISOString(), sourceState: path.relative(root, statePath), symbols, errors };
  for (const d of outRoots) fs.writeFileSync(path.join(d, 'manifest.json'), JSON.stringify(manifest, null, 2));
})();
