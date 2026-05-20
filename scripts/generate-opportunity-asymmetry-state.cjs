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
function score(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function words(value) { return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3); }
function overlaps(a, b) { const set = new Set(words(a)); return words(b).some(w => set.has(w)); }

const now = new Date().toISOString();
const cycleId = now.slice(0, 13).replace(/[-:T]/g, '');
const landscape = read('outputs/market-landscape-state.json', {});
const evidenceMap = read('outputs/institutional-evidence-map.json', { evidence: [] });
const orientation = read('outputs/market-orientation-map.json', { themes: [] });
const packetsState = read('outputs/opportunity-evidence-packets.json', { packets: [], priorityQueue: [] });
const previous = read('outputs/opportunity-asymmetry-state.json', { opportunity_clusters: [] });

const evidenceIds = new Set(list(evidenceMap.evidence).map(ev => ev.id));
const previousClusters = Object.fromEntries(list(previous.opportunity_clusters).map(c => [c.macro_theme, c]));
const landscapeEvidence = list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id));
const focusThemes = list(landscape.market_focus).map(focus => ({
  macro_theme: text(focus.theme, 'unmapped macro theme'),
  summary: text(focus.summary, 'No macro-theme summary available.'),
  evidence_ids: list(focus.evidence_ids).filter(id => evidenceIds.has(id))
}));
const orientationThemes = list(orientation.themes);
const packets = list(packetsState.packets).length ? list(packetsState.packets) : list(packetsState.priorityQueue);

function roleToDirection(role, lane) {
  const s = `${role || ''} ${lane || ''}`.toLowerCase();
  if (/power|grid|electrical|data-center|infrastructure/.test(s)) return 'AI infrastructure pressure moves into power, grid, construction, and equipment bottlenecks.';
  if (/nuclear|uranium|energy/.test(s)) return 'Energy scarcity and load-growth concerns create optionality in nuclear and fuel-chain expressions.';
  if (/crypto|bitcoin|risk-substitution|treasury/.test(s)) return 'Digital-asset liquidity and treasury-rail shifts create beta in crypto infrastructure and balance-sheet proxies.';
  if (/health|medical/.test(s)) return 'Non-correlated growth and health infrastructure may matter when macro beta is constrained.';
  if (/quality|platform/.test(s)) return 'Quality platform resets may become underpriced if broad beta weakens while earnings durability holds.';
  if (/ai|semiconductor/.test(s)) return 'AI center-stack exposure remains benchmarked, but asymmetry may be lower if consensus already crowds the core names.';
  return 'Research candidate needs a clearer second-order macro transmission path before promotion.';
}
function tickerTheme(packet) {
  const search = `${packet.ticker} ${packet.name} ${packet.whyInteresting} ${packet.portfolioRole} ${packet.lane}`;
  const directOrientation = orientationThemes.find(theme => list(theme.tickers).some(t => String(t.ticker || t).toUpperCase() === String(packet.ticker).toUpperCase()));
  if (directOrientation) {
    const focus = focusThemes.find(f => overlaps(`${directOrientation.title} ${directOrientation.id} ${list(directOrientation.layers).join(' ')}`, f.macro_theme));
    if (focus) return focus;
  }
  const focus = focusThemes.find(f => overlaps(search, f.macro_theme) || overlaps(search, f.summary));
  return focus || focusThemes[0] || { macro_theme: 'macro direction pending', summary: 'Macro direction must be resolved before opportunity promotion.', evidence_ids: landscapeEvidence };
}
function promotionStatus(packet) {
  const stage = String(packet.opportunityStage || '').toUpperCase();
  const permission = String(packet.actionPermission || '').toUpperCase();
  if (permission.includes('BUY')) return 'blocked_no_buy_permission';
  if (stage.includes('PRIORITY')) return 'priority_research';
  if (stage.includes('BUILD')) return 'build_evidence_packet';
  if (stage.includes('WATCH')) return 'watch_and_compare';
  return 'research_only';
}
function missingEvidence(packet) {
  const missing = list(packet.missingForPromotion).concat(list(packet.confirmBeforePromotion));
  return missing.length ? missing : ['primary-source evidence', 'valuation zone', 'invalidation rule', 'risk budget'];
}
function underpricedRead(packet) {
  const role = text(packet.portfolioRole, 'unmapped opportunity role');
  const priceRead = text(packet.priceFrame?.priceRead, 'price context pending');
  return `${role}; ${priceRead}`;
}

