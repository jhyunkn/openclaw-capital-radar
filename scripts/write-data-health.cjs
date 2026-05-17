const path = require('path');
const { writeDataHealthFromFile } = require('../lib/data-health.cjs');

const root = path.join(__dirname, '..');
const statePath = path.join(root, 'data', 'report-state.live.json');
const outputPath = path.join(root, 'outputs', 'data-health.json');
const health = writeDataHealthFromFile(statePath, outputPath);
console.log(JSON.stringify({
  wrote: 'outputs/data-health.json',
  status: health.status,
  reportGeneratedAt: health.reportGeneratedAt,
  yahooFinance: health.sources.yahooFinance.tickerCount,
  fred: health.sources.fred.seriesCount
}, null, 2));
