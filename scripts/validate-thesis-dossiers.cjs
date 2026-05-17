const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const dossierPath = path.join(root, 'outputs', 'thesis-dossiers.json');
const pagesDir = path.join(root, 'pages');
function fail(message){ console.error(`THESIS DOSSIER VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message){ if(!condition) fail(message); }
assert(fs.existsSync(dossierPath), 'outputs/thesis-dossiers.json missing');
const data = JSON.parse(fs.readFileSync(dossierPath, 'utf8'));
assert(Array.isArray(data.holdings), 'holdings dossier array missing');
assert(Array.isArray(data.all), 'all dossier array missing');
assert(data.holdings.length > 0, 'no holding dossiers generated');
for (const d of data.holdings) {
  assert(d.ticker, 'holding dossier missing ticker');
  assert(d.businessModel !== undefined, `${d.ticker} missing businessModel`);
  const page = path.join(pagesDir, `${String(d.ticker).toLowerCase()}.html`);
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf8');
    assert(html.includes('THESIS_DOSSIER_START') || html.includes('Thesis Dossier'), `${d.ticker} page missing Thesis Dossier marker`);
  }
}
console.log(`thesis dossiers minimally validated: ${data.holdings.length} holdings / ${(data.candidates || []).length} candidates`);
