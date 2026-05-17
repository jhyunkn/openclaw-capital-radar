const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const interpPath = path.join(root, 'outputs', 'strategy-interpretations.json');
function fail(message){ console.error(`STRATEGY WORKBENCH VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(interpPath), 'outputs/strategy-interpretations.json missing');
assert(fs.existsSync(pagesDir), 'pages directory missing');
const data = JSON.parse(fs.readFileSync(interpPath, 'utf8'));
const items = Array.isArray(data.interpretations) ? data.interpretations : [];
assert(items.length > 0, 'no strategy interpretations found');
let checked = 0;
for (const item of items) {
  const ticker = String(item.ticker || '').toLowerCase();
  const file = path.join(pagesDir, `${ticker}.html`);
  assert(fs.existsSync(file), `${ticker}.html missing`);
  const html = fs.readFileSync(file, 'utf8');
  assert(html.includes('id="strategy-interpreter"'), `${ticker}.html missing strategy-interpreter section`);
  assert(html.includes('Strategy Interpreter'), `${ticker}.html missing Strategy Interpreter heading`);
  assert(html.includes('Action permission'), `${ticker}.html missing Action permission`);
  assert(html.includes('Decision confidence'), `${ticker}.html missing Decision confidence`);
  assert(html.includes('New information processed'), `${ticker}.html missing New information processed`);
  assert(html.includes('Signal changes if'), `${ticker}.html missing Signal changes if`);
  assert(html.includes('../outputs/strategy-interpretations.json'), `${ticker}.html missing source JSON link`);
  checked++;
}
console.log(`strategy workbenches validated: ${checked} pages`);
