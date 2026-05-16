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
assert(index.includes('id="portfolio-scoreboard"'), 'homepage missing #portfolio-scoreboard');
assert(index.includes('Review queue from signal scorecards'), 'homepage missing portfolio scoreboard heading');
assert(index.includes('outputs/portfolio-scoreboard.json'), 'homepage missing scoreboard JSON link');

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
  assert(html.includes('Load live chart'), `pages/${ticker}.html missing live chart loader`);
}

console.log(`analytics surface validated: ${holdings.length} holding pages, homepage scoreboard, JSON output`);
