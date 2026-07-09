'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function readJson(rel, fallback = {}) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { return fallback; }
}

function writeOutput(name, data) {
  for (const dir of ['outputs', 'public/outputs']) {
    const file = path.join(root, dir, name);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  }
}

function clamp(value) {
  const n = Number(value);
  return Math.max(0, Math.min(100, Number.isFinite(n) ? Math.round(n) : 50));
}

function avg(values) {
  const nums = values.map(Number).filter(Number.isFinite);
  return nums.length ? nums.reduce((sum, value) => sum + value, 0) / nums.length : 50;
}

function metricMap(state) {
  const map = new Map();
  for (const group of state.groups || []) {
    for (const metric of group.metrics || []) map.set(metric.id, metric);
  }
  return map;
}

function scoreFromMetrics(metrics, ids) {
  return clamp(avg(ids.map(id => metrics.get(id)?.percentile)));
}

function stateLabel(score, high, mid, low) {
  if (score >= 75) return high;
  if (score >= 45) return mid;
  return low;
}

function directionFrom(metrics, ids) {
  const dirs = ids.map(id => metrics.get(id)?.direction).filter(Boolean);
  if (dirs.filter(d => d === 'up').length > dirs.filter(d => d === 'down').length) return 'up';
  if (dirs.filter(d => d === 'down').length > dirs.filter(d => d === 'up').length) return 'down';
  return 'flat';
}

function evidence(metrics, ids) {
  return ids.map(id => metrics.get(id)?.label || id).filter(Boolean);
}

function freshness(metrics, ids) {
  return ids.map(id => metrics.get(id)?.freshness).filter(Boolean);
}

const now = new Date().toISOString();
const current = readJson('outputs/current-market-state.json');
const cycle = readJson('outputs/macro-cycle-state.json');
const metrics = metricMap(current);

const axisDefs = [
  {
    id: 'money',
    label: 'Money',
    ids: ['real_yield_10y', 'fed_funds', '2y_treasury', '10y_treasury'],
    state: score => stateLabel(score, 'Restrictive', 'Firm', 'Loose'),
    missingEvidence: ['term premium history alignment'],
  },
  {
    id: 'liquidity',
    label: 'Liquidity',
    ids: ['nasdaq', 'russell', 'vix'],
    state: score => stateLabel(score, 'Supportive but extended', 'Mixed', 'Weak'),
    missingEvidence: ['global liquidity source refresh'],
  },
  {
    id: 'funding',
    label: 'Funding',
    ids: ['10y_treasury', 'move'],
    state: score => stateLabel(score, 'Pressure', 'Firm', 'Easy'),
    missingEvidence: ['cross-currency basis integration'],
  },
  {
    id: 'credit',
    label: 'Credit',
    ids: ['hy_oas', 'ig_oas'],
    state: score => stateLabel(100 - score, 'Contained', 'Watch', 'Stress'),
    missingEvidence: ['lending standards refresh'],
  },
  {
    id: 'risk_appetite',
    label: 'Risk Appetite',
    ids: ['spx', 'nasdaq', 'russell', 'vix'],
    state: score => stateLabel(score, 'Strong but extended', 'Selective strength', 'Weak'),
    missingEvidence: ['factor breadth decomposition'],
  },
  {
    id: 'physical_constraint',
    label: 'Physical Constraint',
    ids: ['copper', 'oil', 'silver'],
    state: score => stateLabel(score, 'Tightening', 'Firm', 'Loose'),
    missingEvidence: ['power grid capacity data', 'water stress data'],
  },
];

const axes = axisDefs.map(def => {
  const score = scoreFromMetrics(metrics, def.ids);
  return {
    id: def.id,
    label: def.label,
    score,
    state: def.state(score),
    direction: directionFrom(metrics, def.ids),
    confidence: clamp(avg(def.ids.map(id => metrics.get(id)?.freshness ? 72 : 45))),
    evidence: evidence(metrics, def.ids),
    freshness: freshness(metrics, def.ids),
    missingEvidence: def.missingEvidence,
  };
});

