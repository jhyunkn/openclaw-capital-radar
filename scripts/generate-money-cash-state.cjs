const fs = require('fs');
const path = require('path');
const { fetchFredSeries } = require('./lib/fetch-fred.cjs');

const root = path.join(__dirname, '..');
const HISTORY_WINDOWS = [
  { id: '1y', years: 1, label: '1-year' },
  { id: '5y', years: 5, label: '5-year' },
  { id: '10y', years: 10, label: '10-year' },
  { id: 'full', years: null, label: 'full available history' }
];

const HISTORICAL_SET_POINTS = [
  {
    id: 'gfc_2008',
    date: '2008-09-15',
    label: '2008 crisis set point',
    note: 'Lehman failure / global credit crisis reference point.'
  },
  {
    id: 'late_cycle_2018',
    date: '2018-12-19',
    label: '2018 late-cycle tightening set point',
    note: 'Fed hike / late-cycle risk tightening reference point.'
  },
  {
    id: 'covid_liquidity_2020',
    date: '2020-03-16',
    label: '2020 emergency-liquidity set point',
    note: 'COVID shock / emergency policy response reference point.'
  },
  {
    id: 'zero_rate_2021',
    date: '2021-12-15',
    label: '2021 zero-rate liquidity set point',
    note: 'Near-zero-rate / abundant-liquidity reference point.'
  },
  {
    id: 'hiking_cycle_2022',
    date: '2022-06-15',
    label: '2022 hiking-cycle set point',
    note: 'Inflation shock / accelerated hiking-cycle reference point.'
  }
];

