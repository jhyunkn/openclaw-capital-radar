const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`FOUR-SECTION HOMEPAGE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
function sectionHtml(html, id){ return (html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?<\\/section>`)) || [''])[0]; }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"'), 'homepage constitution marker missing');
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const expected = ['brief', 'holdings', 'opportunity', 'market-tape'];
assert(JSON.stringify(sectionIds) === JSON.stringify(expected), `section order mismatch: ${sectionIds.join(' > ')}`);
const brief = sectionHtml(html, 'brief');
const holdings = sectionHtml(html, 'holdings');
const opportunity = sectionHtml(html, 'opportunity');
const marketTape = sectionHtml(html, 'market-tape');
assert(brief, 'Brief section missing');
assert(holdings, 'Holdings section missing');
assert(opportunity, 'Opportunity section missing');
assert(marketTape, 'Market tape section missing');
assert(/Market Weather|Structural Pressure|Narrative Velocity|Capital Flow|Asymmetry Radar|Concentration|Evidence quality|Evidence gaps|market-orientation/i.test(brief), 'Brief missing market-orientation synthesis');
assert(/Valuation|Cash flow|Trend|Thesis|Risk flag|Data confidence/i.test(holdings), 'Holdings missing decision health fields');
assert(/Invalidation|Research only|Research queue|Evidence gate|No promoted candidates|Opportunity/i.test(opportunity), 'Opportunity missing evidence/research state');
assert(/Rates|liquidity|volatility|Market Tape|external tape|macro|stress/i.test(marketTape), 'Market tape missing market framing');
const forbidden = [
  'id="command"', 'id="holdings-section"', 'id="opportunities-section"', 'id="market-section"',
  'Allowed / forbidden now', 'What requires action now?', 'Read permission before price.', 'Consumer contract',
  'What the portfolio is allowed to do now', 'What deserves attention now', 'Interpreted decision cards',
  'Live action permissions', 'Portfolio story chart', 'Underwritten vs constrained',
  'Pressure / exposure', 'Native Research Engine', 'Opportunity Evidence Engine', 'Ticker Gate Audit'
];
for (const phrase of forbidden) assert(!html.includes(phrase), `legacy phrase still present: ${phrase}`);
console.log('four-section homepage validated semantically: Brief / Holdings / Opportunity / Market Tape only');