const byAxis = Object.fromEntries(axes.map(axis => [axis.id, axis]));
const sourceConfiguration = Object.fromEntries(axes.map(axis => [axis.id, axis.score]));
const diagnosisLabel = [
  byAxis.money?.state || 'money pending',
  byAxis.risk_appetite?.state || 'risk pending',
  byAxis.physical_constraint?.state || 'physical pending',
].join(', ');

const configuration = {
  generatedAt: now,
  schema: 'macro_configuration_state_v1',
  policy: 'Generated from current-market-state and refreshed each build. Each axis discloses score, direction, confidence, evidence basis, freshness, and missing evidence.',
  diagnosis: {
    label: diagnosisLabel,
    confidence: clamp(avg(axes.map(axis => axis.confidence))),
    basis: axes.map(axis => `${axis.label}: ${axis.state} (${axis.score})`),
  },
  axes,
  tensions: [
    {
      id: 'real_yield_vs_growth',
      label: 'High real yields, resilient risk leadership',
      interpretation: 'Risk appetite can hold while restrictive money limits broad add permission.',
    },
    {
      id: 'credit_vs_equity',
      label: 'Contained credit, extended equity percentile',
      interpretation: 'Credit is not yet confirming stress, but high equity percentile reduces margin of safety.',
    },
    {
      id: 'physical_vs_policy',
      label: 'Physical pressure during firm policy',
      interpretation: 'Supply-side pressure can complicate rate-cut expectations and margin assumptions.',
    },
  ],
  portfolioImplication: {
    favor: ['quality growth', 'AI infrastructure enablers', 'cash discipline'],
    avoid: ['weak credit beta', 'unruled duration exposure', 'chasing speculative beta without pullback confirmation'],
    watch: ['credit spread confirmation', 'real-yield break', 'VIX expansion', 'power / commodity squeeze'],
  },
};

const analogBase = [
  {
    period: '2022',
    label: 'Inflation shock / real-yield repricing',
    evidenceQuality: 'good',
    pattern: 'Restrictive money and inflation pressure can compress multiples even while leadership remains resilient.',
    difference: 'Current credit stress is more contained and AI infrastructure leadership remains concentrated.',
    portfolioLesson: 'Do not assume multiple expansion while real yields remain restrictive; size risk around inflation and rate sensitivity.',
  },
  {
    period: '1998',
    label: 'Funding stress without immediate broad collapse',
    evidenceQuality: 'good',
    pattern: 'Strong risk appetite can coexist with funding pressure until transmission becomes visible.',
    difference: 'Current physical and AI infrastructure cycle differs from late-1990s internet leadership.',
    portfolioLesson: 'Watch funding and volatility carefully; contained credit can delay but not eliminate repricing.',
  },
  {
    period: '1973-74',
    label: 'Oil shock / physical constraint recession',
    evidenceQuality: 'usable',
    pattern: 'Physical constraints and inflation pressure interacted with restrictive policy and equity drawdown risk.',
    difference: 'Current physical pressure includes power, copper, and AI infrastructure rather than oil alone.',
    portfolioLesson: 'Physical constraints can convert inflation into margin pressure; infrastructure exposure matters.',
  },
  {
    period: '1980-82',
    label: 'Real-rate reset',
    evidenceQuality: 'usable',
    pattern: 'Restrictive real rates forced repricing across duration, credit, and cyclical exposure.',
    difference: 'Current leadership is more concentrated around technology infrastructure.',
    portfolioLesson: 'Treat duration and weak balance sheets cautiously while real-rate pressure remains high.',
  },
];

const analogs = analogBase.map((analog, index) => ({
  ...analog,
  similarity: clamp(92 - index * 7 - Math.abs((byAxis.credit?.score || 50) - 40) * 0.12),
}));

const historicalAnalog = {
  generatedAt: now,
  schema: 'macro_historical_analog_state_v1',
  policy: 'Generated from current macro configuration. Historical analogs compare configuration patterns, not isolated chart shapes.',
  sourceConfiguration,
  sourceConfigurationGeneratedAt: configuration.generatedAt,
  analogs,
  missingEvidence: [
    'Pre-1960 proxy normalization for credit spreads',
    'Comparable real-yield proxy before TIPS era',
    'Long-history global liquidity series',
    'Power / electricity demand long-history comparable series',
  ],
};

