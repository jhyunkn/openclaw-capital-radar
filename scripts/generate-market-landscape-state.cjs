const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputsDir = path.join(root, 'outputs');
const publicOutputsDir = path.join(root, 'public', 'outputs');

function read(rel, fallback = null) {
  const file = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function write(rel, data) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function list(value) { return Array.isArray(value) ? value : []; }
function text(value, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}
function dateOnly(value) {
  const d = new Date(value || Date.now());
  return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10);
}
function score(value, fallback = 0.65) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : fallback;
}
function confidenceFromScores(...scores) {
  const nums = scores.map(Number).filter(Number.isFinite);
  if (!nums.length) return 0.55;
  return Number((nums.reduce((a, b) => a + b, 0) / nums.length).toFixed(2));
}

const state = read('data/report-state.live.json', read('data/report-state.sample.json', {}));
const orientation = read('outputs/market-orientation-map.json', {});
const regime = read('outputs/market-regime-state.json', {});
const truth = read('outputs/data-truth-state.json', {});

const generatedAt = new Date().toISOString();
const cycleId = generatedAt.slice(0, 13).replace(/[-:T]/g, '');
const evidence = [];
let evCounter = 1;

function addEvidence({
  source_name,
  source_type,
  url = '',
  citation = '',
  publish_date,
  retrieved_at = generatedAt,
  reliability_score = 0.65,
  relevance_score = 0.65,
  freshness_score = 0.65,
  extracted_insight,
  affected_thesis = [],
  claim_type = 'inference',
  confidence
}) {
  const id = `ev_${String(evCounter++).padStart(3, '0')}`;
  const item = {
    id,
    source_name: text(source_name, 'Unspecified source'),
    source_type: text(source_type, 'research'),
    url: text(url),
    citation: text(citation),
    publish_date: dateOnly(publish_date || retrieved_at),
    retrieved_at,
    reliability_score: score(reliability_score),
    relevance_score: score(relevance_score),
    freshness_score: score(freshness_score),
    extracted_insight: text(extracted_insight, 'No extracted insight supplied.'),
    affected_thesis: list(affected_thesis).map(x => text(x)).filter(Boolean),
    claim_type,
    confidence: confidence ?? confidenceFromScores(reliability_score, relevance_score, freshness_score)
  };
  evidence.push(item);
  return id;
}

const rateRows = list(state.liveRatesCredit);
const tapeRows = list(state.liveMarket);
const rateById = Object.fromEntries(rateRows.map(row => [String(row.id || row.name || '').toUpperCase(), row]));
const tapeBySymbol = Object.fromEntries(tapeRows.map(row => [String(row.symbol || row.name || '').toUpperCase(), row]));

const macroEvidenceIds = [];
if (rateById.DGS10) {
  macroEvidenceIds.push(addEvidence({
    source_name: 'FRED - 10-Year Treasury Constant Maturity Rate',
    source_type: 'macro_data',
    url: 'https://fred.stlouisfed.org/series/DGS10',
    publish_date: rateById.DGS10.latestDate || rateById.DGS10.asOf,
    reliability_score: 0.95,
    relevance_score: 0.84,
    freshness_score: 0.8,
    extracted_insight: `10Y yield input is ${rateById.DGS10.value ?? 'unavailable'}, shaping duration sensitivity, liquidity interpretation, and risk-asset permission.`,
    affected_thesis: ['rates pressure', 'liquidity regime', 'long-duration risk assets'],
    claim_type: 'fact'
  }));
}
if (rateById.BAMLH0A0HYM2) {
  macroEvidenceIds.push(addEvidence({
    source_name: 'FRED - ICE BofA US High Yield Option-Adjusted Spread',
    source_type: 'macro_data',
    url: 'https://fred.stlouisfed.org/series/BAMLH0A0HYM2',
    publish_date: rateById.BAMLH0A0HYM2.latestDate || rateById.BAMLH0A0HYM2.asOf,
    reliability_score: 0.95,
    relevance_score: 0.88,
    freshness_score: 0.8,
    extracted_insight: `High-yield OAS input is ${rateById.BAMLH0A0HYM2.value ?? 'unavailable'}, acting as a credit-stress check against risk-on interpretation.`,
    affected_thesis: ['credit stress', 'risk appetite', 'liquidity regime'],
    claim_type: 'fact'
  }));
}
for (const symbol of ['SPY', 'QQQ', '^VIX', 'VIX', 'BTC-USD', 'BTCUSD', 'BTC']) {
  const row = tapeBySymbol[symbol];
  if (!row) continue;
  const normalized = symbol === '^VIX' ? 'VIX' : symbol;
  macroEvidenceIds.push(addEvidence({
    source_name: row.source || 'Market data adapter',
    source_type: normalized.includes('BTC') ? 'onchain_data' : 'market_data',
    citation: `data/report-state liveMarket ${normalized}`,
    publish_date: row.asOf || row.priceAsOf || generatedAt,
    reliability_score: 0.72,
    relevance_score: normalized.includes('BTC') || normalized === 'VIX' ? 0.86 : 0.78,
    freshness_score: row.asOf || row.priceAsOf ? 0.9 : 0.62,
    extracted_insight: `${normalized} tape input shows price ${row.price ?? 'n/a'} and day change ${row.changePct ?? 'n/a'}%, used to test whether live market pressure confirms or contradicts the landscape thesis.`,
    affected_thesis: normalized.includes('BTC') ? ['crypto liquidity', 'risk appetite'] : normalized === 'VIX' ? ['volatility regime', 'risk appetite'] : ['equity risk appetite', 'index breadth proxy'],
    claim_type: 'fact'
  }));
}

