const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const pagesDir = path.join(root, 'pages');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const scoreboardPath = path.join(root, 'outputs', 'portfolio-scoreboard.json');

function fail(message) {
  console.error(`ANALYTICS SURFACE VALIDATION FAILED: ${message}`);
  process.exit(1);
}
function assert(condition, message) {
  if (!condition) fail(message);
}
function readJson(file) {
  assert(fs.existsSync(file), `${path.relative(root, file)} missing`);
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

const state = readJson(statePath);
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
assert(holdings.length > 0, 'state.holdings is empty');
assert(fs.existsSync(indexPath), 'index.html missing');
const index = fs.readFileSync(indexPath, 'utf8');

const cleanHome = index.includes('id="command"') && index.includes('Compact ticker matrix') && index.includes('id="portfolio"');
if (cleanHome) {
  assert(index.includes('id="command"'), 'clean homepage missing command surface');
  assert(index.includes('Allowed / forbidden now'), 'clean homepage missing command heading');
  assert(index.includes('outputs/authoritative-action-state.json'), 'clean homepage missing authoritative action-state JSON link');
  assert(index.includes('id="holdings-section"'), 'clean homepage missing holdings matrix');
  assert(index.includes('id="portfolio"'), 'clean homepage missing portfolio section');
  assert(index.includes('id="research"'), 'clean homepage missing research section');
  assert(!index.includes('What requires action now?'), 'legacy command manifesto still present');
  assert(!index.includes('Read permission before price.'), 'legacy decision poster still present');
  assert(!index.includes('Consumer contract'), 'legacy consumer contract still present');
} else {
  assert(index.includes('id="portfolio-scoreboard"'), 'homepage missing #portfolio-scoreboard');
  assert(index.includes('Review queue from signal scorecards'), 'homepage missing portfolio scoreboard heading');
  assert(index.includes('outputs/portfolio-scoreboard.json'), 'homepage missing scoreboard JSON link');
}

const scoreboard = readJson(scoreboardPath);
assert(Array.isArray(scoreboard.scorecards), 'portfolio-scoreboard.json missing scorecards array');
assert(scoreboard.scorecards.length === holdings.length, `scorecards count ${scoreboard.scorecards.length} does not match holdings count ${holdings.length}`);
assert(Array.isArray(scoreboard.reviewQueue) && scoreboard.reviewQueue.length > 0, 'reviewQueue missing or empty');
assert(Array.isArray(scoreboard.warnings), 'warnings array missing');

for (const h of holdings) {
  const ticker = String(h.ticker || '').toLowerCase();
  assert(ticker, 'holding missing ticker');
  const pagePath = path.join(pagesDir, `${ticker}.html`);
  assert(fs.existsSync(pagePath), `pages/${ticker}.html missing`);
  const html = fs.readFileSync(pagePath, 'utf8');
  assert(html.includes('Signal Scorecard'), `pages/${ticker}.html missing Signal Scorecard`);
  assert(html.includes('Why this signal exists'), `pages/${ticker}.html missing scorecard explanation heading`);
  assert(html.includes('Data quality'), `pages/${ticker}.html missing Data quality section`);
  assert(html.includes('Risk budget'), `pages/${ticker}.html missing Risk budget section`);
  assert(html.includes('TradingView') || html.includes('chart-section'), `pages/${ticker}.html missing chart surface`);
}

console.log(`analytics surface validated: ${holdings.length} holding pages, ${cleanHome ? 'clean homepage composition' : 'legacy homepage scoreboard'}, JSON output`);
