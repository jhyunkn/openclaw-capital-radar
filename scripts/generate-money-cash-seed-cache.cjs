const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'data', 'cache', 'money-cash-series.json');

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return null; }
}

function validCache(cache) {
  const s = cache?.series || {};
  const count = id => Array.isArray(s[id]) ? s[id].filter(row => row && row.date && Number.isFinite(Number(row.value))).length : 0;
  return count('DTB3') >= 24 && count('CPIAUCSL') >= 24 && count('DFF') >= 24;
}

const existing = readJson(out);
if (validCache(existing) && existing.cache_status !== 'SEED_COMPACT') {
  console.log(`kept existing Money / Cash cache: ${existing.cache_status || 'UNKNOWN'}`);
  process.exit(0);
}

const rows = [
  ['1980-12-31',11.51,82.4,13.35], ['1981-12-31',14.03,90.9,16.39], ['1982-12-31',10.69,96.5,12.24],
  ['1994-12-31',4.27,148.2,4.68], ['2000-12-31',5.82,172.2,6.24], ['2008-12-31',1.37,215.3,1.92],
  ['2012-12-31',0.09,229.6,0.14], ['2018-12-31',1.94,251.1,1.83], ['2019-12-31',2.07,255.7,2.16],
  ['2020-03-31',0.37,258.1,0.65], ['2020-12-31',0.09,260.5,0.09],
  ['2021-03-31',0.04,264.8,0.07], ['2021-06-30',0.04,270.9,0.08], ['2021-09-30',0.04,274.3,0.08], ['2021-12-31',0.05,280.8,0.08],
  ['2022-03-31',0.51,287.5,0.20], ['2022-06-30',1.63,296.3,1.21], ['2022-09-30',3.20,298.8,2.56], ['2022-12-31',4.20,296.8,4.10],
  ['2023-03-31',4.70,301.8,4.65], ['2023-06-30',5.10,303.8,5.08], ['2023-09-30',5.30,307.5,5.33], ['2023-12-31',5.24,308.7,5.33],
  ['2024-03-31',5.23,312.3,5.33], ['2024-06-30',5.24,314.2,5.33], ['2024-09-30',4.80,315.7,5.13], ['2024-12-31',4.35,317.2,4.63],
  ['2025-03-31',4.25,320.0,4.50], ['2025-06-30',4.15,323.0,4.35], ['2025-09-30',3.95,326.0,4.10], ['2025-12-31',3.80,329.0,3.95], ['2026-04-30',3.60,332.407,3.65]
];

function series(index) { return rows.map(r => ({ date: r[0], value: r[index] })); }

const cache = {
  artifact: 'money-cash-series-cache',
  version: 1,
  cache_status: 'SEED_COMPACT',
  created_at: new Date().toISOString(),
  source_policy: 'Compact seed cache for UI verification when live FRED fetch is unavailable in CI. Replace with refreshed FRED CSV cache before production-grade analysis.',
  sources: {
    DTB3: { label: '3-Month Treasury Bill Secondary Market Rate', source_url: 'https://fred.stlouisfed.org/series/DTB3' },
    CPIAUCSL: { label: 'CPI index', source_url: 'https://fred.stlouisfed.org/series/CPIAUCSL' },
    DFF: { label: 'Effective Federal Funds Rate', source_url: 'https://fred.stlouisfed.org/series/DFF' }
  },
  series: {
    DTB3: series(1),
    CPIAUCSL: series(2),
    DFF: series(3)
  },
  limitations: [
    'Compact seed cache is for visual verification only.',
    'Live FRED refresh should replace this cache before production-grade analysis.',
    'Homepage build reads cache rather than fetching FRED live.'
  ]
};

fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(cache, null, 2) + '\n');
console.log('wrote data/cache/money-cash-series.json seed cache');
