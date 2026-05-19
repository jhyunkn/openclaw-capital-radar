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
const hasCompressedCards = holdingsHtml.includes('holding-card') && ['Valuation','Risk','Macro','Technical','Earnings','Gate'].every(label => holdingsHtml.includes(label));
assert(hasRestoredStrategyCards || hasCompressedCards, 'Holdings section must use restored strategy cards or compressed holding cards');
if (hasRestoredStrategyCards) {
  for (const label of ['Action permission','Urgency','Thesis','Confidence','New information processed','Signal changes if','Portfolio conflict','Position pressure','Valuation read','Data confidence']) {
    assert(holdingsHtml.includes(label), `restored strategy cards missing ${label}`);
  }
} else {
  for (const label of ['Valuation','Risk','Macro','Technical','Earnings','Gate']) assert(holdingsHtml.includes(label), `compressed holding cards missing ${label} field`);
}
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(holdingsHtml.includes(`>${ticker}</h3>`) || holdingsHtml.includes(`>${ticker}</b>`) || holdingsHtml.includes(`>${ticker}<`), `holding card missing for ${ticker}`);
}
console.log(`${hasRestoredStrategyCards ? 'restored strategy holdings cards' : 'compressed holdings cards'} validated: ${holdings.length} holdings`);
