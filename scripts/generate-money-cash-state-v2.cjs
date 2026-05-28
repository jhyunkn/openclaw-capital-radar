const fs = require('fs');
const path = require('path');
const https = require('https');

const root = path.join(__dirname, '..');
const outPaths = [
  path.join(root, 'outputs', 'money-cash-state.json'),
  path.join(root, 'public', 'outputs', 'money-cash-state.json')
];

const SERIES = {
  tbill_3m_yield: { id: 'DTB3', label: '3-month T-bill yield', tier: 'CORE', unit: '%' },
  effective_fed_funds: { id: 'EFFR', fallbackId: 'DFF', label: 'Effective fed funds rate', tier: 'CORE', unit: '%' },
  cpi_inflation: { id: 'CPIAUCSL', label: 'CPI inflation index', tier: 'CORE', unit: 'index' },
  money_market_assets: { id: 'MMMFFAQ027S', label: 'Money-market fund assets', tier: 'CORE', unit: 'USD billions' },
  bank_reserves: { id: 'WRESBAL', label: 'Reserve balances', tier: 'CONFIRMING', unit: 'USD millions' },
  m2: { id: 'M2SL', label: 'M2 money stock', tier: 'CONFIRMING', unit: 'USD billions' },
  financial_conditions: { id: 'NFCI', label: 'National Financial Conditions Index', tier: 'CONFIRMING', unit: 'index' },
  tga: { id: 'WTREGEN', label: 'Treasury General Account', tier: 'CONTEXT', unit: 'USD millions' },
  reverse_repo: { id: 'RRPONTSYD', label: 'Overnight reverse repo', tier: 'CONTEXT', unit: 'USD billions' },
  sofr: { id: 'SOFR', label: 'SOFR', tier: 'CONTEXT', unit: '%' }
};

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function round(v, d = 3) {
  const n = Number(v);
  return Number.isFinite(n) ? Number(n.toFixed(d)) : null;
}

