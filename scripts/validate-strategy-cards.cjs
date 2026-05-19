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
const cleanHome = html.includes('id="command"') && html.includes('Compact ticker matrix') && html.includes('id="holdings-section"');
if (cleanHome) {
  assert(html.includes('id="holdings-section"'), 'clean homepage missing holdings section');
  assert(html.includes('Compact ticker matrix'), 'clean homepage missing compact ticker matrix heading');
  assert(html.includes('id="command"'), 'clean homepage missing command surface');
  assert(html.includes('Allowed / forbidden now'), 'clean homepage missing command heading');
  assert(html.includes('outputs/authoritative-action-state.json'), 'clean homepage missing authoritative action-state link');
  assert(!html.includes('What requires action now?'), 'legacy manifesto still present');
  assert(!html.includes('Interpreted decision cards'), 'legacy strategic cards still present');
} else {
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
}
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(html.includes(`>${ticker}</b>`) || html.includes(`>${ticker}</h3>`) || html.includes(`>${ticker}<`), `holding card missing for ${ticker}`);
  assert(html.includes(`pages/${ticker.toLowerCase()}.html`), `holding card missing workbench link for ${ticker}`);
}
console.log(`holding strategy surface validated: ${holdings.length} holdings; ${cleanHome ? 'compact matrix' : 'legacy interpreted cards'}`);
