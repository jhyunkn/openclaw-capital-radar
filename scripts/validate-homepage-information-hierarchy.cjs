const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`HOMEPAGE COMPRESSION VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"'), 'missing canonical four-section constitution marker');
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const expected = ['brief', 'holdings', 'opportunity', 'market-tape'];
assert(sectionIds.length === expected.length, `expected exactly 4 top-level sections; found ${sectionIds.length}: ${sectionIds.join(', ')}`);
assert(expected.every((id, i) => sectionIds[i] === id), `section order mismatch: ${sectionIds.join(' > ')}`);
const forbidden = [
  'id="portfolio-scoreboard"', 'id="live-reaction-state"', 'id="native-research-engine"', 'id="opportunity-evidence-engine"', 'id="ticker-gate-audit"',
  'id="information-hierarchy"', 'id="portfolio-story"', 'id="research-candidate-map"',
  'Interpreted decision cards', 'What deserves attention now', 'What the portfolio is allowed to do now', 'Live action permissions',
  'Command surface', 'Today’s decision poster', 'Read permission before price', 'What requires action now?',
  'research engine ready', 'tickers passed', 'Native Research Engine', 'Opportunity Evidence Engine', 'Ticker Gate Audit'
];
const hit = forbidden.find(x => html.includes(x));
assert(!hit, `legacy/rhetorical homepage artifact still present: ${hit}`);
assert(fs.existsSync(path.join(root, 'outputs', 'homepage-constitution.json')), 'homepage constitution output missing');
console.log('compressed homepage four-section constitution validated');
