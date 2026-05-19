const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

const read = (rel, fallback = null) => {
  const target = path.join(root, rel);
  return fs.existsSync(target)
    ? JSON.parse(fs.readFileSync(target, 'utf8'))
    : fallback;
};

const ontology = read('ontology/market-orientation-seed.json', { layers: [], themes: [] });
const state = read('data/report-state.live.json', {});
const interpretations = read('outputs/strategy-interpretations.json', { interpretations: [] });
const opportunities = read('outputs/opportunity-evidence-packets.json', { priorityQueue: [] });

const list = v => Array.isArray(v) ? v : [];
const byTicker = rows => Object.fromEntries(list(rows).map(x => [String(x.ticker || x.symbol || '').toUpperCase(), x]));
const interpBy = byTicker(interpretations.interpretations);
const holdingsBy = byTicker(state.holdings);

function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }

function classifyPressure(theme){
  let score = 0;
  for(const ticker of theme.tickers || []){
    const h = holdingsBy[ticker] || {};
    const i = interpBy[ticker] || {};
    const action = String(i.actionPermission?.status || h.signal || '').toLowerCase();
    const trend = num(h.perf1mPct);

    if(/hold|allowed|monitor|support/.test(action)) score += 1;
    if(/trim|review|blocked|exit|threat/.test(action)) score -= 1;
    if(trend > 5) score += 1;
    if(trend < -5) score -= 1;
  }

  if(score >= 3) return 'expanding';
  if(score <= -2) return 'stressed';
  return 'mixed';
}

function pressureScore(theme){
  const tickers = theme.tickers || [];
  if(!tickers.length) return 0;

  const avgTrend = tickers.reduce((sum,ticker)=>sum + num(holdingsBy[ticker]?.perf1mPct),0) / tickers.length;
  const totalWeight = tickers.reduce((sum,ticker)=>sum + num(holdingsBy[ticker]?.portfolioWeightPct),0);

  return Number((avgTrend * 0.55 + totalWeight * 0.45).toFixed(2));
}

const themes = ontology.themes.map(theme => ({
  id: theme.id,
  title: theme.title,
  phase: theme.phase,
  directionalBias: theme.directionalBias,
  pressureState: classifyPressure(theme),
  pressureScore: pressureScore(theme),
  layers: theme.layers,
  dependencies: theme.dependencies,
  tickers: list(theme.tickers).map(ticker => {
    const h = holdingsBy[ticker] || {};
    const i = interpBy[ticker] || {};

    return {
      ticker,
      signal: i.actionPermission?.status || h.signal || 'review',
      weightPct: num(h.portfolioWeightPct),
      trend1mPct: num(h.perf1mPct),
      thesis: i.thesisStatus?.status || h.health || 'unmapped'
    };
  }),
  watchQuestions: theme.watchQuestions
})).sort((a,b)=>Math.abs(b.pressureScore)-Math.abs(a.pressureScore));

const map = {
  generatedAt: new Date().toISOString(),
  purpose: 'Strategic market orientation map for macro regime, structural pressure, narrative velocity, capital flow, and asymmetry discovery.',
  orientationPrinciple: 'Macro weather -> structural pressure -> directional thesis -> holdings/opportunities.',

  macroWeather: {
    posture: state.marketRegime?.posture || state.finalOutput?.marketPosture || 'mixed',
    stress: state.marketRegime?.mostImportantMacroSignal || state.finalOutput?.mostImportantMacroSignal || 'monitoring',
    tenYearYield: list(state.liveRatesCredit).find(x => x.id === 'DGS10')?.value ?? null,
    highYieldOAS: list(state.liveRatesCredit).find(x => x.id === 'BAMLH0A0HYM2')?.value ?? null,
    dominantMessage: state.finalOutput?.macroSummary || 'Structural positioning remains more important than isolated ticker movement.'
  },

  directionalThesis: {
    summary: 'Structural pressure remains concentrated around AI infrastructure, power systems, digital treasury rails, and quality financial infrastructure while liquidity-sensitive beta remains regime-dependent.',
    leanInto: [
      'Infrastructure beneficiaries with durable demand pull',
      'Second-order AI systems and power bottlenecks',
      'Financial rails benefiting from digitization and treasury transition'
    ],
    avoid: [
      'Crowded momentum without infrastructure support',
      'Narrative-only speculation lacking capital confirmation'
    ],
    invalidateIf: [
      'AI capex materially contracts',
      'Credit stress expands rapidly',
      'Liquidity regime deteriorates faster than infrastructure demand can compensate'
    ]
  },

  opportunityFrontier: list(opportunities.priorityQueue).slice(0,8).map(item => ({
    ticker: item.ticker,
    lane: item.lane,
    opportunityScore: item.opportunityScore,
    whyInteresting: item.whyInteresting
  })),

  layers: ontology.layers,
  themes
};

const out = path.join(root, 'outputs', 'market-orientation-map.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map, null, 2));

console.log(`generated market orientation map: ${themes.length} themes`);
