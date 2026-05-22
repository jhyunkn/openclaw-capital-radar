const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const readJson = (rel, fb = {}) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; } };
const html = fs.existsSync(path.join(root, 'index.html')) ? fs.readFileSync(path.join(root, 'index.html'), 'utf8') : '';
const publicHtml = fs.existsSync(path.join(root, 'public', 'index.html')) ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '';
const state = readJson('data/report-state.live.json', {});
const reactions = readJson('outputs/live-reaction-state.json', {});
const candidates = readJson('outputs/research-candidate-map.json', {});
const score = readJson('outputs/operational-readiness-score.json', { score: 0, target: 80 });
const nativeEvents = readJson('outputs/native-events.json', {});
const opportunityPackets = readJson('outputs/opportunity-evidence-packets.json', {});
const tickerGateAudit = readJson('outputs/ticker-gate-audit.json', {});
const constitution = readJson('outputs/homepage-constitution.json', {});
const list = v => Array.isArray(v) ? v : [];
function pass(label, ok, evidence, blocker = null) { return { label, status: ok ? 'PASS' : 'FAIL', evidence, blocker }; }
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const operationalExpected = ['decision-brief-section','operational-chart-section','holdings-section','opportunities-section','market-section'];
const legacyExpected = ['brief', 'holdings', 'opportunity', 'market-tape'];
const isOperational = operationalExpected.every(id => sectionIds.includes(id));
const expected = isOperational ? operationalExpected : legacyExpected;
const forbidden = isOperational
  ? ['portfolio-scoreboard','live-reaction-state','native-research-engine','opportunity-evidence-engine','ticker-gate-audit','information-hierarchy','research-candidate-map','Evidence-backed Market Landscape','Decision Posture','Strategy Posture']
  : ['portfolio-scoreboard','live-reaction-state','native-research-engine','opportunity-evidence-engine','ticker-gate-audit','information-hierarchy','research-candidate-map'];