const orientationEvidenceId = addEvidence({
  source_name: 'Capital Radar market-orientation-map.json',
  source_type: 'research',
  citation: 'outputs/market-orientation-map.json',
  publish_date: orientation.generatedAt || generatedAt,
  reliability_score: 0.72,
  relevance_score: 0.94,
  freshness_score: orientation.generatedAt ? 0.88 : 0.55,
  extracted_insight: text(orientation.directionalThesis?.summary || regime.macroSummary, 'Market orientation requires refresh.'),
  affected_thesis: ['market focus', 'directional thesis', 'opportunity asymmetry'],
  claim_type: 'inference'
});

const themeEvidenceIds = new Map();
for (const theme of list(orientation.themes).slice(0, 8)) {
  const id = addEvidence({
    source_name: 'Capital Radar theme-pressure model',
    source_type: 'research',
    citation: `outputs/market-orientation-map.json#themes.${theme.id || theme.title}`,
    publish_date: orientation.generatedAt || generatedAt,
    reliability_score: 0.67,
    relevance_score: 0.86,
    freshness_score: orientation.generatedAt ? 0.86 : 0.55,
    extracted_insight: `${theme.title || theme.id || 'Theme'} is classified as ${theme.pressureState || 'mixed'} with pressure score ${theme.pressureScore ?? 'n/a'}, linking macro direction to candidate exposures.`,
    affected_thesis: [theme.title || theme.id || 'theme pressure', ...(theme.layers || [])],
    claim_type: 'inference'
  });
  themeEvidenceIds.set(theme.id || theme.title, id);
}

const themes = list(orientation.themes);
const topThemes = themes.slice(0, 4);
const marketFocus = topThemes.length ? topThemes.map(theme => ({
  theme: text(theme.title || theme.id, 'Unspecified theme'),
  summary: `${text(theme.title || theme.id, 'Theme')} is currently ${text(theme.pressureState, 'mixed')} inside the market-orientation model; this defines macro direction before ticker selection.`,
  pressure_state: text(theme.pressureState, 'mixed'),
  evidence_ids: [themeEvidenceIds.get(theme.id || theme.title), orientationEvidenceId, ...macroEvidenceIds.slice(0, 2)].filter(Boolean),
  confidence: 0.68
})) : [{
  theme: 'Market orientation pending',
  summary: text(regime.macroSummary, 'Market landscape requires institutional evidence refresh.'),
  pressure_state: 'unconfirmed',
  evidence_ids: [orientationEvidenceId, ...macroEvidenceIds].filter(Boolean),
  confidence: 0.52
}];

