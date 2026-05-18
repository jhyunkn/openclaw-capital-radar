const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicHtml = fs.existsSync(path.join(root, 'public', 'index.html')) ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '';
const sources = read('data/research/source-registry.json');
const events = read('outputs/native-events.json');
const list = v => Array.isArray(v) ? v : [];
const failures = [];
function check(ok, msg) { if (!ok) failures.push(msg); }
check(list(sources).length >= 6, 'source registry must contain at least 6 curated sources');
check(list(sources).some(s => s.sourceId === 'sec-company-submissions'), 'SEC source missing');
check(list(sources).some(s => s.sourceId === 'yahoo-chart-public'), 'Yahoo chart source missing');
check(list(sources).some(s => s.sourceId === 'fred-public-series'), 'FRED source missing');
check(events.status === 'ACTIVE', 'native event ledger not active');
check(list(events.events).length >= 8, 'native event ledger has too few events');
check(list(events.immediateResearchQueue).length > 0, 'immediate research queue empty');
check(events.operationalGates?.canClaimFreshNewsCausality === false, 'degraded run must not claim fresh news causality');
check(html.includes('id="native-research-engine"'), 'homepage missing native research panel');
check(html.includes('No whole-web search dependency'), 'homepage missing no-search boundary language');
check(publicHtml.includes('id="native-research-engine"'), 'public homepage missing native research panel');
check(fs.existsSync(path.join(root, 'public', 'outputs', 'native-events.json')), 'public native events missing');
check(fs.existsSync(path.join(root, 'public', 'data', 'research', 'source-registry.json')), 'public source registry missing');
const output = {
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  summary: failures.length ? `${failures.length} native research checks failed.` : 'Native Research Engine Phase 1 is operational from local curated sources and internal state.',
  checks: {
    sourceCount: list(sources).length,
    eventCount: list(events.events).length,
    immediateResearchQueue: list(events.immediateResearchQueue).length,
    canClaimFreshNewsCausality: events.operationalGates?.canClaimFreshNewsCausality === true,
    dashboardPanel: html.includes('id="native-research-engine"'),
    publicSync: publicHtml.includes('id="native-research-engine"')
  },
  failures
};
for (const rel of ['outputs/native-research-engine-audit.json', 'public/outputs/native-research-engine-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify(output, null, 2));
if (failures.length) process.exit(1);
