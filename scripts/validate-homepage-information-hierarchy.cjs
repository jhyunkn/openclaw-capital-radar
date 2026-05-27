const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'config', 'homepage-sections.json');
function fail(message){ console.error(`HOMEPAGE INFORMATION HIERARCHY VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
const ids = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const four = ['decision-brief-section','operational-chart-section','holdings-section','opportunities-section'];
if (four.every(id => ids.includes(id))) {
  assert(fs.existsSync(manifestPath), 'homepage manifest missing for operational homepage');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = manifest.sections.filter(s => s.enabled !== false && s.required !== false).map(s => s.id);
  assert(JSON.stringify(expected) === JSON.stringify(four), `manifest required sections must be four-section canonical: ${expected.join(' > ')}`);
  assert(JSON.stringify(ids) === JSON.stringify(four), `section order mismatch: expected ${four.join(' > ')} got ${ids.join(' > ')}`);
  ['Evidence-backed Market Landscape','Decision Posture','Strategy Posture','Native Research Engine','Opportunity Evidence Engine','Ticker Gate Audit','[object Object]','id="market-section"','id="kostolany-egg-section"','id="market-lens-section"','id="strategy-routing-section"','id="system-health-section"'].forEach(x => assert(!html.includes(x), `legacy/rhetorical homepage artifact still present: ${x}`));
  console.log('four-section homepage information hierarchy validated from manifest');
  process.exit(0);
}
console.log(`homepage information hierarchy validator skipped before final four-section render; current sections: ${ids.join(' > ')}`);
