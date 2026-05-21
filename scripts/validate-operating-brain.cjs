const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const outputs = path.join(root, 'outputs');
const indexPath = path.join(root, 'index.html');
const errors = [];

function readJson(name) {
  const file = path.join(outputs, name);
  if (!fs.existsSync(file)) {
    errors.push(`${name} missing`);
    return null;
  }
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { errors.push(`${name} invalid JSON: ${error.message}`); return null; }
}
function requireField(obj, field, label) {
  if (obj == null || obj[field] == null || obj[field] === '') {
    errors.push(`${label} missing ${field}`);
  }
}
function requireNonEmptyField(obj, field, label) {
  requireField(obj, field, label);
  if (obj && Array.isArray(obj[field]) && obj[field].length === 0) errors.push(`${label} missing ${field}`);
}
function noObjectLeak(value, label) {
  if (String(value).includes('[object Object]')) errors.push(`${label} leaks [object Object]`);
}

const regime = readJson('market-regime-state.json');
const portfolio = readJson('portfolio-decision-state.json');
const opportunity = readJson('opportunity-promotion-state.json');
const truth = readJson('data-truth-state.json');

['generatedAt','regimePosture','liquidityState','ratesPressure','creditPressure','volatilityState','cryptoLiquidity','aiInfrastructurePressure','macroSummary','changedSinceLastRun','reasons'].forEach(field => requireField(regime, field, 'market-regime-state'));

const permissions = new Set(['ADD_ALLOWED_AT_RULED_ZONE', 'HOLD_VERIFY', 'NO_ADD_VERIFY', 'TRIM_WATCH', 'EXIT_REVIEW']);
if (!Array.isArray(portfolio) || portfolio.length === 0) errors.push('portfolio-decision-state must be a non-empty array');
(portfolio || []).forEach((holding, index) => {
  const label = `portfolio[${holding?.ticker || index}]`;
  ['ticker','price','portfolioWeightPct','decisionPermission','ruleBreaches','addZone','trimTrigger','exitTrigger','thesisStatus','thesisInvalidation','nextEvidenceRequired','dataFreshness','sourceConfidence','sourceTimestamp','changedSinceLastRun'].forEach(field => requireField(holding, field, label));
  if (holding.dayChangePct == null && holding.dayChangeStatus !== 'unavailable_in_screenshot') errors.push(`${label} missing dayChangePct`);
  if (holding.dayChangePct != null) requireField(holding, 'dayChangePct', label);
  if (!permissions.has(holding.decisionPermission)) errors.push(`${label} has invalid decisionPermission ${holding.decisionPermission}`);
  if (!Array.isArray(holding.ruleBreaches)) errors.push(`${label} ruleBreaches must be an array`);
  noObjectLeak(holding.sourceConfidence, `${label}.sourceConfidence`);
});

const statuses = new Set(['BLOCKED', 'RESEARCH_ONLY', 'PROMOTION_REVIEW', 'PROMOTED_TO_WATCHLIST']);
if (!Array.isArray(opportunity)) errors.push('opportunity-promotion-state must be an array');
(opportunity || []).forEach((candidate, index) => {
  const label = `opportunity[${candidate?.ticker || index}]`;
  ['ticker','macroThesis','agentSelectionRationale','tickerAnalysisRead','opportunityScore','asymmetryReason','catalystHypothesis','missingEvidence','requiredSources','valuationZoneRequired','invalidationRequired','promotionStatus','assignedAgentTask','changedSinceLastRun'].forEach(field => requireField(candidate, field, label));
  if (!statuses.has(candidate.promotionStatus)) errors.push(`${label} has invalid promotionStatus ${candidate.promotionStatus}`);
  if (!Array.isArray(candidate.missingEvidence)) errors.push(`${label} missingEvidence must be an array`);
  if (!Array.isArray(candidate.requiredSources)) errors.push(`${label} requiredSources must be an array`);
});

['generatedAt','sourceMap','staleSources','blockedSources','fallbackSourcesUsed','perTickerFreshness','perMetricConfidence','homepageSafeToRender'].forEach(field => requireField(truth, field, 'data-truth-state'));
if (truth && truth.homepageSafeToRender === false) errors.push('deploy blocked: data-truth-state.homepageSafeToRender=false');

if (!fs.existsSync(indexPath)) {
  errors.push('index.html missing');
} else {
  const html = fs.readFileSync(indexPath, 'utf8');
  const sections = [
    ['Brief', /id="brief"|>Brief</i],
    ['Holdings', /id="holdings-section"|>Holdings</i],
    ['Opportunity', /id="opportunities-section"|>Opportunit/i],
    ['Market Tape', /id="market-section"|>Market tape|>Market Tape/i]
  ];
  sections.forEach(([name, regex]) => { if (!regex.test(html)) errors.push(`homepage section missing: ${name}`); });
  if (html.includes('[object Object]')) errors.push('homepage leaks [object Object]');
  if (/guaranteed|certain conviction|fake conviction/i.test(html)) errors.push('homepage exposes fake conviction language');
  if (!/dataFreshness|Data freshness|Trust|Source confidence|source confidence/i.test(html)) errors.push('homepage does not expose trust/freshness layer');
}

if (errors.length) {
  console.error('Operating brain validation failed:');
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}
console.log('Operating brain validation passed');
