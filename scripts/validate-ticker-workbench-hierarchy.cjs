const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
function fail(message){ console.error(`TICKER HIERARCHY VALIDATION FAILED: ${message}`); process.exit(1); }
function indexOf(html, marker, ticker){ const i = html.indexOf(marker); if(i < 0) fail(`${ticker}: missing ${marker}`); return i; }
function assertBefore(html, a, b, ticker){ const ia = indexOf(html, a, ticker); const ib = indexOf(html, b, ticker); if(!(ia < ib)) fail(`${ticker}: expected ${a} before ${b}`); }
let checked = 0;
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  const file = path.join(pagesDir, `${ticker.toLowerCase()}.html`);
  if (!fs.existsSync(file)) fail(`${ticker}: page missing`);
  const html = fs.readFileSync(file, 'utf8');
  const order = [
    'id="investment-committee-memo"',
    'id="thesis-coverage-workbench"',
    'id="strategy-interpreter"',
    '<p class="eyebrow">Risk budget</p>',
    'id="chart-cognition"',
    'class="section chart-section"',
    '<p class="eyebrow">Action bands</p>',
    '<p class="eyebrow">Data quality</p>',
    '<p class="eyebrow">Thesis / invalidation</p>',
    'id="agent-intelligence"',
    '<p class="eyebrow">Evidence</p><h2>Flow / technical read</h2>',
    '<p class="eyebrow">Context</p><h2>Forces / evidence</h2>',
    'class="section nav-section"'
  ];
  for (let i = 0; i < order.length - 1; i++) assertBefore(html, order[i], order[i+1], ticker);
  if ((html.match(/id="thesis-coverage-workbench"/g) || []).length !== 1) fail(`${ticker}: duplicate thesis coverage workbench`);
  if ((html.match(/id="strategy-interpreter"/g) || []).length !== 1) fail(`${ticker}: duplicate strategy interpreter`);
  if ((html.match(/id="chart-cognition"/g) || []).length !== 1) fail(`${ticker}: duplicate chart cognition`);
  if ((html.match(/id="agent-intelligence"/g) || []).length !== 1) fail(`${ticker}: duplicate agent intelligence`);
  checked += 1;
}
console.log(`ticker hierarchy validated: ${checked} pages`);
