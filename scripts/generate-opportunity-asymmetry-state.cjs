const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel, fallback = null) { const file = path.join(root, rel); try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; } }
function write(rel, data) { const file = path.join(root, rel); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n'); }
function list(value) { return Array.isArray(value) ? value : []; }
function text(value, fallback = '') { const s = String(value ?? '').trim(); return s || fallback; }
function score(value, fallback = 0) { const n = Number(value); return Number.isFinite(n) ? n : fallback; }
function words(value) { return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(w => w.length > 3); }
function overlaps(a, b) { const set = new Set(words(a)); return words(b).some(w => set.has(w)); }
function uniq(rows) { return Array.from(new Set(rows.filter(Boolean))); }
function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }

const now = new Date().toISOString();
const cycleId = now.slice(0, 13).replace(/[-:T]/g, '');
const landscape = read('outputs/market-landscape-state.json', {});
const evidenceMap = read('outputs/institutional-evidence-map.json', { evidence: [] });
const orientation = read('outputs/market-orientation-map.json', { themes: [] });
const packetsState = read('outputs/opportunity-evidence-packets.json', { packets: [], priorityQueue: [] });
const previous = read('outputs/opportunity-asymmetry-state.json', { opportunity_clusters: [] });
const secCollection = read('outputs/sec-company-evidence-collection.json', { records: [] });
const zoneState = read('outputs/holding-zone-state.json', { zones: [] });
const bandState = read('outputs/opportunity-band-state.json', { bands: [] });
const managerIndex = read('outputs/manager-filing-index.json', { records: [] });
const marketStructure = read('outputs/market-structure-collection.json', { records: [] });

const evidenceIds = new Set(list(evidenceMap.evidence).map(ev => ev.id));
const previousClusters = Object.fromEntries(list(previous.opportunity_clusters).map(c => [c.macro_theme, c]));
const landscapeEvidence = list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id));
const focusThemes = list(landscape.market_focus).map(focus => ({ macro_theme: text(focus.theme, 'unmapped macro theme'), summary: text(focus.summary, 'No macro-theme summary available.'), evidence_ids: list(focus.evidence_ids).filter(id => evidenceIds.has(id)) }));
const orientationThemes = list(orientation.themes);
const packets = list(packetsState.packets).length ? list(packetsState.packets) : list(packetsState.priorityQueue);
const secByTicker = Object.fromEntries(list(secCollection.records).reduce((acc, r) => { const t = String(r.ticker || '').toUpperCase(); if (!t) return acc; acc.set(t, [...(acc.get(t) || []), r]); return acc; }, new Map()));
const holdingZoneByTicker = Object.fromEntries(list(zoneState.zones).map(z => [String(z.ticker || '').toUpperCase(), z]));
const bandByTicker = Object.fromEntries(list(bandState.bands).map(b => [String(b.ticker || '').toUpperCase(), b]));
const marketByTicker = Object.fromEntries(list(marketStructure.records).map(r => [String(r.symbol || '').toUpperCase(), r]));

