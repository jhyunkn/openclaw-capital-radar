const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const cssPath = path.join(root, 'assets', 'proportion-tuning.css');
function fail(message){ console.error(`PROPORTION TUNING VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition,message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
if (html.includes('id="operational-chart-section"')) {
  for (const token of ['operational-chart-section','decision-brief-section','holdings-section','opportunities-section','market-section']) assert(html.includes(token), `operational homepage missing ${token}`);
  assert(/lwc-chart|working-verdict|macro-value-grid|zone-card|artifact-grid|market-tape/i.test(html), 'operational homepage missing proportion-critical classes');
  console.log('proportion tuning validated for operational homepage surface');
  process.exit(0);
}
assert(fs.existsSync(cssPath), 'assets/proportion-tuning.css missing');
const css = fs.readFileSync(cssPath, 'utf8');
for (const token of ['--cr-display','--cr-h2','--cr-section-pad','.holding-card','.holding-head b','.holdings-grid']) assert(css.includes(token), `stylesheet missing ${token}`);
assert(html.includes('assets/proportion-tuning.css'), 'homepage missing proportion tuning stylesheet link');
console.log('proportion tuning validated for current holdings surface');
