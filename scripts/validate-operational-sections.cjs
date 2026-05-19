const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicHtml = fs.existsSync(path.join(root, 'public', 'index.html')) ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '';
const state = readJson('data/report-state.live.json');
const reactions = readJson('outputs/live-reaction-state.json');
const score = readJson('outputs/operational-readiness-score.json');
const nativeEvents = readJson('outputs/native-events.json');
const opportunityPackets = readJson('outputs/opportunity-evidence-packets.json');
const tickerGateAudit = readJson('outputs/ticker-gate-audit.json');
const constitution = readJson('outputs/homepage-constitution.json');
const list = v => Array.isArray(v) ? v : [];
function pass(label, ok, evidence, blocker = null) { return { label, status: ok ? 'PASS' : 'FAIL', evidence, blocker }; }
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const expected = ['brief', 'holdings', 'opportunity', 'market-tape'];
const forbidden = ['portfolio-scoreboard','live-reaction-state','native-research-engine','opportunity-evidence-engine','ticker-gate-audit','information-hierarchy','research-candidate-map'];
const priorityCount = list(opportunityPackets.priorityQueue).length;
const packetCount = list(opportunityPackets.packets).length;
const opportunityValid = html.includes('id="opportunity"') && !html.includes('Opportunity Evidence Engine') && (priorityCount >= 3 || (packetCount > 0 && (html.includes('Research queue') || html.includes('Research only'))));
const constitutionValid = JSON.stringify(constitution.canonicalSections) === JSON.stringify(expected) && (constitution.legacyHomepageSectionsRemoved === true || constitution.restoredHoldingsSurface || constitution.healthFields);
const checks = [
  pass('Canonical four-section homepage', JSON.stringify(sectionIds) === JSON.stringify(expected), `Sections: ${sectionIds.join(' > ')}`),
  pass('No legacy top-level homepage sections', !forbidden.some(id => html.includes(`id="${id}"`)), 'Legacy telemetry modules are absent from homepage composition.'),
  pass('Brief', html.includes('id="brief"') && html.includes('Portfolio concentration') && state.finalOutput && state.marketRegime, `Posture ${state.finalOutput?.marketPosture || state.marketRegime?.posture}; compressed synthesis present.`),
  pass('Holdings', html.includes('id="holdings"') && list(state.holdings).every(h => html.includes(`>${h.ticker}<`)) && list(reactions.all).length === list(state.holdings).length, `${list(state.holdings).length} holdings with reaction/state data integrated into one matrix.`),
  pass('Opportunity', opportunityValid, `${priorityCount} priority opportunity packets; ${packetCount} total packets. Empty priority queue is valid when evidence gate blocks candidates and research state is visible.`),
  pass('Market Tape', html.includes('id="market-tape"') && list(state.liveMarket).length > 0 && list(state.liveRatesCredit).length > 0, `${list(state.liveMarket).length} tape rows; ${list(state.liveRatesCredit).length} rates/credit rows.`),
  pass('Backend telemetry preserved', nativeEvents.status === 'ACTIVE' && tickerGateAudit.status === 'ACTIVE' && opportunityPackets.status === 'ACTIVE', `Native events ${list(nativeEvents.events).length}; ticker gates ${tickerGateAudit.counts?.tickers}; packets ${packetCount}.`),
  pass('Public static sync', publicHtml.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"') && JSON.stringify([...publicHtml.matchAll(/<section\s+id="([^"]+)"/g)].map(m=>m[1])) === JSON.stringify(expected), 'public/index.html uses same four-section constitution.'),
  pass('Operational score threshold', score.score >= score.target && score.target >= 80, `CROS ${score.score}/${score.target}; stage ${score.stage}.`),
  pass('Homepage constitution output', constitutionValid, 'Canonical homepage constitution JSON written for ChatGPT/OpenClaw pickup.'),
  pass('No empty operational placeholders', !['No opportunity queue loaded', 'No research candidates today', 'No live reaction state loaded', 'No holdings loaded'].some(t => html.includes(t)), 'No critical empty-state placeholder present.')
];
const failed = checks.filter(c => c.status !== 'PASS');
const output = {
  generatedAt: new Date().toISOString(),
  runMode: 'DEGRADED_LOCAL_COMPRESSED_HOME_AUDIT_NO_WEB_SEARCH',
  status: failed.length ? 'FAIL' : 'PASS',
  summary: failed.length ? `${failed.length} compressed homepage checks failed.` : 'Capital Radar homepage is compressed to the canonical four-section operating surface; backend intelligence remains preserved in JSON outputs.',
  sections: checks,
  degradedCaveat: 'web_search unavailable; Opportunity section is local/public/internal research only.',
  nextRequiredForHighTrust: ['document evidence store', 'outcome ledger', 'source reliability learning loop']
};
for (const rel of ['outputs/operational-section-audit.json', 'public/outputs/operational-section-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ status: output.status, summary: output.summary, checks: checks.map(c => `${c.status}: ${c.label}`) }, null, 2));
if (failed.length) process.exit(1);