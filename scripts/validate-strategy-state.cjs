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
function present(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function requireField(obj, field, label, severity = 'error') {
  if (!obj || !present(obj[field])) (severity === 'warning' ? warnings : errors).push(`${label} missing ${field}`);
}
function list(value) { return Array.isArray(value) ? value : []; }

const strategy = readJson('strategy-state.json');
const landscape = readJson('market-landscape-state.json');
const portfolio = readJson('portfolio-translation-state.json');
const opportunity = readJson('opportunity-asymmetry-state.json');
const evidenceMap = readJson('institutional-evidence-map.json');
const evidenceIds = new Set(list(evidenceMap?.evidence).map(ev => ev.id));

['as_of','cycle_id','purpose','overall_posture','capital_action','exposure_guidance','highest_conviction_themes','blocked_actions','next_best_questions','decision_summary','evidence_ids','changed_since_last_cycle','render_permission'].forEach(field => requireField(strategy, field, 'strategy-state'));

const postures = new Set(['degraded_observation_only', 'defensive_review', 'selective_risk_on', 'constructive_but_constrained', 'selective_hold_verify', 'watch_only']);
const actions = new Set(['no_new_capital_until_data_truth_recovers', 'protect_capital_review_vulnerable_exposures', 'starter_positions_only_after_individual_triggers', 'hold_core_watch_new_adds', 'hold_verify_prepare_watchlist', 'watch_only_no_adds']);
if (strategy && !postures.has(strategy.overall_posture)) errors.push(`strategy-state invalid overall_posture ${strategy.overall_posture}`);
if (strategy && !actions.has(strategy.capital_action)) errors.push(`strategy-state invalid capital_action ${strategy.capital_action}`);

if (!Array.isArray(strategy?.highest_conviction_themes) || strategy.highest_conviction_themes.length === 0) errors.push('strategy-state.highest_conviction_themes must be non-empty');
if (!Array.isArray(strategy?.blocked_actions) || strategy.blocked_actions.length === 0) errors.push('strategy-state.blocked_actions must be non-empty');
if (!Array.isArray(strategy?.next_best_questions) || strategy.next_best_questions.length === 0) errors.push('strategy-state.next_best_questions must be non-empty');
if (!Array.isArray(strategy?.evidence_ids) || strategy.evidence_ids.length === 0) errors.push('strategy-state.evidence_ids must be non-empty');

list(strategy?.evidence_ids).forEach(id => {
  if (!evidenceIds.has(id)) errors.push(`strategy-state references missing evidence_id ${id}`);
});
list(strategy?.highest_conviction_themes).forEach((theme, index) => {
  const label = `strategy.highest_conviction_themes[${theme?.theme || index}]`;
  ['theme','action','evidence_ids','confidence'].forEach(field => requireField(theme, field, label));
  if (!Array.isArray(theme.evidence_ids) || theme.evidence_ids.length === 0) errors.push(`${label} evidence_ids must be non-empty`);
  list(theme.evidence_ids).forEach(id => { if (!evidenceIds.has(id)) errors.push(`${label} references missing evidence_id ${id}`); });
});
list(strategy?.blocked_actions).forEach((action, index) => {
  const label = `strategy.blocked_actions[${index}]`;
  ['action','reason'].forEach(field => requireField(action, field, label));
});

if (strategy && landscape && strategy.landscape_cycle_id && landscape.cycle_id && strategy.landscape_cycle_id !== landscape.cycle_id) {
  const msg = 'strategy-state landscape_cycle_id does not match market-landscape-state.cycle_id';
  if (mode === 'strict') errors.push(msg); else warnings.push(msg);
}
if (strategy && portfolio && strategy.portfolio_cycle_id && portfolio.cycle_id && strategy.portfolio_cycle_id !== portfolio.cycle_id) {
  const msg = 'strategy-state portfolio_cycle_id does not match portfolio-translation-state.cycle_id';
  if (mode === 'strict') errors.push(msg); else warnings.push(msg);
}
if (strategy && opportunity && strategy.opportunity_cycle_id && opportunity.cycle_id && strategy.opportunity_cycle_id !== opportunity.cycle_id) {
  const msg = 'strategy-state opportunity_cycle_id does not match opportunity-asymmetry-state.cycle_id';
  if (mode === 'strict') errors.push(msg); else warnings.push(msg);
}
if (/buy_now|aggressive_buy|all_in/i.test(`${strategy?.capital_action} ${JSON.stringify(strategy?.blocked_actions || [])}`)) errors.push('strategy-state contains unsafe capital-action language');
if (strategy?.render_permission === true && errors.length) errors.push('strategy-state render_permission=true while validation fails');

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  console.error('Strategy state validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Strategy state validation passed');
