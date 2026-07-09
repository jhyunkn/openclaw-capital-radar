const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outDir = path.join(root, 'data', 'cache');
const userAgent = 'OpenClaw Capital Radar public data cache refresh';

function writeJson(file, payload) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(payload, null, 2) + '\n');
}

function round(value, digits = 4) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
}

function compactRows(rows, maxRows = 900) {
  const clean = rows
    .filter(row => row && row.date && Number.isFinite(Number(row.value)))
    .map(row => ({ date: row.date, value: round(row.value) }))
    .sort((a, b) => a.date.localeCompare(b.date));
  if (clean.length <= maxRows) return clean;
  const stride = Math.ceil(clean.length / maxRows);
  const sampled = clean.filter((_, index) => index % stride === 0);
  const latest = clean.at(-1);
  if (!sampled.length || sampled.at(-1).date !== latest.date) sampled.push(latest);
  return sampled;
}

async function fetchText(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

async function fetchJson(url, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': userAgent } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function parseFredCsv(csv, seriesId) {
  const lines = String(csv || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(part => part.trim());
  const valueIndex = Math.max(1, header.findIndex(part => part === seriesId));
  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const date = String(parts[0] || '').trim();
    const raw = String(parts[valueIndex] || '').trim();
    const value = raw === '.' || raw === '' ? null : Number(raw);
    return { date, value };
  }).filter(row => row.date && Number.isFinite(row.value));
}

async function fredSeries(seriesId) {
  const csvUrl = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const csv = await fetchText(csvUrl);
  return compactRows(parseFredCsv(csv, seriesId), 1200);
}

async function yahooSeries(symbol, range = '10y', interval = '1d') {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false&events=div%2Csplits`;
  const json = await fetchJson(url);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo chart result for ${symbol}`);
  const quote = result.indicators?.quote?.[0] || {};
  const timestamps = result.timestamp || [];
  const closes = quote.close || [];
  const rows = timestamps.map((timestamp, index) => ({
    date: new Date(timestamp * 1000).toISOString().slice(0, 10),
    value: closes[index]
  }));
  return compactRows(rows, 900);
}

async function collectSeries(defs, fetcher) {
  const series = {};
  const refreshMeta = {};
  const errors = [];
  await Promise.all(Object.entries(defs).map(async ([id, def]) => {
    try {
      const rows = await fetcher(id, def);
      if (!rows.length) throw new Error('no numeric observations');
      series[id] = rows;
      refreshMeta[id] = {
        rows: rows.length,
        latest_date: rows.at(-1).date,
        latest_value: rows.at(-1).value,
        refreshed_at: new Date().toISOString()
      };
      console.log(`cache ${id} ${rows.length} rows latest ${rows.at(-1).date}`);
    } catch (error) {
      errors.push({ id, error: error.message });
      console.warn(`cache failed ${id}: ${error.message}`);
    }
  }));
  return { series, refreshMeta, errors };
}

function sourceMap(defs) {
  return Object.fromEntries(Object.entries(defs).map(([id, def]) => [id, {
    label: def.label,
    source_url: def.sourceUrl
  }]));
}

function cachePayload({ artifact, sources, series, refreshMeta, errors, sourcePolicy, limitations = [], scope }) {
  return {
    artifact,
    version: 2,
    cache_status: errors.length ? 'PARTIAL_PUBLIC_REFRESHED' : 'PUBLIC_REFRESHED',
    created_at: new Date().toISOString(),
    source_policy: sourcePolicy,
    ...(scope ? { scope } : {}),
    sources,
    series,
    refresh_meta: refreshMeta,
    ...(errors.length ? { refresh_errors: errors } : {}),
    limitations
  };
}

async function writeFredCache(file, artifact, defs, sourcePolicy, limitations) {
  const result = await collectSeries(defs, id => fredSeries(id));
  writeJson(path.join(outDir, file), cachePayload({
    artifact,
    sources: sourceMap(defs),
    series: result.series,
    refreshMeta: result.refreshMeta,
    errors: result.errors,
    sourcePolicy,
    limitations
  }));
}

async function writeYahooCache(file, artifact, defs, sourcePolicy, limitations, scope) {
  const result = await collectSeries(defs, (_, def) => yahooSeries(def.symbol, def.range, def.interval));
  writeJson(path.join(outDir, file), cachePayload({
    artifact,
    sources: sourceMap(defs),
    series: result.series,
    refreshMeta: result.refreshMeta,
    errors: result.errors,
    sourcePolicy,
    limitations,
    scope
  }));
}

