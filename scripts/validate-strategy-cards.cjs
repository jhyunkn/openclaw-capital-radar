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
assert(html.includes('id="holdings"'), 'homepage missing compressed Holdings section');
assert(!html.includes('strategy-card-grid'), 'legacy interpreted decision card grid must be removed from homepage');
for (const label of ['Valuation','Risk','Macro','Technical','Earnings','Gate']) assert(html.includes(label), `compressed holding cards missing ${label} field`);
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(html.includes(`>${ticker}</b>`) || html.includes(`>${ticker}<`), `compressed holding card missing for ${ticker}`);
}
console.log(`compressed holdings decision cards validated: ${holdings.length} holdings`);
