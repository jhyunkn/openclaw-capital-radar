const https = require('https');

const DEFAULT_TIMEOUT_MS = Number(process.env.FRED_FETCH_TIMEOUT_MS || 12000);
const MAX_REDIRECTS = 4;

function fetchText(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const redirectsRemaining = Number.isFinite(options.redirectsRemaining) ? options.redirectsRemaining : MAX_REDIRECTS;

  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      timeout: timeoutMs,
      headers: { 'User-Agent': 'openclaw-capital-radar/1.0' }
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        if (redirectsRemaining <= 0) return reject(new Error(`too many redirects for ${url}`));
        return resolve(fetchText(res.headers.location, { timeoutMs, redirectsRemaining: redirectsRemaining - 1 }));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve(body));
    });

    req.on('timeout', () => {
      req.destroy(new Error(`timeout after ${timeoutMs}ms for ${url}`));
    });
    req.on('error', reject);
  });
}

function parseFredCsv(csv, seriesId) {
  const lines = String(csv || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim());
  const directIndex = header.findIndex(h => h === seriesId);
  const valueIndex = directIndex >= 0 ? directIndex : 1;

  return lines.slice(1).map(line => {
    const parts = line.split(',');
    const date = String(parts[0] || '').trim();
    const raw = String(parts[valueIndex] || '').trim();
    const value = raw === '.' || raw === '' ? null : Number(raw);
    return {
      date,
      value: Number.isFinite(value) ? value : null
    };
  }).filter(row => row.date);
}

async function fetchFredSeries(seriesId) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(seriesId)}`;
  const csv = await fetchText(url);
  const observations = parseFredCsv(csv, seriesId);
  const latest = [...observations].reverse().find(row => Number.isFinite(row.value)) || null;
  return {
    seriesId,
    source: 'FRED public CSV endpoint',
    sourceUrl: `https://fred.stlouisfed.org/series/${seriesId}`,
    observations,
    latest
  };
}

module.exports = {
  fetchText,
  fetchFredSeries,
  parseFredCsv
};
