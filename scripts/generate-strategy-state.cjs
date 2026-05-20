const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel, fallback = null) {
  const file = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function write(rel, data) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}
function list(value) { return Array.isArray(value) ? value : []; }
function text(value, fallback = '') { const s = String(value ?? '').trim(); return s || fallback; }
function uniq(rows) { return Array.from(new Set(rows.filter(Boolean))); }
function pct(n, d) { return d ? n / d : 0; }

const now = new Date().toISOString();
const cycleId = now.slice(0, 13).replace(/[-:T]/g, '');
const landscape = read('outputs/market-landscape-state.json', {});
const evidenceMap = read('outputs/institutional-evidence-map.json', { evidence: [] });
const portfolio = read('outputs/portfolio-translation-state.json', { holdings: [], summary: {} });
const opportunity = read('outputs/opportunity-asymmetry-state.json', { opportunity_clusters: [], summary: {} });
const truth = read('outputs/data-truth-state.json', {});
const previous = read('outputs/strategy-state.json', null);

const evidenceIds = new Set(list(evidenceMap.evidence).map(ev => ev.id));
const landscapeEvidence = list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id));
const dataBlocked = list(truth.blockedSources).length > 0 || truth.homepageSafeToRender === false;
const staleCount = list(truth.staleSources).length;
const holdings = list(portfolio.holdings);
const clusters = list(opportunity.opportunity_clusters);
const supported = holdings.filter(h => h.exposure_state === 'supported').length;
const constrained = holdings.filter(h => h.exposure_state === 'constrained').length;
const vulnerable = holdings.filter(h => h.exposure_state === 'vulnerable').length;
const totalHoldings = holdings.length;
const priorityCandidates = clusters.flatMap(c => list(c.candidate_tickers).filter(t => t.promotion_status === 'priority_research').map(t => ({ ...t, macro_theme: c.macro_theme, second_order_direction: c.second_order_direction })));
const buildCandidates = clusters.flatMap(c => list(c.candidate_tickers).filter(t => t.promotion_status === 'build_evidence_packet').map(t => ({ ...t, macro_theme: c.macro_theme, second_order_direction: c.second_order_direction })));

