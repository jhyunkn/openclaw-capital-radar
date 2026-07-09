const fs = require('fs');
const path = require('path');

function isoNow() {
  return new Date().toISOString();
}

function latestTimestamp(items, fields) {
  const dates = [];
  for (const item of items || []) {
    for (const field of fields) {
      const value = item && item[field];
      if (!value) continue;
      const date = new Date(value);
      if (Number.isFinite(date.getTime())) dates.push(date.getTime());
    }
  }
  return dates.length ? new Date(Math.max(...dates)).toISOString() : null;
}

function sourceErrors(errors, source) {
  return (errors || []).filter(error => {
    if (source === 'yahoo') return Boolean(error.symbol);
    if (source === 'fred') return Boolean(error.series);
    return true;
  }).map(error => ({ ...error }));
}

function buildDataHealth(state) {
  const liveMarket = Array.isArray(state?.liveMarket) ? state.liveMarket : [];
  const liveRatesCredit = Array.isArray(state?.liveRatesCredit) ? state.liveRatesCredit : [];
  const errors = Array.isArray(state?.liveDataErrors) ? state.liveDataErrors : [];
  const yahooErrors = sourceErrors(errors, 'yahoo');
  const fredErrors = sourceErrors(errors, 'fred');
  const fredCacheFallbacks = liveRatesCredit.filter(row => row?.fetchedFromCache);
  const generatedAt = state?.meta?.generatedAt || isoNow();

  return {
    generatedAt: isoNow(),
    reportGeneratedAt: generatedAt,
    status: errors.length || fredCacheFallbacks.length ? 'PARTIAL' : 'OK',
    sources: {
      yahooFinance: {
        status: yahooErrors.length ? 'PARTIAL' : (liveMarket.length ? 'OK' : 'MISSING'),
        lastSuccessfulFetchAt: latestTimestamp(liveMarket, ['asOf', 'lastTimestamp']) || (liveMarket.length ? generatedAt : null),
        tickerCount: liveMarket.length,
        failedCount: yahooErrors.length,
        errors: yahooErrors
      },
      fred: {
        status: fredErrors.length || fredCacheFallbacks.length ? 'PARTIAL' : (liveRatesCredit.length ? 'OK' : 'MISSING'),
        lastSuccessfulFetchAt: latestTimestamp(liveRatesCredit, ['latestDate']) || (liveRatesCredit.length ? generatedAt : null),
        seriesCount: liveRatesCredit.length,
        cachedFallbackCount: fredCacheFallbacks.length,
        failedCount: fredErrors.length,
        errors: fredErrors
      }
    },
    failedSources: [
      ...(yahooErrors.length ? [{ source: 'Yahoo Finance', errors: yahooErrors }] : []),
      ...(fredErrors.length ? [{ source: 'FRED', errors: fredErrors }] : [])
    ]
  };
}

function latestCacheRefresh(root, cacheFiles) {
  const dates = [];
  let sourceCount = 0;
  for (const cacheFile of cacheFiles) {
    const filePath = path.join(root, 'data', 'cache', cacheFile);
    if (!fs.existsSync(filePath)) continue;
    let cache;
    try { cache = JSON.parse(fs.readFileSync(filePath, 'utf8')); } catch { continue; }
    for (const meta of Object.values(cache.refresh_meta || {})) {
      if (!meta || typeof meta !== 'object') continue;
      sourceCount += 1;
      const timestamp = meta.refreshed_at || meta.latest_date;
      const date = new Date(timestamp);
      if (Number.isFinite(date.getTime())) dates.push(date.getTime());
    }
  }
  return {
    sourceCount,
    lastSuccessfulFetchAt: dates.length ? new Date(Math.max(...dates)).toISOString() : null,
  };
}

function applyCacheFreshness(health, root) {
  const yahoo = latestCacheRefresh(root, [
    'commodities-series.json',
    'equity-ownership-series.json',
    'fx-dollar-series.json',
    'real-assets-series.json',
    'volatility-series.json',
  ]);
  const fred = latestCacheRefresh(root, [
    'credit-series.json',
    'duration-series.json',
    'money-cash-series.json',
  ]);
  if (yahoo.lastSuccessfulFetchAt) {
    health.sources.yahooFinance.lastSuccessfulFetchAt = yahoo.lastSuccessfulFetchAt;
    health.sources.yahooFinance.cacheBacked = true;
    health.sources.yahooFinance.cacheSeriesCount = yahoo.sourceCount;
  }
  if (fred.lastSuccessfulFetchAt) {
    health.sources.fred.lastSuccessfulFetchAt = fred.lastSuccessfulFetchAt;
    health.sources.fred.cacheBacked = true;
    health.sources.fred.cacheSeriesCount = fred.sourceCount;
  }
  return health;
}

function writeDataHealthFromState(state, outputPath) {
  const health = buildDataHealth(state || {});
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(health, null, 2));
  return health;
}

function writeDataHealthFromFile(statePath, outputPath) {
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  const health = buildDataHealth(state || {});
  applyCacheFreshness(health, path.resolve(path.dirname(statePath), '..'));
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(health, null, 2));
  return health;
}

module.exports = { buildDataHealth, writeDataHealthFromState, writeDataHealthFromFile };
