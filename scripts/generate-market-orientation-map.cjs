const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const ontology = read('ontology/market-orientation-seed.json');
const state = read('data/report-state.live.json');
const interpretations = read('outputs/strategy-interpretations.json');
const list = v => Array.isArray(v) ? v : [];
const interpBy = Object.fromEntries(list(interpretations.interpretations).map(x => [String(x.ticker || '').toUpperCase(), x]));
const holdingsBy = Object.fromEntries(list(state.holdings).map(x => [String(x.ticker || '').toUpperCase(), x]));
function classifyPressure(theme){
  let score = 0;
  for(const ticker of theme.tickers || []){
    const h = holdingsBy[ticker] || {};
    const i = interpBy[ticker] || {};
    const action = String(i.actionPermission?.status || h.signal || '').toLowerCase();
    const trend = Number(h.perf1mPct || 0);
    if(/hold|allowed|monitor/.test(action)) score += 1;
    if(/trim|review|blocked|exit/.test(action)) score -= 1;
    if(trend > 5) score += 1;
    if(trend < -5) score -= 1;
  }
  if(score >= 3) return 'expanding';
  if(score <= -2) return 'stressed';
  return 'mixed';
}
const map = {
  generatedAt: new Date().toISOString(),
  macroWeather: {
    liquidity: state.marketRegime?.posture || 'mixed',
    stress: state.marketRegime?.mostImportantMacroSignal || 'monitoring',
    rates: state.liveRatesCredit?.find(x => x.id === 'DGS10')?.value || null,
    credit: state.liveRatesCredit?.find(x => x.id === 'BAMLH0A0HYM2')?.value || null
  },
  themes: ontology.themes.map(theme => ({
    id: theme.id,
    title: theme.title,
    phase: theme.phase,
    directionalBias: theme.directionalBias,
    pressureState: classifyPressure(theme),
    dependencies: theme.dependencies,
    tickers: theme.tickers.map(ticker => {
      const h = holdingsBy[ticker] || {};
      const i = interpBy[ticker] || {};
      return {
        ticker,
        signal: i.actionPermission?.status || h.signal || 'review',
        weight: h.portfolioWeightPct || 0,
        trend1m: h.perf1mPct || 0
      };
    }),
    watchQuestions: theme.watchQuestions
  }))
};
const out = path.join(root, 'outputs', 'market-orientation-map.json');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(map, null, 2));
console.log(`generated market orientation map: ${map.themes.length} themes`);