function roleToDirection(role, lane) { const s = `${role || ''} ${lane || ''}`.toLowerCase(); if (/power|grid|electrical|data-center|infrastructure/.test(s)) return 'AI infrastructure pressure moves into power, grid, construction, and equipment bottlenecks.'; if (/nuclear|uranium|energy/.test(s)) return 'Energy scarcity and load-growth concerns create optionality in nuclear and fuel-chain expressions.'; if (/crypto|bitcoin|risk-substitution|treasury/.test(s)) return 'Digital-asset liquidity and treasury-rail shifts create beta in crypto infrastructure and balance-sheet proxies.'; if (/health|medical/.test(s)) return 'Non-correlated growth and health infrastructure may matter when macro beta is constrained.'; if (/quality|platform/.test(s)) return 'Quality platform resets may become underpriced if broad beta weakens while earnings durability holds.'; if (/ai|semiconductor/.test(s)) return 'AI center-stack exposure remains benchmarked, but asymmetry may be lower if consensus already crowds the core names.'; return 'Research candidate needs a clearer second-order macro transmission path before promotion.'; }
const TICKER_THEMES = {
  // Nuclear
  OKLO: 'Nuclear & Uranium', CCJ: 'Nuclear & Uranium',
  // Power & Grid
  NXT: 'Power & Grid Infrastructure', VRT: 'Power & Grid Infrastructure',
  ETN: 'Power & Grid Infrastructure', PWR: 'Power & Grid Infrastructure', GEV: 'Power & Grid Infrastructure',
  // AI Chip & Compute
  NVDA: 'AI Chip & Compute', AVGO: 'AI Chip & Compute', AMD: 'AI Chip & Compute', MRVL: 'AI Chip & Compute',
  // AI Software
  PLTR: 'AI Software & Enterprise Platforms',
  // Space & Defense
  RKLB: 'Space & Defense Tech', LMT: 'Space & Defense Tech', RTX: 'Space & Defense Tech',
  // Crypto
  IBIT: 'Crypto / Digital Assets', COIN: 'Crypto / Digital Assets', MSTR: 'Crypto / Digital Assets',
  // Healthcare
  HIMS: 'Healthcare & Consumer Health', TMDX: 'Healthcare & Consumer Health',
  // Attention / Social
  RDDT: 'Attention & Data Assets',
  // Quality Compounders
  GOOGL: 'Quality Compounders',
};
const THEME_META = {
  'Nuclear & Uranium': 'Nuclear power and uranium fuel supply chain as AI data-center electricity load meets grid constraints.',
  'Power & Grid Infrastructure': 'Physical infrastructure layer: grid hardware, power capacity, and electrification buildout required by AI and energy transition.',
  'AI Chip & Compute': 'Direct AI hardware stack: GPU, custom ASIC, and networking silicon demand from hyperscaler capex cycles.',
  'AI Software & Enterprise Platforms': 'Software layer capturing AI operational deployment: workflow platforms, ontologies, and enterprise AI tools.',
  'Space & Defense Tech': 'New-space infrastructure and defense-tech compounding as launch cadence, satellite demand, and defense budgets grow.',
  'Crypto / Digital Assets': 'Digital asset beta and infrastructure: Bitcoin, stablecoins, and treasury-allocation proxies.',
  'Healthcare & Consumer Health': 'Non-correlated growth in direct-to-consumer healthcare and medical infrastructure outside the AI/platform complex.',
  'Attention & Data Assets': 'Human-generated data and social attention as potentially scarce AI training and monetization inputs.',
  'Quality Compounders': 'Durable earnings compounders where valuation reset may offer cleaner margin of safety than pure AI names.',
  'Payments & Financial Infrastructure': 'Digital payment rails, network effects, and financial infrastructure with AI and stablecoin adoption tailwinds.',
};
function deriveTheme(packet) {
  const ids = landscapeEvidence;
  const t = String(packet.ticker || '').toUpperCase();
  const knownTheme = TICKER_THEMES[t];
  if (knownTheme) return { macro_theme: knownTheme, macro_theme_summary: THEME_META[knownTheme] || knownTheme, evidence_ids: ids };
  // Fall back to why/name keyword matching
  const combined = `${packet.whyInteresting || ''} ${packet.name || ''}`.toLowerCase();
  if (/nuclear|uranium|atomic/.test(combined)) return { macro_theme: 'Nuclear & Uranium', macro_theme_summary: THEME_META['Nuclear & Uranium'], evidence_ids: ids };
  if (/launch|rocket|satellite|spacecraft|space|defense|aerospace/.test(combined)) return { macro_theme: 'Space & Defense Tech', macro_theme_summary: THEME_META['Space & Defense Tech'], evidence_ids: ids };
  if (/organ|transplant|medical device|biotech|pharma/.test(combined)) return { macro_theme: 'Healthcare & Consumer Health', macro_theme_summary: THEME_META['Healthcare & Consumer Health'], evidence_ids: ids };
  if (/health|consumer.health|direct.to.consumer/.test(combined)) return { macro_theme: 'Healthcare & Consumer Health', macro_theme_summary: THEME_META['Healthcare & Consumer Health'], evidence_ids: ids };
  if (/bitcoin|ethereum|crypto|blockchain|digital.asset/.test(combined)) return { macro_theme: 'Crypto / Digital Assets', macro_theme_summary: THEME_META['Crypto / Digital Assets'], evidence_ids: ids };
  if (/social|conversation|reddit|attention|data.*license/.test(combined)) return { macro_theme: 'Attention & Data Assets', macro_theme_summary: THEME_META['Attention & Data Assets'], evidence_ids: ids };
  if (/gpu|accelerat|asic|chip|semiconductor|cuda/.test(combined)) return { macro_theme: 'AI Chip & Compute', macro_theme_summary: THEME_META['AI Chip & Compute'], evidence_ids: ids };
  if (/workflow|ontology|government.*ai|enterprise.*ai|operational.*deploy/.test(combined)) return { macro_theme: 'AI Software & Enterprise Platforms', macro_theme_summary: THEME_META['AI Software & Enterprise Platforms'], evidence_ids: ids };
  if (/solar|wind|grid|turbine|cooling|electrif|power/.test(combined)) return { macro_theme: 'Power & Grid Infrastructure', macro_theme_summary: THEME_META['Power & Grid Infrastructure'], evidence_ids: ids };
  if (/payment|stablecoin|fintech|transaction/.test(combined)) return { macro_theme: 'Payments & Financial Infrastructure', macro_theme_summary: THEME_META['Payments & Financial Infrastructure'], evidence_ids: ids };
  if (/quality|compounder|platform|search|cloud.*ai/.test(combined)) return { macro_theme: 'Quality Compounders', macro_theme_summary: THEME_META['Quality Compounders'], evidence_ids: ids };
  return { macro_theme: 'Research Candidates', macro_theme_summary: 'Opportunity candidates under active research — no macro theme confirmed yet.', evidence_ids: ids };
}
function tickerTheme(packet) { return deriveTheme(packet); }
function baseStatus(packet) { const stage = String(packet.opportunityStage || '').toUpperCase(); if (stage.includes('PRIORITY')) return 'priority_research'; if (stage.includes('BUILD')) return 'build_evidence_packet'; if (stage.includes('WATCH')) return 'watch_and_compare'; if (stage.includes('LOW_PRIORITY')) return 'low_priority_watch'; return 'research_only'; }
function opportunityType(packet, gate, undervaluation_score, conviction_score) { const price = text(packet.priceFrame?.priceRead, ''); const thesis = text(packet.whyInteresting, ''); if (gate.evidence_completeness_pct >= 80) return 'promotion_candidate'; if (gate.evidence_completeness_pct >= 60 && undervaluation_score >= 70 && conviction_score >= 70) return 'undervalued_exception_watch'; if (/pullback|dislocation|meaningful|undervalued|cheap|reset/i.test(price)) return 'dislocation_watch'; if (/infrastructure|power|grid|cooling|data-center/i.test(thesis)) return 'second_order_infrastructure_watch'; if (/quality|compounder|valuation/i.test(thesis)) return 'quality_reset_watch'; return baseStatus(packet); }
function normalizedBandStatus(status) { const s = String(status || '').toLowerCase(); if (s === 'entry_band') return 'inside_buy_zone'; if (s === 'near_entry_band') return 'near_buy_zone'; if (s === 'extension_band') return 'inside_trim_zone'; if (s === 'near_extension_band') return 'near_trim_zone'; if (s === 'risk_review') return 'near_stop'; if (s === 'below_exit_review') return 'below_hard_exit'; if (s === 'neutral_band') return 'neutral_hold'; return 'unmapped'; }
function zoneForTicker(ticker) { const t = String(ticker || '').toUpperCase(); const holdingZone = holdingZoneByTicker[t]; if (holdingZone) return { status: holdingZone.zone_status || 'unmapped', confidence: holdingZone.zone_confidence || 0, source: 'holding-zone-state' }; const band = bandByTicker[t]; if (band) return { status: normalizedBandStatus(band.band_status), confidence: band.band_confidence || 0, source: 'opportunity-band-state' }; return { status: 'unmapped', confidence: 0, source: 'missing' }; }
function evidenceGate(packet) { const ticker = String(packet.ticker || '').toUpperCase(); const sec = list(secByTicker[ticker]); const zone = zoneForTicker(ticker); const market = marketByTicker[ticker]; const refs = list(packet.evidenceRefs); const hasCompany = sec.length > 0 || refs.some(r => /sec|company|filing|ir/i.test(`${r.sourceId} ${r.use}`) && r.status !== 'required_not_yet_attached'); const hasZone = Boolean(zone.status && zone.status !== 'unmapped'); const hasMarket = Boolean(market && market.current_price) || refs.some(r => /price|chart|market/i.test(`${r.sourceId} ${r.use}`)); const hasInvalidation = list(packet.invalidationQuestions).length > 0; const hasRiskBudget = !list(packet.missingForPromotion).some(x => /risk budget/i.test(x)); const gates = [{ key: 'company', label: 'Company/SEC', passed: hasCompany, weight: 30 }, { key: 'zone', label: 'Zone', passed: hasZone, weight: 25 }, { key: 'market', label: 'Market', passed: hasMarket, weight: 15 }, { key: 'invalidation', label: 'Invalidation', passed: hasInvalidation, weight: 20 }, { key: 'risk_budget', label: 'Risk budget', passed: hasRiskBudget, weight: 10 }]; const evidence_completeness_pct = gates.reduce((sum, g) => sum + (g.passed ? g.weight : 0), 0); const missing = gates.filter(g => !g.passed).map(g => g.label); return { gates, evidence_completeness_pct, missing, sec_record_count: sec.length, zone_status: zone.status, zone_confidence: zone.confidence, zone_source: zone.source, market_structure: hasMarket ? 'available' : 'missing', manager_filing_records: list(managerIndex.records).length }; }
function underValueScore(packet, gate) { const price = text(packet.priceFrame?.priceRead, ''); let s = 30; if (/undervalued|cheap|discount/i.test(price)) s += 35; if (/pullback|dislocation|reset|meaningful/i.test(price)) s += 25; if (/near_buy|inside_buy/i.test(gate.zone_status)) s += 25; if (/trim/i.test(gate.zone_status)) s -= 25; return clamp(s); }
function convictionScore(packet, gate) { let s = score(packet.opportunityScore); if (gate.sec_record_count > 0) s += 10; if (gate.evidence_completeness_pct >= 60) s += 10; if (list(packet.invalidationQuestions).length) s += 5; return clamp(s); }
function promotionStatus(gate, undervaluation_score, conviction_score) { if (gate.evidence_completeness_pct >= 80) return 'promotion_review'; if (gate.evidence_completeness_pct >= 60 && undervaluation_score >= 70 && conviction_score >= 70) return 'exception_review'; if (gate.evidence_completeness_pct >= 60) return 'build_evidence_packet'; return 'watch_and_collect'; }

