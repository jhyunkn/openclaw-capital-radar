const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const mapPath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
const pagesDir = path.join(root, 'pages');
function fail(message){ console.error(`THESIS COVERAGE WORKBENCH VALIDATION FAILED: ${message}`); process.exit(1); }
function ok(condition, message){ if(!condition) fail(message); }
ok(fs.existsSync(mapPath), 'coverage map missing');
ok(fs.existsSync(pagesDir), 'pages directory missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const holdings = Array.isArray(data.holdings) ? data.holdings : [];
ok(holdings.length > 0, 'no holdings in coverage map');
let checked = 0;
for (const h of holdings) {
  const ticker = String(h.ticker || '').toLowerCase();
  const file = path.join(pagesDir, `${ticker}.html`);
  ok(fs.existsSync(file), `${h.ticker} page missing`);
  const html = fs.readFileSync(file, 'utf8');
  ok(html.includes('id="thesis-coverage-workbench"'), `${h.ticker} workbench anchor missing`);
  ok(html.includes('Underwriting workbench'), `${h.ticker} workbench heading missing`);
  ok(html.includes('/outputs/portfolio-thesis-coverage-map.json'), `${h.ticker} coverage map link missing`);
  ok(html.includes(`${h.thesisCoverageScore}%`), `${h.ticker} score missing`);
  ok(html.includes(h.coverageState), `${h.ticker} coverage state missing`);
  ok(html.includes('Thesis → signal → permission chain'), `${h.ticker} thesis chain missing`);
  ok(html.includes('Missing evidence / breach list'), `${h.ticker} missing evidence section missing`);
  if (h.blockedForAction) ok(html.includes('Capital action blocked') || html.includes('Partial underwriting'), `${h.ticker} blocked warning missing`);
  checked += 1;
}
console.log(`thesis coverage workbenches validated: ${checked} ticker pages`);
