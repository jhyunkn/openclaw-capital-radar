const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const manifestPath = path.join(root, 'config', 'homepage-sections.json');
function fail(message){ console.error(`HOMEPAGE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
function sectionHtml(html, id){ return (html.match(new RegExp(`<section[^>]*id="${id}"[\\s\\S]*?<\\/section>`)) || [''])[0]; }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const operational = ['decision-brief-section','operational-chart-section','holdings-section','opportunities-section','market-section'];
if (operational.every(id => sectionIds.includes(id))) {
  assert(fs.existsSync(manifestPath), 'homepage manifest missing for operational homepage');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const expected = manifest.sections.filter(s => s.enabled !== false && s.required !== false).map(s => s.id);
  assert(expected.every(id => sectionIds.includes(id)), `operational section mismatch: expected ${expected.join(' > ')} got ${sectionIds.join(' > ')}`);
  const brief = sectionHtml(html, 'decision-brief-section');
  const chart = sectionHtml(html, 'operational-chart-section');
  const holdings = sectionHtml(html, 'holdings-section');
  const opportunity = sectionHtml(html, 'opportunities-section');
  const market = sectionHtml(html, 'market-section');
  assert(/Macro|Confirmation|VIX|10Y|M2|Risk rule/i.test(brief), 'Decision brief missing macro/confirmation fields');
  assert(/Operational Decision Chart|SPX|RSI|MACD|VIX|10Y|ADD|TRIM|DEFENSE/i.test(chart), 'Operational chart missing chart/indicator/action fields');
  assert(/AUTH|PARTIAL|PROXY|MISSING|Price-zone|Buy|Trim|Stop|Exit/i.test(holdings), 'Holdings missing source tier and zone fields');
  assert(/Opportunity|Evidence|Near|candidate|gate|promotion|qualification|missing/i.test(opportunity), 'Opportunity missing evidence/research state');
  assert(/Market Tape|Rates|liquidity|volatility|BTC|oil|credit|spread|signal/i.test(market), 'Market tape missing market framing');
  ['id="command"','Native Research Engine','Opportunity Evidence Engine','Ticker Gate Audit','What requires action now?','Read permission before price.','[object Object]'].forEach(x => assert(!html.includes(x), `legacy phrase still present: ${x}`));
  console.log('operational homepage validated semantically from manifest');
  process.exit(0);
}
assert(html.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"'), 'homepage constitution marker missing');
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
const forbidden = ['id="command"','id="holdings-section"','id="opportunities-section"','id="market-section"','Allowed / forbidden now','What requires action now?','Read permission before price.','Consumer contract','What the portfolio is allowed to do now','What deserves attention now','Interpreted decision cards','Live action permissions','Portfolio story chart','Underwritten vs constrained','Pressure / exposure','Native Research Engine','Opportunity Evidence Engine','Ticker Gate Audit'];
for (const phrase of forbidden) assert(!html.includes(phrase), `legacy phrase still present: ${phrase}`);
console.log('four-section homepage validated semantically: Brief / Holdings / Opportunity / Market Tape only');
