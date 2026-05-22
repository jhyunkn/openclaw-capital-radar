const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const targets = ['outputs/holding-zone-state.json', 'public/outputs/holding-zone-state.json'];
function full(rel){ return path.join(root, rel); }
function mark(z){
  const method = String(z.zone_method || '');
  const quality = String(z.source_quality || z.institutional_readiness?.evidence_grade || '');
  if (/authoritative_action_state/i.test(method) || /authoritative_action_state/i.test(quality)) return ['AUTH','direct level source',3,false];
  if (/institutional/i.test(method) || /institutional_partial/i.test(quality)) return ['PARTIAL','partial source support',2,false];
  if (/proxy/i.test(method) || /proxy_only/i.test(quality)) return ['PROXY','model-derived estimate',1,true];
  return ['MISSING','source not mapped',0,true];
}
for (const rel of targets) {
  const file = full(rel);
  if (!fs.existsSync(file)) continue;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  const zones = Array.isArray(state.zones) ? state.zones : [];
  const counts = {};
  for (const z of zones) {
    const [source,label,rank,soft] = mark(z);
    z.zone_source_tier = source;
    z.zone_source_label = label;
    z.zone_source_rank = rank;
    z.zone_source_soft = soft;
    counts[source] = (counts[source] || 0) + 1;
  }
  state.summary = { ...(state.summary || {}), zone_source_counts: counts };
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
}
console.log('holding zone source annotation complete');
