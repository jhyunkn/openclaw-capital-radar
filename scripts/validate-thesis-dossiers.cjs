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
const required = ['ticker','type','businessModel','whyItMattersNow','macroLinkage','portfolioFit','cases','valuationQuestion','technicalQuestion','confirmBeforeAdd','trimCondition','exitCondition','keyRisks','sourceConfidence','actionPermission','urgency','dossierConfidence'];
for (const d of data.all) {
  for (const key of required) assert(d[key] !== undefined && d[key] !== null, `${d.ticker || 'unknown'} missing ${key}`);
  assert(String(d.businessModel).length >= 20, `${d.ticker} businessModel too thin`);
  assert(Array.isArray(d.whyItMattersNow) && d.whyItMattersNow.length >= 1, `${d.ticker} whyItMattersNow missing`);
  assert(Array.isArray(d.macroLinkage) && d.macroLinkage.length >= 1, `${d.ticker} macroLinkage missing`);
  assert(d.cases && String(d.cases.base || '').length >= 20, `${d.ticker} base case too thin`);
  assert(d.cases && String(d.cases.bull || '').length >= 20, `${d.ticker} bull case too thin`);
  assert(d.cases && String(d.cases.bear || '').length >= 20, `${d.ticker} bear case too thin`);
  assert(Array.isArray(d.confirmBeforeAdd) && d.confirmBeforeAdd.length >= 1, `${d.ticker} confirmBeforeAdd missing`);
  assert(Array.isArray(d.keyRisks) && d.keyRisks.length >= 1, `${d.ticker} keyRisks missing`);
  assert(typeof d.dossierConfidence.score === 'number', `${d.ticker} confidence score missing`);
  const page = path.join(pagesDir, `${String(d.ticker).toLowerCase()}.html`);
  if (fs.existsSync(page)) {
    const html = fs.readFileSync(page, 'utf8');
    assert(html.includes('Thesis Dossier'), `${d.ticker} page missing Thesis Dossier section`);
    assert(html.includes(`${d.ticker} operating thesis`), `${d.ticker} page missing operating thesis heading`);
  }
}
console.log(`thesis dossiers validated: ${data.holdings.length} holdings / ${(data.candidates || []).length} candidates`);
