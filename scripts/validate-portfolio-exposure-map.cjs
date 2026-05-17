const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mapPath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`PORTFOLIO EXPOSURE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(mapPath), 'outputs/portfolio-exposure-map.json missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
assert(Array.isArray(data.buckets), 'buckets array missing');
assert(data.buckets.length >= 5, 'expected at least five exposure buckets');
assert(Array.isArray(data.whyTodayMatters), 'whyTodayMatters array missing');
for (const id of ['ai_infrastructure','single_name_equity','levered_decay','crypto_liquidity','market_beta','weak_data']) {
  assert(data.buckets.some(b => b.id === id), `missing exposure bucket ${id}`);
}
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
console.log(`portfolio exposure map validated: ${data.buckets.length} buckets`);
