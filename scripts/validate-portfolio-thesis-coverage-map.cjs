const fs = require('fs');
const path = require('path');
const { hasSection } = require('./lib/homepage-section-contract.cjs');
const root = path.join(__dirname, '..');
const mapPath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
const indexPath = path.join(root, 'index.html');
function fail(message){ console.error(`THESIS COVERAGE VALIDATION FAILED: ${message}`); process.exit(1); }
function ok(condition, message){ if(!condition) fail(message); }
ok(fs.existsSync(mapPath), 'coverage map missing');
ok(fs.existsSync(indexPath), 'homepage missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const html = fs.readFileSync(indexPath, 'utf8');
ok(data.layer === 'portfolio-thesis-coverage-map', 'wrong layer marker');
ok(data.summary && typeof data.summary.averageCoverageScore === 'number', 'summary average missing');
ok(typeof data.summary.constrained === 'number', 'constrained summary missing');
ok(Array.isArray(data.holdings) && data.holdings.length > 0, 'holdings missing');
for (const h of data.holdings) {
  ok(h.ticker, 'ticker missing');
  ok(typeof h.thesisCoverageScore === 'number', `${h.ticker} score missing`);
  ok(h.thesisCoverageScore >= 0 && h.thesisCoverageScore <= 100, `${h.ticker} score out of range`);
  ok(['underwritten','constrained','partial','thin'].includes(h.coverageState), `${h.ticker} bad coverage state`);
  ok(h.categories && h.categories.businessModel && h.categories.riskInvalidation && h.categories.sourceEvidence, `${h.ticker} categories incomplete`);
  ok(h.thesisChain && h.thesisChain.signal && h.thesisChain.actionPermission, `${h.ticker} thesis chain incomplete`);
  if (h.blockedForAction) ok(h.coverageState !== 'underwritten', `${h.ticker} blocked position cannot be cleanly underwritten`);
}
for (const t of ['BMNR','CONL','TSLT']) {
  const row = data.holdings.find(h => h.ticker === t);
  if (row) ok(row.humanReviewRequired === true, `${t} should require human review`);
}
for (const t of ['BMNR','TSNF']) {
  const row = data.holdings.find(h => h.ticker === t);
  if (row) {
    ok(row.highRiskEvidenceReview, `${t} missing high-risk evidence review`);
    ok(row.highRiskEvidenceReview.status === 'insufficient_for_confident_posture', `${t} should remain insufficient for confident posture until thesis evidence is attached`);
    ok(row.blockedForAction === true, `${t} should remain blocked for action`);
    ok(row.categories.sourceEvidence.status !== 'covered', `${t} should not count governance/placeholders as substantive source evidence`);
  }
}
ok(hasSection(html, 'macro'), 'homepage missing Macro section for compressed thesis synthesis');
ok(html.includes('thesis') || html.includes('coverage'), 'Macro missing thesis coverage synthesis');
ok(!html.includes('Underwritten vs constrained holdings') && !html.includes('Underwritten vs merely tracked holdings'), 'legacy thesis coverage chart section still visible');
console.log(`thesis coverage validated as backend data for Macro: ${data.holdings.length} holdings, avg ${data.summary.averageCoverageScore}%, constrained ${data.summary.constrained}`);
