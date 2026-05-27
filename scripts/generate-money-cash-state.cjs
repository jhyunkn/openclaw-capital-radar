const fs = require('fs');
const path = require('path');
const { fetchFredSeries } = require('./lib/fetch-fred.cjs');

const root = path.join(__dirname, '..');

function write(rel, data) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

function pct(value) {
  return Number.isFinite(value) ? Number(value.toFixed(2)) : null;
}

function daysOld(dateString, now = new Date()) {
  const d = new Date(`${dateString}T00:00:00Z`);
  if (!Number.isFinite(d.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - d.getTime()) / 86400000));
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

function classifyMoneyCash({ datasets, derived }) {
  const realCash = derived.real_cash_yield?.value;
  const reservesChange = datasets.bank_reserves?.delta_4w;
  const rrpChange = datasets.reverse_repo?.delta_4w;
  const m2Change = datasets.m2?.pct_delta_3m;
  const nfci = datasets.financial_conditions?.latest_value;

  const positives = [];
  const constraints = [];
  const missing = [];

  if (Number.isFinite(realCash)) {
    if (realCash > 1) positives.push('Cash earns a positive real waiting return.');
    else if (realCash < 0) constraints.push('Cash does not preserve purchasing power after inflation.');
  } else missing.push('real cash yield');

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
    missing,
    ontological_landscape_read: landscape_read,
    historical_cycle_narrative: 'Compare this state to prior tightening, cash-competition, and post-stress redeployment windows after more historical coverage is added.',
    portfolio_implication
  };
}

async function main() {
  const generatedAt = new Date().toISOString();
  const fetched = await Promise.all(Object.entries(SERIES).map(([key, spec]) => safeFetch(key, spec)));

  const datasets = {};
  const errors = [];

  for (const item of fetched) {
    const latest = item.series?.latest || null;
    const confidence = item.error ? 'MISSING' : freshnessLabel(latest, item.spec.maxDays);
    if (item.error) errors.push({ dataset: item.key, seriesId: item.spec.seriesId, error: item.error });

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
      observations_count: item.series?.observations?.length || 0
    };
  }

  const tbill = datasets.tbill_3m_yield?.latest_value;
  const cpiSeries = fetched.find(item => item.key === 'cpi_inflation')?.series;
  const cpiYoY = (() => {
    const values = [...(cpiSeries?.observations || [])].filter(row => Number.isFinite(row.value));
    if (values.length < 13) return null;
    const latest = values[values.length - 1];
    const prior = values[values.length - 13];
    return prior.value ? Number((((latest.value - prior.value) / prior.value) * 100).toFixed(2)) : null;
  })();
  const realCashYield = Number.isFinite(tbill) && Number.isFinite(cpiYoY) ? pct(tbill - cpiYoY) : null;
  const effr = datasets.effective_fed_funds?.latest_value;
  const realFedFunds = Number.isFinite(effr) && Number.isFinite(cpiYoY) ? pct(effr - cpiYoY) : null;

  const derived = {
    cpi_yoy: {
      label: 'CPI year-over-year inflation',
      value: cpiYoY,
      confidence: Number.isFinite(cpiYoY) ? datasets.cpi_inflation.confidence : 'MISSING'
    },
    real_cash_yield: {
      label: '3M T-bill yield minus CPI YoY',
      value: realCashYield,
      confidence: Number.isFinite(realCashYield) ? 'AUTH' : 'MISSING'
    },
    real_fed_funds: {
      label: 'Effective fed funds minus CPI YoY',
      value: realFedFunds,
      confidence: Number.isFinite(realFedFunds) ? 'AUTH' : 'MISSING'
    }
  };

  const requiredButMissing = [
    'Treasury bill supply is declared in Mission 3 but not implemented in this first generator.',
    'Stablecoin supply is Phase 2 and requires a crypto liquidity provider.'
  ];

  const availableCore = Object.values(datasets).filter(d => d.tier === 'CORE' && ['AUTH', 'VERIFIED_PROXY'].includes(d.confidence)).length;
  const totalCore = Object.values(datasets).filter(d => d.tier === 'CORE').length + 2;
  const coverage = availableCore >= 4 ? 'PARTIAL' : 'MISSING';

  const analysis = classifyMoneyCash({ datasets, derived });

  const output = {
    artifact: 'money-cash-state',
    version: 1,
    as_of: generatedAt,
    asset_class: 'Money / Cash',
    coverage,
    macro_gate_contribution: coverage === 'PARTIAL' ? 'eligible_for_partial_macro_matrix' : 'not_eligible',
    primary_question: 'Is capital being paid to wait, or is capital being forced out on the risk curve?',
    datasets,
    derived,
    missing_evidence: requiredButMissing.concat(errors.map(e => `${e.dataset} failed: ${e.error}`)),
    analysis,
    generator: {
      path: 'scripts/generate-money-cash-state.cjs',
      sources: ['FRED public CSV endpoint'],
      limitations: [
        'No market-price provider is used in this generator.',
        'Treasury bill supply is not implemented until FiscalData plumbing is added.',
        'Stablecoin supply is not implemented until a crypto liquidity provider is selected.'
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
