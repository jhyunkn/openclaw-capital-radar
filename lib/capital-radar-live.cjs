const fs = require('fs');
const path = require('path');

const defaultHoldingsPath = path.join(__dirname, '..', 'data', 'report-state.sample.json');
const fredSeries = {
  DGS2: 'US 2Y Treasury yield',
  DGS10: 'US 10Y Treasury yield',
  DGS30: 'US 30Y Treasury yield',
  T10YIE: '10Y breakeven inflation rate',
  BAMLH0A0HYM2: 'High yield option-adjusted spread',
  BAMLC0A0CM: 'Investment grade corporate OAS',
  DFF: 'Effective federal funds rate'
};

const globalReportSources = [
  { institution: 'Federal Reserve / FRED', geography: 'US', use: 'Rates, inflation, growth, labor, liquidity release metadata', status: 'active-public-csv' },
  { institution: 'BIS', geography: 'Global', use: 'Global liquidity, credit, cross-border banking, financial stability plumbing', status: 'roadmap' },
  { institution: 'IMF', geography: 'Global', use: 'Country macro, policy, fiscal/external risk context', status: 'roadmap' },
  { institution: 'World Bank', geography: 'Global', use: 'Growth outlooks, regional risk framing, development/macro reports', status: 'roadmap' },
  { institution: 'US Treasury Fiscal Data', geography: 'US', use: 'Debt, deficit, fiscal flows, interest expense', status: 'roadmap' },
  { institution: 'JPMorgan / BlackRock / Vanguard public outlooks', geography: 'Global markets', use: 'Capital market assumptions, asset allocation regimes, chartbook framing', status: 'manual-ingestion-roadmap' },
  { institution: 'SEC / company filings', geography: 'US equities', use: 'Company fundamentals, risk factors, filings, earnings evidence', status: 'next-adapter' }
];

