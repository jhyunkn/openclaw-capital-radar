const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`FOUR-SECTION HOMEPAGE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"'), 'homepage constitution marker missing');
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const expected = ['brief', 'holdings', 'opportunity', 'market-tape'];
assert(JSON.stringify(sectionIds) === JSON.stringify(expected), `section order mismatch: ${sectionIds.join(' > ')}`);
const required = [
  ['id="brief"', 'Brief section'],
  ['id="holdings"', 'Holdings section'],
  ['id="opportunity"', 'Opportunity section'],
  ['id="market-tape"', 'Market tape section'],
  ['Portfolio concentration', 'Brief synthesis'],
  ['Valuation', 'Holdings valuation field'],
  ['Invalidation', 'Opportunity invalidation field'],
  ['Rates, liquidity, volatility', 'Market tape framing']
];
for (const [needle, label] of required) assert(html.includes(needle), `${label} missing`);
const forbidden = [
  'id="command"', 'id="holdings-section"', 'id="opportunities-section"', 'id="market-section"',
  'Allowed / forbidden now', 'What requires action now?', 'Read permission before price.', 'Consumer contract',
  'What the portfolio is allowed to do now', 'What deserves attention now', 'Interpreted decision cards',
  'Live action permissions', 'Portfolio story chart', 'Underwritten vs constrained', 'Research queue, not action queue',
  'Pressure / exposure', 'Native Research Engine', 'Opportunity Evidence Engine', 'Ticker Gate Audit'
];
for (const phrase of forbidden) assert(!html.includes(phrase), `legacy phrase still present: ${phrase}`);
console.log('four-section homepage validated: Brief / Holdings / Opportunity / Market Tape only');