const clusterMap = new Map();
for (const packet of packets) { if (!packet || !packet.ticker) continue; const theme = tickerTheme(packet); const key = theme.macro_theme; if (!clusterMap.has(key)) clusterMap.set(key, { macro_theme: key, macro_theme_summary: theme.macro_theme_summary || theme.summary || key, second_order_direction: null, candidate_tickers: [], missing_evidence: [], evidence_ids: Array.from(new Set([...theme.evidence_ids, ...landscapeEvidence])).filter(id => evidenceIds.has(id)), confidence: 0.55, changed_since_last_cycle: false }); const cluster = clusterMap.get(key); cluster.second_order_direction ||= roleToDirection(packet.portfolioRole, packet.lane); const gate = evidenceGate(packet); const undervaluation_score = underValueScore(packet, gate); const conviction_score = convictionScore(packet, gate); const candidate = { ticker: packet.ticker, name: packet.name || packet.ticker, opportunity_type: opportunityType(packet, gate, undervaluation_score, conviction_score), opportunity_score: score(packet.opportunityScore), evidence_completeness_pct: gate.evidence_completeness_pct, evidence_required_pct: gate.evidence_completeness_pct >= 60 && undervaluation_score >= 70 && conviction_score >= 70 ? 60 : 80, undervaluation_score, conviction_score, promotion_status: promotionStatus(gate, undervaluation_score, conviction_score), evidence_gates: gate.gates, sec_record_count: gate.sec_record_count, institutional_filing_records: gate.manager_filing_records, zone_status: gate.zone_status, zone_confidence: gate.zone_confidence, zone_source: gate.zone_source, market_structure: gate.market_structure, next_gate: gate.missing[0] || 'human review', missing_evidence: gate.missing.length ? gate.missing : ['human review'], evidence_ids: cluster.evidence_ids, action_permission: packet.actionPermission || 'RESEARCH_ONLY_NO_BUY_PERMISSION', action_guardrail: packet.actionPermission || 'RESEARCH_ONLY_NO_BUY_PERMISSION', assigned_agent_task: text(packet.nextResearchTask || packet.assignedAgentTask, `Attach primary evidence, price-zone, invalidation, and risk-budget support for ${packet.ticker}.`), why_this_ticker: text(packet.whyInteresting, 'Ticker rationale pending.'), what_is_underpriced: text(packet.priceFrame?.priceRead || packet.whatIsUnderpriced, 'Price zone not yet established — research only.'), current_price: packet.priceFrame?.currentPrice ?? null, price_read: text(packet.priceFrame?.priceRead, ''), provisional_zone: text(packet.priceFrame?.provisionalZone, ''), why_now: list(packet.whyNow).slice(0, 2), required_sources: uniq(list(packet.evidenceRefs).map(ref => ref.sourceId || ref.use).filter(Boolean)), invalidation_questions: list(packet.invalidationQuestions) };
  cluster.candidate_tickers.push(candidate); cluster.missing_evidence.push(...candidate.missing_evidence); cluster.confidence = Math.max(cluster.confidence, Math.min(0.9, 0.25 + candidate.evidence_completeness_pct / 160 + candidate.opportunity_score / 350)); }
