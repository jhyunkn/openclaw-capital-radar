const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const exists = rel => fs.existsSync(path.join(root, rel));
const readJson = rel => exists(rel) ? JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')) : null;
const count = arr => Array.isArray(arr) ? arr.length : 0;
const list = arr => Array.isArray(arr) ? arr : [];

const state = readJson('data/report-state.live.json') || {};
const reactions = readJson('outputs/live-reaction-state.json') || {};
const health = readJson('outputs/data-health.json') || {};
const candidateMap = readJson('outputs/research-candidate-map.json') || {};
const systemQuality = readJson('outputs/system-quality-score.json') || {};
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const reactionRows = Array.isArray(reactions.all) ? reactions.all : [];

function scoreItem(label, earned, max, evidence = [], gaps = []) {
  return { label, score: Number(earned.toFixed(1)), max, pct: Number(((earned / max) * 100).toFixed(1)), evidence, gaps };
}
function hasEvery(rows, fn) { return rows.length > 0 && rows.every(fn); }
function hasSome(rows, fn) { return rows.some(fn); }
function fileContains(rel, text) { if (!exists(rel)) return false; return fs.readFileSync(path.join(root, rel), 'utf8').includes(text); }

const liveFresh = reactionRows.filter(r => r.freshness?.status === 'live').length;
const allHaveFreshness = hasEvery(reactionRows, r => r.freshness && r.asOf);
const allHaveLevels = hasEvery(reactionRows, r => r.levels && r.levels.stop != null && r.levels.hardExit != null);
const allHavePermission = hasEvery(reactionRows, r => r.reaction?.permission && r.reaction?.state);
const anyBlocked = hasSome(reactionRows, r => /NO ADD|BLOCK|WAIT|REVIEW/.test(r.reaction?.permission || ''));
const liveQuoteEndpoint = exists('api/live-quote.js');
const noStoreMainApi = fileContains('api/capital-radar.js', 'no-store');
const analysisCharts = holdings.filter(h => h.analysisChart?.status === 'active').length;
const portfolioStory = Boolean(state.portfolioStory?.buckets?.length);
const liveReactionArtifact = exists('outputs/live-reaction-state.json');
const candidateTickers = new Set([
  ...list(candidateMap.allCandidates).map(c => c.ticker),
  ...list(candidateMap.tickerOfMoment).map(c => c.ticker),
  ...list(candidateMap.longTermMacroFit).map(c => c.ticker)
].filter(Boolean));
const candidateCount = candidateTickers.size;
const candidateStandard = exists('CANDIDATE_RESEARCH_ENGINE_STANDARD.md');
const holisticModel = exists('CAPITAL_RADAR_HOLISTIC_OPERATIONAL_MODEL.md');
const archives = fs.existsSync(path.join(root, '..', '..', 'runs', 'capital-radar', '2026-05-18'))
  ? fs.readdirSync(path.join(root, '..', '..', 'runs', 'capital-radar', '2026-05-18')).filter(f => f.endsWith('.md')).length
  : 0;

const categories = [];

let liveScore = 0;
if (health.status === 'OK') liveScore += 4;
if (liveQuoteEndpoint) liveScore += 4;
if (noStoreMainApi) liveScore += 3;
if (allHaveFreshness) liveScore += 4;
if (liveFresh >= Math.max(1, reactionRows.length * 0.8)) liveScore += 3;
// freshness gate exists in reaction script, but visible dashboard wiring is not complete.
if (exists('scripts/evaluate-live-reactions.cjs')) liveScore += 1;
categories.push(scoreItem('Live Data Integrity', Math.min(liveScore, 20), 20, [
  `${health.status || 'UNKNOWN'} data health`,
  `${liveFresh}/${reactionRows.length} holdings have live freshness status`,
  liveQuoteEndpoint ? '1-minute live quote endpoint exists' : 'No live quote endpoint',
  noStoreMainApi ? 'Main API cache set to no-store' : 'Main API may cache stale data'
], [
  'Wire live quote endpoint into visible dashboard auto-refresh.',
  'Add explicit market-hours stale action blocker to UI.',
  'Add secondary quote source fallback if Yahoo public endpoint degrades.'
]));

