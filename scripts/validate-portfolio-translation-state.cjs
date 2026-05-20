const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const errors = [];
const warnings = [];
const mode = process.env.CAPITAL_RADAR_VALIDATION_MODE || 'balanced';

function readJson(name) {
  const file = path.join(outputs, name);
  if (!fs.existsSync(file)) {
    errors.push(`${name} missing`);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${name} invalid JSON: ${error.message}`); return null; }
}
function present(value) {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return true;
  if (typeof value === 'object') return true;
  return String(value).trim() !== '';
}
function requireField(obj, field, label, severity = 'error') {
  if (!obj || !present(obj[field])) (severity === 'warning' ? warnings : errors).push(`${label} missing ${field}`);
}
function list(value) { return Array.isArray(value) ? value : []; }
function scoreOk(value) { const n = Number(value); return Number.isFinite(n) && n >= 0 && n <= 100; }
function numberOrNull(value) { return value === null || Number.isFinite(Number(value)); }

const translation = readJson('portfolio-translation-state.json');
const landscape = readJson('market-landscape-state.json');
const evidenceMap = readJson('institutional-evidence-map.json');
const evidenceIds = new Set(list(evidenceMap?.evidence).map(ev => ev.id));
const severity = mode === 'migration' && translation?.render_permission === false ? 'warning' : 'error';

['as_of','cycle_id','purpose','holdings','summary','render_permission'].forEach(field => requireField(translation, field, 'portfolio-translation-state'));
if (!Array.isArray(translation?.holdings) || translation.holdings.length === 0) errors.push('portfolio-translation-state.holdings must be a non-empty array');

const exposureStates = new Set(['supported', 'constrained', 'vulnerable']);
const permissions = new Set(['add_allowed_at_ruled_zone', 'hold_verify', 'watch_only', 'trim_watch', 'exit_review']);
const riskStates = new Set(['normal', 'watch', 'elevated', 'high']);
const concentrationStates = new Set(['concentration_high', 'concentration_elevated', 'position_material', 'position_small', 'no_weight_or_tracking_only']);
const sizingPostures = new Set(['reduce_or_freeze_until_invalidation_review', 'no_adds_hold_or_trim_review', 'starter_add_only_at_ruled_zone', 'hold_add_only_if_trigger_confirms', 'hold_do_not_concentrate_without_fresh_evidence', 'watch_only', 'inside_buy_zone_add_review']);

list(translation?.holdings).forEach((holding, index) => {
  const label = `portfolio_translation[${holding?.ticker || index}]`;
  [
    'ticker','portfolio_role','linked_macro_theme','macro_theme_summary','thesis_bridge','exposure_state','exposure_reason','rule_permission','risk_state','concentration_state','sizing_posture','numeric_action','price_decision_map','holding_strength_score','thesis_quality_score','next_decision_trigger','invalidation','evidence_quality','data_truth','changed_since_last_cycle'
  ].forEach(field => requireField(holding, field, label, severity));
  if (!exposureStates.has(holding.exposure_state)) errors.push(`${label} invalid exposure_state ${holding.exposure_state}`);
  if (!permissions.has(holding.rule_permission)) errors.push(`${label} invalid rule_permission ${holding.rule_permission}`);
  if (!riskStates.has(holding.risk_state)) errors.push(`${label} invalid risk_state ${holding.risk_state}`);
  if (!concentrationStates.has(holding.concentration_state)) errors.push(`${label} invalid concentration_state ${holding.concentration_state}`);
  if (!sizingPostures.has(holding.sizing_posture)) errors.push(`${label} invalid sizing_posture ${holding.sizing_posture}`);
  if (!scoreOk(holding.holding_strength_score)) errors.push(`${label} holding_strength_score must be 0..100`);
  if (!scoreOk(holding.thesis_quality_score)) errors.push(`${label} thesis_quality_score must be 0..100`);
  if (!Array.isArray(holding.next_decision_trigger) || holding.next_decision_trigger.length === 0) errors.push(`${label} next_decision_trigger must be non-empty array`);
  if (!Array.isArray(holding.invalidation) || holding.invalidation.length === 0) errors.push(`${label} invalidation must be non-empty array`);

  const map = holding.price_decision_map || {};
  ['current_price','buy_zone_low','buy_zone_high','trim_zone_low','trim_zone_high','stop_review','hard_exit_review','target_resistance'].forEach(field => {
    if (!numberOrNull(map[field])) errors.push(`${label}.price_decision_map.${field} must be number or null`);
  });
  ['upside_to_target_pct','upside_to_trim_low_pct','downside_to_buy_mid_pct','downside_to_stop_pct','downside_to_hard_exit_pct'].forEach(field => {
    if (!numberOrNull(map[field])) errors.push(`${label}.price_decision_map.${field} must be number or null`);
  });
  if (map.current_price === null || map.current_price === undefined) errors.push(`${label}.price_decision_map.current_price required`);
  if (!present(map.institutional_accumulation_status)) errors.push(`${label}.price_decision_map.institutional_accumulation_status missing`);

  if (!holding.evidence_quality || typeof holding.evidence_quality !== 'object') errors.push(`${label} evidence_quality must be object`);
  if (holding.evidence_quality) {
    ['status','evidence_backed','source_confidence','data_freshness','macro_confidence'].forEach(field => requireField(holding.evidence_quality, field, `${label}.evidence_quality`, severity));
  }
  if (!holding.data_truth || typeof holding.data_truth !== 'object') errors.push(`${label} data_truth must be object`);
  if (holding.data_truth) {
    ['evidence_backed','freshness_ok','data_freshness','source_confidence','macro_confidence','rule_breaches','conflicts'].forEach(field => requireField(holding.data_truth, field, `${label}.data_truth`, severity));
    if (!Array.isArray(holding.data_truth.evidence_ids)) errors.push(`${label}.data_truth.evidence_ids must be array`);
    if (!Array.isArray(holding.data_truth.rule_breaches)) errors.push(`${label}.data_truth.rule_breaches must be array`);
    if (!Array.isArray(holding.data_truth.conflicts)) errors.push(`${label}.data_truth.conflicts must be array`);
    list(holding.data_truth.evidence_ids).forEach(id => {
      if (!evidenceIds.has(id)) errors.push(`${label} references missing evidence_id ${id}`);
    });
  }
});

if (translation?.render_permission === true && errors.length) errors.push('portfolio-translation-state render_permission=true while validation fails');
if (translation && landscape && translation.landscape_cycle_id && landscape.cycle_id && translation.landscape_cycle_id !== landscape.cycle_id) {
  const msg = 'portfolio-translation-state landscape_cycle_id does not match market-landscape-state.cycle_id';
  if (mode === 'strict') errors.push(msg); else warnings.push(msg);
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  console.error('Portfolio translation validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Portfolio translation validation passed');