const portfolioTranslation = {
  generatedAt: now,
  schema: 'macro_portfolio_translation_state_v1',
  policy: 'Portfolio translation converts configuration and historical memory into allocation posture, not automatic buy/sell instructions.',
  sourceConfiguration,
  sourceConfigurationGeneratedAt: configuration.generatedAt,
  posture: {
    label: cycle.cycle_phase || 'Selective risk-on with restrictive-money discipline',
    riskLevel: byAxis.risk_appetite?.score >= 75 ? 'Moderate-high but pullback-gated' : 'Moderate',
    cashDiscipline: byAxis.money?.score >= 70 ? 'High' : 'Normal',
    durationPosture: byAxis.money?.score >= 70 ? 'Avoid unruled long-duration exposure until real-yield pressure eases' : 'Duration can be reviewed if confirmation improves',
    creditPosture: byAxis.credit?.score <= 45 ? 'Contained spreads allow holding quality exposure' : 'Watch credit deterioration before increasing beta',
    equityPosture: 'Favor quality growth and infrastructure enablers; avoid broad chasing without pullback confirmation',
    commodityPosture: byAxis.physical_constraint?.score >= 70 ? 'Maintain attention to power, copper, energy, and physical bottlenecks' : 'Monitor physical inputs as secondary confirmation',
  },
  allocationBias: [
    {
      bucket: 'Cash / T-bill discipline',
      bias: byAxis.money?.score >= 70 ? 'Overweight relative to normal risk-on periods' : 'Neutral',
      rationale: `Money axis is ${byAxis.money?.state} at ${byAxis.money?.score}.`,
    },
    {
      bucket: 'Quality growth / AI infrastructure',
      bias: 'Selective overweight',
      rationale: `Risk appetite is ${byAxis.risk_appetite?.state} at ${byAxis.risk_appetite?.score}; entries remain ruled.`,
    },
    {
      bucket: 'Energy / power / physical infrastructure',
      bias: byAxis.physical_constraint?.score >= 70 ? 'Watch-to-overweight' : 'Watch',
      rationale: `Physical constraint axis is ${byAxis.physical_constraint?.state} at ${byAxis.physical_constraint?.score}.`,
    },
    {
      bucket: 'Weak credit / small-cap beta',
      bias: 'Underweight until confirmation improves',
      rationale: `Credit axis is ${byAxis.credit?.state} at ${byAxis.credit?.score}; do not use index strength alone as permission.`,
    },
    {
      bucket: 'Long duration',
      bias: byAxis.money?.score >= 70 ? 'Underweight until signal improves' : 'Review selectively',
      rationale: 'Duration permission depends on real-yield relief without credit deterioration.',
    },
  ],
  riskRules: [
    { trigger: 'Credit confirmation', watch: 'HY OAS / IG OAS widening while small caps break lower', action: 'Downgrade risk posture and raise cash / defensive allocation.' },
    { trigger: 'Funding stress', watch: 'MOVE, dollar, and volatility rise together', action: 'Reduce speculative exposure and monitor global liquidity stress.' },
    { trigger: 'Real-yield relief', watch: '10Y real yield falls materially without credit deterioration', action: 'Reassess duration and growth multiple pressure.' },
    { trigger: 'Physical squeeze', watch: 'Copper / power / energy inputs accelerate with inflation expectations', action: 'Increase focus on infrastructure beneficiaries and inflation-sensitive risks.' },
  ],
  historicalLessons: analogs.slice(0, 4).map(analog => ({ period: analog.period, lesson: analog.portfolioLesson })),
  missingEvidence: [
    'Portfolio-specific target allocation percentages are not yet connected.',
    'Tax constraints and account-level liquidity needs are not integrated.',
    'Ticker-level entry zones are handled outside this macro translation layer.',
  ],
};

writeOutput('macro-configuration-state.json', configuration);
writeOutput('macro-historical-analog-state.json', historicalAnalog);
writeOutput('macro-portfolio-translation-state.json', portfolioTranslation);
console.log(`macro-derived-states: ${configuration.diagnosis.label}; generated ${now}`);
