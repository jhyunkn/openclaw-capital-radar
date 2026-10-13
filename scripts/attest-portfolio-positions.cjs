'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const sourcePath = path.join(root, 'outputs', 'robinhood-positions.json');
const outputPath = path.join(root, 'outputs', 'portfolio-positions-attestation.json');

if (!process.argv.includes('--unchanged')) {
  console.error('Refusing to attest without explicit --unchanged confirmation.');
  process.exit(2);
}

const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
if (!source.syncedAt || !Array.isArray(source.positions) || !source.positions.length) {
  throw new Error('Robinhood snapshot is missing syncedAt or positions.');
}

const attestation = {
  schema: 'capital-radar-portfolio-positions-attestation.v1',
  status: 'UNCHANGED',
  attestedAt: new Date().toISOString(),
  sourceSnapshotSyncedAt: source.syncedAt,
  positionCount: source.positions.length,
  note: 'Manual confirmation that share counts and cost basis remain unchanged from the referenced broker snapshot. This does not refresh market prices.'
};

fs.writeFileSync(outputPath, JSON.stringify(attestation, null, 2) + '\n');
console.log(`attested ${attestation.positionCount} positions unchanged from ${source.syncedAt}`);
