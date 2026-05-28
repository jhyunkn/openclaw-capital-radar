const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const out = path.join(root, 'data', 'cache', 'money-cash-series.json');
const timeoutMs = Number(process.env.FRED_FETCH_TIMEOUT_MS || 30000);
const retries = Number(process.env.FRED_FETCH_RETRIES || 3);

const SERIES = {
  DTB3: { label: '3-Month Treasury Bill Secondary Market Rate', source_url: 'https://fred.stlouisfed.org/series/DTB3' },
  CPIAUCSL: { label: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', source_url: 'https://fred.stlouisfed.org/series/CPIAUCSL' },
  DFF: { label: 'Effective Federal Funds Rate', source_url: 'https://fred.stlouisfed.org/series/DFF' }
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function get(url, redirectsRemaining = 4) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { 'User-Agent': 'CapitalRadar/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsRemaining <= 0) return reject(new Error(`too many redirects for ${url}`));
        return resolve(get(res.headers.location, redirectsRemaining - 1));
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

async function getWithRetry(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await get(url);
    } catch (error) {
      lastError = error;
      console.warn(`fetch attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
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

function parseFredTxt(txt) {
  const lines = String(txt || '').split(/\r?\n/);
  const rows = [];
  for (const line of lines) {
    const m = line.trim().match(/^(\d{4}-\d{2}-\d{2})\s+(-?\d+(?:\.\d+)?)$/);
    if (!m) continue;
    const n = Number(m[2]);
    if (Number.isFinite(n)) rows.push({ date: m[1], value: n });
  }
  return rows;
}

async function fetchSeries(id) {
  const endpoints = [
    { name: 'fredgraph-csv', url: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`, parser: body => parseFredCsv(body, id) },
    { name: 'fred-data-txt', url: `https://fred.stlouisfed.org/data/${encodeURIComponent(id)}.txt`, parser: parseFredTxt }
  ];
  const failures = [];
  for (const endpoint of endpoints) {
    try {
      const body = await getWithRetry(endpoint.url);
      const rows = endpoint.parser(body);
      if (rows.length >= 24) {
        return { rows, endpoint: endpoint.name, url: endpoint.url };
      }
      failures.push(`${endpoint.name}: only ${rows.length} rows`);
    } catch (error) {
      failures.push(`${endpoint.name}: ${error.message || String(error)}`);
    }
  }
  throw new Error(`${id} failed all endpoints: ${failures.join(' | ')}`);
}

async function main() {
  const series = {};
  const refresh_meta = {};
  const errors = [];
  for (const id of Object.keys(SERIES)) {
    try {
      const result = await fetchSeries(id);
      series[id] = result.rows;
      refresh_meta[id] = { endpoint: result.endpoint, url: result.url, rows: result.rows.length, latest_date: result.rows.at(-1)?.date || null };
      console.log(`fetched ${id}: ${result.rows.length} rows, latest=${result.rows.at(-1)?.date}, endpoint=${result.endpoint}`);
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
    version: 3,
    cache_status: 'FRED_REFRESHED',
    created_at: new Date().toISOString(),
    source_policy: 'Refreshed from FRED public endpoints. Homepage build reads this cache and does not fetch FRED live.',
    sources: SERIES,
    refresh_meta,
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
