const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const cachePath = path.join(root, 'data', 'cache', 'money-cash-series.json');
const outputPaths = [
  path.join(root, 'outputs', 'money-cash-state.json'),
  path.join(root, 'public', 'outputs', 'money-cash-state.json')
];

const HISTORICAL_WINDOWS = [
  ['1y', 1],
  ['5y', 5],
  ['10y', 10],
  ['full', null]
];

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function round(value, digits = 3) {
  return Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
}

function validRows(rows) {
  return Array.isArray(rows)
    ? rows
      .filter(row => row && row.date && Number.isFinite(Number(row.value)))
      .map(row => ({ date: row.date, value: Number(row.value) }))
      .sort((a, b) => a.date.localeCompare(b.date))
    : [];
}

function latest(rows) {
  return validRows(rows).at(-1) || null;
}

function dateMs(date) {
  const value = new Date(`${date}T00:00:00Z`).getTime();
  return Number.isFinite(value) ? value : null;
}

function daysBetween(a, b) {
  const ma = dateMs(a);
  const mb = dateMs(b);
  if (!Number.isFinite(ma) || !Number.isFinite(mb)) return null;
  return Math.round((ma - mb) / 86400000);
}

function dateYearsBefore(date, years) {
  const d = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  d.setUTCFullYear(d.getUTCFullYear() - years);
  return d.toISOString().slice(0, 10);
}

function nearestPriorObservation(rows, targetDate, maxDistanceDays = 55) {
  const target = dateMs(targetDate);
  if (!Number.isFinite(target)) return null;

  let best = null;
  for (const row of validRows(rows)) {
    const current = dateMs(row.date);
    if (!Number.isFinite(current) || current > target) continue;
    const distance = Math.abs(Math.round((target - current) / 86400000));
    if (distance > maxDistanceDays) continue;
    if (!best || distance < best.distance_days) best = { ...row, distance_days: distance };
  }
  return best;
}

function yoySeries(rows) {
  const input = validRows(rows);
  const output = [];

  for (const row of input) {
    const priorTarget = dateYearsBefore(row.date, 1);
    const prior = priorTarget ? nearestPriorObservation(input, priorTarget, 55) : null;
    if (!prior || !Number.isFinite(prior.value) || prior.value === 0) continue;
    output.push({
      date: row.date,
      value: round(((row.value - prior.value) / prior.value) * 100),
      basis: {
        current_date: row.date,
        prior_date: prior.date,
        prior_distance_days: prior.distance_days,
        method: 'year-over-year using nearest prior observation within 55 days'
      }
    });
  }

  return output;
}

function carryForwardValue(rows, targetDate) {
  const target = dateMs(targetDate);
  if (!Number.isFinite(target)) return null;

  let value = null;
  let valueDate = null;
  for (const row of validRows(rows)) {
    const current = dateMs(row.date);
    if (!Number.isFinite(current) || current > target) break;
    value = row.value;
    valueDate = row.date;
  }

  return Number.isFinite(value) ? { value, date: valueDate } : null;
}

function subtractCarryForward(primaryRows, secondaryRows, label) {
  return validRows(primaryRows)
    .map(row => {
      const carried = carryForwardValue(secondaryRows, row.date);
      if (!carried || !Number.isFinite(carried.value)) return null;
      return {
        date: row.date,
        value: round(row.value - carried.value),
        basis: {
          primary_date: row.date,
          secondary_date: carried.date,
          method: `${label}; secondary series carried forward to primary date`
        }
      };
    })
    .filter(Boolean);
}

function windowRows(rows, years) {
  const valid = validRows(rows);
  if (!valid.length || !years) return valid;
  const end = new Date(`${valid.at(-1).date}T00:00:00Z`);
  const start = new Date(end);
  start.setUTCFullYear(start.getUTCFullYear() - years);
  return valid.filter(row => new Date(`${row.date}T00:00:00Z`) >= start);
}

function percentileRank(values, current) {
  if (!values.length || !Number.isFinite(current)) return null;
  return Math.round((values.filter(value => value <= current).length / values.length) * 100);
}

function percentileValue(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((percentile / 100) * (sorted.length - 1))));
  return round(sorted[index]);
}

function relativeZone(percentile) {
  if (percentile == null) return 'unknown';
  if (percentile >= 90) return 'historically extreme high';
  if (percentile >= 75) return 'historically high';
  if (percentile >= 55) return 'above normal';
  if (percentile >= 45) return 'near normal';
  if (percentile >= 25) return 'below normal';
  if (percentile >= 10) return 'historically low';
  return 'historically extreme low';
}