function overallPosture() {
  if (dataBlocked) return 'degraded_observation_only';
  if (vulnerable > 0 && pct(vulnerable, totalHoldings) >= 0.25) return 'defensive_review';
  if (supported > constrained + vulnerable && priorityCandidates.length) return 'selective_risk_on';
  if (supported > 0 && constrained >= supported) return 'constructive_but_constrained';
  if (supported > 0) return 'selective_hold_verify';
  return 'watch_only';
}
function capitalAction(posture) {
  if (posture === 'degraded_observation_only') return 'no_new_capital_until_data_truth_recovers';
  if (posture === 'defensive_review') return 'protect_capital_review_vulnerable_exposures';
  if (posture === 'selective_risk_on') return 'starter_positions_only_after_individual_triggers';
  if (posture === 'constructive_but_constrained') return 'hold_core_watch_new_adds';
  if (posture === 'selective_hold_verify') return 'hold_verify_prepare_watchlist';
  return 'watch_only_no_adds';
}
function exposureGuidance(posture) {
  return {
    cash: posture.includes('degraded') || posture.includes('defensive') ? 'maintain_or_raise_dry_powder' : 'maintain_dry_powder_for_confirmed_setups',
    core_equity: supported > 0 ? 'hold_supported_exposures_verify_against_macro_theme' : 'no_clear_support_yet',
    speculative_growth: constrained + vulnerable > supported ? 'constrained_watch_only' : 'selective_only_after_evidence_and_price_trigger',
    crypto_beta: 'requires liquidity_confirmation_and_defined_invalidation',
    ai_infrastructure: clusters.some(c => /ai|power|grid|infrastructure/i.test(c.macro_theme + ' ' + c.second_order_direction)) ? 'research_second_order_beneficiaries' : 'monitor_for_macro_theme_confirmation'
  };
}
function highestConvictionThemes() {
  const fromLandscape = list(landscape.market_focus).slice(0, 4).map(theme => ({
    theme: text(theme.theme, 'macro theme'),
    action: 'use_as_macro_direction_for_holdings_and_opportunity_translation',
    evidence_ids: list(theme.evidence_ids).filter(id => evidenceIds.has(id)),
    confidence: theme.confidence ?? 0.55
  }));
  const fromOpp = clusters.slice(0, 3).map(cluster => ({
    theme: cluster.macro_theme,
    action: `research second-order direction: ${cluster.second_order_direction}`,
    evidence_ids: list(cluster.evidence_ids).filter(id => evidenceIds.has(id)),
    confidence: cluster.confidence ?? 0.55
  }));
  const merged = [...fromLandscape, ...fromOpp];
  const seen = new Set();
  return merged.filter(item => {
    const key = item.theme.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 5);
}
function blockedActions(posture) {
  const rows = [];
  if (dataBlocked) rows.push({ action: 'normal homepage interpretation and new capital deployment', reason: 'data truth failed or blocked sources are present' });
  if (staleCount) rows.push({ action: 'increase exposure based on stale inputs', reason: `${staleCount} stale source(s) require refresh or degraded rendering` });
  if (vulnerable) rows.push({ action: 'add to vulnerable holdings', reason: `${vulnerable} holding(s) classified as vulnerable` });
  rows.push({ action: 'buy from opportunity asymmetry artifact alone', reason: 'Opportunity state is research permission only; it cannot authorize buy/add decisions.' });
  if (!priorityCandidates.length) rows.push({ action: 'promote opportunity candidates without further evidence', reason: 'No priority-research candidate is sufficiently promoted by current evidence.' });
  return rows;
}
function nextBestQuestions() {
  const questions = [];
  const topTheme = list(landscape.market_focus)[0]?.theme;
  if (topTheme) questions.push(`What primary-source evidence most strengthens or weakens the ${topTheme} thesis?`);
  const constrainedHolding = holdings.find(h => h.exposure_state === 'constrained' || h.exposure_state === 'vulnerable');
  if (constrainedHolding) questions.push(`What evidence would move ${constrainedHolding.ticker} from ${constrainedHolding.exposure_state} to supported, or force trim/exit review?`);
  const topCandidate = priorityCandidates[0] || buildCandidates[0];
  if (topCandidate) questions.push(`What is the valuation zone, invalidation level, and primary-source evidence packet for ${topCandidate.ticker}?`);
  questions.push('Are rates, credit, volatility, liquidity, BTC, oil/energy, and breadth confirming or contradicting the current landscape?');
  return uniq(questions).slice(0, 5);
}

const posture = overallPosture();
const strategy = {
  as_of: now,
  cycle_id: cycleId,
  landscape_cycle_id: landscape.cycle_id || null,
  portfolio_cycle_id: portfolio.cycle_id || null,
  opportunity_cycle_id: opportunity.cycle_id || null,
  purpose: 'Top-level decision posture synthesized from market landscape, portfolio exposure translation, opportunity asymmetry, and data truth.',
  overall_posture: posture,
  capital_action: capitalAction(posture),
  exposure_guidance: exposureGuidance(posture),
  highest_conviction_themes: highestConvictionThemes(),
  blocked_actions: blockedActions(posture),
  next_best_questions: nextBestQuestions(),
  decision_summary: {
    landscape_thesis: text(landscape.directional_thesis?.base_case, 'Landscape thesis unavailable.'),
    supported_holdings: supported,
    constrained_holdings: constrained,
    vulnerable_holdings: vulnerable,
    opportunity_clusters: clusters.length,
    priority_research_candidates: priorityCandidates.length,
    data_truth: dataBlocked ? 'blocked_or_degraded' : staleCount ? 'usable_with_stale_inputs' : 'usable'
  },
  evidence_ids: uniq([...landscapeEvidence, ...highestConvictionThemes().flatMap(t => list(t.evidence_ids))]).filter(id => evidenceIds.has(id)),
  changed_since_last_cycle: false,
  render_permission: true
};
strategy.changed_since_last_cycle = !previous || previous.overall_posture !== strategy.overall_posture || previous.capital_action !== strategy.capital_action || JSON.stringify(previous.blocked_actions || []) !== JSON.stringify(strategy.blocked_actions) || JSON.stringify(previous.highest_conviction_themes?.map(t => t.theme) || []) !== JSON.stringify(strategy.highest_conviction_themes.map(t => t.theme));
strategy.render_permission = Boolean(strategy.overall_posture && strategy.capital_action && Object.keys(strategy.exposure_guidance).length && strategy.highest_conviction_themes.length && strategy.blocked_actions.length && strategy.next_best_questions.length && strategy.evidence_ids.length);

write('outputs/strategy-state.json', strategy);
write('public/outputs/strategy-state.json', strategy);
console.log(`generated strategy state: posture=${strategy.overall_posture}, capital_action=${strategy.capital_action}, render_permission=${strategy.render_permission}`);
