const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const idx = read('outputs/opportunity-dossier-index.json');
const goggles = read('data/research/finance-goggles.json');
const failures = [];
function check(ok, msg){ if(!ok) failures.push(msg); }
check(goggles.status === 'ACTIVE', 'finance goggles inactive');
check((goggles.goggles || []).length >= 5, 'too few finance goggles');
const degradedEmptyDossiers = idx.status === 'EMPTY' && (idx.dossiers || []).length === 0;
check(idx.status === 'ACTIVE' || degradedEmptyDossiers, 'opportunity dossier index inactive');
check((idx.dossiers || []).length >= 1 || degradedEmptyDossiers, 'too few persistent opportunity dossiers');
for (const d of idx.dossiers || []) {
  check(fs.existsSync(path.join(root, d.path)), `missing dossier markdown for ${d.ticker}`);
  check(fs.existsSync(path.join(root, 'tickers', d.ticker, 'opportunity-dossier.json')), `missing dossier json for ${d.ticker}`);
  check((d.goggles || []).includes('stock_research_default'), `${d.ticker} missing default finance goggle`);
}
check(fs.existsSync(path.join(root, 'public', 'outputs', 'opportunity-dossier-index.json')), 'public dossier index missing');
check(fs.existsSync(path.join(root, 'public', 'data', 'research', 'finance-goggles.json')), 'public finance goggles missing');
const output = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  summary: failures.length ? `${failures.length} opportunity dossier checks failed.` : 'Opportunity dossiers and Finance Goggles are operational as persistent research memory.',
  checks: { goggles: (goggles.goggles || []).length, dossiers: (idx.dossiers || []).length },
  failures
};
for (const rel of ['outputs/opportunity-dossier-audit.json', 'public/outputs/opportunity-dossier-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
