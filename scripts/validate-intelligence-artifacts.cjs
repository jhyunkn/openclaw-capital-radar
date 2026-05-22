const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dir = path.join(root, 'data', 'intelligence');
const required = [
  'precedent-research-map.json',
  'institutional-evidence-map.json',
  'market-landscape-state.json',
  'portfolio-translation-state.json',
  'opportunity-asymmetry-state.json',
  'strategy-state.json',
  'data-truth-state.json'
];

function fail(msg) {
  console.error(`INTELLIGENCE_VALIDATION_FAIL: ${msg}`);
  process.exitCode = 1;
}
function read(name) {
  const p = path.join(dir, name);
  if (!fs.existsSync(p)) return fail(`missing ${name}`), null;
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { return fail(`invalid JSON ${name}: ${e.message}`), null; }
}
function collectEvidenceRefs(value, refs = []) {
  if (!value || typeof value !== 'object') return refs;
  if (Array.isArray(value)) { value.forEach(v => collectEvidenceRefs(v, refs)); return refs; }
  for (const [k, v] of Object.entries(value)) {
    if (k === 'evidence_ids' && Array.isArray(v)) refs.push(...v);
    else collectEvidenceRefs(v, refs);
  }
  return refs;
}

const artifacts = Object.fromEntries(required.map(n => [n, read(n)]));
if (process.exitCode) process.exit(1);

const evidence = artifacts['institutional-evidence-map.json'];
const evidenceIds = new Set((evidence.evidence || []).map(e => e.id));
if (!Array.isArray(evidence.evidence) || evidence.evidence.length < 5) fail('institutional-evidence-map requires at least 5 evidence records');
for (const e of evidence.evidence || []) {
  for (const f of ['id','source_name','source_type','retrieved_at','claim_type']) if (!e[f]) fail(`evidence ${e.id || '(missing id)'} missing ${f}`);
  for (const f of ['reliability_score','relevance_score','freshness_score','confidence']) if (typeof e[f] !== 'number') fail(`evidence ${e.id} missing numeric ${f}`);
}

for (const name of ['market-landscape-state.json','portfolio-translation-state.json','opportunity-asymmetry-state.json','strategy-state.json']) {
  const refs = [...new Set(collectEvidenceRefs(artifacts[name]))];
  const missing = refs.filter(id => !evidenceIds.has(id));
  if (missing.length) fail(`${name} references missing evidence ids: ${missing.join(', ')}`);
}

const precedent = artifacts['precedent-research-map.json'];
if (!Array.isArray(precedent.frameworks) || precedent.frameworks.length < 3) fail('precedent-research-map requires frameworks');

const truth = artifacts['data-truth-state.json'];
for (const f of ['missing_evidence','stale_data','unsupported_claims','conflicting_evidence','failed_sources','degraded_states']) {
  if (!Array.isArray(truth[f])) fail(`data-truth-state missing array ${f}`);
}
if (typeof truth.render_permission !== 'boolean') fail('data-truth-state missing boolean render_permission');
if (typeof truth.deployment_permission !== 'boolean') fail('data-truth-state missing boolean deployment_permission');

if (!process.exitCode) {
  console.log(`INTELLIGENCE_VALIDATION_OK: ${required.length} artifacts, ${evidenceIds.size} evidence records, render_permission=${truth.render_permission}, deployment_permission=${truth.deployment_permission}`);
}