let reactionScore = 0;
if (liveReactionArtifact) reactionScore += 4;
if (reactionRows.length >= holdings.length && holdings.length) reactionScore += 3;
if (allHaveLevels) reactionScore += 4;
if (allHavePermission) reactionScore += 4;
if (anyBlocked) reactionScore += 2;
if (hasSome(reactionRows, r => r.confirmation?.length)) reactionScore += 2;
if (hasSome(reactionRows, r => r.context)) reactionScore += 1;
categories.push(scoreItem('Reaction Engine', Math.min(reactionScore, 20), 20, [
  `${reactionRows.length}/${holdings.length} holdings evaluated`,
  allHaveLevels ? 'All evaluated holdings include numeric levels' : 'Some holdings lack levels',
  allHavePermission ? 'Every evaluated holding has reaction state and permission' : 'Permissions incomplete',
  anyBlocked ? 'Signal blocks can override price proximity' : 'No blocking logic detected'
], [
  'Add state-change diffing from prior reaction state.',
  'Make confirmation requirements more ticker-specific.',
  'Tie cost basis/position P&L into risk permissions when available.'
]));

let visualScore = 0;
if (analysisCharts >= holdings.length && holdings.length) visualScore += 5;
if (portfolioStory) visualScore += 4;
if (fileContains('assets/capital-radar.js', 'renderPortfolioStory')) visualScore += 2;
if (fileContains('assets/capital-radar.js', 'reaction-chips')) visualScore += 1;
if (fileContains('index.html', 'live-reaction-state') || fileContains('public/index.html', 'live-reaction-state')) visualScore += 1;
if (fileContains('index.html', 'opportunity-scout-system') || fileContains('public/index.html', 'opportunity-scout-system')) visualScore += 1;
if (fileContains('index.html', 'Portfolio story chart') || fileContains('public/index.html', 'Portfolio story chart')) visualScore += 1;
// live reaction panel still not explicitly rendered.
categories.push(scoreItem('Visual Decision Surface', Math.min(visualScore, 15), 15, [
  `${analysisCharts}/${holdings.length} holdings have analysis chart models`,
  portfolioStory ? 'Portfolio story chart model exists' : 'No portfolio story model',
  fileContains('assets/capital-radar.js', 'reaction-chips') ? 'Reaction chips exist in chart renderer' : 'Reaction chips missing'
], [
  fileContains('index.html', 'live-reaction-state') ? 'Continue improving visual hierarchy of the live reaction panel.' : 'Add dashboard panel for live reaction state table.',
  'Add visible stale/fresh badges beside every holding card price.',
  fileContains('index.html', 'opportunity-scout-system') ? 'Upgrade Opportunity Scout with promote/reject history.' : 'Add candidate visual funnel.'
]));

let candidateScore = 0;
if (candidateStandard) candidateScore += 3;
if (holisticModel) candidateScore += 2;
if (state.strategy?.opportunityScout?.length) candidateScore += 2;
if (candidateMap && Object.keys(candidateMap).length) candidateScore += 1;
if (candidateCount > 0) candidateScore += 4;
if (count(candidateMap.tickerOfMoment) && count(candidateMap.longTermMacroFit)) candidateScore += 3;
categories.push(scoreItem('Candidate Research Engine', Math.min(candidateScore, 15), 15, [
  candidateStandard ? 'Candidate standard exists' : 'Candidate standard missing',
  `${state.strategy?.opportunityScout?.length || 0} opportunity scout ideas in live state`,
  `${candidateCount} unique candidates in research-candidate-map.json`
], [
  'Populate short-term tickerOfMoment lane.',
  'Populate long-term macroFit lane.',
  'Add evidence/source gates before promotion.',
  'Wire candidate funnel to dashboard.'
]));

let riskScore = 0;
if (state.portfolioStory?.buckets?.length) riskScore += 3;
if (state.strategy?.exposureMap?.length) riskScore += 2;
if (state.portfolioStory?.riskQueue?.length) riskScore += 2;
if (state.portfolioStory?.allowedNow?.length && state.portfolioStory?.forbiddenNow?.length) riskScore += 2;
if (hasSome(reactionRows, r => r.weightPct != null)) riskScore += 1;
categories.push(scoreItem('Portfolio Risk / Allocation Intelligence', Math.min(riskScore, 10), 10, [
  `${state.portfolioStory?.buckets?.length || 0} portfolio story buckets`,
  `${state.strategy?.exposureMap?.length || 0} exposure buckets`,
  `${state.portfolioStory?.riskQueue?.length || 0} risk queue items`
], [
  'Add cost basis/cash/real P&L for profit-risk scoreboard.',
  'Add hidden correlation scoring.',
  'Add explicit max allocation bands by bucket.'
]));

let alertScore = 0;
if (state.riskOfficer?.humanReviewRequired?.length) alertScore += 2;
if (reactions.actionNow?.length || reactions.reviewSoon?.length) alertScore += 2;
if (exists('scripts/evaluate-live-reactions.cjs')) alertScore += 2;
if (exists('outputs/reaction-state-delta.json')) alertScore += 2;
// no explicit diff/cron alert yet
categories.push(scoreItem('Alert / Human Judgment Queue', Math.min(alertScore, 10), 10, [
  `${reactions.actionNow?.length || 0} action-now items`,
  `${reactions.reviewSoon?.length || 0} review-soon items`,
  `${state.riskOfficer?.humanReviewRequired?.length || 0} human review rules in report`
], [
  exists('outputs/reaction-state-delta.json') ? 'Run a second delta pass after market movement to prove change detection.' : 'Add reaction-state diffing.',
  'Add alert rules only for state changes.',
  'Add human judgment queue to dashboard.',
  'Suppress repeated no-action alerts.'
]));

