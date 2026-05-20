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
function list(value) { return Array.isArray(value) ? value : []; }
function present(value) { return value !== null && value !== undefined && String(value).trim() !== ''; }
function requireField(obj, field, label) {
  if (!obj || !present(obj[field])) errors.push(`${label} missing ${field}`);
}
function requireEvidenceIds(obj, label) {
  if (!obj || !Array.isArray(obj.evidence_ids) || obj.evidence_ids.length === 0) errors.push(`${label} missing evidence_ids`);
}

const landscape = readJson('market-landscape-state.json');
const evidenceMap = readJson('institutional-evidence-map.json');
const evidence = list(evidenceMap?.evidence);
const evidenceIds = new Set(evidence.map(item => item.id));
const allowedClaimTypes = new Set(['fact', 'inference', 'speculation']);
const allowedSourceTypes = new Set(['macro_data', 'filing', 'earnings_call', 'news', 'research', 'onchain_data', 'market_data']);

['as_of','cycle_id','market_focus','market_worries','global_finance_shift','directional_thesis','what_changed_since_last_cycle','state_change_level','render_permission'].forEach(field => requireField(landscape, field, 'market-landscape-state'));
['as_of','cycle_id','evidence'].forEach(field => requireField(evidenceMap, field, 'institutional-evidence-map'));

if (!Array.isArray(landscape?.market_focus) || landscape.market_focus.length === 0) errors.push('market_focus must be a non-empty array');
if (!Array.isArray(landscape?.market_worries) || landscape.market_worries.length === 0) errors.push('market_worries must be a non-empty array');
if (!Array.isArray(landscape?.what_changed_since_last_cycle) || landscape.what_changed_since_last_cycle.length === 0) errors.push('what_changed_since_last_cycle must be a non-empty array');
if (!Array.isArray(evidenceMap?.evidence) || evidenceMap.evidence.length === 0) errors.push('institutional-evidence-map.evidence must be a non-empty array');

list(landscape?.market_focus).forEach((item, index) => {
  const label = `market_focus[${index}]`;
  ['theme','summary','confidence'].forEach(field => requireField(item, field, label));
  requireEvidenceIds(item, label);
});
list(landscape?.market_worries).forEach((item, index) => {
  const label = `market_worries[${index}]`;
  ['risk','summary','confidence'].forEach(field => requireField(item, field, label));
  requireEvidenceIds(item, label);
});
requireField(landscape?.global_finance_shift, 'summary', 'global_finance_shift');
requireEvidenceIds(landscape?.global_finance_shift, 'global_finance_shift');
['base_case','bull_case','bear_case','confidence'].forEach(field => requireField(landscape?.directional_thesis, field, 'directional_thesis'));
requireEvidenceIds(landscape?.directional_thesis, 'directional_thesis');
list(landscape?.what_changed_since_last_cycle).forEach((item, index) => {
  const label = `what_changed_since_last_cycle[${index}]`;
  ['change','prior_state','current_state','materiality'].forEach(field => requireField(item, field, label));
  requireEvidenceIds(item, label);
});

const referenced = [];
function collectEvidenceIds(node) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node.evidence_ids)) referenced.push(...node.evidence_ids);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(collectEvidenceIds);
    else if (value && typeof value === 'object') collectEvidenceIds(value);
  }
}
collectEvidenceIds(landscape);
referenced.forEach(id => {
  if (!evidenceIds.has(id)) errors.push(`referenced evidence_id not found: ${id}`);
});

evidence.forEach((item, index) => {
  const label = `evidence[${item?.id || index}]`;
  ['id','source_name','source_type','publish_date','retrieved_at','reliability_score','relevance_score','freshness_score','extracted_insight','affected_thesis','claim_type','confidence'].forEach(field => requireField(item, field, label));
  if (!present(item.url) && !present(item.citation)) errors.push(`${label} missing url or citation`);
  if (!allowedClaimTypes.has(item.claim_type)) errors.push(`${label} invalid claim_type ${item.claim_type}`);
  if (!allowedSourceTypes.has(item.source_type)) errors.push(`${label} invalid source_type ${item.source_type}`);
  if (!Array.isArray(item.affected_thesis) || item.affected_thesis.length === 0) errors.push(`${label} affected_thesis must be non-empty array`);
  ['reliability_score','relevance_score','freshness_score','confidence'].forEach(field => {
    const n = Number(item[field]);
    if (!Number.isFinite(n) || n < 0 || n > 1) errors.push(`${label} ${field} must be 0..1`);
  });
});

if (landscape?.render_permission === true && errors.length) errors.push('render_permission=true while evidence validation fails');

if (errors.length) {
  console.error('Market landscape evidence validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Market landscape evidence validation passed');
