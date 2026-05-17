const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function fail(message) {
  console.error(`RESEARCH ENGINE VALIDATION FAILED: ${message}`);
  process.exitCode = 1;
}
function isInternal(packet) {
  return packet.sourceType === 'internal';
}

const evidence = readJson('data/research/sample-evidence-packets.json');
const claims = readJson('data/research/sample-claim-ledger.json');
const sources = readJson('data/research/sample-source-registry.json');

const evidenceIds = new Set(evidence.map(item => item.id));
const sourceTypes = new Set(sources.map(source => source.sourceType));

for (const packet of evidence) {
  if (!packet.id || !packet.ticker || !packet.claim) fail(`Evidence packet missing identity/claim: ${JSON.stringify(packet)}`);
  if (!packet.retrievedAt) fail(`${packet.id} has no retrievedAt timestamp`);
  if (!isInternal(packet) && !packet.sourceUrl) fail(`${packet.id} has no sourceUrl and is not internal`);
  if (!packet.claimType) fail(`${packet.id} has no claimType`);
  if (typeof packet.confidence !== 'number' || packet.confidence < 0 || packet.confidence > 1) fail(`${packet.id} has invalid confidence`);
  if (!sourceTypes.has(packet.sourceType)) fail(`${packet.id} uses sourceType not represented in source registry: ${packet.sourceType}`);
  if (packet.claimType === 'speculation' && packet.confidence > 0.4) fail(`${packet.id} speculation confidence exceeds 0.40`);
}

for (const claim of claims) {
  if (!claim.claimType) fail(`${claim.claimId} has no claimType`);
  for (const id of claim.supportingEvidenceIds || []) {
    if (!evidenceIds.has(id)) fail(`${claim.claimId} references missing supporting evidence ${id}`);
  }
  for (const id of claim.contradictingEvidenceIds || []) {
    if (!evidenceIds.has(id)) fail(`${claim.claimId} references missing contradicting evidence ${id}`);
  }
  if (claim.confidence > 0.8 && (claim.supportingEvidenceIds || []).length < 2 && claim.claimType !== 'fact') {
    fail(`${claim.claimId} confidence > 0.80 without multiple evidence IDs`);
  }
  if (claim.status === 'contradicted' && !(claim.contradictingEvidenceIds || []).length) {
    fail(`${claim.claimId} is contradicted without contradicting evidence`);
  }
}

if (process.exitCode) process.exit(process.exitCode);
console.log(JSON.stringify({
  ok: true,
  evidencePackets: evidence.length,
  claims: claims.length,
  sources: sources.length,
  policy: 'Research evidence validates source presence, claim typing, evidence references, and confidence discipline.'
}, null, 2));
