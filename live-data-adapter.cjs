const fs = require('fs');
const path = require('path');
const { buildLiveState } = require('./lib/capital-radar-live.cjs');
const { writeDataHealthFromState } = require('./lib/data-health.cjs');

const outPath = process.argv[2] || path.join(__dirname, 'data', 'report-state.live.json');
const healthPath = path.join(__dirname, 'outputs', 'data-health.json');

buildLiveState()
  .then(state => {
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