const directional = orientation.directionalThesis || {};
const worryInputs = [
  ...(list(directional.avoid).map(x => ({ risk: x, source: 'avoid' }))),
  ...(list(directional.invalidateIf).map(x => ({ risk: x, source: 'invalidation' }))),
  ...(regime.creditPressure ? [{ risk: regime.creditPressure, source: 'credit pressure' }] : []),
  ...(regime.ratesPressure ? [{ risk: regime.ratesPressure, source: 'rates pressure' }] : [])
].slice(0, 5);
const marketWorries = worryInputs.length ? worryInputs.map(item => ({
  risk: text(item.risk, 'Unspecified risk'),
  summary: `Risk monitor: ${text(item.risk)}. This can constrain or invalidate the current macro-direction thesis if confirmed by live tape or source evidence.`,
  evidence_ids: [orientationEvidenceId, ...macroEvidenceIds].filter(Boolean),
  confidence: item.source === 'invalidation' ? 0.7 : 0.63
})) : [{
  risk: 'Risk map pending',
  summary: 'Market worries require explicit evidence-backed risk records before normal Brief rendering.',
  evidence_ids: [orientationEvidenceId].filter(Boolean),
  confidence: 0.45
}];

const globalFinanceShift = {
  summary: text(directional.summary || orientation.macroWeather?.dominantMessage || regime.macroSummary, 'Global finance shift requires source-backed interpretation.'),
  evidence_ids: [orientationEvidenceId, ...macroEvidenceIds].filter(Boolean),
  confidence: 0.66
};

const directionalThesis = {
  base_case: text(directional.summary || regime.macroSummary, 'Directional thesis pending evidence refresh.'),
  bull_case: list(directional.leanInto).length ? `Market rewards ${list(directional.leanInto).join('; ')}.` : 'Bull case requires explicit lean-into evidence.',
  bear_case: list(directional.invalidateIf).length ? `Thesis weakens if ${list(directional.invalidateIf).join('; ')}.` : 'Bear case requires explicit invalidation evidence.',
  evidence_ids: [orientationEvidenceId, ...macroEvidenceIds].filter(Boolean),
  confidence: 0.67
};

const previous = read('outputs/market-landscape-state.json', null);
const changed = [];
if (!previous) {
  changed.push({
    change: 'Initialized evidence-backed market landscape artifact.',
    prior_state: 'none',
    current_state: 'active',
    materiality: 'high',
    evidence_ids: [orientationEvidenceId]
  });
} else {
  if (JSON.stringify(previous.directional_thesis) !== JSON.stringify(directionalThesis)) {
    changed.push({ change: 'Directional thesis changed.', prior_state: previous.directional_thesis?.base_case || 'unknown', current_state: directionalThesis.base_case, materiality: 'medium', evidence_ids: directionalThesis.evidence_ids });
  }
  if (JSON.stringify(previous.market_focus?.map(x => x.theme)) !== JSON.stringify(marketFocus.map(x => x.theme))) {
    changed.push({ change: 'Market focus changed.', prior_state: list(previous.market_focus).map(x => x.theme).join(', '), current_state: marketFocus.map(x => x.theme).join(', '), materiality: 'medium', evidence_ids: marketFocus.flatMap(x => x.evidence_ids).slice(0, 5) });
  }
}
if (!changed.length) {
  changed.push({
    change: 'No material macro-direction change detected this cycle.',
    prior_state: 'previous landscape retained',
    current_state: 'current landscape consistent',
    materiality: 'low',
    evidence_ids: [orientationEvidenceId, ...macroEvidenceIds.slice(0, 2)].filter(Boolean)
  });
}

const landscape = {
  as_of: generatedAt,
  cycle_id: cycleId,
  market_focus: marketFocus,
  market_worries: marketWorries,
  global_finance_shift: globalFinanceShift,
  directional_thesis: directionalThesis,
  what_changed_since_last_cycle: changed,
  contradictions: list(truth.staleSources).concat(list(truth.blockedSources)).map(source => ({
    issue: `Data truth watch: ${source}`,
    implication: 'This weakens render confidence until source freshness/confidence recovers.',
    evidence_ids: [orientationEvidenceId]
  })),
  state_change_level: changed.some(x => x.materiality === 'high' || x.materiality === 'medium') ? 'meaningful' : 'minor',
  render_permission: true
};

const evidenceMap = {
  as_of: generatedAt,
  cycle_id: cycleId,
  evidence
};

write('outputs/institutional-evidence-map.json', evidenceMap);
write('outputs/market-landscape-state.json', landscape);
write('public/outputs/institutional-evidence-map.json', evidenceMap);
write('public/outputs/market-landscape-state.json', landscape);

console.log(`generated evidence-backed market landscape: ${evidence.length} evidence records, render_permission=${landscape.render_permission}`);
