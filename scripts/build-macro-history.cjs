'use strict';
// Fetches and saves historical macro series for the multi-layer chart:
//   DFF  — Effective Federal Funds Rate (daily → monthly avg)
//   DGS10 — 10-Year Treasury Constant Maturity (daily → monthly avg)
//   CPIAUCSL — CPI YoY % (monthly)
//
// Outputs: data/macro-history.json
// No API key required — uses public FRED fredgraph.csv endpoint.

const https = require('https');
const fs    = require('fs');
const path  = require('path');

const root    = path.join(__dirname, '..');
const outPath = path.join(root, 'data', 'macro-history.json');

const SERIES = [
  { id: 'DFF',      label: 'Fed Funds Rate',  type: 'rate' },
  { id: 'DGS10',    label: '10Y Treasury',     type: 'rate' },
  { id: 'CPIAUCSL', label: 'CPI Index',         type: 'index' },
];

// How far back to keep (years)
const YEARS_BACK = 7;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'capital-radar/1.0' } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return get(res.headers.location).then(resolve).catch(reject);
      }
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ ok: res.statusCode === 200, body, status: res.statusCode }));
    }).on('error', reject);
  });
}

function parseCsv(csv) {
  const lines = csv.trim().split('\n').slice(1); // skip header
  return lines.map(l => {
    const [date, value] = l.split(',');
    const v = parseFloat(value);
    return Number.isFinite(v) ? { date: date.trim(), value: v } : null;
  }).filter(Boolean);
}

function monthlyAvg(observations) {
  // Group daily observations by YYYY-MM and average
  const groups = {};
  for (const { date, value } of observations) {
    const month = date.slice(0, 7); // YYYY-MM
    if (!groups[month]) groups[month] = [];
    groups[month].push(value);
  }
  return Object.entries(groups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, vals]) => ({
      date: month + '-01',
      value: parseFloat((vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(4),),
    }));
}

function cpiToYoy(obs) {
  // Convert CPI index to YoY % change
  const result = [];
  for (let i = 12; i < obs.length; i++) {
    const yoy = ((obs[i].value - obs[i - 12].value) / obs[i - 12].value * 100);
    result.push({ date: obs[i].date, value: parseFloat(yoy.toFixed(2)) });
  }
  return result;
}

function filterRecent(obs, yearsBack) {
  const cutoff = new Date();
  cutoff.setFullYear(cutoff.getFullYear() - yearsBack);
  const cutStr = cutoff.toISOString().slice(0, 10);
  return obs.filter(o => o.date >= cutStr);
}

async function fetchSeries(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;
  try {
    const res = await get(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = parseCsv(res.body);
    return raw;
  } catch (e) {
    console.warn(`  WARN: ${id} fetch failed — ${e.message}`);
    return null;
  }
}

async function main() {
  console.log('Building macro history...');
  const result = { generatedAt: new Date().toISOString(), series: {} };

  for (const s of SERIES) {
    process.stdout.write(`  fetching ${s.id}...`);
    const raw = await fetchSeries(s.id);
    if (!raw) { console.log(' skip'); continue; }

    let obs;
    if (s.id === 'CPIAUCSL') {
      // CPI is monthly already — convert to YoY %
      const monthly = raw.filter(o => o.value !== null);
      obs = filterRecent(cpiToYoy(monthly), YEARS_BACK + 1);
      s.label = 'CPI YoY %';
      s.type = 'pct';
    } else {
      // Daily rate data — aggregate to monthly averages
      obs = filterRecent(monthlyAvg(raw), YEARS_BACK);
    }

    result.series[s.id] = { id: s.id, label: s.label, type: s.type, observations: obs };
    console.log(` ${obs.length} monthly obs (${obs[0]?.date} → ${obs[obs.length-1]?.date})`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(result, null, 2));
  console.log(`Saved → ${path.relative(root, outPath)}`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
