const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const file = path.join(root, 'outputs', 'metadata-scan-state.json');
const errors = [];

function ok(condition, message) {
  if (!condition) errors.push(message);
}

ok(fs.existsSync(file), 'outputs/metadata-scan-state.json missing');
const state = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;

ok(state && typeof state.generatedAt === 'string', 'metadata scan missing generatedAt');
ok(['IMPORTED', 'EMPTY', 'DEGRADED'].includes(state?.status), 'metadata scan status invalid');
ok(state?.coverage && typeof state.coverage.rawRecords === 'number', 'metadata scan coverage.rawRecords missing');
ok(state?.gates?.requiresHardDataVerification === true, 'metadata scan must require hard data verification');
ok(state?.gates?.actionPromotionAllowedFromMetadataAlone === false, 'metadata scan must not allow action promotion from metadata alone');
ok(state?.integration?.capitalRadarSurface === true, 'metadata scan must be marked as Capital Radar integrated');
ok(state?.integration?.githubCommittedArtifact === 'outputs/metadata-scan-state.json', 'metadata scan GitHub artifact contract drift');
ok(state?.integration?.vercelPublicArtifact === 'public/outputs/metadata-scan-state.json', 'metadata scan Vercel artifact contract drift');

if (errors.length) {
  console.error(`metadata scan validation failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`metadata scan validation passed: status=${state.status} records=${state.coverage.rawRecords} unique=${state.coverage.uniqueIds}`);
