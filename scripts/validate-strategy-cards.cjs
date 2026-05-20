const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');

function fail(message) {
  console.error(`STRATEGY CARD VALIDATION FAILED: ${message}`);
  process.exit(1);
}
function assert(condition, message) { if (!condition) fail(message); }
function section(html, id) {
  const match = html.match(new RegExp(`<section[^>]*id=["']${id}["'][\\s\\S]*?<\\/section>`, 'i'));
  return match ? match[0] : '';
}

assert(fs.existsSync(indexPath), 'index.html missing');
assert(fs.existsSync(statePath), 'report state missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const html = fs.readFileSync(indexPath, 'utf8');
const holdingsHtml = section(html, 'holdings');

assert(holdingsHtml, 'homepage missing Holdings section');
assert(!html.includes('[object Object]'), 'homepage rendered an object directly; normalize confidence/trust values to text');

// This validator is intentionally semantic, not visual-fragment based. The homepage may
// change layout, but Holdings must still expose decision-machine facts for every holding.
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  assert(ticker, 'holding missing ticker');
  assert(holdingsHtml.includes(`>${ticker}</h3>`) || holdingsHtml.includes(`>${ticker}</b>`) || holdingsHtml.includes(`>${ticker}<`), `holding decision machine missing for ${ticker}`);
}

const requiredSemanticSignals = [
  [/permission/i, 'decision permission'],
  [/(rule breach|risk)/i, 'rule breach or risk visibility'],
  [/(data confidence|source confidence|freshness)/i, 'data/source confidence visibility'],
  [/(thesis|invalidation)/i, 'thesis or invalidation visibility'],
  [/(evidence|why)/i, 'evidence/why visibility'],
  [/(valuation|add|trim|exit|hold|review)/i, 'action gate visibility']
];
for (const [pattern, label] of requiredSemanticSignals) {
  assert(pattern.test(holdingsHtml), `Holdings section missing ${label}`);
}

const cardCount = (holdingsHtml.match(/<(article|div)[^>]*(strategy-card|holding-card|health-card|decision-machine|permission)/gi) || []).length;
assert(cardCount >= holdings.length, `expected at least ${holdings.length} holding decision cards, found ${cardCount}`);

console.log(`semantic holdings decision-machine validation passed: ${holdings.length} holdings`);
