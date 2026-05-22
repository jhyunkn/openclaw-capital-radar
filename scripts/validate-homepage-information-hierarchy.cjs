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
const operational = ['decision-brief-section','operational-chart-section','holdings-section','opportunities-section','market-section'];
const legacy = ['brief','holdings','opportunity','market-tape'];
if (operational.every(id => ids.includes(id))) {
  assert(fs.existsSync(manifestPath), 'homepage manifest missing for operational homepage');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = manifest.sections.filter(s => s.enabled !== false && s.required !== false).map(s => s.id);
  assert(expected.every(id => ids.includes(id)), `operational sections missing: expected ${expected.join(', ')} got ${ids.join(', ')}`);
  assert(ids.indexOf('decision-brief-section') < ids.indexOf('operational-chart-section'), 'decision brief must precede operational chart');
  assert(ids.indexOf('operational-chart-section') < ids.indexOf('holdings-section'), 'operational chart must precede holdings');
  assert(ids.indexOf('holdings-section') < ids.indexOf('opportunities-section'), 'holdings must precede opportunities');
  assert(ids.indexOf('opportunities-section') < ids.indexOf('market-section'), 'opportunities must precede market tape');
  ['Evidence-backed Market Landscape','Decision Posture','Strategy Posture','Native Research Engine','Opportunity Evidence Engine','Ticker Gate Audit','[object Object]'].forEach(x => assert(!html.includes(x), `legacy/rhetorical homepage artifact still present: ${x}`));
  console.log('operational homepage information hierarchy validated from manifest');
  process.exit(0);
}
assert(html.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"'), 'missing canonical four-section constitution marker');
assert(JSON.stringify(ids) === JSON.stringify(legacy), `section order mismatch: ${ids.join(' > ')}`);
const forbidden = ['id="portfolio-scoreboard"','id="live-reaction-state"','id="native-research-engine"','id="opportunity-evidence-engine"','id="ticker-gate-audit"','id="information-hierarchy"','id="portfolio-story"','id="research-candidate-map"','Interpreted decision cards','What deserves attention now','What the portfolio is allowed to do now','Live action permissions','Command surface','Today’s decision poster','Read permission before price','What requires action now?','research engine ready','tickers passed','Native Research Engine','Opportunity Evidence Engine','Ticker Gate Audit'];
const hit = forbidden.find(x => html.includes(x));
assert(!hit, `legacy/rhetorical homepage artifact still present: ${hit}`);
assert(fs.existsSync(path.join(root, 'outputs', 'homepage-constitution.json')), 'homepage constitution output missing');
console.log('compressed homepage four-section constitution validated');