async function main() {
  await writeFredCache('duration-series.json', 'duration-series-cache', {
    DGS2: { label: '2-Year Treasury Constant Maturity Rate', sourceUrl: 'https://fred.stlouisfed.org/series/DGS2' },
    DGS10: { label: '10-Year Treasury Constant Maturity Rate', sourceUrl: 'https://fred.stlouisfed.org/series/DGS10' },
    DFII10: { label: '10-Year Treasury Inflation-Indexed Security, Constant Maturity', sourceUrl: 'https://fred.stlouisfed.org/series/DFII10' },
    T10YIE: { label: '10-Year Breakeven Inflation Rate', sourceUrl: 'https://fred.stlouisfed.org/series/T10YIE' },
    DTB3: { label: '3-Month Treasury Bill Secondary Market Rate', sourceUrl: 'https://fred.stlouisfed.org/series/DTB3' }
  }, 'Refreshed from FRED public CSV endpoints. Homepage build reads this cache and does not fetch FRED live.', [
    'Term premium, Treasury issuance pressure, fiscal deficit pressure, MOVE index, and TLT price trend remain missing evidence.'
  ]);

  await writeFredCache('credit-series.json', 'credit-series-cache', {
    BAMLH0A0HYM2: { label: 'ICE BofA US High Yield OAS', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2' },
    BAMLC0A0CM: { label: 'ICE BofA US Corporate OAS', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLC0A0CM' },
    BAMLH0A3HYC: { label: 'ICE BofA CCC & Lower US High Yield OAS', sourceUrl: 'https://fred.stlouisfed.org/series/BAMLH0A3HYC' },
    TOTBKCR: { label: 'Bank Credit, All Commercial Banks', sourceUrl: 'https://fred.stlouisfed.org/series/TOTBKCR' }
  }, 'Refreshed from FRED public CSV endpoints. Homepage build reads this cache and does not fetch FRED live.', [
    'Default rates, lending standards, HYG/LQD price trend, and private-credit stress remain missing evidence.'
  ]);

  await writeFredCache('money-cash-series.json', 'money-cash-series-cache', {
    DTB3: { label: '3-Month Treasury Bill Secondary Market Rate', sourceUrl: 'https://fred.stlouisfed.org/series/DTB3' },
    CPIAUCSL: { label: 'Consumer Price Index for All Urban Consumers', sourceUrl: 'https://fred.stlouisfed.org/series/CPIAUCSL' },
    DFF: { label: 'Effective Federal Funds Rate', sourceUrl: 'https://fred.stlouisfed.org/series/DFF' }
  }, 'Refreshed from FRED public CSV endpoints. Homepage build reads this cache and does not fetch FRED live.', [
    'Money-market assets, bank reserves, M2, financial conditions, TGA, reverse repo, and SOFR remain pending.'
  ]);

  await writeYahooCache('volatility-series.json', 'volatility-series-cache', {
    VIX: { label: 'CBOE Volatility Index', symbol: '^VIX', sourceUrl: 'https://finance.yahoo.com/quote/%5EVIX' },
    MOVE: { label: 'ICE BofA MOVE Index proxy', symbol: '^MOVE', sourceUrl: 'https://finance.yahoo.com/quote/%5EMOVE' },
    VVIX: { label: 'CBOE VVIX Index proxy', symbol: '^VVIX', sourceUrl: 'https://finance.yahoo.com/quote/%5EVVIX' }
  }, 'Refreshed from Yahoo Finance public chart endpoints where symbols are available.', [
    'Yahoo chart API is public/unofficial. Skew, put/call ratio, credit volatility, realized volatility, and option-market positioning remain missing evidence.'
  ]);

  await writeYahooCache('fx-dollar-series.json', 'fx-dollar-series-cache', {
    DXY: { label: 'US Dollar Index', symbol: 'DX-Y.NYB', sourceUrl: 'https://finance.yahoo.com/quote/DX-Y.NYB' },
    EURUSD: { label: 'Euro / US Dollar', symbol: 'EURUSD=X', sourceUrl: 'https://finance.yahoo.com/quote/EURUSD=X' },
    USDJPY: { label: 'US Dollar / Japanese Yen', symbol: 'JPY=X', sourceUrl: 'https://finance.yahoo.com/quote/JPY=X' },
    USDCNY: { label: 'US Dollar / Chinese Yuan', symbol: 'CNY=X', sourceUrl: 'https://finance.yahoo.com/quote/CNY=X' }
  }, 'Refreshed from Yahoo Finance public chart endpoints. Homepage build reads this cache and does not fetch FX live.', [
    'Yahoo chart API is public/unofficial. Cross-currency basis, dollar funding spreads, reserves, and offshore dollar liquidity remain missing evidence.'
  ]);

  await writeYahooCache('commodities-series.json', 'commodities-series-cache', {
    OIL: { label: 'WTI crude oil futures proxy', symbol: 'CL=F', sourceUrl: 'https://finance.yahoo.com/quote/CL=F' },
    NATGAS: { label: 'Natural gas futures proxy', symbol: 'NG=F', sourceUrl: 'https://finance.yahoo.com/quote/NG=F' },
    URANIUM: { label: 'Uranium equities proxy', symbol: 'URA', sourceUrl: 'https://finance.yahoo.com/quote/URA' },
    COPPER: { label: 'Copper futures proxy', symbol: 'HG=F', sourceUrl: 'https://finance.yahoo.com/quote/HG=F' },
    AGRI: { label: 'Agriculture basket proxy', symbol: 'DBA', sourceUrl: 'https://finance.yahoo.com/quote/DBA' },
    SILVER: { label: 'Silver futures proxy', symbol: 'SI=F', sourceUrl: 'https://finance.yahoo.com/quote/SI=F' },
    GOLD: { label: 'Gold futures proxy', symbol: 'GC=F', sourceUrl: 'https://finance.yahoo.com/quote/GC=F' }
  }, 'Refreshed from Yahoo Finance public chart endpoints. Homepage build reads this cache and does not fetch commodities live.', [
    'Yahoo chart API is public/unofficial. Inventory data, futures curves, shipping data, regional power prices, and producer cost curves remain missing evidence.'
  ], {
    energy: ['oil', 'natural_gas', 'uranium'],
    industrial: ['copper'],
    food: ['agriculture_basket'],
    monetary_metal: ['silver', 'gold']
  });

  await writeYahooCache('equity-ownership-series.json', 'equity-ownership-series-cache', {
    SPX: { label: 'S&P 500 index', symbol: '^GSPC', sourceUrl: 'https://finance.yahoo.com/quote/%5EGSPC' },
    RSP_PROXY: { label: 'Equal-weight S&P 500 ETF proxy', symbol: 'RSP', sourceUrl: 'https://finance.yahoo.com/quote/RSP' },
    IWM_PROXY: { label: 'Russell 2000 ETF proxy', symbol: 'IWM', sourceUrl: 'https://finance.yahoo.com/quote/IWM' },
    VT_PROXY: { label: 'Global total-market ETF proxy', symbol: 'VT', sourceUrl: 'https://finance.yahoo.com/quote/VT' }
  }, 'Refreshed from Yahoo Finance public chart endpoints. Homepage build reads this cache and does not fetch equity breadth live.', [
    'Yahoo chart API is public/unofficial. Advance/decline breadth, valuation, earnings revisions, buybacks, and sector participation remain missing evidence.'
  ]);

  const realSources = {
    HPI: { label: 'S&P CoreLogic Case-Shiller US National Home Price Index', sourceUrl: 'https://fred.stlouisfed.org/series/CSUSHPINSA' },
    AFFORD: { label: '30-year fixed mortgage rate affordability-pressure proxy', sourceUrl: 'https://fred.stlouisfed.org/series/MORTGAGE30US' },
    CRE: { label: 'US REIT market proxy', sourceUrl: 'https://finance.yahoo.com/quote/VNQ' },
    FARM: { label: 'Agriculture land/produce proxy', sourceUrl: 'https://finance.yahoo.com/quote/DBA' },
    INFRA: { label: 'US infrastructure ETF proxy', sourceUrl: 'https://finance.yahoo.com/quote/PAVE' }
  };
  const realResult = await collectSeries(realSources, id => {
    if (id === 'HPI') return fredSeries('CSUSHPINSA');
    if (id === 'AFFORD') return fredSeries('MORTGAGE30US');
    if (id === 'CRE') return yahooSeries('VNQ');
    if (id === 'FARM') return yahooSeries('DBA');
    if (id === 'INFRA') return yahooSeries('PAVE');
    throw new Error(`unknown real-assets series ${id}`);
  });
  writeJson(path.join(outDir, 'real-assets-series.json'), cachePayload({
    artifact: 'real-assets-series-cache',
    sources: realSources,
    series: realResult.series,
    refreshMeta: realResult.refreshMeta,
    errors: realResult.errors,
    sourcePolicy: 'Refreshed from public FRED and Yahoo Finance endpoints. Homepage build reads this cache and does not fetch real-assets data live.',
    limitations: [
      'Mortgage rate is an affordability-pressure proxy, not a full household affordability index.',
      'VNQ, DBA, and PAVE are listed-market proxies, not direct cap-rate, farmland, or infrastructure-asset datasets.',
      'Cap rates, rents, vacancy, lending standards, construction pipeline, and regional dispersion remain missing evidence.'
    ],
    scope: {
      housing: ['housing_price_index', 'housing_affordability'],
      commercial_real_estate: ['cre_stress'],
      productive_land: ['farmland'],
      infrastructure: ['infrastructure_proxy']
    }
  }));
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
