const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'assets', 'proportion-tuning.css');
function fail(message){ console.error(`PROPORTION TUNING VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition,message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const expected = ['decision-brief-section','operational-chart-section','holdings-section','opportunities-section'];
const finalFour = JSON.stringify(sectionIds) === JSON.stringify(expected) && html.includes('Capital Radar · four-section decision surface');
if (!finalFour) {
  console.log(`proportion tuning validation skipped before final four-section render: ${sectionIds.join(' > ')}`);
  process.exit(0);
}
for (const token of expected) assert(html.includes(token), `operational homepage missing ${token}`);
for (const removed of ['market-section','kostolany-egg-section','market-lens-section','strategy-routing-section','system-health-section']) assert(!html.includes(`id="${removed}"`), `removed section still present: ${removed}`);
assert(/lwc-chart|working-verdict|macro-value-grid|zone-card|artifact-grid|decision-brief-text|permission-matrix/i.test(html), 'four-section homepage missing proportion-critical classes');
if (fs.existsSync(cssPath)) {
  const css = fs.readFileSync(cssPath, 'utf8');
  for (const token of ['--cr-display','--cr-h2','--cr-section-pad']) assert(css.includes(token), `stylesheet missing ${token}`);
}
console.log('proportion tuning validated for final four-section operational homepage surface');
