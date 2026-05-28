const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const out = path.join(root, 'data', 'cache', 'money-cash-series.json');
const SERIES = {
  DTB3: { label: '3-Month Treasury Bill Secondary Market Rate', source_url: 'https://fred.stlouisfed.org/series/DTB3' },
  CPIAUCSL: { label: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', source_url: 'https://fred.stlouisfed.org/series/CPIAUCSL' },
  DFF: { label: 'Effective Federal Funds Rate', source_url: 'https://fred.stlouisfed.org/series/DFF' }
};

function get(url, timeoutMs = Number(process.env.FRED_FETCH_TIMEOUT_MS || 20000)) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CapitalRadar/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location, timeoutMs));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; });
      res.on('end', () => resolve(body));
    });
    req.on('error', reject);
    req.setTimeout(timeoutMs, () => req.destroy(new Error(`timeout after ${timeoutMs}ms for ${url}`)));
  });
}

function parseFredCsv(csv, id) {
  const lines = String(csv || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim());
  const valueIndex = Math.max(1, header.findIndex(h => h === id));
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const raw = String(cells[valueIndex] || '').trim();
    const n = Number(raw);
    return { date: String(cells[0] || '').trim(), value: Number.isFinite(n) ? n : null };
  }).filter(row => row.date && Number.isFinite(row.value));
}

async function fetchSeries(id) {
  const csv = await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`);
  const rows = parseFredCsv(csv, id);
  if (rows.length < 24) throw new Error(`${id} returned only ${rows.length} rows`);
  return rows;
}

async function main() {
  const series = {};
  const errors = [];
  for (const id of Object.keys(SERIES)) {
    try {
      series[id] = await fetchSeries(id);
      console.log(`fetched ${id}: ${series[id].length} rows, latest=${series[id].at(-1)?.date}`);
    } catch (error) {
      errors.push({ id, error: error.message || String(error) });
    }
  }
  if (errors.length) {
    console.error(JSON.stringify({ status: 'FAILED', errors }, null, 2));
    process.exit(1);
  }
  const cache = {
    artifact: 'money-cash-series-cache',
    version: 2,
    cache_status: 'FRED_REFRESHED',
    created_at: new Date().toISOString(),
    source_policy: 'Refreshed from FRED public CSV endpoint. Homepage build reads this cache and does not fetch FRED live.',
    sources: SERIES,
    series,
    limitations: [
      'Cache contains the first Money / Cash visual-pass series: DTB3, CPIAUCSL, and DFF.',
      'Future expansion should add money-market assets, reserves, M2, NFCI, reverse repo, SOFR, and Treasury bill supply.'
    ]
  };
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(cache, null, 2) + '\n');
  console.log(`wrote ${path.relative(root, out)} with FRED_REFRESHED cache`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
