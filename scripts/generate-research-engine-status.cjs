const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function writeJson(rel, value) {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(value, null, 2));
}
const evidence = readJson('data/research/sample-evidence-packets.json');
const claims = readJson('data/research/sample-claim-ledger.json');
const sources = readJson('data/research/sample-source-registry.json');
const status = {
  generatedAt: new Date().toISOString(),
  state: 'READY',
  layer: 'research-engine-backbone',
  evidencePackets: evidence.length,
  claims: claims.length,
  sources: sources.length,
  unresolvedContradictions: claims.filter(c => c.status === 'contradicted').length,
  highConfidenceClaims: claims.filter(c => c.confidence > 0.8).length,
  policy: 'Research Engine is schema-first. It supports evidence and claim discipline but does not authorize autonomous recommendations.',
  nextRequiredStep: 'Attach primary external evidence sources to each active thesis before advancing action permissions.'
};
writeJson('outputs/research-engine-status.json', status);
console.log(JSON.stringify(status, null, 2));
