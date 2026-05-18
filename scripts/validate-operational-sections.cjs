const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const readJson = rel => JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8'));
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const publicHtml = fs.existsSync(path.join(root, 'public', 'index.html')) ? fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8') : '';
const state = readJson('data/report-state.live.json');
const reactions = readJson('outputs/live-reaction-state.json');
const delta = readJson('outputs/reaction-state-delta.json');
const candidates = readJson('outputs/research-candidate-map.json');
const score = readJson('outputs/operational-readiness-score.json');
const nativeEvents = fs.existsSync(path.join(root, 'outputs', 'native-events.json')) ? readJson('outputs/native-events.json') : null;
const nativeAudit = fs.existsSync(path.join(root, 'outputs', 'native-research-engine-audit.json')) ? readJson('outputs/native-research-engine-audit.json') : null;
const opportunityPackets = fs.existsSync(path.join(root, 'outputs', 'opportunity-evidence-packets.json')) ? readJson('outputs/opportunity-evidence-packets.json') : null;
const opportunityAudit = fs.existsSync(path.join(root, 'outputs', 'opportunity-evidence-engine-audit.json')) ? readJson('outputs/opportunity-evidence-engine-audit.json') : null;
const list = v => Array.isArray(v) ? v : [];
const unique = rows => [...new Set(rows.filter(Boolean))];
function pass(label, ok, evidence, blocker = null) { return { label, status: ok ? 'PASS' : 'FAIL', evidence, blocker }; }
function hasSection(id) { return html.includes(`id="${id}"`); }
function hasNoEmpty(fragmentTerms) { return !fragmentTerms.some(t => html.includes(t)); }
const candidateTickers = unique([...list(candidates.allCandidates).map(c => c.ticker), ...list(candidates.tickerOfMoment).map(c => c.ticker), ...list(candidates.longTermMacroFit).map(c => c.ticker)]);
const checks = [
  pass('Run mode banner', hasSection('run-mode-banner'), 'Dashboard states degraded/local snapshot mode; no fresh web_search research claimed.'),
  pass('Executive brief', hasSection('brief') && state.finalOutput && state.marketRegime, `Posture ${state.finalOutput?.marketPosture || state.marketRegime?.posture}; macro read loaded.`),
  pass('Live reaction panel', hasSection('live-reaction-state') && list(reactions.all).length === list(state.holdings).length, `${list(reactions.all).length}/${list(state.holdings).length} holdings have price/state/permission/freshness rows.`),
  pass('Reaction delta / alerts', fs.existsSync(path.join(root, 'outputs', 'reaction-state-delta.json')) && delta.counts?.tracked === list(state.holdings).length, `${delta.counts?.tracked || 0} tracked; ${delta.counts?.alertQueue || 0} alert queue items; baselineOnly=${Boolean(delta.baselineOnly)}.`),
  pass('Portfolio scoreboard', hasSection('portfolio-scoreboard') && fs.existsSync(path.join(root, 'outputs', 'portfolio-scoreboard.json')), 'Review queue and weak-factor warnings are generated.'),
  pass('Holdings section', hasSection('holdings-section') && list(state.holdings).length > 0 && !html.includes('No holdings loaded'), `${list(state.holdings).length} holdings rendered from local live-state snapshot.`),
  pass('Opportunity Scout unified candidate system', hasSection('opportunities-section') && html.includes('Intake / discovery') && html.includes('Ticker of the moment') && html.includes('Long-term macro fit') && list(state.strategy?.opportunityScout).length > 0 && !html.includes('No research candidates today') && !html.includes('TBD-1'), `${list(state.strategy?.opportunityScout).length} intake candidates rendered; root opportunityScout mirrored for compatibility.`),
  pass('Opportunity Scout lane data', list(candidates.tickerOfMoment).length > 0 && list(candidates.longTermMacroFit).length > 0 && !hasSection('research-candidate-map'), `${list(candidates.tickerOfMoment).length} tactical and ${list(candidates.longTermMacroFit).length} long-term lane entries inside the single Opportunity Scout section; ${candidateTickers.length} unique candidates.`),
  pass('Market tape / regime', hasSection('market-section') && list(state.liveMarket).length > 0 && list(state.liveRatesCredit).length > 0, `${list(state.liveMarket).length} tape rows; ${list(state.liveRatesCredit).length} rates/credit rows from local snapshot.`),
  pass('Native Research Engine', hasSection('native-research-engine') && nativeEvents?.status === 'ACTIVE' && list(nativeEvents?.events).length >= 8 && nativeEvents?.operationalGates?.canClaimFreshNewsCausality === false, `${list(nativeEvents?.events).length} local events; immediate queue ${list(nativeEvents?.immediateResearchQueue).length}; audit ${nativeAudit?.status || 'not-run'}.`),
  pass('Opportunity Evidence Engine', hasSection('opportunity-evidence-engine') && opportunityPackets?.status === 'ACTIVE' && list(opportunityPackets?.packets).length >= 8 && list(opportunityPackets?.priorityQueue).length >= 3, `${list(opportunityPackets?.packets).length} research-only packets; priority queue ${list(opportunityPackets?.priorityQueue).length}; audit ${opportunityAudit?.status || 'not-run'}.`),
  pass('Public static sync', publicHtml.includes('live-reaction-state') && publicHtml.includes('opportunities-section') && publicHtml.includes('Intake / discovery') && publicHtml.includes('native-research-engine') && publicHtml.includes('opportunity-evidence-engine') && !publicHtml.includes('id="research-candidate-map"'), 'public/index.html includes live reaction, Native Research Engine, Opportunity Evidence Engine, and unified Opportunity Scout sections.'),
  pass('Operational score threshold', score.score >= score.target && score.target >= 80, `CROS ${score.score}/${score.target}; stage ${score.stage}.`),
  pass('No empty operational placeholders', hasNoEmpty(['No opportunity queue loaded', 'No research candidates today', 'No live reaction state loaded', 'No holdings loaded']), 'No critical section is rendering an empty-state placeholder.')
];
const failed = checks.filter(c => c.status !== 'PASS');
const output = {
  generatedAt: new Date().toISOString(),
  runMode: 'DEGRADED_LOCAL_AUDIT_NO_WEB_SEARCH',
  status: failed.length ? 'FAIL' : 'PASS',
  summary: failed.length ? `${failed.length} operational sections failed.` : 'All audited Capital Radar homepage sections are populated and operational from the local snapshot.',
  sections: checks,
  degradedCaveat: 'web_search unavailable; do not treat Opportunity Scout as fresh external/news research.',
  nextRequiredForHighTrust: ['second delta run after market movement', 'source reliability ledger', 'decision outcome ledger', 'candidate evidence packets with promotion/rejection history']
};
for (const rel of ['outputs/operational-section-audit.json', 'public/outputs/operational-section-audit.json']) {
  const p = path.join(root, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ status: output.status, summary: output.summary, checks: checks.map(c => `${c.status}: ${c.label}`) }, null, 2));
if (failed.length) process.exit(1);
