const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mapPath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`PORTFOLIO EXPOSURE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(mapPath), 'outputs/portfolio-exposure-map.json missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
assert(data.taxonomy === 'exclusive_business_exposure_v1', 'expected exclusive_business_exposure_v1 taxonomy');
assert(Array.isArray(data.buckets), 'buckets array missing');
assert(data.buckets.length >= 8, 'expected at least eight exclusive business exposure buckets');
assert(Array.isArray(data.whyTodayMatters), 'whyTodayMatters array missing');
assert(typeof data.totalWeightPct === 'number', 'totalWeightPct missing');
assert(Math.abs(data.totalWeightPct - 100) <= 0.15, `exclusive bucket weights do not reconcile to 100%; got ${data.totalWeightPct}`);
assert(data.reconciliation === 'PASS', 'portfolio exposure reconciliation did not pass');
for (const id of ['ecommerce_cloud','cloud_software_ai','payments_financial_infrastructure','levered_tactical','index_market_beta']) {
  assert(data.buckets.some(b => b.id === id), `missing exposure bucket ${id}`);
}
const crypto = data.buckets.find(b => b.id === 'speculative_crypto_infrastructure');
if (crypto) assert(!(crypto.members || []).some(m => m.ticker === 'AMZN'), 'AMZN must not appear in crypto infrastructure bucket');
const payments = data.buckets.find(b => b.id === 'payments_financial_infrastructure');
assert(payments && (payments.members || []).some(m => m.ticker === 'MA'), 'MA must appear in payments / financial infrastructure bucket');
for (const b of data.buckets) {
  assert(b.label, `${b.id} missing label`);
  assert(typeof b.weightPct === 'number', `${b.id} missing numeric weightPct`);
  assert(typeof b.capPct === 'number', `${b.id} missing numeric capPct`);
  assert(b.interpretation, `${b.id} missing interpretation`);
}
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('Portfolio Pressure Map'), 'homepage missing Portfolio Pressure Map');
assert(html.includes('Why today matters'), 'homepage missing Why today matters');
assert(html.includes('outputs/portfolio-exposure-map.json'), 'homepage missing exposure JSON link');
console.log(`portfolio exposure map validated: ${data.buckets.length} buckets, ${data.totalWeightPct}% reconciled`);
