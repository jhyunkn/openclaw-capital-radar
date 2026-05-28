const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const out = path.join(root, 'data', 'cache', 'money-cash-series.json');
const timeoutMs = Number(process.env.FRED_FETCH_TIMEOUT_MS || 30000);
const retries = Number(process.env.FRED_FETCH_RETRIES || 3);
const forceIpv4 = process.env.FRED_FORCE_IPV4 !== '0';
const useCurlFirst = process.env.FRED_USE_CURL !== '0';
const forceCurlHttp11 = process.env.FRED_CURL_HTTP11 !== '0';
const fredApiKey = process.env.FRED_API_KEY || '';

const SERIES = {
  DTB3: { label: '3-Month Treasury Bill Secondary Market Rate', source_url: 'https://fred.stlouisfed.org/series/DTB3' },
  CPIAUCSL: { label: 'Consumer Price Index for All Urban Consumers: All Items in U.S. City Average', source_url: 'https://fred.stlouisfed.org/series/CPIAUCSL' },
  DFF: { label: 'Effective Federal Funds Rate', source_url: 'https://fred.stlouisfed.org/series/DFF' }
};

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function curlGet(url) {
  const args = [
    '-fsSL',
    '--retry', String(retries),
    '--retry-delay', '2',
    '--connect-timeout', String(Math.ceil(timeoutMs / 1000)),
    '--max-time', String(Math.ceil(timeoutMs / 1000)),
    '-A', 'CapitalRadar/1.0',
    '-H', 'Accept: application/json,text/plain,text/csv,*/*'
  ];
  if (forceCurlHttp11) args.unshift('--http1.1');
  if (forceIpv4) args.unshift('-4');
  args.push(url);
  const result = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim().slice(-800);
    throw new Error(`curl exit ${result.status}${stderr ? `: ${stderr}` : ''}`);
  }
  return result.stdout;
}

function nodeGet(url, redirectsRemaining = 4) {
  return new Promise((resolve, reject) => {
    const requestOptions = {
      headers: {
        'User-Agent': 'CapitalRadar/1.0',
        'Accept': 'application/json,text/plain,text/csv,*/*',
        'Connection': 'close'
      },
      family: forceIpv4 ? 4 : undefined
    };
    const req = https.get(url, requestOptions, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsRemaining <= 0) return reject(new Error(`too many redirects for ${url}`));
        return resolve(nodeGet(res.headers.location, redirectsRemaining - 1));
      }
      if (res.statusCode !== 200) {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', d => { body += d; });
        res.on('end', () => reject(new Error(`HTTP ${res.statusCode} for ${url}${body ? `: ${body.slice(0, 240)}` : ''}`)));
        return;
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

async function nodeGetWithRetry(url) {
  let lastError = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await nodeGet(url);
    } catch (error) {
      lastError = error;
      console.warn(`node fetch attempt ${attempt}/${retries} failed for ${url}: ${error.message}`);
      await sleep(1000 * attempt);
    }
  }
  throw lastError;
}

async function fetchBody(url) {
  const failures = [];
  if (useCurlFirst) {
    try {
      const transportParts = ['curl'];
      if (forceIpv4) transportParts.push('ipv4');
      if (forceCurlHttp11) transportParts.push('http1.1');
      return { body: curlGet(url), transport: transportParts.join('-') };
    } catch (error) {
      failures.push(`curl: ${error.message || String(error)}`);
      console.warn(`curl fetch failed for ${url}: ${error.message || String(error)}`);
    }
  }
  try {
    return { body: await nodeGetWithRetry(url), transport: forceIpv4 ? 'node-https-ipv4' : 'node-https' };
  } catch (error) {
    failures.push(`node: ${error.message || String(error)}`);
  }
  throw new Error(failures.join(' | '));
}

function parseFredApiJson(body) {
  const json = JSON.parse(body);
  const observations = Array.isArray(json.observations) ? json.observations : [];
  return observations.map(row => {
    const n = Number(row.value);
    return { date: row.date, value: Number.isFinite(n) ? n : null };
  }).filter(row => row.date && Number.isFinite(row.value));
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

function endpointList(id) {
  const endpoints = [];
  if (fredApiKey) {
    const params = new URLSearchParams({
      series_id: id,
      api_key: fredApiKey,
      file_type: 'json'
    });
    endpoints.push({
      name: 'fred-api-json',
      url: `https://api.stlouisfed.org/fred/series/observations?${params.toString()}`,
      parser: parseFredApiJson,
      redacted_url: `https://api.stlouisfed.org/fred/series/observations?series_id=${id}&api_key=***&file_type=json`
    });
  }
  endpoints.push(
    { name: 'fredgraph-csv', url: `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`, parser: body => parseFredCsv(body, id) },
    { name: 'fred-data-txt', url: `https://fred.stlouisfed.org/data/${encodeURIComponent(id)}.txt`, parser: parseFredTxt }
  );
  return endpoints;
}

async function fetchSeries(id) {
  const failures = [];
  for (const endpoint of endpointList(id)) {
    try {
      const fetched = await fetchBody(endpoint.url);
      const rows = endpoint.parser(fetched.body);
      if (rows.length >= 24) {
        return {
          rows,
          endpoint: endpoint.name,
          url: endpoint.redacted_url || endpoint.url,
          force_ipv4: forceIpv4,
          force_curl_http11: forceCurlHttp11,
          transport: fetched.transport,
          used_api_key: endpoint.name === 'fred-api-json'
        };
      }
      failures.push(`${endpoint.name}: only ${rows.length} rows via ${fetched.transport}`);
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
  console.log(`FRED refresh settings: timeoutMs=${timeoutMs}, retries=${retries}, forceIpv4=${forceIpv4}, useCurlFirst=${useCurlFirst}, forceCurlHttp11=${forceCurlHttp11}, apiKeyPresent=${Boolean(fredApiKey)}`);
  for (const id of Object.keys(SERIES)) {
    try {
      const result = await fetchSeries(id);
      series[id] = result.rows;
      refresh_meta[id] = {
        endpoint: result.endpoint,
        url: result.url,
        rows: result.rows.length,
        latest_date: result.rows.at(-1)?.date || null,
        force_ipv4: result.force_ipv4,
        force_curl_http11: result.force_curl_http11,
        transport: result.transport,
        used_api_key: result.used_api_key
      };
      console.log(`fetched ${id}: ${result.rows.length} rows, latest=${result.rows.at(-1)?.date}, endpoint=${result.endpoint}, transport=${result.transport}, usedApiKey=${result.used_api_key}`);
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
    version: 7,
    cache_status: 'FRED_REFRESHED',
    created_at: new Date().toISOString(),
    source_policy: 'Refreshed from the official FRED API when FRED_API_KEY is present; otherwise from public FRED endpoints. Homepage build reads this cache and does not fetch FRED live.',
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