function write(rel, data) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function pct(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function rounded(value, digits = 3) {
  return Number.isFinite(value) ? Number(value.toFixed(digits)) : null;
}

function daysOld(dateString, now = new Date()) {
  const d = new Date(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
}

function dateDistanceDays(a, b) {
  const da = new Date(`${a}T00:00:00Z`);
  const db = new Date(`${b}T00:00:00Z`);
  if (!Number.isFinite(da.getTime()) || !Number.isFinite(db.getTime())) return null;
  return Math.abs(Math.round((da.getTime() - db.getTime()) / 86400000));
}

function freshnessLabel(latest, maxDays) {
  if (!latest || !latest.date || !Number.isFinite(latest.value)) return 'MISSING';
  const age = daysOld(latest.date);
  if (!Number.isFinite(age)) return 'MISSING';
  return age <= maxDays ? 'AUTH' : 'STALE';
}

function latestDelta(series, periods = 1) {
  const values = [...(series.observations || [])].filter(row => Number.isFinite(row.value));
  if (values.length <= periods) return null;
  const latest = values[values.length - 1];
  const prior = values[values.length - 1 - periods];
  return Number((latest.value - prior.value).toFixed(3));
}

function percentDelta(series, periods = 1) {
  const values = [...(series.observations || [])].filter(row => Number.isFinite(row.value));
  if (values.length <= periods) return null;
  const latest = values[values.length - 1];
  const prior = values[values.length - 1 - periods];
  if (!prior.value) return null;
  return Number((((latest.value - prior.value) / Math.abs(prior.value)) * 100).toFixed(2));
}

function valuesSince(observations, years) {
  const rows = [...(observations || [])].filter(row => row.date && Number.isFinite(row.value));
  if (!years) return rows;
  const latest = rows[rows.length - 1];
  if (!latest) return [];
  const cutoff = new Date(`${latest.date}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  return rows.filter(row => new Date(`${row.date}T00:00:00Z`) >= cutoff);
}

function percentileRank(values, current) {
  if (!values.length || !Number.isFinite(current)) return null;
  const belowOrEqual = values.filter(v => v <= current).length;
  return Math.round((belowOrEqual / values.length) * 100);
}

function percentileValue(values, percentile) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((percentile / 100) * (sorted.length - 1))));
  return rounded(sorted[index]);
}

function relativeZone(percentile) {
  if (!Number.isFinite(percentile)) return 'unknown';
  if (percentile >= 90) return 'historically extreme high';
  if (percentile >= 75) return 'historically high';
  if (percentile >= 55) return 'above normal';
  if (percentile >= 45) return 'near normal';
  if (percentile >= 25) return 'below normal';
  if (percentile >= 10) return 'historically low';
  return 'historically extreme low';
}

function historicalReferenceFromRows(rows, currentValue) {
  const windows = {};
  for (const window of HISTORY_WINDOWS) {
    const windowRows = valuesSince(rows, window.years);
    const values = windowRows.map(row => row.value).filter(Number.isFinite);
    const percentile = percentileRank(values, currentValue);
    const avg = values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
    windows[window.id] = {
      label: window.label,
      observations: values.length,
      start_date: windowRows[0]?.date || null,
      end_date: windowRows[windowRows.length - 1]?.date || null,
      min: values.length ? rounded(Math.min(...values)) : null,
      max: values.length ? rounded(Math.max(...values)) : null,
      average: rounded(avg),
      p10: percentileValue(values, 10),
      p25: percentileValue(values, 25),
      median: percentileValue(values, 50),
      p75: percentileValue(values, 75),
      p90: percentileValue(values, 90),
      current_percentile: percentile,
      relative_zone: relativeZone(percentile)
    };
  }
  return windows;
}

function seriesFromDerived(observationsA, observationsB, deriveFn) {
  const byDateB = new Map((observationsB || []).map(row => [row.date, row.value]));
  return (observationsA || []).map(row => {
    const b = byDateB.get(row.date);
    const value = deriveFn(row.value, b);
    return { date: row.date, value: Number.isFinite(value) ? rounded(value) : null };
  }).filter(row => row.date && Number.isFinite(row.value));
}

function yoySeries(indexSeries) {
  const rows = [...(indexSeries?.observations || [])].filter(row => row.date && Number.isFinite(row.value));
  return rows.map((row, index) => {
    const prior = rows[index - 12];
    if (!prior || !prior.value) return { date: row.date, value: null };
    return { date: row.date, value: rounded(((row.value - prior.value) / prior.value) * 100) };
  }).filter(row => row.date && Number.isFinite(row.value));
}

function nearestObservation(rows, targetDate, maxDistanceDays = 45) {
  const valid = [...(rows || [])].filter(row => row.date && Number.isFinite(row.value));
  if (!valid.length) return null;
  let best = null;
  for (const row of valid) {
    const distance = dateDistanceDays(row.date, targetDate);
    if (!Number.isFinite(distance)) continue;
    if (!best || distance < best.distance_days) best = { ...row, distance_days: distance };
  }
  return best && best.distance_days <= maxDistanceDays ? best : null;
}

function historicalSetPointAnnotations({ chartId, seriesRows, currentBySeries, maxDistanceDays = 45 }) {
  const annotations = [];
  for (const point of HISTORICAL_SET_POINTS) {
    const values = {};
    const comparisons = {};
    for (const [seriesId, rows] of Object.entries(seriesRows)) {
      const eventValue = nearestObservation(rows, point.date, maxDistanceDays);
      const currentValue = currentBySeries[seriesId];
      values[seriesId] = eventValue ? {
        date: eventValue.date,
        value: rounded(eventValue.value),
        distance_days: eventValue.distance_days
      } : null;
      comparisons[seriesId] = eventValue && Number.isFinite(currentValue) ? {
        current_value: rounded(currentValue),
        event_value: rounded(eventValue.value),
        difference_from_event: rounded(currentValue - eventValue.value),
        comparison_basis: 'current minus historical set-point value'
      } : null;
    }

    annotations.push({
      id: `${chartId}_${point.id}`,
      chart_id: chartId,
      type: 'historical_set_point',
      target_date: point.date,
      label: point.label,
      note: point.note,
      values,
      current_comparison: comparisons,
      render_hint: 'vertical marker with point labels on each visible series'
    });
  }
  return annotations;
}

const SERIES = {
  tbill_3m_yield: { seriesId: 'DTB3', label: '3-month T-bill yield', maxDays: 10, tier: 'CORE' },
  effective_fed_funds: { seriesId: 'EFFR', label: 'Effective fed funds rate', maxDays: 10, tier: 'CORE' },
  cpi_inflation: { seriesId: 'CPIAUCSL', label: 'CPI inflation index', maxDays: 60, tier: 'CORE' },
  money_market_assets: { seriesId: 'MMMFFAQ027S', label: 'Money-market fund assets', maxDays: 120, tier: 'CORE' },
  bank_reserves: { seriesId: 'WRESBAL', label: 'Reserve balances with Federal Reserve Banks', maxDays: 21, tier: 'CONFIRMING' },
  m2: { seriesId: 'M2SL', label: 'M2 money stock', maxDays: 60, tier: 'CONFIRMING' },
  financial_conditions: { seriesId: 'NFCI', label: 'Chicago Fed National Financial Conditions Index', maxDays: 21, tier: 'CONFIRMING' },
  tga: { seriesId: 'WTREGEN', label: 'Treasury General Account', maxDays: 21, tier: 'CONTEXT' },
  reverse_repo: { seriesId: 'RRPONTSYD', label: 'Overnight reverse repo agreements', maxDays: 10, tier: 'CONTEXT' },
  sofr: { seriesId: 'SOFR', label: 'SOFR', maxDays: 10, tier: 'CONTEXT' }
};

async function safeFetch(key, spec) {
  try {
    const series = await fetchFredSeries(spec.seriesId);
    return { key, spec, series, error: null };
  } catch (error) {
    return { key, spec, series: null, error: error.message || String(error) };
  }
}

function classifyMoneyCash({ datasets, derived, historical_reference }) {
  const realCash = derived.real_cash_yield?.value;
  const realCashPercentile10y = historical_reference?.real_cash_yield?.windows?.['10y']?.current_percentile;
  const reservesChange = datasets.bank_reserves?.delta_4w;
  const rrpChange = datasets.reverse_repo?.delta_4w;
  const m2Change = datasets.m2?.pct_delta_3m;
  const nfci = datasets.financial_conditions?.latest_value;

  const positives = [];
  const constraints = [];
  const missing = [];
  const relativeSignals = [];

  if (Number.isFinite(realCash)) {
    if (realCash > 1) positives.push('Cash earns a positive real waiting return.');
    else if (realCash < 0) constraints.push('Cash does not preserve purchasing power after inflation.');
  } else missing.push('real cash yield');

  if (Number.isFinite(realCashPercentile10y)) {
    relativeSignals.push(`Real cash yield sits in the ${realCashPercentile10y}th percentile versus its 10-year history.`);
    if (realCashPercentile10y >= 75) constraints.push('Real cash yield is historically high, raising the hurdle rate for risk assets.');
    if (realCashPercentile10y <= 25) positives.push('Real cash yield is historically low, reducing the reward for waiting.');
  }

  if (Number.isFinite(reservesChange)) {
    if (reservesChange > 0) positives.push('Bank reserves are rising over the recent window.');
    else if (reservesChange < 0) constraints.push('Bank reserves are contracting over the recent window.');
  } else missing.push('bank-reserve momentum');

  if (Number.isFinite(rrpChange)) {
    if (rrpChange < 0) positives.push('Reverse repo drain may release liquidity into the system.');
    else if (rrpChange > 0) constraints.push('Reverse repo is absorbing liquidity.');
  } else missing.push('reverse-repo momentum');

  if (Number.isFinite(m2Change)) {
    if (m2Change > 0) positives.push('Broad money is expanding over the recent window.');
    else if (m2Change < 0) constraints.push('Broad money is contracting over the recent window.');
  } else missing.push('M2 momentum');

  if (Number.isFinite(nfci)) {
    if (nfci < 0) positives.push('Financial conditions are easier than average.');
    else if (nfci > 0) constraints.push('Financial conditions are tighter than average.');
  } else missing.push('financial conditions');

  let cycle_state = 'incomplete liquidity read';
  let portfolio_implication = 'Hold optionality; do not let Money / Cash drive Macro alone until missing evidence is resolved.';
  let landscape_read = 'Money / Cash coverage is partial, so the system can discuss cash optionality but cannot yet claim a complete liquidity regime.';

  if (positives.length >= 3 && constraints.length <= 1) {
    cycle_state = 'liquidity easing / redeployment window';
    portfolio_implication = 'Cash remains useful, but risk deployment can be considered when price and other asset-class confirmations align.';
    landscape_read = 'Money conditions are moving toward risk-curve permission, subject to Credit, Duration, FX, and Volatility confirmation.';
  } else if (constraints.length >= 3) {
    cycle_state = 'cash optionality / liquidity constraint';
    portfolio_implication = 'Preserve dry powder; avoid forcing full risk deployment until liquidity and credit confirm.';
    landscape_read = 'Money conditions are limiting broad-risk permission and make cash optionality strategically valuable.';
  } else if (Number.isFinite(realCash) && realCash > 1) {
    cycle_state = 'cash competes with risk';
    portfolio_implication = 'Require higher expected return before deploying cash into risk assets.';
    landscape_read = 'The short-rate structure pays capital to wait, raising the hurdle rate for equity and long-duration risk.';
  }

  return {
    cycle_state,
    positives,
    constraints,
    relative_signals: relativeSignals,
    missing,
    ontological_landscape_read: landscape_read,
    historical_cycle_narrative: historicalNarrative({ cycle_state, historical_reference }),
    portfolio_implication
  };
}

function historicalNarrative({ cycle_state, historical_reference }) {
  const realCash10y = historical_reference?.real_cash_yield?.windows?.['10y'];
  const tbill10y = historical_reference?.tbill_3m_yield?.windows?.['10y'];
  const nfci10y = historical_reference?.financial_conditions?.windows?.['10y'];

  const fragments = [];
  if (realCash10y?.relative_zone && realCash10y.relative_zone !== 'unknown') {
    fragments.push(`Real cash yield is ${realCash10y.relative_zone} versus the 10-year window.`);
  }
  if (tbill10y?.relative_zone && tbill10y.relative_zone !== 'unknown') {
    fragments.push(`The 3-month T-bill yield is ${tbill10y.relative_zone} versus the 10-year window.`);
  }
  if (nfci10y?.relative_zone && nfci10y.relative_zone !== 'unknown') {
    fragments.push(`Financial conditions are ${nfci10y.relative_zone} versus the 10-year window.`);
  }

  const base = fragments.length ? fragments.join(' ') : 'Historical reference bands are available in the artifact, but the generator lacks enough valid observations for a full relative narrative.';
  return `${base} Current Money / Cash cycle is classified as ${cycle_state}; compare this with prior cash-competition, tightening, and post-stress redeployment windows before using it as a standalone Macro conclusion.`;
}

async function main() {
  const generatedAt = new Date().toISOString();
  const fetched = await Promise.all(Object.entries(SERIES).map(([key, spec]) => safeFetch(key, spec)));

  const datasets = {};
  const seriesByKey = new Map();
  const errors = [];

  for (const item of fetched) {
    const latest = item.series?.latest || null;
    const confidence = item.error ? 'MISSING' : freshnessLabel(latest, item.spec.maxDays);
    if (item.error) errors.push({ dataset: item.key, seriesId: item.spec.seriesId, error: item.error });
    if (item.series) seriesByKey.set(item.key, item.series);

    datasets[item.key] = {
      label: item.spec.label,
      series_id: item.spec.seriesId,
      tier: item.spec.tier,
      source: 'FRED public CSV endpoint',
      source_url: `https://fred.stlouisfed.org/series/${item.spec.seriesId}`,
      latest_date: latest?.date || null,
      latest_value: latest?.value ?? null,
      freshness_days: latest?.date ? daysOld(latest.date) : null,
      confidence,
      delta_1p: item.series ? latestDelta(item.series, 1) : null,
      delta_4w: item.series ? latestDelta(item.series, 4) : null,
      pct_delta_3m: item.series ? percentDelta(item.series, 3) : null,
      historical_reference: item.series ? historicalReferenceFromRows(item.series.observations, latest?.value) : null,
      observations_count: item.series?.observations?.length || 0
    };
  }

  const tbillRows = seriesByKey.get('tbill_3m_yield')?.observations || [];
  const effrRows = seriesByKey.get('effective_fed_funds')?.observations || [];
  const cpiSeries = seriesByKey.get('cpi_inflation');
  const cpiYoYRows = yoySeries(cpiSeries);
  const cpiYoY = cpiYoYRows[cpiYoYRows.length - 1]?.value ?? null;
  const realCashYieldRows = seriesFromDerived(tbillRows, cpiYoYRows, (tbillValue, cpiValue) => tbillValue - cpiValue);
  const realFedFundsRows = seriesFromDerived(effrRows, cpiYoYRows, (effrValue, cpiValue) => effrValue - cpiValue);
  const tbill = datasets.tbill_3m_yield?.latest_value;
  const effr = datasets.effective_fed_funds?.latest_value;
  const realCashYield = Number.isFinite(tbill) && Number.isFinite(cpiYoY) ? pct(tbill - cpiYoY) : null;
  const realFedFunds = Number.isFinite(effr) && Number.isFinite(cpiYoY) ? pct(effr - cpiYoY) : null;

  const chart_series = {
    money_cash_main: {
      chart_id: 'money_cash_main',
      title: '3M T-bill yield vs CPI YoY vs real cash yield',
      y_axis: 'percent',
      series: {
        tbill_3m_yield: tbillRows.map(row => ({ date: row.date, value: row.value })),
        cpi_yoy: cpiYoYRows,
        real_cash_yield: realCashYieldRows
      }
    },
    front_end_rates: {
      chart_id: 'front_end_rates',
      title: 'Fed funds vs SOFR vs 3M T-bill',
      y_axis: 'percent',
      series: {
        effective_fed_funds: effrRows.map(row => ({ date: row.date, value: row.value })),
        sofr: (seriesByKey.get('sofr')?.observations || []).map(row => ({ date: row.date, value: row.value })),
        tbill_3m_yield: tbillRows.map(row => ({ date: row.date, value: row.value }))
      }
    },
    liquidity_plumbing: {
      chart_id: 'liquidity_plumbing',
      title: 'Bank reserves, reverse repo, M2, and financial conditions',
      y_axis: 'native units / index',
      series: {
        bank_reserves: (seriesByKey.get('bank_reserves')?.observations || []).map(row => ({ date: row.date, value: row.value })),
        reverse_repo: (seriesByKey.get('reverse_repo')?.observations || []).map(row => ({ date: row.date, value: row.value })),
        m2: (seriesByKey.get('m2')?.observations || []).map(row => ({ date: row.date, value: row.value })),
        financial_conditions: (seriesByKey.get('financial_conditions')?.observations || []).map(row => ({ date: row.date, value: row.value }))
      }
    }
  };

  const latestBySeries = {
    tbill_3m_yield: tbill,
    cpi_yoy: cpiYoY,
    real_cash_yield: realCashYield,
    effective_fed_funds: effr,
    sofr: datasets.sofr?.latest_value,
    bank_reserves: datasets.bank_reserves?.latest_value,
    reverse_repo: datasets.reverse_repo?.latest_value,
    m2: datasets.m2?.latest_value,
    financial_conditions: datasets.financial_conditions?.latest_value
  };

  const annotation_spec = {
    historical_set_points: HISTORICAL_SET_POINTS,
    charts: {
      money_cash_main: historicalSetPointAnnotations({
        chartId: 'money_cash_main',
        seriesRows: chart_series.money_cash_main.series,
        currentBySeries: latestBySeries
      }),
      front_end_rates: historicalSetPointAnnotations({
        chartId: 'front_end_rates',
        seriesRows: chart_series.front_end_rates.series,
        currentBySeries: latestBySeries
      }),
      liquidity_plumbing: historicalSetPointAnnotations({
        chartId: 'liquidity_plumbing',
        seriesRows: chart_series.liquidity_plumbing.series,
        currentBySeries: latestBySeries
      })
    },
    current_markers: Object.entries(latestBySeries).map(([seriesId, value]) => ({
      id: `current_${seriesId}`,
      type: 'current_value_marker',
      series_id: seriesId,
      value: rounded(value),
      label: `Current ${seriesId}: ${Number.isFinite(value) ? rounded(value) : 'n/a'}`
    }))
  };

  const historical_reference = {
    tbill_3m_yield: {
      label: '3-month T-bill yield historical reference',
      windows: datasets.tbill_3m_yield?.historical_reference || null
    },
    effective_fed_funds: {
      label: 'Effective fed funds historical reference',
      windows: datasets.effective_fed_funds?.historical_reference || null
    },
    cpi_yoy: {
      label: 'CPI YoY historical reference',
      windows: historicalReferenceFromRows(cpiYoYRows, cpiYoY)
    },
    real_cash_yield: {
      label: 'Real cash yield historical reference',
      windows: historicalReferenceFromRows(realCashYieldRows, realCashYield)
    },
    real_fed_funds: {
      label: 'Real fed funds historical reference',
      windows: historicalReferenceFromRows(realFedFundsRows, realFedFunds)
    },
    money_market_assets: {
      label: 'Money-market fund assets historical reference',
      windows: datasets.money_market_assets?.historical_reference || null
    },
    bank_reserves: {
      label: 'Bank reserves historical reference',
      windows: datasets.bank_reserves?.historical_reference || null
    },
    m2: {
      label: 'M2 historical reference',
      windows: datasets.m2?.historical_reference || null
    },
    financial_conditions: {
      label: 'Financial conditions historical reference',
      windows: datasets.financial_conditions?.historical_reference || null
    },
    reverse_repo: {
      label: 'Reverse repo historical reference',
      windows: datasets.reverse_repo?.historical_reference || null
    }
  };

  const derived = {
    cpi_yoy: {
      label: 'CPI year-over-year inflation',
      value: cpiYoY,
      confidence: Number.isFinite(cpiYoY) ? datasets.cpi_inflation.confidence : 'MISSING',
      historical_reference: historical_reference.cpi_yoy.windows
    },
    real_cash_yield: {
      label: '3M T-bill yield minus CPI YoY',
      value: realCashYield,
      confidence: Number.isFinite(realCashYield) ? 'AUTH' : 'MISSING',
      historical_reference: historical_reference.real_cash_yield.windows
    },
    real_fed_funds: {
      label: 'Effective fed funds minus CPI YoY',
      value: realFedFunds,
      confidence: Number.isFinite(realFedFunds) ? 'AUTH' : 'MISSING',
      historical_reference: historical_reference.real_fed_funds.windows
    }
  };

  const requiredButMissing = [
    'Treasury bill supply is declared in Mission 3 but not implemented in this first generator.',
    'Stablecoin supply is Phase 2 and requires a crypto liquidity provider.'
  ];

  const availableCore = Object.values(datasets).filter(d => d.tier === 'CORE' && ['AUTH', 'VERIFIED_PROXY'].includes(d.confidence)).length;
  const coverage = availableCore >= 4 ? 'PARTIAL' : 'MISSING';

  const analysis = classifyMoneyCash({ datasets, derived, historical_reference });

  const web_summary = {
    section_title: 'Money / Cash',
    display_mode: 'raw_chart_with_historical_set_point_annotations',
    primary_chart: 'money_cash_main',
    chart_order: ['money_cash_main', 'front_end_rates', 'liquidity_plumbing'],
    current_reading: {
      real_cash_yield: derived.real_cash_yield.value,
      tbill_3m_yield: datasets.tbill_3m_yield.latest_value,
      effective_fed_funds: datasets.effective_fed_funds.latest_value,
      financial_conditions: datasets.financial_conditions.latest_value
    },
    historical_context: {
      real_cash_yield_10y_zone: historical_reference.real_cash_yield.windows?.['10y']?.relative_zone || 'unknown',
      real_cash_yield_10y_percentile: historical_reference.real_cash_yield.windows?.['10y']?.current_percentile ?? null,
      tbill_3m_10y_zone: historical_reference.tbill_3m_yield.windows?.['10y']?.relative_zone || 'unknown',
      financial_conditions_10y_zone: historical_reference.financial_conditions.windows?.['10y']?.relative_zone || 'unknown'
    },
    annotation_policy: 'Show raw data first. Overlay historical set points and current-vs-set-point values. Keep interpretation secondary.',
    inference: analysis.ontological_landscape_read,
    historical_narrative: analysis.historical_cycle_narrative,
    portfolio_implication: analysis.portfolio_implication
  };

  const output = {
    artifact: 'money-cash-state',
    version: 3,
    as_of: generatedAt,
    asset_class: 'Money / Cash',
    coverage,
    macro_gate_contribution: coverage === 'PARTIAL' ? 'eligible_for_partial_macro_matrix' : 'not_eligible',
    primary_question: 'Is capital being paid to wait, or is capital being forced out on the risk curve?',
    datasets,
    derived,
    chart_series,
    annotation_spec,
    historical_reference,
    web_summary,
    missing_evidence: requiredButMissing.concat(errors.map(e => `${e.dataset} failed: ${e.error}`)),
    analysis,
    generator: {
      path: 'scripts/generate-money-cash-state.cjs',
      sources: ['FRED public CSV endpoint'],
      historical_windows: HISTORY_WINDOWS.map(w => w.id),
      historical_set_points: HISTORICAL_SET_POINTS.map(p => p.id),
      limitations: [
        'No market-price provider is used in this generator.',
        'Treasury bill supply is not implemented until FiscalData plumbing is added.',
        'Stablecoin supply is not implemented until a crypto liquidity provider is selected.',
        'Historical set points are reference markers, not causal explanations by themselves.',
        'Historical reference uses available FRED history for relative percentile/range context; it is not a causal forecast.'
      ]
    }
  };

  write('outputs/money-cash-state.json', output);
  write('public/outputs/money-cash-state.json', output);
  console.log(`generated money-cash-state: coverage=${coverage}, cycle=${analysis.cycle_state}`);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
