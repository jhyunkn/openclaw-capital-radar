const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const pagesDir = path.join(root, 'pages');
const notesDir = path.join(root, 'agent-notes', 'tickers');
function fail(message) { console.error(`CHART COGNITION VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function list(value) { return Array.isArray(value) ? value : []; }
for (const h of holdings) {
  const ticker = String(h.ticker || '').toLowerCase();
  const notePath = path.join(notesDir, `${ticker}.json`);
  assert(fs.existsSync(notePath), `missing note for ${ticker}`);
  const note = JSON.parse(fs.readFileSync(notePath, 'utf8'));
  const map = note.technicalMap || {};
  for (const key of ['supportLevels', 'resistanceLevels', 'buyZone', 'trimZone', 'stopZone']) assert(list(map[key]).length > 0, `${ticker} technicalMap.${key} empty`);
  assert(map.fractalRead, `${ticker} fractalRead empty`);
  assert(map.multiTimeframeRead, `${ticker} multiTimeframeRead empty`);
  const pagePath = path.join(pagesDir, `${ticker}.html`);
  assert(fs.existsSync(pagePath), `missing page for ${ticker}`);
  const page = fs.readFileSync(pagePath, 'utf8');
  assert(page.includes('Chart Cognition'), `${ticker} page missing Chart Cognition`);
  assert(page.includes('Action map before loading chart'), `${ticker} page missing action map heading`);
}
const indexPath = path.join(root, 'index.html');
assert(fs.existsSync(indexPath), 'index.html missing');
const index = fs.readFileSync(indexPath, 'utf8');
const cleanHome = index.includes('id="command"') && index.includes('Allowed / forbidden now') && index.includes('outputs/authoritative-action-state.json');
const legacyHome = index.includes('id="action-proximity"');
assert(cleanHome || legacyHome, 'homepage missing either clean command surface or legacy action proximity section');
if (cleanHome) {
  assert(!index.includes('What requires action now?'), 'legacy command manifesto still present');
  assert(!index.includes('Read permission before price.'), 'legacy decision-poster still present');
}
console.log(`chart cognition validated: ${holdings.length} ticker workspaces; ${cleanHome ? 'clean homepage command surface' : 'legacy action proximity'}`);
