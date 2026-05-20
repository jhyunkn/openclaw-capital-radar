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
  if (!obj || !present(obj[field])) {
    (severity === 'warning' ? warnings : errors).push(`${label} missing ${field}`);
  }
}
function list(value) { return Array.isArray(value) ? value : []; }
function requiredSeverity(renderPermission) {
  return mode === 'migration' && renderPermission === false ? 'warning' : 'error';
}

const asymmetry = readJson('opportunity-asymmetry-state.json');
const landscape = readJson('market-landscape-state.json');
const evidenceMap = readJson('institutional-evidence-map.json');
const evidenceIds = new Set(list(evidenceMap?.evidence).map(ev => ev.id));

['as_of','cycle_id','purpose','opportunity_clusters','summary','render_permission'].forEach(field => requireField(asymmetry, field, 'opportunity-asymmetry-state'));
if (!Array.isArray(asymmetry?.opportunity_clusters) || asymmetry.opportunity_clusters.length === 0) errors.push('opportunity-asymmetry-state.opportunity_clusters must be non-empty');

const promotionStatuses = new Set(['priority_research', 'build_evidence_packet', 'watch_and_compare', 'research_only', 'blocked_no_buy_permission']);
const severity = requiredSeverity(asymmetry?.render_permission);

list(asymmetry?.opportunity_clusters).forEach((cluster, index) => {
  const label = `opportunity_cluster[${cluster?.macro_theme || index}]`;
  ['macro_theme','macro_theme_summary','second_order_direction','candidate_tickers','missing_evidence','evidence_ids','confidence','changed_since_last_cycle'].forEach(field => requireField(cluster, field, label, severity));
  if (!Array.isArray(cluster.evidence_ids) || cluster.evidence_ids.length === 0) errors.push(`${label} evidence_ids must be non-empty`);
  list(cluster.evidence_ids).forEach(id => {
    if (!evidenceIds.has(id)) errors.push(`${label} references missing evidence_id ${id}`);
  });
  if (!Array.isArray(cluster.candidate_tickers) || cluster.candidate_tickers.length === 0) errors.push(`${label} candidate_tickers must be non-empty`);
  list(cluster.candidate_tickers).forEach((candidate, candidateIndex) => {
    const clabel = `${label}.candidate[${candidate?.ticker || candidateIndex}]`;
    ['ticker','why_this_ticker','what_is_underpriced','opportunity_score','promotion_status','assigned_agent_task','missing_evidence','evidence_ids','action_permission'].forEach(field => requireField(candidate, field, clabel, severity));
    if (!promotionStatuses.has(candidate.promotion_status)) errors.push(`${clabel} invalid promotion_status ${candidate.promotion_status}`);
    if (!Array.isArray(candidate.missing_evidence) || candidate.missing_evidence.length === 0) errors.push(`${clabel} missing_evidence must be non-empty`);
    if (!Array.isArray(candidate.evidence_ids) || candidate.evidence_ids.length === 0) errors.push(`${clabel} evidence_ids must be non-empty`);
    list(candidate.evidence_ids).forEach(id => {
      if (!evidenceIds.has(id)) errors.push(`${clabel} references missing evidence_id ${id}`);
    });
    if (/BUY_ALLOWED|ADD_ALLOWED/i.test(String(candidate.action_permission || ''))) errors.push(`${clabel} must not authorize buy/add from opportunity asymmetry artifact`);
  });
});

if (asymmetry?.render_permission === true && errors.length) errors.push('opportunity-asymmetry-state render_permission=true while validation fails');
if (asymmetry && landscape && asymmetry.landscape_cycle_id && landscape.cycle_id && asymmetry.landscape_cycle_id !== landscape.cycle_id) {
  const msg = 'opportunity-asymmetry-state landscape_cycle_id does not match market-landscape-state.cycle_id';
  if (mode === 'strict') errors.push(msg); else warnings.push(msg);
}

for (const warning of warnings) console.warn(`warning: ${warning}`);
if (errors.length) {
  console.error('Opportunity asymmetry validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Opportunity asymmetry validation passed');