function historicalReference(rows, current) {
  const output = {};
  for (const [id, years] of HISTORICAL_WINDOWS) {
    const scoped = windowRows(rows, years);
    const values = scoped.map(row => row.value).filter(Number.isFinite);
    const percentile = percentileRank(values, current);

    output[id] = {
      observations: values.length,
      start_date: scoped[0]?.date || null,
      end_date: scoped.at(-1)?.date || null,
      min: values.length ? round(Math.min(...values)) : null,
      max: values.length ? round(Math.max(...values)) : null,
      average: values.length ? round(values.reduce((sum, value) => sum + value, 0) / values.length) : null,
      p10: percentileValue(values, 10),
      p25: percentileValue(values, 25),
      median: percentileValue(values, 50),
      p75: percentileValue(values, 75),
      p90: percentileValue(values, 90),
      current_percentile: percentile,
      relative_zone: relativeZone(percentile)
    };
  }
  return output;
}

function dataset({ key, label, seriesId, tier, rows, cache }) {
  const latestRow = latest(rows);
  return {
    key,
    label,
    series_id: seriesId,
    tier,
    source: 'money-cash cache',
    source_url: cache.sources?.[seriesId]?.source_url || null,
    latest_date: latestRow?.date || null,
    latest_value: latestRow?.value ?? null,
    confidence: latestRow ? (cache.cache_status || 'CACHE') : 'MISSING',
    observations_count: validRows(rows).length,
    historical_reference: latestRow ? historicalReference(rows, latestRow.value) : null,
    raw_series_policy: 'Render the series directly; use annotations as overlays, not substitutes.'
  };
}

function derivedSeries({ key, label, rows, sourceSeries, method }) {
  const latestRow = latest(rows);
  return {
    key,
    label,
    source_series: sourceSeries,
    method,
    value: latestRow?.value ?? null,
    latest_date: latestRow?.date || null,
    confidence: latestRow ? 'DERIVED_FROM_CACHE_SERIES' : 'MISSING',
    observations_count: validRows(rows).length,
    historical_reference: latestRow ? historicalReference(rows, latestRow.value) : null,
    observations: validRows(rows)
  };
}

function currentMarker(seriesId, row) {
  return {
    id: `current_${seriesId}`,
    type: 'current_value_marker',
    series_id: seriesId,
    date: row?.date || null,
    value: row?.value ?? null,
    label: `Current ${seriesId}: ${Number.isFinite(row?.value) ? round(row.value) : 'n/a'}`
  };
}