function todayISO() { return new Date().toISOString().slice(0, 10); }
function round(n, digits = 2) { return typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(digits)) : null; }
async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'OpenClaw Capital Radar research prototype' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function yahooChart(symbol) {
  const encoded = encodeURIComponent(symbol);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encoded}?range=6mo&interval=1d&includePrePost=false&events=div%2Csplits`;
  const json = await fetchJson(url);
  const result = json.chart?.result?.[0];
  if (!result) throw new Error(`No Yahoo chart result for ${symbol}`);
  const quote = result.indicators?.quote?.[0] || {};
  const closes = (quote.close || []).filter(v => typeof v === 'number');
  const timestamps = result.timestamp || [];
  const meta = result.meta || {};
  const price = meta.regularMarketPrice ?? closes.at(-1) ?? null;
  const prevClose = closes.length > 1 ? closes.at(-2) : meta.chartPreviousClose ?? null;
  const at = idx => closes.length > Math.abs(idx) ? closes.at(idx) : closes[0];
  const calc = base => price && base ? ((price / base) - 1) * 100 : null;
  return {
    symbol,
    source: 'Yahoo Finance chart API (public/unofficial)',
    sourceUrl: url,
    asOf: meta.regularMarketTime ? new Date(meta.regularMarketTime * 1000).toISOString() : new Date().toISOString(),
    currency: meta.currency || null,
    exchange: meta.exchangeName || meta.fullExchangeName || null,
    price: round(price),
    previousClose: round(prevClose),
    changePct: round(calc(prevClose)),
    perf5dPct: round(calc(at(-6))),
    perf1mPct: round(calc(at(-22))),
    perf3mPct: round(calc(at(-66))),
    sparkline: closes.slice(-60).map(v => round(v)),
    dataPoints: closes.length,
    lastTimestamp: timestamps.at(-1) ? new Date(timestamps.at(-1) * 1000).toISOString() : null
  };
}

function parseFredCsv(csv) {
  const lines = csv.trim().split(/\r?\n/).slice(1);
  for (let i = lines.length - 1; i >= 0; i--) {
    const [date, raw] = lines[i].split(',');
    const value = Number(raw);
    if (date && Number.isFinite(value)) return { date, value };
  }
  return null;
}
async function fredLatest(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  const res = await fetch(url, { headers: { 'user-agent': 'OpenClaw Capital Radar research prototype' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const latest = parseFredCsv(await res.text());
  return { id, name: fredSeries[id], source: 'FRED CSV public endpoint', sourceUrl: url, latestDate: latest?.date || null, value: latest ? round(latest.value, 3) : null };
}

function scoreHolding(h) {
  let score = 70;
  const role = (h.role || '').toLowerCase();
  if (role.includes('core') || role.includes('quality') || role.includes('anchor')) score += 8;
  if (role.includes('levered') || role.includes('decay')) score -= 18;
  if (role.includes('speculative') || h.health === 'Unknown') score -= 16;
  if ((h.perf1mPct ?? 0) > 8) score += 5;
  if ((h.perf1mPct ?? 0) < -8) score -= 6;
  if ((h.perf5dPct ?? 0) < -8) score -= 4;
  if ((h.portfolioWeightPct ?? 0) > 35 && h.ticker !== 'SPY') score -= 8;
  score = Math.max(0, Math.min(100, Math.round(score)));
  let signal = h.signal;
  if (score >= 85 && !['TRIM WATCH','EXIT REVIEW','INVESTIGATE'].includes(signal)) signal = 'HOLD';
  else if (score >= 70 && signal === 'HOLD') signal = 'HOLD';
  else if (score >= 55 && signal === 'HOLD') signal = 'HOLD / WATCH';
  else if (score < 40 && role.includes('levered')) signal = 'EXIT REVIEW';
  else if (score < 55 && !['EXIT REVIEW','INVESTIGATE'].includes(signal)) signal = 'TRIM WATCH';
  return { score, signal };
}

function classifyRegime(live) {
  const by = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const spy = by.SPY, qqq = by.QQQ, vix = by['^VIX'];
  const dgs10 = live.ratesCredit.find(x => x.id === 'DGS10');
  const dgs2 = live.ratesCredit.find(x => x.id === 'DGS2');
  const hy = live.ratesCredit.find(x => x.id === 'BAMLH0A0HYM2');
  const curve = dgs10?.value != null && dgs2?.value != null ? dgs10.value - dgs2.value : null;
  const riskOn = (spy?.perf5dPct ?? 0) > 0 && (qqq?.perf5dPct ?? 0) > 0;
  const vol = vix?.price ?? null;
  const pressure = (dgs10?.value ?? 0) > 4.25 ? 'rate pressure present' : 'rate pressure contained';
  return {
    posture: riskOn && (!vol || vol < 20) ? 'HOLD' : 'HOLD / WATCH',
    riskLevel: vol == null ? 'Unknown' : vol < 16 ? 'Low/normal' : vol < 22 ? 'Moderate' : 'High',
    growth: 'Live proxy: equity trend ' + (riskOn ? 'constructive' : 'mixed/weak'),
    inflation: 'Live proxy: breakeven/rates check required; see FRED T10YIE',
    policy: dgs10?.value ? `Live: 10Y Treasury ${dgs10.value}% (${pressure})` : 'Live rates unavailable',
    liquidity: hy?.value ? `Live: HY OAS ${hy.value}` : 'Credit spread unavailable',
    riskAppetite: vol ? `Live: VIX ${vol}; ${riskOn ? 'selective risk-on' : 'risk watch'}` : 'VIX unavailable',
    mostImportantMacroSignal: curve != null ? `2Y/10Y curve is ${curve.toFixed(2)} pts; watch rate pressure and cycle signal.` : 'Rates curve unavailable.',
    confidence: 'Medium for prices/rates; low for fundamentals/news until adapters are added.',
    evidence: ['Yahoo chart endpoint for prices', 'FRED CSV endpoint for Treasury/rates/credit indicators']
  };
}

function exposureBucket(h) {
  const role = (h.role || '').toLowerCase();
  if (role.includes('levered')) return 'Levered / decay product';
  if (role.includes('speculative')) return 'Speculative / thesis verification';
  if (h.ticker === 'SPY') return 'Index anchor';
  if (role.includes('ai') || role.includes('cloud') || role.includes('power')) return 'AI / infrastructure compounder';
  if (role.includes('quality') || role.includes('core')) return 'Core compounder';
  return 'Other exposure';
}

function attachPrices(state, live) {
  const bySymbol = Object.fromEntries(live.marketTape.map(x => [x.symbol, x]));
  const priced = state.holdings.map(h => {
    const quote = bySymbol[h.ticker];
    const marketValue = quote?.price != null ? quote.price * h.shares : null;
    const enriched = { ...h, livePrice: quote?.price ?? null, priceAsOf: quote?.asOf ?? null, dayChangePct: quote?.changePct ?? null, perf5dPct: quote?.perf5dPct ?? null, perf1mPct: quote?.perf1mPct ?? null, perf3mPct: quote?.perf3mPct ?? null, sparkline: quote?.sparkline ?? [], marketValue: marketValue != null ? round(marketValue, 2) : null, liveDataSource: quote?.source ?? 'unavailable', exposureBucket: exposureBucket(h) };
    return enriched;
  });
  const total = priced.reduce((sum, h) => sum + (h.marketValue || 0), 0);
  return priced.map(h => {
    const withWeight = { ...h, portfolioWeightPct: total && h.marketValue ? round((h.marketValue / total) * 100, 2) : null };
    const rating = scoreHolding(withWeight);
    return { ...withWeight, healthScore: rating.score, computedSignal: rating.signal };
  });
}

function buildStrategyState(state) {
  const exposure = {};
  for (const h of state.holdings) exposure[h.exposureBucket] = round((exposure[h.exposureBucket] || 0) + (h.portfolioWeightPct || 0));
  const highestRisk = [...state.holdings].sort((a,b) => (a.healthScore || 0) - (b.healthScore || 0))[0];
  const strongest = [...state.holdings].sort((a,b) => (b.healthScore || 0) - (a.healthScore || 0))[0];
  return {
    exposureMap: Object.entries(exposure).map(([bucket, weight]) => ({ bucket, weightPct: weight })).sort((a,b) => b.weightPct - a.weightPct),
    strongestHolding: strongest?.ticker || null,
    weakestHolding: highestRisk?.ticker || null,
    highestRiskPosition: highestRisk?.ticker || null,
    watchTriggers: [
      'If VIX moves above 22, reduce speculative/levered risk review threshold.',
      'If 10Y Treasury continues rising, pressure-test high-duration AI/cloud multiples.',
      'If HY spreads widen materially, treat risk appetite as fragile even if indices stay green.'
    ],
    strategyPosture: 'Preserve core compounders, isolate levered/path-dependent risk, scout adds only where valuation and catalyst align.'
  };
}

async function buildLiveState(options = {}) {
  const basePath = options.basePath || defaultHoldingsPath;
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  const symbols = [...new Set([...(base.holdings || []).map(h => h.ticker), 'QQQ', 'IWM', '^VIX', 'DX-Y.NYB', 'BTC-USD', 'ETH-USD', 'TSLA', 'COIN'])];
  const marketTape = [], ratesCredit = [], errors = [];
  await Promise.all(symbols.map(async symbol => { try { marketTape.push(await yahooChart(symbol)); } catch (e) { errors.push({ symbol, error: e.message }); } }));
  await Promise.all(Object.keys(fredSeries).map(async id => { try { ratesCredit.push(await fredLatest(id)); } catch (e) { errors.push({ series: id, error: e.message }); } }));
  marketTape.sort((a,b) => symbols.indexOf(a.symbol) - symbols.indexOf(b.symbol));
  ratesCredit.sort((a,b) => Object.keys(fredSeries).indexOf(a.id) - Object.keys(fredSeries).indexOf(b.id));
  const state = JSON.parse(JSON.stringify(base));
  state.meta.reportDate = todayISO();
  state.meta.dataStatus = errors.length ? 'PARTIAL_LIVE_PUBLIC_DATA' : 'LIVE_PUBLIC_DATA';
  state.meta.generatedAt = new Date().toISOString();
  state.meta.liveDataSources = ['Yahoo Finance chart API public/unofficial endpoint', 'FRED public CSV endpoint'];
  state.marketRegime = classifyRegime({ marketTape, ratesCredit });
  state.holdings = attachPrices(state, { marketTape, ratesCredit });
  state.strategy = buildStrategyState(state);
  state.globalInstitutionSources = globalReportSources;
  state.liveMarket = marketTape;
  state.liveRatesCredit = ratesCredit;
  state.liveDataErrors = errors;
  state.valuationExpectation.status = 'Partially live: price, market value, weights, recent performance, rates, and credit are active. Fundamentals/valuation estimates still need provider.';
  state.finalOutput.strongestCurrentHolding = state.strategy.strongestHolding;
  state.finalOutput.weakestCurrentHolding = state.strategy.weakestHolding;
  state.finalOutput.finalJudgment = 'Live public market/rates data is active. Next layer: fundamentals, valuation, news/filings, global institution report ingestion, and chartbook publishing.';
  return state;
}

module.exports = { buildLiveState };