function get(url, timeoutMs = 18000) {
  return new Promise(resolve => {
    const req = https.get(url, { headers: { 'User-Agent': 'CapitalRadar/1.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return resolve(get(res.headers.location, timeoutMs));
      }
      if (res.statusCode !== 200) {
        res.resume();
        return resolve({ ok: false, body: '', error: `HTTP ${res.statusCode}` });
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', d => { body += d; });
      res.on('end', () => resolve({ ok: true, body, error: null }));
    });
    req.on('error', error => resolve({ ok: false, body: '', error: error.message }));
    req.setTimeout(timeoutMs, () => { req.destroy(); resolve({ ok: false, body: '', error: `timeout after ${timeoutMs}ms` }); });
  });
}

function parseCsv(csv, preferredHeader) {
  const lines = String(csv || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',').map(s => s.trim());
  const idx = Math.max(1, header.findIndex(h => h === preferredHeader));
  return lines.slice(1).map(line => {
    const [date, ...rest] = line.split(',');
    const raw = String(rest[idx - 1] || '').trim();
    const n = Number(raw);
    return { date: String(date || '').trim(), value: Number.isFinite(n) ? n : null };
  }).filter(row => row.date && Number.isFinite(row.value));
}

async function fetchFred(id) {
  const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  const result = await get(url);
  if (!result.ok) return { id, observations: [], latest: null, error: result.error };
  const observations = parseCsv(result.body, id);
  return { id, observations, latest: observations.at(-1) || null, error: observations.length ? null : 'empty observations' };
}

async function fetchFredWithFallback(spec) {
  const primary = await fetchFred(spec.id);
  if (primary.observations.length || !spec.fallbackId) return primary;
  const fallback = await fetchFred(spec.fallbackId);
  return { ...fallback, id: spec.id, fallback_id_used: spec.fallbackId, primary_error: primary.error };
}

function yoy(rows) {
  const out = [];
  for (let i = 12; i < rows.length; i++) {
    const current = rows[i];
    const prior = rows[i - 12];
    if (prior?.value) out.push({ date: current.date, value: round(((current.value - prior.value) / prior.value) * 100, 3) });
  }
  return out;
}

function joinSubtract(aRows, bRows) {
  const bByDate = new Map(bRows.map(r => [r.date, r.value]));
  return aRows.map(row => {
    const b = bByDate.get(row.date);
    return { date: row.date, value: Number.isFinite(b) ? round(row.value - b, 3) : null };
  }).filter(row => row.date && Number.isFinite(row.value));
}

function latest(rows) { return rows.filter(row => Number.isFinite(row.value)).at(-1) || null; }

function windowRows(rows, years) {
  const valid = rows.filter(row => row.date && Number.isFinite(row.value));
  if (!valid.length || !years) return valid;
  const end = new Date(`${valid.at(-1).date}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return valid.filter(row => new Date(`${row.date}T00:00:00Z`) >= start);
}

function percentile(values, current) {
  if (!values.length || !Number.isFinite(current)) return null;
  return Math.round((values.filter(v => v <= current).length / values.length) * 100);
}

function ref(rows, current) {
  const windows = {};
  for (const [id, years] of [['1y', 1], ['5y', 5], ['10y', 10], ['full', null]]) {
    const w = windowRows(rows, years);
    const values = w.map(r => r.value).filter(Number.isFinite);
    const p = percentile(values, current);
    windows[id] = {
      observations: values.length,
      start_date: w[0]?.date || null,
      end_date: w.at(-1)?.date || null,
      min: values.length ? round(Math.min(...values), 3) : null,
      max: values.length ? round(Math.max(...values), 3) : null,
      average: values.length ? round(values.reduce((a, b) => a + b, 0) / values.length, 3) : null,
      current_percentile: p,
      relative_zone: p == null ? 'unknown' : p >= 90 ? 'historically extreme high' : p >= 75 ? 'historically high' : p >= 55 ? 'above normal' : p >= 45 ? 'near normal' : p >= 25 ? 'below normal' : p >= 10 ? 'historically low' : 'historically extreme low'
    };
  }
  return windows;
}

async function main() {
  const fetched = [];
  for (const [key, spec] of Object.entries(SERIES)) {
    const series = await fetchFredWithFallback(spec);
    fetched.push({ key, spec, series });
    await new Promise(resolve => setTimeout(resolve, 350));
  }

  const datasets = {};
  const seriesByKey = new Map();
  const missing = [
    'Treasury bill supply is declared in Mission 3 but not implemented in this first generator.',
    'Stablecoin supply is Phase 2 and requires a crypto liquidity provider.'
  ];

  for (const item of fetched) {
    const l = item.series.latest;
    if (item.series.error) missing.push(`${item.key} failed: ${item.series.error}`);
    if (item.series.observations.length) seriesByKey.set(item.key, item.series.observations);
    datasets[item.key] = {
      label: item.spec.label,
      series_id: item.spec.id,
      fallback_id_used: item.series.fallback_id_used || null,
      tier: item.spec.tier,
      source: 'FRED public CSV endpoint',
      source_url: `https://fred.stlouisfed.org/series/${item.spec.id}`,
      latest_date: l?.date || null,
      latest_value: l?.value ?? null,
      confidence: l ? 'AUTH' : 'MISSING',
      observations_count: item.series.observations.length,
      historical_reference: l ? ref(item.series.observations, l.value) : null
    };
  }

  const tbillRows = seriesByKey.get('tbill_3m_yield') || [];
  const effrRows = seriesByKey.get('effective_fed_funds') || [];
  const cpiRows = seriesByKey.get('cpi_inflation') || [];
  const cpiYoyRows = yoy(cpiRows);
  const realCashRows = joinSubtract(tbillRows, cpiYoyRows);
  const realFedRows = joinSubtract(effrRows, cpiYoyRows);
  const cpiNow = latest(cpiYoyRows)?.value ?? null;
  const realCash = latest(realCashRows)?.value ?? null;
  const realFed = latest(realFedRows)?.value ?? null;

  const chart_series = {
    money_cash_main: {
      chart_id: 'money_cash_main',
      title: '3M T-bill yield vs CPI YoY vs real cash yield',
      y_axis: 'percent',
      series: {
        tbill_3m_yield: tbillRows,
        cpi_yoy: cpiYoyRows,
        real_cash_yield: realCashRows
      }
    },
    front_end_rates: {
      chart_id: 'front_end_rates',
      title: 'Fed funds vs SOFR vs 3M T-bill',
      y_axis: 'percent',
      series: {
        effective_fed_funds: effrRows,
        sofr: seriesByKey.get('sofr') || [],
        tbill_3m_yield: tbillRows
      }
    },
    liquidity_plumbing: {
      chart_id: 'liquidity_plumbing',
      title: 'Bank reserves, reverse repo, M2, and financial conditions',
      y_axis: 'native units / index',
      series: {
        bank_reserves: seriesByKey.get('bank_reserves') || [],
        reverse_repo: seriesByKey.get('reverse_repo') || [],
        m2: seriesByKey.get('m2') || [],
        financial_conditions: seriesByKey.get('financial_conditions') || []
      }
    }
  };

  const derived = {
    cpi_yoy: { label: 'CPI year-over-year inflation', value: cpiNow, confidence: cpiNow == null ? 'MISSING' : 'AUTH', historical_reference: ref(cpiYoyRows, cpiNow) },
    real_cash_yield: { label: '3M T-bill yield minus CPI YoY', value: realCash, confidence: realCash == null ? 'MISSING' : 'AUTH', historical_reference: ref(realCashRows, realCash) },
    real_fed_funds: { label: 'Effective fed funds minus CPI YoY', value: realFed, confidence: realFed == null ? 'MISSING' : 'AUTH', historical_reference: ref(realFedRows, realFed) }
  };

  const coverage = tbillRows.length >= 24 && cpiYoyRows.length >= 24 && realCashRows.length >= 24 ? 'PARTIAL' : 'MISSING';
  const cycle = realCash == null ? 'incomplete liquidity read' : realCash > 1 ? 'cash competes with risk' : realCash < 0 ? 'cash does not preserve purchasing power' : 'cash near neutral versus inflation';

  const state = {
    artifact: 'money-cash-state',
    version: 5,
    as_of: new Date().toISOString(),
    asset_class: 'Money / Cash',
    coverage,
    macro_gate_contribution: coverage === 'PARTIAL' ? 'eligible_for_partial_macro_matrix' : 'not_eligible',
    primary_question: 'Is capital being paid to wait, or is capital being forced out on the risk curve?',
    datasets,
    derived,
    chart_series,
    annotation_spec: { charts: {}, current_markers: [] },
    historical_reference: {
      tbill_3m_yield: { windows: datasets.tbill_3m_yield.historical_reference },
      cpi_yoy: { windows: derived.cpi_yoy.historical_reference },
      real_cash_yield: { windows: derived.real_cash_yield.historical_reference },
      real_fed_funds: { windows: derived.real_fed_funds.historical_reference },
      financial_conditions: { windows: datasets.financial_conditions.historical_reference }
    },
    web_summary: {
      section_title: 'Money / Cash',
      display_mode: 'raw_chart_with_historical_set_point_annotations',
      primary_chart: 'money_cash_main',
      chart_order: ['money_cash_main', 'front_end_rates', 'liquidity_plumbing'],
      current_reading: {
        real_cash_yield: realCash,
        tbill_3m_yield: latest(tbillRows)?.value ?? null,
        effective_fed_funds: latest(effrRows)?.value ?? null,
        financial_conditions: latest(seriesByKey.get('financial_conditions') || [])?.value ?? null
      },
      historical_context: {
        real_cash_yield_10y_zone: derived.real_cash_yield.historical_reference?.['10y']?.relative_zone || 'unknown',
        real_cash_yield_10y_percentile: derived.real_cash_yield.historical_reference?.['10y']?.current_percentile ?? null,
        tbill_3m_10y_zone: datasets.tbill_3m_yield.historical_reference?.['10y']?.relative_zone || 'unknown',
        financial_conditions_10y_zone: datasets.financial_conditions.historical_reference?.['10y']?.relative_zone || 'unknown'
      },
      annotation_policy: 'Show raw data first. Overlay historical set points and current-vs-set-point values. Keep interpretation secondary.',
      inference: 'Raw data workbench generated; interpretation is secondary to chart and annotations.',
      historical_narrative: 'Historical set points are applied by config/historical-set-points.json after the raw series is generated.',
      portfolio_implication: 'Use Money / Cash as one input in the Macro spine; require Duration, Credit, FX, and Volatility confirmation before final capital permission.'
    },
    missing_evidence: missing,
    analysis: {
      cycle_state: cycle,
      positives: [],
      constraints: [],
      relative_signals: [],
      missing: missing,
      ontological_landscape_read: 'Raw Money / Cash chart artifact generated. Use chart annotations to compare current readings with historical regimes.',
      historical_cycle_narrative: 'Historical comparisons are data-backed set points, not causal claims by themselves.',
      portfolio_implication: 'Preserve optionality until the rest of the Core Macro Spine confirms.'
    },
    generator: {
      path: 'scripts/generate-money-cash-state-v2.cjs',
      sources: ['FRED public CSV endpoint'],
      limitations: ['Treasury bill supply and stablecoin supply are not yet implemented.']
    }
  };

  for (const file of outPaths) writeJson(file, state);
  console.log(`generated money-cash-state-v2: coverage=${coverage}, real_cash_yield=${realCash ?? 'n/a'}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
