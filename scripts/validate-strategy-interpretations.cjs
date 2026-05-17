const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`STRATEGY INTERPRETATION VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
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
  assert(html.includes('Interpreted decision cards'), 'homepage missing interpreted decision cards heading');
  assert(html.includes('New information processed'), 'homepage missing new information processed section');
  assert(html.includes('Signal changes if'), 'homepage missing signal changes if section');
  assert(html.includes('Action permission'), 'homepage missing action permission band');
}
console.log(`strategy interpretations validated: ${data.interpretations.length} holdings`);
