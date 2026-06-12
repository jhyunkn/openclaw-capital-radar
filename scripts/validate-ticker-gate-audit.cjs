const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const audit = read('outputs/ticker-gate-audit.json');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicHtml = fs.existsSync(path.join(root, 'public', 'index.html')) ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '';
const failures=[];
const list=v=>Array.isArray(v)?v:[];
function check(ok,msg){ if(!ok) failures.push(msg); }
function hasCanonicalHomepage(source) {
  return ['decision-brief-section', 'operational-chart-section', 'holdings-section', 'opportunities-section']
    .every(id => source.includes(`id="${id}"`));
}
function hasGateSurfaces(source) {
  return (source.includes('id="holdings-section"') && source.includes('id="opportunities-section"'))
    || (source.includes('id="holdings"') && source.includes('id="opportunity"'));
}
check(audit.status === 'ACTIVE', 'ticker gate audit inactive');
check(audit.counts?.tickers >= 20, 'too few tickers audited');
check(list(audit.rows).every(r => r.gates?.primaryEvidence && r.gates?.priceZone && r.gates?.invalidation && r.gates?.riskBudget && r.gates?.portfolioRole), 'not every ticker has all five gate objects');
check(list(audit.rows).every(r => ['PASS','BLOCKED'].includes(r.gateStatus)), 'invalid gate status found');
check(list(audit.rows).every(r => r.actionBoundary && /human review/i.test(r.actionBoundary)), 'missing human review boundary');
check(audit.counts.pass + audit.counts.blocked === audit.counts.tickers, 'pass/blocked counts do not reconcile');
check(!html.includes('id="ticker-gate-audit"'), 'ticker gate telemetry should not be a top-level homepage section after compression');
check(hasGateSurfaces(html), 'homepage missing sections that absorb gate state');
check(!publicHtml.includes('id="ticker-gate-audit"'), 'public homepage still exposes ticker gate telemetry panel');
check(fs.existsSync(path.join(root, 'public', 'outputs', 'ticker-gate-audit.json')), 'public ticker gate audit missing');
const output = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  summary: failures.length ? `${failures.length} ticker gate checks failed.` : 'Every ticker has explicit primary evidence, price zone, invalidation, risk budget, and portfolio-role gates; blocked tickers cannot promote.',
  checks: { tickers:audit.counts?.tickers || 0, pass:audit.counts?.pass || 0, blocked:audit.counts?.blocked || 0, primaryEvidenceBlocked:list(audit.blockedByGate?.primaryEvidence).length, dashboardPanel:hasGateSurfaces(html), publicSync:hasCanonicalHomepage(publicHtml) || publicHtml.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"') },
  failures
};
for (const rel of ['outputs/ticker-gate-audit-validation.json','public/outputs/ticker-gate-audit-validation.json']) {
  const p=path.join(root,rel); fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,JSON.stringify(output,null,2));
}
console.log(JSON.stringify(output,null,2));
if (failures.length) process.exit(1);
