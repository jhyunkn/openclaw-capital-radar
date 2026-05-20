const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const errors = [];

function readJson(name) {
  const file = path.join(outputs, name);
  if (!fs.existsSync(file)) {
    errors.push(`${name} missing`);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${name} invalid JSON: ${error.message}`); return null; }
}
function present(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function requireField(obj, field, label) {
  if (!obj || !present(obj[field])) errors.push(`${label} missing ${field}`);
}
function list(value) { return Array.isArray(value) ? value : []; }

const translation = readJson('portfolio-translation-state.json');
const landscape = readJson('market-landscape-state.json');
const evidenceMap = readJson('institutional-evidence-map.json');
const evidenceIds = new Set(list(evidenceMap?.evidence).map(ev => ev.id));

['as_of','cycle_id','purpose','holdings','summary','render_permission'].forEach(field => requireField(translation, field, 'portfolio-translation-state'));
if (!Array.isArray(translation?.holdings) || translation.holdings.length === 0) errors.push('portfolio-translation-state.holdings must be a non-empty array');

const exposureStates = new Set(['supported', 'constrained', 'vulnerable']);
const permissions = new Set(['add_allowed_at_ruled_zone', 'hold_verify', 'watch_only', 'trim_watch', 'exit_review']);
const riskStates = new Set(['normal', 'watch', 'elevated', 'high']);

list(translation?.holdings).forEach((holding, index) => {
  const label = `portfolio_translation[${holding?.ticker || index}]`;
  ['ticker','linked_macro_theme','macro_theme_summary','exposure_state','rule_permission','risk_state','next_evidence','invalidation','data_truth','changed_since_last_cycle'].forEach(field => requireField(holding, field, label));
  if (!exposureStates.has(holding.exposure_state)) errors.push(`${label} invalid exposure_state ${holding.exposure_state}`);
  if (!permissions.has(holding.rule_permission)) errors.push(`${label} invalid rule_permission ${holding.rule_permission}`);
  if (!riskStates.has(holding.risk_state)) errors.push(`${label} invalid risk_state ${holding.risk_state}`);
  if (!Array.isArray(holding.next_evidence) || holding.next_evidence.length === 0) errors.push(`${label} next_evidence must be non-empty array`);
  if (!Array.isArray(holding.invalidation) || holding.invalidation.length === 0) errors.push(`${label} invalidation must be non-empty array`);
  if (!holding.data_truth || typeof holding.data_truth !== 'object') errors.push(`${label} data_truth must be object`);
  if (holding.data_truth) {
    ['evidence_backed','freshness_ok','data_freshness','source_confidence','rule_breaches','conflicts'].forEach(field => requireField(holding.data_truth, field, `${label}.data_truth`));
    if (!Array.isArray(holding.data_truth.evidence_ids)) errors.push(`${label}.data_truth.evidence_ids must be array`);
    if (!Array.isArray(holding.data_truth.rule_breaches)) errors.push(`${label}.data_truth.rule_breaches must be array`);
    if (!Array.isArray(holding.data_truth.conflicts)) errors.push(`${label}.data_truth.conflicts must be array`);
    list(holding.data_truth.evidence_ids).forEach(id => {
      if (!evidenceIds.has(id)) errors.push(`${label} references missing evidence_id ${id}`);
    });
  }
});

if (translation?.render_permission === true && errors.length) errors.push('portfolio-translation-state render_permission=true while validation fails');
if (translation && landscape && translation.landscape_cycle_id && landscape.cycle_id && translation.landscape_cycle_id !== landscape.cycle_id) errors.push('portfolio-translation-state landscape_cycle_id does not match market-landscape-state.cycle_id');

if (errors.length) {
  console.error('Portfolio translation validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Portfolio translation validation passed');
