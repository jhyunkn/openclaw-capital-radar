const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`STRATEGY INTERPRETATION VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
function getSection(html, id) {
  const match = html.match(new RegExp(`<section[^>]*id=["']${id}["'][\\s\\S]*?<\\/section>`, 'i'));
  return match ? match[0] : '';
}
assert(fs.existsSync(interpPath), 'outputs/strategy-interpretations.json missing');
const data = JSON.parse(fs.readFileSync(interpPath, 'utf8'));
assert(Array.isArray(data.interpretations), 'interpretations array missing');
assert(data.interpretations.length > 0, 'interpretations array empty');
const required = ['ticker','role','exposureType','riskCap','thesisStatus','actionPermission','urgency','newInformation','nearestDecisionBoundary','positionPressure','trendRead','dataConfidence','portfolioConflict','decisionConfidence','signalChangeConditions'];
for (const item of data.interpretations) {
  for (const key of required) assert(Object.prototype.hasOwnProperty.call(item, key), `${item.ticker || 'unknown'} missing ${key}`);
  assert(item.actionPermission.status, `${item.ticker} missing actionPermission.status`);
  assert(item.urgency.level, `${item.ticker} missing urgency.level`);
  assert(item.thesisStatus.status, `${item.ticker} missing thesisStatus.status`);
  assert(Array.isArray(item.newInformation), `${item.ticker} newInformation must be array`);
  assert(Array.isArray(item.signalChangeConditions), `${item.ticker} signalChangeConditions must be array`);
}
if (fs.existsSync(indexPath)) {
  const html = fs.readFileSync(indexPath, 'utf8');
  const holdingsHtml = getSection(html, 'holdings-section');
  assert(holdingsHtml, 'homepage missing Holdings section');
  assert(!html.includes('[object Object]'), 'homepage rendered an object directly; normalize confidence/trust values to text');
  assert(!html.includes('Interpreted decision cards'), 'legacy Interpreted decision cards heading still visible');

  const semanticBindings = [
    [/permission/i, 'action permission'],
    [/thesis|invalidation/i, 'thesis/invalidation'],
    [/confidence|freshness/i, 'confidence/freshness'],
    [/risk|breach|conflict|pressure/i, 'risk/pressure'],
    [/trend|technical|valuation|cash flow/i, 'market/valuation read'],
    [/why|evidence|change|gate/i, 'decision evidence/gate']
  ];
  for (const [pattern, label] of semanticBindings) assert(pattern.test(holdingsHtml), `Holdings surface missing ${label}`);
  for (const item of data.interpretations) assert(holdingsHtml.includes(`>${item.ticker}</b>`) || holdingsHtml.includes(`>${item.ticker}</h3>`) || holdingsHtml.includes(`>${item.ticker}<`), `Holdings missing ${item.ticker}`);
  console.log('strategy interpretations UI binding validated semantically');
}
console.log(`strategy interpretations data validated: ${data.interpretations.length} holdings`);
