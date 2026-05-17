const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
function readJson(rel) { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
function writeJson(rel, value) {
  const out = path.join(root, rel);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(value, null, 2));
}
const dossiers = readJson('data/thesis/sample-thesis-dossiers.json');
const contradictions = readJson('data/thesis/sample-contradiction-flags.json');
const permissions = readJson('data/thesis/sample-action-permissions.json');
const status = {
  generatedAt: new Date().toISOString(),
  state: 'READY',
  layer: 'thesis-dossier-backbone',
  dossiers: dossiers.length,
  holdingsCovered: dossiers.filter(d => d.positionStatus === 'holding').length,
  watchlistCovered: dossiers.filter(d => d.positionStatus === 'watchlist' || d.positionStatus === 'candidate').length,
  humanReviewRequired: dossiers.filter(d => d.humanReviewRequired).length,
  actionPermissions: permissions.length,
  contradictionFlags: contradictions.length,
  actionPermissionBreakdown: dossiers.reduce((acc, d) => {
    acc[d.currentActionPermission] = (acc[d.currentActionPermission] || 0) + 1;
    return acc;
  }, {}),
  policy: 'Thesis Dossier is active as a validation backbone. Prepare-add/trim/exit states require human review and evidence links.',
  nextRequiredStep: 'Expand sample dossiers into all holdings and attach primary-source evidence packets.'
};
writeJson('outputs/thesis-dossier-status.json', status);
console.log(JSON.stringify(status, null, 2));
