const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
function fail(message){ console.error(`STRATEGY CARD VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition,message){ if(!condition) fail(message); }
assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
assert(html.includes('Strategic Holdings'), 'homepage missing Strategic Holdings section');
assert(html.includes('Interpreted decision cards'), 'homepage missing interpreted decision-card framing');
assert(html.includes('Action permission'), 'homepage missing Action permission labels');
assert(html.includes('Urgency'), 'homepage missing Urgency labels');
assert(html.includes('Thesis'), 'homepage missing Thesis labels');
assert(html.includes('Confidence'), 'homepage missing Confidence labels');
assert(html.includes('New information processed'), 'homepage missing new information processed section');
assert(html.includes('Signal changes if'), 'homepage missing signal-change conditions');
assert(html.includes('Portfolio conflict'), 'homepage missing portfolio conflict labels');
assert(html.includes('Position pressure'), 'homepage missing Position pressure labels');
assert(html.includes('Valuation read'), 'homepage missing Valuation read labels');
assert(html.includes('Data confidence'), 'homepage missing Data confidence labels');
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(html.includes(`>${ticker}</h3>`) || html.includes(`>${ticker}<`), `strategy card missing for ${ticker}`);
  assert(html.includes(`pages/${ticker.toLowerCase()}.html`), `strategy card missing workbench link for ${ticker}`);
}
console.log(`interpreted strategy cards validated: ${holdings.length} holdings`);
