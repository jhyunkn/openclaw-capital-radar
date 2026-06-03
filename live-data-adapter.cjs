const fs = require('fs');
const path = require('path');
const { buildLiveState } = require('./lib/capital-radar-live.cjs');
const { writeDataHealthFromState } = require('./lib/data-health.cjs');

const args = process.argv.slice(2);
const ALLOW_STALE_FRED = args.includes('--allow-stale-fred');
const positionalArgs = args.filter(a => !a.startsWith('--'));
const outPath = positionalArgs[0] || path.join(__dirname, 'data', 'report-state.live.json');
const healthPath = path.join(__dirname, 'outputs', 'data-health.json');
const MIN_YAHOO_TICKERS = 20;
const MIN_FRED_SERIES = 6;

function mergeCachedFred(state) {
  const existing = (() => {
    try { return JSON.parse(fs.readFileSync(outPath, 'utf8')); } catch { return null; }
  })();
  if (!existing?.liveRatesCredit?.length) return;
  const liveById = Object.fromEntries((state.liveRatesCredit || []).map(r => [r.id, r]));
  for (const cached of existing.liveRatesCredit) {
    if (!liveById[cached.id]) {
      state.liveRatesCredit.push({ ...cached, fromCache: true, cacheWarning: 'FRED unavailable; using cached value' });
    }
  }
  state.meta.dataStatus = 'PARTIAL_LIVE_FRED_FROM_CACHE';
  console.warn(`FRED degraded: merged ${state.liveRatesCredit.length} series (${(state.liveRatesCredit).filter(r=>r.fromCache).length} from cache)`);
}

function failLoudIfDegraded(state) {
  const yahooCount = Array.isArray(state.liveMarket) ? state.liveMarket.length : 0;
  const fredCount = Array.isArray(state.liveRatesCredit) ? state.liveRatesCredit.length : 0;
  const errors = Array.isArray(state.liveDataErrors) ? state.liveDataErrors : [];
  const yahooErrors = errors.filter(error => error.symbol);
  const fredErrors = errors.filter(error => error.series);
  const failures = [];

  if (yahooCount === 0) failures.push(`Yahoo Finance produced no data. Errors: ${JSON.stringify(yahooErrors)}`);
  if (fredCount === 0) failures.push(`FRED produced no data. Errors: ${JSON.stringify(fredErrors)}`);
  if (yahooCount < MIN_YAHOO_TICKERS) failures.push(`Yahoo Finance returned ${yahooCount} tickers; required at least ${MIN_YAHOO_TICKERS}. Errors: ${JSON.stringify(yahooErrors)}`);
  if (fredCount < MIN_FRED_SERIES) failures.push(`FRED returned ${fredCount} series; required at least ${MIN_FRED_SERIES}. Errors: ${JSON.stringify(fredErrors)}`);

  if (failures.length) {
    console.error('LIVE DATA REFRESH FAILED — refusing to write degraded report.');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
}

buildLiveState()
  .then(state => {
    if (ALLOW_STALE_FRED) mergeCachedFred(state);
    failLoudIfDegraded(state);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    const health = writeDataHealthFromState(state, healthPath);
    console.log(outPath);
    console.log(healthPath);
    console.log(JSON.stringify({
      dataStatus: state.meta.dataStatus,
      symbols: state.liveMarket.length,
      rates: state.liveRatesCredit.length,
      errors: state.liveDataErrors,
      dataHealth: {
        status: health.status,
        yahooFinance: health.sources.yahooFinance.status,
        fred: health.sources.fred.status
      }
    }, null, 2));
  })
  .catch(err => { console.error(err); process.exit(1); });
