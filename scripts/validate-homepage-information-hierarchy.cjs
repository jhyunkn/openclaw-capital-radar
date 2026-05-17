const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`HOMEPAGE HIERARCHY VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('id="information-hierarchy"'), 'missing information hierarchy guide');
assert(html.includes('How to read this board'), 'missing operating-sequence explanation');
assert(html.includes('Can I act?'), 'missing first-look operator question');
assert(html.includes('Why does today matter?'), 'missing second-look operator question');
assert(html.includes('What do I do with holdings?'), 'missing holdings operator question');
assert(html.includes('What should enter research?'), 'missing research pipeline operator question');
console.log('homepage information hierarchy guide validated');