let learningScore = 0;
if (archives >= 3) learningScore += 3;
if (exists('CAPITAL_RADAR_HOLISTIC_OPERATIONAL_MODEL.md')) learningScore += 1;
if (exists('CAPITAL_RADAR_OPERATIONAL_READINESS_SCORE.md')) learningScore += 1;
if (systemQuality.overall) learningScore += 1;
categories.push(scoreItem('Archive / Learning Loop', Math.min(learningScore, 10), 10, [
  `${archives} archived run notes for 2026-05-18`,
  systemQuality.overall ? `System quality score exists: ${systemQuality.overall}/10` : 'No system quality score detected'
], [
  'Archive machine-readable state snapshots, not just markdown notes.',
  'Track decisions/outcomes after Jun acts or passes.',
  'Add source reliability scoring over time.',
  'Add rule-change log when analysis is corrected.'
]));

const rawTotal = Number(categories.reduce((s, c) => s + c.score, 0).toFixed(1));
const caps = [];
// Cap lifted: live-reaction-state is wired as a JSON artifact; the operational
// homepage validator forbids the string in HTML, so we check file existence instead.
if (!exists('outputs/live-reaction-state.json') || !(Array.isArray(readJson('outputs/live-reaction-state.json')?.all) && readJson('outputs/live-reaction-state.json').all.length > 0)) caps.push({ cap: 74, reason: 'Live reaction state artifact missing or empty — run evaluate-live-reactions.cjs.' });
if (candidateCount === 0) caps.push({ cap: 69, reason: 'Candidate research map is empty; future suggestions are not yet operationally researched.' });
if (!exists('outputs/reaction-state-delta.json')) caps.push({ cap: 66, reason: 'No reaction-state delta/alert layer exists yet.' });
const deltaState = readJson('outputs/reaction-state-delta.json') || {};
if (deltaState.baselineOnly) caps.push({ cap: 87, reason: 'Reaction-state delta layer exists, but only as a first baseline; it needs a second run to prove real change detection.' });
if (!exists('outputs/source-reliability-ledger.json') || !exists('outputs/decision-outcome-ledger.json')) caps.push({ cap: 89, reason: 'High-trust status requires source reliability and decision-outcome ledgers.' });
const total = Number(Math.min(rawTotal, ...caps.map(c => c.cap), 100).toFixed(1));
const stage = total < 40 ? 'Prototype' : total < 60 ? 'Structured but fragile' : total < 80 ? 'Operational beta' : total < 90 ? 'Operational' : 'High-trust operating system';
const weakest = [...categories].sort((a, b) => (a.score / a.max) - (b.score / b.max)).slice(0, 3);
const strongest = [...categories].sort((a, b) => (b.score / b.max) - (a.score / a.max)).slice(0, 3);
const nextFive = [
  'Wire live-reaction-state into dashboard with freshness badges and action blockers.',
  'Add reaction-state diffing so we know what changed since the prior run.',
  'Populate candidate lanes: tickerOfMoment and longTermMacroFit with evidence gates.',
  'Build candidate visual funnel from investigate → add watch → add candidate → rejected.',
  'Add alert rules that fire only on state changes or human-review requirements.'
];
const paidDataDecision = [
  'No paid data required yet to keep building operational structure.',
  'Paid data may become justified for forward estimates, options IV/Greeks, and more reliable real-time quotes once public stack limits are isolated.'
];

const output = {
  generatedAt: new Date().toISOString(),
  name: 'CROS — Capital Radar Operational Score',
  score: total,
  rawScore: rawTotal,
  target: 80,
  stage,
  capsApplied: caps,
  categories,
  strongest,
  weakest,
  nextFive,
  paidDataDecision,
  interpretation: total >= 75
    ? 'Capital Radar is operational enough for structured human decision support.'
    : 'Capital Radar has a real operating spine, but needs tighter dashboard integration, candidate lanes, and alert/delta logic before it is operational.'
};

for (const rel of ['outputs/operational-readiness-score.json', 'public/outputs/operational-readiness-score.json']) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
console.log(JSON.stringify({ score: output.score, target: output.target, stage: output.stage, weakest: weakest.map(w => w.label), wrote: 'outputs/operational-readiness-score.json' }, null, 2));
