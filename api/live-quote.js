async function fetchYahoo1m(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=1d&interval=1m&includePrePost=true`;
  const res = await fetch(url, { headers: { 'user-agent': 'OpenClaw Capital Radar live quote adapter' } });
  if (!res.ok) throw new Error(`${res.status} ${symbol}`);
  const json = await res.json();
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No chart result for ${symbol}`);
  const meta = result.meta || {};
  const quote = result.indicators?.quote?.[0] || {};
  const closes = quote.close || [];
  const volumes = quote.volume || [];
  const timestamps = result.timestamp || [];
  let last = null;
  for (let i = closes.length - 1; i >= 0; i--) {
    if (typeof closes[i] === 'number') {
      last = { price: closes[i], volume: typeof volumes[i] === 'number' ? volumes[i] : null, timestamp: timestamps[i] || null };
      break;
    }
  }
  const prev = meta.chartPreviousClose ?? meta.previousClose ?? null;
  const price = last?.price ?? meta.regularMarketPrice ?? null;
  return {
    symbol,
    price,
    previousClose: prev,
    changePct: price && prev ? ((price / prev) - 1) * 100 : null,
    asOf: last?.timestamp ? new Date(last.timestamp * 1000).toISOString() : null,
    source: 'Yahoo Finance chart API 1m public/unofficial',
    sourceUrl: url,
    isIntraday: Boolean(last?.timestamp),
    volume: last?.volume,
    exchange: meta.exchangeName || meta.fullExchangeName || null
  };
}

module.exports = async function handler(req, res) {
  try {
    const raw = req.query?.symbols || req.query?.symbol || 'CONL,COIN,BTC-USD,SPY,QQQ,^VIX';
    const symbols = String(raw).split(',').map(s => s.trim()).filter(Boolean).slice(0, 25);
    const results = await Promise.all(symbols.map(async symbol => {
      try { return await fetchYahoo1m(symbol); }
      catch (error) { return { symbol, error: error.message }; }
    }));
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(200).json({ generatedAt: new Date().toISOString(), symbols: results });
  } catch (error) {
    res.setHeader('Cache-Control', 'no-store, max-age=0');
    res.status(500).json({ error: error.message, generatedAt: new Date().toISOString() });
  }
};
