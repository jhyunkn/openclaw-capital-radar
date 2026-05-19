const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const mapPath = path.join(root, 'outputs', 'market-orientation-map.json');

function fail(message) {
  console.error(`MARKET ORIENTATION MAP VALIDATION FAILED: ${message}`);
  process.exit(1);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

assert(fs.existsSync(mapPath), 'outputs/market-orientation-map.json missing');
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

assert(map.generatedAt, 'generatedAt missing');
assert(map.macroWeather && typeof map.macroWeather === 'object', 'macroWeather missing');
assert(map.directionalThesis && typeof map.directionalThesis === 'object', 'directionalThesis missing');
assert(Array.isArray(map.layers) && map.layers.length >= 5, 'expected at least five orientation layers');
assert(Array.isArray(map.themes) && map.themes.length >= 4, 'expected at least four structural themes');

const requiredLayerIds = [
  'macro_regime',
  'infrastructure_dependency',
  'narrative_velocity',
  'capital_flow',
  'asymmetry_discovery'
];
const layerIds = new Set(map.layers.map(layer => layer.id));
for (const id of requiredLayerIds) assert(layerIds.has(id), `missing required layer ${id}`);

for (const theme of map.themes) {
  assert(theme.id, 'theme missing id');
  assert(theme.title, `${theme.id} missing title`);
  assert(theme.phase, `${theme.id} missing phase`);
  assert(theme.directionalBias, `${theme.id} missing directionalBias`);
  assert(['expanding', 'mixed', 'stressed'].includes(theme.pressureState), `${theme.id} has invalid pressureState`);
  assert(Number.isFinite(Number(theme.pressureScore)), `${theme.id} missing numeric pressureScore`);
  assert(Array.isArray(theme.layers) && theme.layers.length > 0, `${theme.id} missing layer links`);
  assert(Array.isArray(theme.dependencies) && theme.dependencies.length > 0, `${theme.id} missing dependencies`);
  assert(Array.isArray(theme.tickers) && theme.tickers.length > 0, `${theme.id} missing tickers`);
  assert(Array.isArray(theme.watchQuestions) && theme.watchQuestions.length > 0, `${theme.id} missing watchQuestions`);

  for (const ticker of theme.tickers) {
    assert(ticker.ticker, `${theme.id} ticker missing symbol`);
    assert(ticker.signal, `${theme.id}/${ticker.ticker} missing signal`);
    assert(Number.isFinite(Number(ticker.weightPct)), `${theme.id}/${ticker.ticker} missing numeric weightPct`);
    assert(Number.isFinite(Number(ticker.trend1mPct)), `${theme.id}/${ticker.ticker} missing numeric trend1mPct`);
  }
}

assert(Array.isArray(map.directionalThesis.leanInto) && map.directionalThesis.leanInto.length > 0, 'directionalThesis.leanInto missing');
assert(Array.isArray(map.directionalThesis.avoid) && map.directionalThesis.avoid.length > 0, 'directionalThesis.avoid missing');
assert(Array.isArray(map.directionalThesis.invalidateIf) && map.directionalThesis.invalidateIf.length > 0, 'directionalThesis.invalidateIf missing');

console.log(`market orientation map validated: ${map.layers.length} layers / ${map.themes.length} themes`);
