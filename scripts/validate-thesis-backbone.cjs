const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
}
function fail(message) {
  console.error(`THESIS BACKBONE VALIDATION FAILED: ${message}`);
  process.exitCode = 1;
}

const dossiers = readJson('data/thesis/sample-thesis-dossiers.json');
const permissions = readJson('data/thesis/sample-action-permissions.json');
const contradictions = readJson('data/thesis/sample-contradiction-flags.json');
const evidence = readJson('data/research/sample-evidence-packets.json');
const claims = readJson('data/research/sample-claim-ledger.json');

const evidenceIds = new Set(evidence.map(item => item.id));
const claimIds = new Set(claims.map(item => item.claimId));
const permissionMap = new Map(permissions.map(item => [item.permission, item]));

for (const dossier of dossiers) {
  if (!dossier.coreThesis || dossier.coreThesis.trim().length < 20) fail(`${dossier.ticker} has no meaningful core thesis`);
  if (!Array.isArray(dossier.invalidationTriggers) || dossier.invalidationTriggers.length === 0) fail(`${dossier.ticker} has no invalidation trigger`);
  if (!permissionMap.has(dossier.currentActionPermission)) fail(`${dossier.ticker} has unknown action permission ${dossier.currentActionPermission}`);
  const permission = permissionMap.get(dossier.currentActionPermission);
  if (['prepare_add', 'prepare_trim', 'prepare_exit'].includes(dossier.currentActionPermission) && dossier.humanReviewRequired !== true) {
    fail(`${dossier.ticker} has ${dossier.currentActionPermission} without humanReviewRequired=true`);
  }
  if (permission.requiresHumanReview && dossier.humanReviewRequired !== true) {
    fail(`${dossier.ticker} permission ${dossier.currentActionPermission} requires human review`);
  }
  const linkedEvidence = [
    ...(dossier.evidenceMap?.supporting || []),
    ...(dossier.evidenceMap?.weakening || []),
    ...(dossier.evidenceMap?.contradicting || [])
  ];
  for (const id of linkedEvidence) {
    if (!evidenceIds.has(id)) fail(`${dossier.ticker} references missing evidence ${id}`);
  }
  if (['prepare_add', 'prepare_trim', 'prepare_exit'].includes(dossier.currentActionPermission) && linkedEvidence.length === 0) {
    fail(`${dossier.ticker} has action permission ${dossier.currentActionPermission} without evidence`);
  }
  if (dossier.confidence > 0.8 && linkedEvidence.length < 2) {
    fail(`${dossier.ticker} confidence > 0.80 without multiple evidence links`);
  }
}

for (const flag of contradictions) {
  if (!flag.surfacedForReview) fail(`${flag.flagId} contradiction exists but is not surfaced for review`);
  if (!claimIds.has(flag.claimId)) fail(`${flag.flagId} references missing claim ${flag.claimId}`);
  if (!evidenceIds.has(flag.contradictingEvidenceId)) fail(`${flag.flagId} references missing evidence ${flag.contradictingEvidenceId}`);
  if (flag.requiresHumanReview !== true) fail(`${flag.flagId} contradiction must require human review`);
}

if (process.exitCode) process.exit(process.exitCode);
console.log(JSON.stringify({
  ok: true,
  dossiers: dossiers.length,
  permissions: permissions.length,
  contradictionFlags: contradictions.length,
  policy: 'Thesis backbone validates core thesis, invalidation triggers, evidence links, confidence discipline, and human-review action grammar.'
}, null, 2));
