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
assert(html.includes('id="holdings"'), 'homepage missing Holdings section');
const holdingsMatch = html.match(/<section[^>]*id="holdings"[\s\S]*?<\/section>/);
assert(holdingsMatch, 'Holdings section not found');
const holdingsHtml = holdingsMatch[0];
const hasRestoredStrategyCards = holdingsHtml.includes('strategy-card-grid') && holdingsHtml.includes('strategy-decision-band') && holdingsHtml.includes('strategy-fact-list') && holdingsHtml.includes('strategy-grid');
const hasOldCompressedCards = holdingsHtml.includes('holding-card') && ['Valuation','Risk','Macro','Technical','Earnings','Gate'].every(label => holdingsHtml.includes(label));
const hasCleanedHealthCards = holdingsHtml.includes('strategy-card-grid') && holdingsHtml.includes('health-card') && holdingsHtml.includes('health-matrix') && ['Valuation','Cash flow','Trend','Thesis','Risk flag','Data confidence'].every(label => holdingsHtml.includes(label));
assert(hasRestoredStrategyCards || hasOldCompressedCards || hasCleanedHealthCards, 'Holdings section must use restored strategy cards, old compressed holding cards, or cleaned ticker health cards');
if (hasRestoredStrategyCards) {
  for (const label of ['Action permission','Urgency','Thesis','Confidence','New information processed','Signal changes if','Portfolio conflict','Position pressure','Valuation read','Data confidence']) assert(holdingsHtml.includes(label), `restored strategy cards missing ${label}`);
} else if (hasOldCompressedCards) {
  for (const label of ['Valuation','Risk','Macro','Technical','Earnings','Gate']) assert(holdingsHtml.includes(label), `compressed holding cards missing ${label} field`);
} else {
  for (const label of ['Valuation','Cash flow','Trend','Thesis','Risk flag','Data confidence']) assert(holdingsHtml.includes(label), `cleaned health cards missing ${label} field`);
  for (const removed of ['New information processed','Signal changes if','Capex / reinvestment']) assert(!holdingsHtml.includes(removed), `cleaned health cards still include redundant field: ${removed}`);
}
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(holdingsHtml.includes(`>${ticker}</h3>`) || holdingsHtml.includes(`>${ticker}</b>`) || holdingsHtml.includes(`>${ticker}<`), `holding card missing for ${ticker}`);
}
const mode = hasRestoredStrategyCards ? 'restored strategy holdings cards' : hasOldCompressedCards ? 'compressed holdings cards' : 'cleaned ticker health cards';
console.log(`${mode} validated: ${holdings.length} holdings`);
