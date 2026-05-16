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
assert(html.includes('Decision cards, not data cards'), 'homepage missing decision-card framing');
assert(html.includes('Next trigger'), 'homepage missing Next trigger labels');
assert(html.includes('Distance to action'), 'homepage missing Distance to action labels');
assert(html.includes('Position pressure'), 'homepage missing Position pressure labels');
assert(html.includes('Valuation read'), 'homepage missing Valuation read labels');
assert(html.includes('Data confidence'), 'homepage missing Data confidence labels');
assert(html.includes('strategy-action-map'), 'homepage missing action map');
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(html.includes(`>${ticker}</h3>`) || html.includes(`>${ticker}<`), `strategy card missing for ${ticker}`);
  assert(html.includes(`pages/${ticker.toLowerCase()}.html`), `strategy card missing workbench link for ${ticker}`);
}
console.log(`strategy cards validated: ${holdings.length} holdings`);
