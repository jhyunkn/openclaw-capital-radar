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

function freshnessStatus(timestamp, maxHours) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return 'MISSING';
  const ageHours = (Date.now() - date.getTime()) / 3_600_000;
  if (ageHours < -0.25) return 'INVALID_FUTURE_TIMESTAMP';
  return ageHours <= maxHours ? 'OK' : 'STALE';
}

function buildDataHealth(state) {
  const liveMarket = Array.isArray(state?.liveMarket) ? state.liveMarket : [];
  const liveRatesCredit = Array.isArray(state?.liveRatesCredit) ? state.liveRatesCredit : [];
  const errors = Array.isArray(state?.liveDataErrors) ? state.liveDataErrors : [];
  const yahooErrors = sourceErrors(errors, 'yahoo');
  const fredErrors = sourceErrors(errors, 'fred');
  const fredCacheFallbacks = liveRatesCredit.filter(row => row?.fetchedFromCache);
  const liveFredRows = liveRatesCredit.filter(row => !row?.fetchedFromCache);
  const generatedAt = state?.meta?.generatedAt || isoNow();
  const reportFreshness = freshnessStatus(generatedAt, 24);
  const holdingsSyncedAt = state?.meta?.holdingsSyncedAt || null;
  const holdingsFreshness = freshnessStatus(holdingsSyncedAt, 24);
  const hasUnhealthyPrimarySource = reportFreshness !== 'OK' || holdingsFreshness !== 'OK';

  return {
    generatedAt: isoNow(),
    reportGeneratedAt: generatedAt,
    status: hasUnhealthyPrimarySource
      ? 'STALE'
      : (errors.length || fredCacheFallbacks.length ? 'PARTIAL' : 'OK'),
    sourceFreshness: {
      report: { status: reportFreshness, asOf: generatedAt, maxAgeHours: 24 },
      holdings: { status: holdingsFreshness, asOf: holdingsSyncedAt, maxAgeHours: 24 },
    },
    sources: {
      yahooFinance: {
        status: yahooErrors.length ? 'PARTIAL' : (liveMarket.length ? 'OK' : 'MISSING'),
        lastSuccessfulFetchAt: latestTimestamp(liveMarket, ['asOf', 'lastTimestamp']) || (liveMarket.length ? generatedAt : null),
        refreshedLive: true,
        tickerCount: liveMarket.length,
        failedCount: yahooErrors.length,
        errors: yahooErrors
      },
      fred: {
        status: fredErrors.length || fredCacheFallbacks.length ? 'PARTIAL' : (liveRatesCredit.length ? 'OK' : 'MISSING'),
        lastSuccessfulFetchAt: latestTimestamp(liveFredRows, ['fetchedAt']) || (liveFredRows.length ? generatedAt : null),
        latestObservationAt: latestTimestamp(liveRatesCredit, ['latestDate']),
        refreshedLive: liveFredRows.length > 0,
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
  // Cache-touch timestamps must NOT overwrite the live-derived
  // lastSuccessfulFetchAt: a cache refresh (e.g. 2026-09-30) is not a live
  // fetch success (e.g. FRED API last good ~2026-09-17). Record cache info
  // separately and only adopt the cache timestamp when no live timestamp
  // exists, marking refreshedLive=false so the provenance is explicit.
  if (yahoo.lastSuccessfulFetchAt) {
    health.sources.yahooFinance.cacheBacked = true;
    health.sources.yahooFinance.cacheSeriesCount = yahoo.sourceCount;
    health.sources.yahooFinance.cacheRefreshedAt = yahoo.lastSuccessfulFetchAt;
    if (!health.sources.yahooFinance.lastSuccessfulFetchAt) {
      health.sources.yahooFinance.lastSuccessfulFetchAt = yahoo.lastSuccessfulFetchAt;
      health.sources.yahooFinance.refreshedLive = false;
    }
  }
  if (fred.lastSuccessfulFetchAt) {
    health.sources.fred.cacheBacked = true;
    health.sources.fred.cacheSeriesCount = fred.sourceCount;
    health.sources.fred.cacheRefreshedAt = fred.lastSuccessfulFetchAt;
    if (!health.sources.fred.lastSuccessfulFetchAt) {
      health.sources.fred.lastSuccessfulFetchAt = fred.lastSuccessfulFetchAt;
      health.sources.fred.refreshedLive = false;
    }
  }
  // Money / Cash coverage (Batch 2 B2): the money-cash module reads its OWN
  // FRED cache (data/cache/money-cash-series.json), separate from the main
  // FRED path above — the rollup never inspected it, so overall stayed OK
  // while that cache sat on failed-refresh fallback from 2026-09-29. Cover
  // it as its own source: a failed-cache module reports PARTIAL and cannot
  // leave the overall status at OK.
  const mcPath = path.join(root, 'data', 'cache', 'money-cash-series.json');
  if (fs.existsSync(mcPath)) {
    let mc = null;
    try { mc = JSON.parse(fs.readFileSync(mcPath, 'utf8')); } catch { mc = null; }
    if (mc) {
      const failedFallback = mc.cache_status === 'FRED_REFRESH_FAILED_USING_EXISTING_CACHE'
        || mc.last_refresh_status === 'FAILED_FALLBACK_USED';
      let latestObs = null;
      for (const rows of Object.values(mc.series || {})) {
        if (!Array.isArray(rows) || !rows.length) continue;
        const d = rows[rows.length - 1]?.date;
        if (d && (!latestObs || d > latestObs)) latestObs = d;
      }
      health.sources.moneyCash = {
        status: failedFallback ? 'PARTIAL' : 'OK',
        cacheStatus: mc.cache_status || null,
        lastRefreshAttemptAt: mc.last_refresh_attempt_at || null,
        latestObservationAt: latestObs ? new Date(latestObs + 'T00:00:00Z').toISOString() : null,
        seriesCount: Object.keys(mc.series || {}).length,
        refreshedLive: mc.cache_status === 'FRED_REFRESHED',
      };
      if (failedFallback) {
        if (health.status === 'OK') health.status = 'PARTIAL';
        health.failedSources = health.failedSources || [];
        if (!health.failedSources.some(f => f.source === 'Money / Cash (FRED)')) {
          health.failedSources.push({
            source: 'Money / Cash (FRED)',
            errors: (Array.isArray(mc.last_refresh_errors) ? mc.last_refresh_errors : [])
              .map(e => ({ series: e.id, error: String(e.error || '').slice(0, 200) })),
          });
        }
      }
    }
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