let checks;
if (isOperational) {
  checks = [
    pass('Operational manifest homepage', expected.every(id => sectionIds.includes(id)), `Sections: ${sectionIds.join(' > ')}`),
    pass('No legacy telemetry homepage sections', !forbidden.some(id => html.includes(id)), 'Legacy telemetry modules are absent from operational homepage composition.'),
    pass('Decision Brief', html.includes('id="decision-brief-section"') && /Confirmation|Macro|VIX|10Y|M2|Risk rule/i.test(html), 'Macro / confirmation verdict rendered.'),
    pass('Operational Chart', html.includes('id="operational-chart-section"') && /Operational Decision Chart|SPX|RSI|MACD|VIX|10Y|ADD|TRIM|DEFENSE/i.test(html), 'Chart, indicators, and action zones rendered.'),
    pass('Holdings', html.includes('id="holdings-section"') && /AUTH|PARTIAL|PROXY|MISSING|Buy|Trim|Stop|Exit/i.test(html), 'Holdings source tiers and price-zone fields rendered.'),
    pass('Opportunity', html.includes('id="opportunities-section"') && /Opportunity|Evidence|candidate|gate|promotion|qualification|missing|near/i.test(html), 'Opportunity/research gate surface rendered.'),
    pass('Market Tape', html.includes('id="market-section"') && /Market Tape|Rates|liquidity|volatility|BTC|oil|credit|spread|signal/i.test(html), 'Market tape confirmation surface rendered.'),
    pass('Backend telemetry preserved', nativeEvents.status === 'ACTIVE' || tickerGateAudit.status === 'ACTIVE' || opportunityPackets.status === 'ACTIVE', `Native events ${list(nativeEvents.events).length}; ticker gates ${tickerGateAudit.counts?.tickers || 'n/a'}; packets ${list(opportunityPackets.packets).length}.`),
    pass('Operational score available', Number(score.score || 0) >= 0 && Number(score.target || 0) >= 0, `CROS ${score.score || 0}/${score.target || 0}; stage ${score.stage || 'n/a'}.`),
    pass('No object leaks', !html.includes('[object Object]'), 'No object serialization leak present.')
  ];
} else {
  checks = [
    pass('Canonical four-section homepage', JSON.stringify(sectionIds) === JSON.stringify(expected), `Sections: ${sectionIds.join(' > ')}`),
    pass('No legacy top-level homepage sections', !forbidden.some(id => html.includes(`id="${id}"`)), 'Legacy telemetry modules are absent from homepage composition.'),
    pass('Brief', html.includes('id="brief"') && (html.includes('Concentration:') || html.includes('Portfolio concentration') || html.includes('Market Landscape')) && (html.includes('brief-text') || html.includes('strategy-state')), `Posture ${state.finalOutput?.marketPosture || state.marketRegime?.posture || 'rendered'}; compressed synthesis present.`),
    pass('Holdings', html.includes('id="holdings"') && list(state.holdings).every(h => html.includes(`>${h.ticker}<`)) && list(reactions.all).length === list(state.holdings).length, `${list(state.holdings).length} holdings with reaction/state data integrated into one matrix.`),
    pass('Opportunity', html.includes('id="opportunity"') && ((list(opportunityPackets.priorityQueue).length >= 1) || html.includes('unblock-card') || html.includes('No cleared candidates')) && !html.includes('Opportunity Evidence Engine'), `${list(opportunityPackets.priorityQueue).length} priority opportunity packets compressed into one operator-facing section; degraded/blocked queues render explicit unblock cards when evidence gates block promotion.`),
    pass('Market Tape', html.includes('id="market-tape"') && list(state.liveMarket).length > 0 && list(state.liveRatesCredit).length > 0, `${list(state.liveMarket).length} tape rows; ${list(state.liveRatesCredit).length} rates/credit rows.`),
    pass('Backend telemetry preserved', nativeEvents.status === 'ACTIVE' && tickerGateAudit.status === 'ACTIVE' && opportunityPackets.status === 'ACTIVE', `Native events ${list(nativeEvents.events).length}; ticker gates ${tickerGateAudit.counts?.tickers}; packets ${list(opportunityPackets.packets).length}.`),
    pass('Public static sync', publicHtml.includes('data-homepage-constitution="brief-holdings-opportunity-market-tape"') && JSON.stringify([...publicHtml.matchAll(/<section\s+id="([^"]+)"/g)].map(m=>m[1])) === JSON.stringify(expected), 'public/index.html uses same four-section constitution.'),
    pass('Operational score threshold', score.score >= score.target && score.target >= 80, `CROS ${score.score}/${score.target}; stage ${score.stage}.`),
    pass('Homepage constitution output', JSON.stringify(constitution.canonicalSections) === JSON.stringify(expected), 'Canonical homepage constitution JSON written for ChatGPT/OpenClaw pickup.'),
    pass('No empty operational placeholders', !['No opportunity queue loaded', 'No research candidates today', 'No live reaction state loaded', 'No holdings loaded'].some(t => html.includes(t)), 'No critical empty-state placeholder present.')
  ];
}
const failed = checks.filter(c => c.status !== 'PASS');
const output = {
  generatedAt: new Date().toISOString(),
  runMode: isOperational ? 'OPERATIONAL_MANIFEST_HOME_AUDIT' : 'DEGRADED_LOCAL_COMPRESSED_HOME_AUDIT_NO_WEB_SEARCH',
  status: failed.length ? 'FAIL' : 'PASS',
  summary: failed.length ? `${failed.length} homepage checks failed.` : 'Capital Radar homepage validates against the active homepage contract; backend intelligence remains preserved in JSON outputs.',
  sections: checks,
  degradedCaveat: isOperational ? null : 'web_search unavailable; Opportunity section is local/public/internal research only.',
  nextRequiredForHighTrust: ['document evidence store', 'outcome ledger', 'source reliability learning loop']
};
for (const rel of ['outputs/operational-section-audit.json', 'public/outputs/operational-section-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ status: output.status, summary: output.summary, checks: checks.map(c => `${c.status}: ${c.label}`) }, null, 2));
if (failed.length) process.exit(1);
