const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const scorePath = path.join(root, 'outputs', 'system-quality-score.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`SYSTEM QUALITY VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(scorePath), 'outputs/system-quality-score.json missing');
const data = JSON.parse(fs.readFileSync(scorePath, 'utf8'));
assert(typeof data.overall === 'number', 'overall score must be numeric');
assert(data.target === 8, 'target must be 8');
assert(Array.isArray(data.scores), 'scores array missing');
for (const label of ['Architecture','Visual direction','Data integrity','Analytical depth','Strategic usefulness','Agent-readiness']) {
  const item = data.scores.find(s => s.label === label);
  assert(item, `missing score for ${label}`);
  assert(typeof item.score === 'number', `${label} score must be numeric`);
  assert(Array.isArray(item.evidence), `${label} evidence missing`);
  assert(Array.isArray(item.gaps), `${label} gaps missing`);
}
assert(Array.isArray(data.nextLevers) && data.nextLevers.length >= 3, 'nextLevers missing');
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('System Quality'), 'homepage missing System Quality section');
assert(html.includes('Path to overall 8'), 'homepage missing Path to overall 8');
assert(html.includes('outputs/system-quality-score.json'), 'homepage missing quality JSON link');
console.log(`system quality score validated: ${data.overall}/10`);