const clusterMap = new Map();
for (const packet of packets) {
  if (!packet || !packet.ticker) continue;
  const theme = tickerTheme(packet);
  const key = theme.macro_theme;
  if (!clusterMap.has(key)) {
    clusterMap.set(key, {
      macro_theme: key,
      macro_theme_summary: theme.summary,
      second_order_direction: null,
      candidate_tickers: [],
      missing_evidence: [],
      evidence_ids: Array.from(new Set([...theme.evidence_ids, ...landscapeEvidence])).filter(id => evidenceIds.has(id)),
      confidence: 0.55,
      changed_since_last_cycle: false
    });
  }
  const cluster = clusterMap.get(key);
  const direction = roleToDirection(packet.portfolioRole, packet.lane);
  cluster.second_order_direction ||= direction;
  const candidate = {
    ticker: packet.ticker,
    name: packet.name || packet.ticker,
    why_this_ticker: text(packet.whyInteresting, 'Ticker rationale pending.'),
    what_is_underpriced: underpricedRead(packet),
    opportunity_score: score(packet.opportunityScore),
    promotion_status: promotionStatus(packet),
    assigned_agent_task: `Opportunity Asymmetry: attach primary-source evidence, valuation zone, invalidation, and risk budget for ${packet.ticker}.`,
    required_sources: list(packet.evidenceRefs).map(ref => ref.sourceId || ref.use).filter(Boolean),
    missing_evidence: missingEvidence(packet),
    invalidation_questions: list(packet.invalidationQuestions),
    evidence_ids: cluster.evidence_ids,
    action_permission: packet.actionPermission || 'RESEARCH_ONLY_NO_BUY_PERMISSION'
  };
  cluster.candidate_tickers.push(candidate);
  cluster.missing_evidence.push(...candidate.missing_evidence);
  cluster.confidence = Math.max(cluster.confidence, Math.min(0.85, 0.45 + candidate.opportunity_score / 200));
}

const clusters = Array.from(clusterMap.values()).map(cluster => {
  cluster.candidate_tickers.sort((a, b) => b.opportunity_score - a.opportunity_score);
  cluster.missing_evidence = Array.from(new Set(cluster.missing_evidence)).slice(0, 8);
  const prev = previousClusters[cluster.macro_theme];
  cluster.changed_since_last_cycle = !prev || JSON.stringify(prev.candidate_tickers?.map(x => `${x.ticker}:${x.promotion_status}:${x.opportunity_score}`)) !== JSON.stringify(cluster.candidate_tickers.map(x => `${x.ticker}:${x.promotion_status}:${x.opportunity_score}`));
  return cluster;
}).sort((a, b) => Math.max(...b.candidate_tickers.map(x => x.opportunity_score), 0) - Math.max(...a.candidate_tickers.map(x => x.opportunity_score), 0));

const output = {
  as_of: now,
  cycle_id: cycleId,
  landscape_cycle_id: landscape.cycle_id || null,
  purpose: 'Map macro direction into underpriced second-order ticker expressions with missing evidence and promotion gates.',
  opportunity_clusters: clusters,
  summary: {
    clusters: clusters.length,
    candidates: clusters.reduce((sum, c) => sum + c.candidate_tickers.length, 0),
    priority_research: clusters.reduce((sum, c) => sum + c.candidate_tickers.filter(x => x.promotion_status === 'priority_research').length, 0),
    build_evidence_packet: clusters.reduce((sum, c) => sum + c.candidate_tickers.filter(x => x.promotion_status === 'build_evidence_packet').length, 0),
    changed_since_last_cycle: clusters.filter(c => c.changed_since_last_cycle).length
  },
  render_permission: clusters.length > 0 && clusters.every(c => c.macro_theme && c.second_order_direction && c.evidence_ids.length && c.candidate_tickers.every(t => t.ticker && t.why_this_ticker && t.what_is_underpriced && t.missing_evidence.length && t.promotion_status && t.assigned_agent_task))
};

write('outputs/opportunity-asymmetry-state.json', output);
write('public/outputs/opportunity-asymmetry-state.json', output);
console.log(`generated opportunity asymmetry state: ${output.summary.clusters} clusters, ${output.summary.candidates} candidates, render_permission=${output.render_permission}`);