function main() {
  const cache = readJson(cachePath);

  const tbill = validRows(cache.series?.DTB3);
  const cpi = validRows(cache.series?.CPIAUCSL);
  const fedFunds = validRows(cache.series?.DFF);

  const cpiYoy = yoySeries(cpi);
  const realCashYield = subtractCarryForward(tbill, cpiYoy, '3M T-bill yield minus CPI YoY');
  const realFedFunds = subtractCarryForward(fedFunds, cpiYoy, 'effective fed funds minus CPI YoY');

  const latestTbill = latest(tbill);
  const latestCpi = latest(cpi);
  const latestCpiYoy = latest(cpiYoy);
  const latestRealCash = latest(realCashYield);
  const latestFedFunds = latest(fedFunds);
  const latestRealFedFunds = latest(realFedFunds);

  const datasets = {
    tbill_3m_yield: dataset({ key: 'tbill_3m_yield', label: '3-month T-bill yield', seriesId: 'DTB3', tier: 'CORE', rows: tbill, cache }),
    cpi_inflation: dataset({ key: 'cpi_inflation', label: 'CPI inflation index', seriesId: 'CPIAUCSL', tier: 'CORE', rows: cpi, cache }),
    effective_fed_funds: dataset({ key: 'effective_fed_funds', label: 'Effective fed funds rate', seriesId: 'DFF', tier: 'CORE', rows: fedFunds, cache }),
    money_market_assets: { label: 'Money-market fund assets', tier: 'CORE', confidence: 'PENDING_SOURCE', observations_count: 0 },
    bank_reserves: { label: 'Reserve balances', tier: 'CONFIRMING', confidence: 'PENDING_SOURCE', observations_count: 0 },
    m2: { label: 'M2 money stock', tier: 'CONFIRMING', confidence: 'PENDING_SOURCE', observations_count: 0 },
    financial_conditions: { label: 'Financial conditions', tier: 'CONFIRMING', confidence: 'PENDING_SOURCE', observations_count: 0 },
    tga: { label: 'Treasury General Account', tier: 'CONTEXT', confidence: 'PENDING_SOURCE', observations_count: 0 },
    reverse_repo: { label: 'Reverse repo', tier: 'CONTEXT', confidence: 'PENDING_SOURCE', observations_count: 0 },
    sofr: { label: 'SOFR', tier: 'CONTEXT', confidence: 'PENDING_SOURCE', observations_count: 0 }
  };

  const derived = {
    cpi_yoy: derivedSeries({
      key: 'cpi_yoy',
      label: 'CPI YoY',
      rows: cpiYoy,
      sourceSeries: ['CPIAUCSL'],
      method: 'Year-over-year CPI change using nearest prior observation within 55 days.'
    }),
    real_cash_yield: derivedSeries({
      key: 'real_cash_yield',
      label: '3M T-bill yield minus CPI YoY',
      rows: realCashYield,
      sourceSeries: ['DTB3', 'CPIAUCSL'],
      method: '3M T-bill yield minus CPI YoY, with CPI YoY carried forward to the T-bill observation date.'
    }),
    real_fed_funds: derivedSeries({
      key: 'real_fed_funds',
      label: 'Effective fed funds minus CPI YoY',
      rows: realFedFunds,
      sourceSeries: ['DFF', 'CPIAUCSL'],
      method: 'Effective fed funds minus CPI YoY, with CPI YoY carried forward to the fed-funds observation date.'
    })
  };

  const coverage = tbill.length >= 24 && cpiYoy.length >= 12 && realCashYield.length >= 12 ? 'PARTIAL' : 'MISSING';
  const missingEvidence = [
    'Treasury bill supply is declared in Mission 3 but not implemented in this first generator.',
    'Stablecoin supply is Phase 2 and requires a crypto liquidity provider.',
    'Money-market assets, bank reserves, M2, financial conditions, TGA, reverse repo, and SOFR remain pending in the cache-backed first visual pass.',
    'Seed cache is compact and must be replaced by live FRED refresh before production-grade analysis.'
  ];

  const chartSeries = {
    money_cash_main: {
      chart_id: 'money_cash_main',
      title: '3M T-bill yield vs CPI YoY vs real cash yield',
      y_axis: 'percent',
      default_window: '10y',
      display_rule: 'raw_series_first',
      series: {
        tbill_3m_yield: tbill,
        cpi_yoy: cpiYoy,
        real_cash_yield: realCashYield
      }
    },
    front_end_rates: {
      chart_id: 'front_end_rates',
      title: 'Fed funds vs 3M T-bill',
      y_axis: 'percent',
      default_window: '10y',
      display_rule: 'raw_series_first',
      series: {
        effective_fed_funds: fedFunds,
        tbill_3m_yield: tbill
      }
    },
    liquidity_plumbing: {
      chart_id: 'liquidity_plumbing',
      title: 'Liquidity plumbing pending source coverage',
      y_axis: 'native units / index',
      default_window: '10y',
      display_rule: 'pending_source_coverage',
      series: {
        bank_reserves: [],
        reverse_repo: [],
        m2: [],
        financial_conditions: []
      }
    }
  };

  const state = {
    artifact: 'money-cash-chart-dataset',
    version: 8,
    as_of: new Date().toISOString(),
    asset_class: 'Money / Cash',
    coverage,
    cache: {
      status: cache.cache_status,
      created_at: cache.created_at,
      source_policy: cache.source_policy
    },
    doctrine: {
      primary_rule: 'Render raw dataset first; annotations are analytic overlays, not replacements.',
      interpretation_rule: 'Text interpretation is secondary to direct data and must not hide missing evidence.',
      annotation_rule: 'Historical annotations must be suppressed when the chart dataset does not cover the set point.'
    },
    macro_gate_contribution: coverage === 'PARTIAL' ? 'eligible_for_partial_macro_matrix' : 'not_eligible',
    primary_question: 'Is capital being paid to wait, or is capital being forced out on the risk curve?',
    datasets,
    derived,
    chart_series: chartSeries,
    display_spec: {
      mode: 'direct_data_with_annotations',
      default_chart: 'money_cash_main',
      chart_order: ['money_cash_main', 'front_end_rates', 'liquidity_plumbing'],
      required_visual_layers: ['raw_line_series', 'zero_line', 'current_value_markers', 'historical_set_point_annotations'],
      prohibited_visual_layers: ['unsupported_historical_values', 'interpretation_only_cards']
    },
    annotation_spec: {
      charts: {},
      current_markers: [
        currentMarker('tbill_3m_yield', latestTbill),
        currentMarker('cpi_yoy', latestCpiYoy),
        currentMarker('real_cash_yield', latestRealCash),
        currentMarker('effective_fed_funds', latestFedFunds),
        currentMarker('real_fed_funds', latestRealFedFunds)
      ]
    },
    historical_reference: {
      tbill_3m_yield: { windows: datasets.tbill_3m_yield.historical_reference },
      cpi_yoy: { windows: derived.cpi_yoy.historical_reference },
      real_cash_yield: { windows: derived.real_cash_yield.historical_reference },
      real_fed_funds: { windows: derived.real_fed_funds.historical_reference },
      financial_conditions: { windows: null }
    },
    web_summary: {
      section_title: 'Money / Cash',
      display_mode: 'raw_chart_with_historical_set_point_annotations',
      primary_chart: 'money_cash_main',
      chart_order: ['money_cash_main', 'front_end_rates', 'liquidity_plumbing'],
      current_reading: {
        real_cash_yield: latestRealCash?.value ?? null,
        real_cash_yield_date: latestRealCash?.date ?? null,
        tbill_3m_yield: latestTbill?.value ?? null,
        tbill_3m_yield_date: latestTbill?.date ?? null,
        cpi_yoy: latestCpiYoy?.value ?? null,
        cpi_yoy_date: latestCpiYoy?.date ?? null,
        effective_fed_funds: latestFedFunds?.value ?? null,
        effective_fed_funds_date: latestFedFunds?.date ?? null,
        financial_conditions: null
      },
      historical_context: {
        real_cash_yield_10y_zone: derived.real_cash_yield.historical_reference?.['10y']?.relative_zone || 'unknown',
        real_cash_yield_10y_percentile: derived.real_cash_yield.historical_reference?.['10y']?.current_percentile ?? null,
        tbill_3m_10y_zone: datasets.tbill_3m_yield.historical_reference?.['10y']?.relative_zone || 'unknown',
        tbill_3m_10y_percentile: datasets.tbill_3m_yield.historical_reference?.['10y']?.current_percentile ?? null,
        financial_conditions_10y_zone: 'pending'
      },
      annotation_policy: 'Show raw data first. Overlay data-backed historical set points. Keep interpretation secondary.',
      inference: 'Annotation-only workbench generated from cache-backed chart data. Refresh source cache before production-grade analysis.',
      historical_narrative: 'Historical comparisons are data-backed set points, not causal claims by themselves.',
      portfolio_implication: 'Use Money / Cash as one input in the Macro spine.'
    },
    missing_evidence: missingEvidence,
    analysis: {
      mode: 'minimal_secondary_read',
      cycle_state: latestRealCash?.value > 1 ? 'cash competes with risk' : latestRealCash?.value < 0 ? 'cash does not preserve purchasing power' : 'cash near neutral or incomplete',
      positives: [],
      constraints: [],
      relative_signals: [],
      missing: missingEvidence,
      ontological_landscape_read: 'Raw Money / Cash chart artifact generated from cache. Use chart annotations to compare current readings with historical regimes.',
      historical_cycle_narrative: 'Historical comparisons are data-backed set points, not causal claims by themselves.',
      portfolio_implication: 'Preserve optionality until the rest of the Core Macro Spine confirms.'
    },
    generator: {
      path: 'scripts/generate-money-cash-state-from-cache.cjs',
      sources: ['data/cache/money-cash-series.json'],
      derivation_notes: [
        'CPI YoY is calendar-year based, not fixed-row-count based.',
        'Real cash yield and real fed funds use carry-forward CPI YoY alignment.'
      ],
      limitations: cache.limitations || []
    }
  };

  // Keep latestCpi referenced in artifact through datasets; this line prevents accidental removal during refactors.
  void latestCpi;

  for (const file of outputPaths) writeJson(file, state);
  console.log(`generated money-cash-state-from-cache: coverage=${coverage}, real_cash_rows=${realCashYield.length}`);
}

main();
