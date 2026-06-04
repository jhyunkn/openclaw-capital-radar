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

function writeDataHealthFromState(state, outputPath) {
  const health = buildDataHealth(state || {});
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(health, null, 2));
  return health;
}

function writeDataHealthFromFile(statePath, outputPath) {
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  return writeDataHealthFromState(state, outputPath);
}

module.exports = { buildDataHealth, writeDataHealthFromState, writeDataHealthFromFile };
