const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`HOMEPAGE HIERARCHY VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
const required = ['information-hierarchy','strategy-command','portfolio-exposure','holdings-section','opportunity-section'];
for (const id of required) assert(html.includes(`id="${id}"`), `missing #${id}`);
function pos(id){ return html.indexOf(`id="${id}"`); }
assert(pos('information-hierarchy') < pos('strategy-command'), 'information hierarchy guide must appear before Strategy Command');
assert(pos('strategy-command') < pos('portfolio-exposure'), 'Strategy Command must appear before Portfolio Pressure Map');
assert(pos('portfolio-exposure') < pos('holdings-section'), 'Portfolio Pressure Map must appear before Holdings');
if (html.includes('id="research-candidate-map"')) {
  assert(pos('holdings-section') < pos('research-candidate-map'), 'Research Candidate Map must appear after Holdings');
  assert(pos('portfolio-exposure') < pos('research-candidate-map'), 'Research Candidate Map must appear after Portfolio Pressure Map');
}
assert(pos('holdings-section') < pos('opportunity-section'), 'Opportunity Scout must appear after Holdings');
assert(html.includes('How to read this board'), 'missing operating-sequence explanation');
assert(html.includes('Can I act?'), 'missing first-look operator question');
assert(html.includes('Why does today matter?'), 'missing second-look operator question');
console.log('homepage information hierarchy validated');