const clusters = Array.from(clusterMap.values()).map(cluster => { cluster.candidate_tickers.sort((a, b) => (b.evidence_completeness_pct - a.evidence_completeness_pct) || (b.undervaluation_score - a.undervaluation_score) || (b.opportunity_score - a.opportunity_score)); cluster.missing_evidence = uniq(cluster.missing_evidence).slice(0, 8); const prev = previousClusters[cluster.macro_theme]; cluster.changed_since_last_cycle = !prev || JSON.stringify(prev.candidate_tickers?.map(x => `${x.ticker}:${x.promotion_status}:${x.opportunity_score}:${x.evidence_completeness_pct}:${x.zone_status}`)) !== JSON.stringify(cluster.candidate_tickers.map(x => `${x.ticker}:${x.promotion_status}:${x.opportunity_score}:${x.evidence_completeness_pct}:${x.zone_status}`)); return cluster; }).sort((a, b) => Math.max(...b.candidate_tickers.map(x => x.evidence_completeness_pct), 0) - Math.max(...a.candidate_tickers.map(x => x.evidence_completeness_pct), 0));
const all = clusters.flatMap(c => c.candidate_tickers);
const output = { as_of: now, cycle_id: cycleId, landscape_cycle_id: landscape.cycle_id || null, purpose: 'Opportunity engine uses numeric evidence gates. Normal promotion requires evidence >=80. Evidence 60-79 is only passable for high-conviction undervaluation exceptions.', opportunity_clusters: clusters, summary: { clusters: clusters.length, candidates: all.length, promotion_review: all.filter(x => x.promotion_status === 'promotion_review').length, exception_review: all.filter(x => x.promotion_status === 'exception_review').length, build_evidence_packet: all.filter(x => x.promotion_status === 'build_evidence_packet').length, watch_and_collect: all.filter(x => x.promotion_status === 'watch_and_collect').length, average_evidence_completeness_pct: all.length ? Number((all.reduce((s, x) => s + x.evidence_completeness_pct, 0) / all.length).toFixed(1)) : 0, average_undervaluation_score: all.length ? Number((all.reduce((s, x) => s + x.undervaluation_score, 0) / all.length).toFixed(1)) : 0, changed_since_last_cycle: clusters.filter(c => c.changed_since_last_cycle).length }, render_permission: clusters.length > 0 && clusters.every(c => c.macro_theme && c.second_order_direction && c.evidence_ids.length && c.candidate_tickers.every(t => t.ticker && t.promotion_status && Number.isFinite(t.evidence_completeness_pct) && Number.isFinite(t.undervaluation_score))) };
write('outputs/opportunity-asymmetry-state.json', output);
write('public/outputs/opportunity-asymmetry-state.json', output);
console.log(`generated opportunity asymmetry state: ${output.summary.clusters} clusters, ${output.summary.candidates} candidates, avg evidence=${output.summary.average_evidence_completeness_pct}% render_permission=${output.render_permission}`);