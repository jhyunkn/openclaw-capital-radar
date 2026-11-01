const { spawnSync } = require('child_process');

const DEFAULT_TIMEOUT_MS = Number(process.env.FRED_FETCH_TIMEOUT_MS || 12000);
const MAX_REDIRECTS = 4;

// Transport (2026-10-31): Node's https stack cannot reach fred.stlouisfed.org
// from this host at all (stalls pre-socket, any UA, IPv4 or IPv6), while curl
// with its DEFAULT User-Agent returns 200 in ~0.6s. Any explicit -A stalls.
// So this helper is curl-only; do not "fix" it back to https.get.
function fetchText(url, options = {}) {
  const timeoutMs = Number(options.timeoutMs || DEFAULT_TIMEOUT_MS);
  const secs = Math.max(1, Math.ceil(timeoutMs / 1000));
  const args = [
    '-fsSL',
    '--retry', '2',
    '--retry-delay', '2',
    '--connect-timeout', String(secs),
    '--max-time', String(secs),
    url
  ];
  const result = spawnSync('curl', args, { encoding: 'utf8', maxBuffer: 50 * 1024 * 1024 });
  if (result.status !== 0) {
    const stderr = String(result.stderr || '').trim().slice(-300);
    throw new Error(`curl exit ${result.status}${stderr ? `: ${stderr}` : ''} for ${url}`);
  }
  return result.stdout;
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
