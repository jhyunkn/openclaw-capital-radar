const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicHtml = fs.existsSync(path.join(root, 'public', 'index.html')) ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '';
const packets = read('outputs/opportunity-evidence-packets.json');
const ledger = read('outputs/source-reliability-ledger.json');
const list = v => Array.isArray(v) ? v : [];
const failures = [];
function check(ok, msg){ if(!ok) failures.push(msg); }
check(packets.status === 'ACTIVE', 'opportunity packets not active');
check(list(packets.packets).length >= 8, 'too few opportunity packets');
check(list(packets.priorityQueue).length >= 3, 'priority queue too small');
check(list(packets.packets).every(p => p.actionPermission === 'RESEARCH_ONLY_NO_BUY_PERMISSION'), 'packet has unsafe action permission');
check(list(packets.packets).every(p => list(p.missingForPromotion).length >= 4), 'packet missing promotion blockers');
check(ledger.status === 'ACTIVE', 'source reliability ledger not active');
check(ledger.aggregate?.sourceCount >= 6, 'source ledger source count too low');
check(ledger.aggregate?.candidatesBlockedFromPromotion >= 1, 'promotion blockers not enforced');
check(html.includes('id="opportunity-evidence-engine"'), 'homepage missing opportunity evidence section');
check(html.includes('research-priority packets, not buy calls'), 'homepage missing permission boundary');
check(publicHtml.includes('id="opportunity-evidence-engine"'), 'public homepage missing opportunity evidence section');
check(fs.existsSync(path.join(root, 'public', 'outputs', 'opportunity-evidence-packets.json')), 'public opportunity packets missing');
check(fs.existsSync(path.join(root, 'public', 'outputs', 'source-reliability-ledger.json')), 'public source reliability ledger missing');
const output = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  summary: failures.length ? `${failures.length} opportunity evidence checks failed.` : 'Opportunity Evidence Engine is operational: local events become research-only evidence packets with source reliability gates.',
  checks: {
    packetCount: list(packets.packets).length,
    priorityQueue: list(packets.priorityQueue).length,
    sourceCount: ledger.aggregate?.sourceCount || 0,
    candidatesBlockedFromPromotion: ledger.aggregate?.candidatesBlockedFromPromotion || 0,
    dashboardPanel: html.includes('id="opportunity-evidence-engine"'),
    publicSync: publicHtml.includes('id="opportunity-evidence-engine"')
  },
  failures
};
for (const rel of ['outputs/opportunity-evidence-engine-audit.json', 'public/outputs/opportunity-evidence-engine-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
