const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`FOUR-SECTION HOMEPAGE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
const required = [
  ['id="brief"', 'Brief section'],
  ['id="holdings-section"', 'Holdings section'],
  ['id="opportunities-section"', 'Opportunity section'],
  ['id="market-section"', 'Market tape section'],
  ['Portfolio operating matrix', 'Holdings matrix heading'],
  ['Research queue', 'Opportunity queue heading'],
  ['External pressure', 'Market tape heading']
];
for (const [needle, label] of required) assert(html.includes(needle), `${label} missing`);
const forbidden = [
  'id="command"',
  'Allowed / forbidden now',
  'What requires action now?',
  'Read permission before price.',
  'Consumer contract',
  'What the portfolio is allowed to do now',
  'What deserves attention now',
  'Interpreted decision cards',
  'Live action permissions',
  'Portfolio story chart',
  'Underwritten vs constrained',
  'Research queue, not action queue',
  'Pressure / exposure'
];
for (const phrase of forbidden) assert(!html.includes(phrase), `legacy phrase still present: ${phrase}`);
const firstBrief = html.indexOf('id="brief"');
const firstHoldings = html.indexOf('id="holdings-section"');
const firstOpp = html.indexOf('id="opportunities-section"');
const firstMarket = html.indexOf('id="market-section"');
assert(firstBrief < firstHoldings && firstHoldings < firstOpp && firstOpp < firstMarket, 'sections are not ordered Brief → Holdings → Opportunity → Market tape');
console.log('four-section homepage validated: Brief / Holdings / Opportunity / Market tape only');
