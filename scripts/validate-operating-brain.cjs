const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const indexPath = path.join(root, 'index.html');
const errors = [];
const warnings = [];

function readJson(name, required = true) {
  const file = path.join(outputs, name);
  if (!fs.existsSync(file)) {
    if (required) errors.push(`${name} missing`);
    else warnings.push(`${name} missing`);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${name} invalid JSON: ${error.message}`); return null; }
}
function requireField(obj, field, label) {
  if (obj == null || obj[field] == null || obj[field] === '') errors.push(`${label} missing ${field}`);
}
function countMatches(html, regex) { return (html.match(regex) || []).length; }
function requireOne(html, label, regex) {
  const count = countMatches(html, regex);
  if (count !== 1) errors.push(`${label} count ${count}; expected 1`);
}
function requireAbsent(html, phrase) {
  if (html.toLowerCase().includes(String(phrase).toLowerCase())) errors.push(`legacy phrase present: ${phrase}`);
}

const operationalChart = readJson('operational-chart-state.json');
const decisionBrief = readJson('market-decision-brief-state.json');
const holdingZones = readJson('holding-zone-state.json', false);
const opportunityBands = readJson('opportunity-band-state.json', false);
const tape = readJson('market-tape-state.json', false);
const truth = readJson('data-truth-state.json', false);

requireField(operationalChart, 'render_permission', 'operational-chart-state');
requireField(operationalChart, 'symbol', 'operational-chart-state');
requireField(operationalChart, 'chart', 'operational-chart-state');
requireField(operationalChart, 'action_bands', 'operational-chart-state');
if (operationalChart && operationalChart.render_permission !== true) errors.push('operational-chart-state render_permission is not true');
if (!Array.isArray(operationalChart?.chart?.series) || operationalChart.chart.series.length < 100) errors.push('operational chart series is missing or too short');
if (!Array.isArray(operationalChart?.chart?.scenarios) || operationalChart.chart.scenarios.length < 3) errors.push('operational chart scenarios missing');

requireField(decisionBrief, 'render_permission', 'market-decision-brief-state');
requireField(decisionBrief, 'brief', 'market-decision-brief-state');
if (!Array.isArray(decisionBrief?.macro_values) || decisionBrief.macro_values.length < 4) errors.push('market-decision-brief-state macro_values too thin');

if (truth && truth.homepageSafeToRender === false) errors.push('deploy blocked: data-truth-state.homepageSafeToRender=false');

if (!fs.existsSync(indexPath)) {
  errors.push('index.html missing');
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  requireOne(html, 'Market Decision Brief section', /id="decision-brief-section"/g);
  requireOne(html, 'Operational Decision Chart section', /id="operational-chart-section"/g);
  requireOne(html, 'Holdings section', /id="holdings-section"/g);
  requireOne(html, 'Opportunity section', /id="opportunities-section"/g);
  requireOne(html, 'Market Tape section', /id="market-section"/g);

  ['Evidence-backed Market Landscape', 'Decision Posture', 'Strategy Posture', 'visual regime board', 'transition_or_distribution_watch'].forEach(phrase => requireAbsent(html, phrase));
  if (html.includes('[object Object]')) errors.push('homepage leaks [object Object]');
  if (/guaranteed|certain conviction|fake conviction/i.test(html)) errors.push('homepage exposes fake conviction language');
  if (!/REAL|EST|PROJ|Data freshness|Source confidence|VIX|10Y/i.test(html)) errors.push('homepage does not expose data/trust/indicator layer');
  if (!/Operational Decision Chart/i.test(html)) errors.push('operational decision chart title missing');
  if (!/Market Decision Brief/i.test(html)) errors.push('market decision brief title missing');
}

if (errors.length) {
  console.error('Operational homepage validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  if (warnings.length) for (const warning of warnings) console.warn(`warning: ${warning}`);
  process.exit(1);
}
if (warnings.length) for (const warning of warnings) console.warn(`warning: ${warning}`);
console.log('Operational homepage validation passed');
