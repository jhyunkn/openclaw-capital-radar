const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`STRATEGY INTERPRETATION VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
function detectHoldingsSurface(holdingsHtml){
  if (holdingsHtml.includes('strategy-card-grid') && holdingsHtml.includes('health-card') && holdingsHtml.includes('health-matrix')) return 'cleaned-health-cards';
  if (holdingsHtml.includes('strategy-card-grid') && holdingsHtml.includes('strategy-decision-band') && holdingsHtml.includes('strategy-fact-list')) return 'restored-strategy-cards';
  if (holdingsHtml.includes('holding-card') || holdingsHtml.includes('holdings-grid')) return 'compressed-holding-cards';
  return null;
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
  assert(html.includes('id="holdings"'), 'homepage missing Holdings section');
  const holdingsMatch = html.match(/<section[^>]*id="holdings"[\s\S]*?<\/section>/);
  assert(holdingsMatch, 'Holdings section not found');
  const holdingsHtml = holdingsMatch[0];
  const surfaceMode = detectHoldingsSurface(holdingsHtml);
  assert(surfaceMode, 'Holdings section missing recognized holdings surface mode');
  if (surfaceMode === 'restored-strategy-cards') {
    for (const label of ['Action permission','Urgency','Thesis','Confidence','New information processed','Signal changes if','Portfolio conflict','Position pressure','Valuation read','Data confidence']) assert(holdingsHtml.includes(label), `restored Holdings surface missing ${label}`);
  }
  if (surfaceMode === 'cleaned-health-cards') {
    for (const label of ['Valuation','Cash flow','Trend','Thesis','Risk flag','Data confidence']) assert(holdingsHtml.includes(label), `cleaned Holdings surface missing ${label}`);
    for (const removed of ['New information processed','Signal changes if']) assert(!holdingsHtml.includes(removed), `cleaned Holdings surface still includes removed redundant field: ${removed}`);
  }
  assert(!html.includes('Interpreted decision cards'), 'legacy Interpreted decision cards heading still visible');
  for (const item of data.interpretations) assert(holdingsHtml.includes(`>${item.ticker}</b>`) || holdingsHtml.includes(`>${item.ticker}</h3>`) || holdingsHtml.includes(`>${item.ticker}<`), `Holdings missing ${item.ticker}`);
  console.log(`strategy interpretations UI binding validated: ${surfaceMode}`);
}
console.log(`strategy interpretations data validated: ${data.interpretations.length} holdings`);
