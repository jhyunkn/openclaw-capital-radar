const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'outputs', 'homepage-registry-preview-report.json');

function stop(message) {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(reportPath)) {
  stop('homepage registry gate: missing preview report');
}

const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
const validation = report.validation || {};
const checks = [
  ['report status is OK', report.status === 'OK'],
  ['validation status is OK', validation.status === 'OK'],
  ['production index untouched', report.productionIndexWritten === false],
  ['all active manifest sections represented', validation.allActiveManifestSectionsRepresented === true],
  ['no missing manifest sections', !(validation.missingManifestSections || []).length],
  ['no section count mismatches', !(validation.sectionCountMismatches || []).length],
  ['no duplicate sections', !(validation.duplicateSections || []).length],
  ['no legacy section leakage', !(validation.legacySectionLeakage || []).length],
  ['no disabled section leakage', !(validation.disabledSectionLeakage || []).length],
  ['no banned phrase leakage', !(validation.bannedPhraseLeakage || []).length],
  ['no object string leakage', validation.objectObjectLeakage !== true],
  ['no preview-relative output link leakage', validation.previewRelativeOutputLinkLeakage !== true],
  ['no render gaps', !(validation.renderGaps || []).length],
];

const failed = checks.filter(([, pass]) => !pass).map(([name]) => name);
if (failed.length) {
  stop(`homepage registry gate: ${failed.join('; ')}`);
}

console.log('homepage registry gate passed');
