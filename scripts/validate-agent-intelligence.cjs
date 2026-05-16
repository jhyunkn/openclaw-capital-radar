const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const notesDir = path.join(root, 'agent-notes', 'tickers');
const pagesDir = path.join(root, 'pages');
function fail(message) { console.error(`AGENT INTELLIGENCE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function list(value) { return Array.isArray(value) ? value : []; }
for (const h of holdings) {
  const ticker = String(h.ticker || '').toLowerCase();
  assert(ticker, 'holding missing ticker');
  const notePath = path.join(notesDir, `${ticker}.json`);
  assert(fs.existsSync(notePath), `agent note missing for ${ticker}`);
  const note = JSON.parse(fs.readFileSync(notePath, 'utf8'));
  assert(note.ticker && note.ticker.toLowerCase() === ticker, `agent note ticker mismatch for ${ticker}`);
  assert(note.agentThesis && typeof note.agentThesis.baseCase === 'string', `agentThesis.baseCase missing for ${ticker}`);
  assert(note.agentThesis.invalidation, `agentThesis.invalidation missing for ${ticker}`);
  assert(typeof note.agentThesis.confidence === 'number', `agentThesis.confidence missing for ${ticker}`);
  assert(note.technicalMap && typeof note.technicalMap.trendRegime === 'string', `technicalMap.trendRegime missing for ${ticker}`);
  assert(note.strategyProtocol, `strategyProtocol missing for ${ticker}`);
  for (const key of ['holdIf', 'addIf', 'trimIf', 'exitIf', 'doNothingIf']) {
    assert(list(note.strategyProtocol[key]).length > 0, `strategyProtocol.${key} empty for ${ticker}`);
  }
  assert(list(note.agentLog).length > 0, `agentLog empty for ${ticker}`);
  assert(list(note.openQuestions).length > 0, `openQuestions empty for ${ticker}`);
  const pagePath = path.join(pagesDir, `${ticker}.html`);
  assert(fs.existsSync(pagePath), `ticker page missing for ${ticker}`);
  const page = fs.readFileSync(pagePath, 'utf8');
  assert(page.includes('OpenClaw Agent Intelligence'), `ticker page missing agent intelligence for ${ticker}`);
  assert(page.includes(`/agent-notes/tickers/${ticker}.json`), `ticker page missing agent note link for ${ticker}`);
}
console.log(`agent intelligence validated: ${holdings.length} ticker notes and workspaces`);
