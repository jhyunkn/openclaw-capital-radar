const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cachePath = path.join(root, 'data', 'cache', 'money-cash-series.json');
const reportPath = path.join(root, 'outputs', 'money-cash-cache-validation-report.json');
const REQUIRED = ['DTB3', 'CPIAUCSL', 'DFF'];

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (error) { return null; }
}
function rows(cache, id) {
  return Array.isArray(cache?.series?.[id]) ? cache.series[id].filter(row => row && row.date && Number.isFinite(Number(row.value))) : [];
}
function fail(errors, warnings = []) {
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), status: 'FAILED', errors, warnings }, null, 2));
  console.error(`Money / Cash cache validation failed: ${errors.join('; ')}`);
  process.exit(1);
}

const cache = readJson(cachePath);
const errors = [];
const warnings = [];
if (!cache) errors.push('cache missing or unreadable');
if (cache) {
  if (cache.artifact !== 'money-cash-series-cache') errors.push(`unexpected artifact: ${cache.artifact}`);
  if (!cache.cache_status) errors.push('cache_status missing');
  if (cache.cache_status === 'SEED_COMPACT') warnings.push('cache is SEED_COMPACT; visual validation only, not production-grade live evidence');
  if (!cache.created_at) errors.push('created_at missing');
  for (const id of REQUIRED) {
    const count = rows(cache, id).length;
    if (count < 24) errors.push(`${id} row count too low: ${count}`);
    if (!cache.sources?.[id]?.source_url) errors.push(`${id} source_url missing`);
  }
}
if (errors.length) fail(errors, warnings);
fs.mkdirSync(path.dirname(reportPath), { recursive: true });
fs.writeFileSync(reportPath, JSON.stringify({
  generatedAt: new Date().toISOString(),
  status: 'OK',
  cache_status: cache.cache_status,
  rows: Object.fromEntries(REQUIRED.map(id => [id, rows(cache, id).length])),
  warnings
}, null, 2));
console.log(`Money / Cash cache validation passed: ${cache.cache_status}`);
