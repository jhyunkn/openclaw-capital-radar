const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const idx = read('outputs/opportunity-dossier-index.json');
const goggles = read('data/research/finance-goggles.json');
const packets = read('outputs/opportunity-evidence-packets.json');
const ledger = read('outputs/source-reliability-ledger.json');
const failures = [];
function check(ok, msg){ if(!ok) failures.push(msg); }
const dossierCount = (idx.dossiers || []).length;
const packetCount = (packets.packets || []).length;
const priorityCount = (packets.priorityQueue || []).length;
const blockedCount = ledger.aggregate?.candidatesBlockedFromPromotion || 0;
const allPacketsBlocked = packetCount > 0 && blockedCount >= packetCount && priorityCount === 0;
const dossierStateOperational = dossierCount >= 3 || allPacketsBlocked;
check(goggles.status === 'ACTIVE', 'finance goggles inactive');
check((goggles.goggles || []).length >= 5, 'too few finance goggles');
check(idx.status === 'ACTIVE' || allPacketsBlocked, 'opportunity dossier index inactive without validated upstream blockage');
check(dossierStateOperational, 'too few persistent opportunity dossiers and no validated evidence-gate blockage');
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
  summary: failures.length ? `${failures.length} opportunity dossier checks failed.` : 'Opportunity dossiers and Finance Goggles are operational; zero dossiers is valid when upstream evidence gates block every candidate from persistent promotion.',
  checks: {
    goggles: (goggles.goggles || []).length,
    dossiers: dossierCount,
    packets: packetCount,
    priorityQueue: priorityCount,
    candidatesBlockedFromPromotion: blockedCount,
    dossierState: dossierCount >= 3 ? 'ACTIVE_PERSISTENT_DOSSIERS' : allPacketsBlocked ? 'EMPTY_BY_VALIDATED_EVIDENCE_GATE' : 'INSUFFICIENT_UNEXPLAINED_EMPTY_DOSSIERS'
  },
  failures
};
for (const rel of ['outputs/opportunity-dossier-audit.json', 'public/outputs/opportunity-dossier-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
