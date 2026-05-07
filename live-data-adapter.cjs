const fs = require('fs');
const path = require('path');
const { buildLiveState } = require('./lib/capital-radar-live.cjs');

const outPath = process.argv[2] || path.join(__dirname, 'data', 'report-state.live.json');

buildLiveState()
  .then(state => {
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(state, null, 2));
    console.log(outPath);
    console.log(JSON.stringify({
      dataStatus: state.meta.dataStatus,
      symbols: state.liveMarket.length,
      rates: state.liveRatesCredit.length,
      errors: state.liveDataErrors
    }, null, 2));
  })
  .catch(err => { console.error(err); process.exit(1); });
