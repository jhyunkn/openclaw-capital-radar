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
function num(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function round(value, digits = 2) { const n = Number(value); return Number.isFinite(n) ? Number(n.toFixed(digits)) : null; }
function pctDistance(from, to) { const a = num(from); const b = num(to); return a && b ? round(((b - a) / a) * 100, 2) : null; }
function midpoint(low, high) { const a = num(low); const b = num(high); return Number.isFinite(a) && Number.isFinite(b) ? round((a + b) / 2, 2) : null; }
function includesAny(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  return needles.some(n => h.includes(String(n).toLowerCase()));
}
function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }
function quantile(values, q) {
  const nums = values.map(num).filter(Number.isFinite).sort((a, b) => a - b);
  if (!nums.length) return null;
  const pos = (nums.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (nums[base + 1] !== undefined) return round(nums[base] + rest * (nums[base + 1] - nums[base]), 2);
  return round(nums[base], 2);
}

const generatedAt = new Date().toISOString();
const cycleId = generatedAt.slice(0, 13).replace(/[-:T]/g, '');
const portfolio = read('outputs/portfolio-decision-state.json', []);
const landscape = read('outputs/market-landscape-state.json', {});
const evidenceMap = read('outputs/institutional-evidence-map.json', { evidence: [] });
const orientation = read('outputs/market-orientation-map.json', { themes: [] });
const strategy = read('outputs/strategy-state.json', {});
const previous = read('outputs/portfolio-translation-state.json', { holdings: [] });

const evidenceIds = new Set(list(evidenceMap.evidence).map(ev => ev.id));
const macroThemes = list(landscape.market_focus).map(item => ({
  theme: text(item.theme, 'unmapped macro theme'),
  summary: text(item.summary),
  evidence_ids: list(item.evidence_ids).filter(id => evidenceIds.has(id)),
  confidence: num(item.confidence) ?? 0.55
}));
const orientationThemes = list(orientation.themes);
const previousByTicker = Object.fromEntries(list(previous.holdings).map(row => [row.ticker, row]));

function themeForTicker(ticker, row) {
  const t = String(ticker || '').toUpperCase();
  const direct = orientationThemes.find(theme => list(theme.tickers).some(item => String(item.ticker || item).toUpperCase() === t));
  if (direct) {
    const focus = macroThemes.find(item => includesAny(`${direct.title} ${direct.id} ${list(direct.layers).join(' ')}`, item.theme.split(/\s+/).filter(w => w.length > 3)));
    return {
      linked_macro_theme: focus?.theme || direct.title || direct.id || 'theme mapped from orientation',
      theme_summary: focus?.summary || text(direct.directionalBias || direct.phase, 'Mapped from market-orientation theme pressure.'),
      evidence_ids: focus?.evidence_ids?.length ? focus.evidence_ids : list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id)),
      macro_confidence: focus?.confidence ?? 0.58
    };
  }
  const search = `${row.thesisStatus || ''} ${row.nextEvidenceRequired || ''} ${row.addZone || ''}`;
  const focus = macroThemes.find(item => includesAny(search, item.theme.split(/\s+/).filter(w => w.length > 3)));
  return {
    linked_macro_theme: focus?.theme || macroThemes[0]?.theme || 'macro linkage requires research mapping',
    theme_summary: focus?.summary || macroThemes[0]?.summary || 'No explicit macro theme link found yet.',
    evidence_ids: focus?.evidence_ids?.length ? focus.evidence_ids : list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id)),
    macro_confidence: focus?.confidence ?? 0.45
  };
}
function exposureState(row) {
  const permission = String(row.decisionPermission || '').toUpperCase();
  const breaches = list(row.ruleBreaches).join(' ').toLowerCase();
  const freshness = String(row.dataFreshness || '').toLowerCase();
  const confidence = String(row.sourceConfidence || '').toLowerCase();
  if (permission.includes('EXIT') || permission.includes('TRIM') || breaches.includes('trim') || breaches.includes('exit')) return 'vulnerable';
  if (permission.includes('NO_ADD') || permission.includes('VERIFY') || freshness === 'stale' || freshness === 'missing' || confidence === 'missing') return 'constrained';
  if (permission.includes('ADD') || permission.includes('HOLD')) return 'supported';
  return 'constrained';
}
function riskState(row) {
  const day = Math.abs(num(row.dayChangePct) ?? 0);
  const weight = Math.abs(num(row.portfolioWeightPct ?? row.weight) ?? 0);
  if (String(row.decisionPermission || '').includes('EXIT') || day >= 7 || weight >= 20) return 'high';
  if (String(row.decisionPermission || '').includes('TRIM') || day >= 5 || weight >= 12 || list(row.ruleBreaches).length) return 'elevated';
  if (String(row.decisionPermission || '').includes('NO_ADD') || String(row.decisionPermission || '').includes('VERIFY')) return 'watch';
  return 'normal';
}
function permissionLabel(permission) {
  const p = String(permission || '').toUpperCase();
  if (p.includes('ADD')) return 'add_allowed_at_ruled_zone';
  if (p.includes('NO_ADD')) return 'watch_only';
  if (p.includes('TRIM')) return 'trim_watch';
  if (p.includes('EXIT')) return 'exit_review';
  return 'hold_verify';
}
function thesisQuality(row, theme) {
  let score = 0;
  if (theme.evidence_ids.length) score += 25;
  if (text(row.thesisStatus).length > 8) score += 15;
  if (text(row.thesisInvalidation).length > 20) score += 20;
  if (text(row.nextEvidenceRequired).length > 20) score += 15;
  if (text(row.addZone).length > 20) score += 10;
  if (String(row.sourceConfidence || '').toLowerCase().includes('high')) score += 10;
  if (String(row.dataFreshness || '').toLowerCase() === 'fresh') score += 5;
  return clamp(score);
}
function holdingStrengthScore(row, theme) {
  let score = 45;
  const exposure = exposureState(row);
  const risk = riskState(row);
  if (exposure === 'supported') score += 20;
  if (exposure === 'constrained') score -= 5;
  if (exposure === 'vulnerable') score -= 20;
  if (risk === 'normal') score += 10;
  if (risk === 'watch') score -= 3;
  if (risk === 'elevated') score -= 10;
  if (risk === 'high') score -= 20;
  if (theme.evidence_ids.length) score += 10;
  if (String(row.dataFreshness || '').toLowerCase() === 'fresh') score += 5;
  if (list(row.ruleBreaches).length) score -= Math.min(20, list(row.ruleBreaches).length * 7);
  // XBRL fundamentals bonus/penalty
  const xbrl = row.xbrl_fundamentals || null;
  if (xbrl) {
    const growth = xbrl.revenue_growth_pct;
    const fcf    = xbrl.fcf_usd_millions;
    const gm     = xbrl.gross_margin_pct;
    const dil    = xbrl.dilution_flag;
    if (typeof growth === 'number' && growth > 15)  score += 8;
    else if (typeof growth === 'number' && growth > 5) score += 4;
    else if (typeof growth === 'number' && growth < 0) score -= 6;
    if (typeof fcf === 'number' && fcf > 0) score += 6;
    else if (typeof fcf === 'number' && fcf < 0) score -= 8;
    if (typeof gm === 'number' && gm > 50) score += 5;
    if (dil === 'elevated') score -= 5;
    if (dil === 'low') score += 3;
  }
  return clamp(score);
}
function priceDecisionMap(row) {
  const chart = row.analysisChart || {};
  const zones = chart.zones || {};
  const current = num(row.price ?? row.livePrice ?? chart.current);
  const buyLow = num(zones.buy?.low);
  const buyHigh = num(zones.buy?.high);
  const buyMid = midpoint(buyLow, buyHigh);
  const trimLow = num(zones.trim?.low);
  const trimHigh = num(zones.trim?.high);
  const trimMid = midpoint(trimLow, trimHigh);
  const stop = num(zones.stop?.value);
  const hardExit = num(zones.hardExit?.value);
  const target = num(zones.target?.value);
  const spark = list(row.sparkline).map(num).filter(Number.isFinite);
  const proxyLow = quantile(spark, 0.25);
  const proxyHigh = quantile(spark, 0.5);
  return {
    current_price: current,
    buy_zone_low: buyLow,
    buy_zone_high: buyHigh,
    buy_zone_mid: buyMid,
    trim_zone_low: trimLow,
    trim_zone_high: trimHigh,
    trim_zone_mid: trimMid,
    stop_review: stop,
    hard_exit_review: hardExit,
    target_resistance: target,
    upside_to_target_pct: pctDistance(current, target),
    upside_to_trim_low_pct: pctDistance(current, trimLow),
    downside_to_buy_mid_pct: pctDistance(current, buyMid),
    downside_to_stop_pct: pctDistance(current, stop),
    downside_to_hard_exit_pct: pctDistance(current, hardExit),
    recent_range_low: spark.length ? round(Math.min(...spark), 2) : null,
    recent_range_high: spark.length ? round(Math.max(...spark), 2) : null,
    recent_accumulation_proxy_low: proxyLow,
    recent_accumulation_proxy_high: proxyHigh,
    institutional_accumulation_status: 'proxy_only_not_actual_institutional_cost_basis',
    institutional_accumulation_method: 'Current proxy uses recent price distribution from sparkline. True institutional basis requires volume profile, anchored VWAP, 13F windows, or block/flow data.',
    operational_read: text(chart.operationalRead, 'numeric decision map pending')
  };
}
function sizingPosture(row, exposure, risk) {
  const map = priceDecisionMap(row);
  if (exposure === 'vulnerable' || risk === 'high') return 'reduce_or_freeze_until_invalidation_review';
  if (map.current_price && map.buy_zone_low && map.buy_zone_high && map.current_price >= map.buy_zone_low && map.current_price <= map.buy_zone_high && exposure === 'supported') return 'inside_buy_zone_add_review';
  if (exposure === 'constrained' || risk === 'elevated') return 'no_adds_hold_or_trim_review';
  if (exposure === 'supported') return 'hold_add_only_if_trigger_confirms';
  return 'watch_only';
}
function concentrationState(row) {
  const weight = num(row.portfolioWeightPct ?? row.weight) ?? 0;
  if (weight >= 20) return 'concentration_high';
  if (weight >= 12) return 'concentration_elevated';
  if (weight >= 5) return 'position_material';
  if (weight > 0) return 'position_small';
  return 'no_weight_or_tracking_only';
}
function thesisBridge(row, theme) { return `${theme.linked_macro_theme}: ${theme.theme_summary}`; }
function numericAction(row, exposure, risk) {
  const map = priceDecisionMap(row);
  if (exposure === 'vulnerable' || risk === 'high') return `Freeze/review. Watch stop ${map.stop_review ?? 'n/a'} and hard-exit ${map.hard_exit_review ?? 'n/a'}.`;
  if (map.current_price && map.buy_zone_low && map.buy_zone_high && map.current_price >= map.buy_zone_low && map.current_price <= map.buy_zone_high) return `Inside buy zone ${map.buy_zone_low}-${map.buy_zone_high}; add review requires evidence confirmation.`;
  if (map.current_price && map.trim_zone_low && map.current_price >= map.trim_zone_low) return `Inside/near trim zone ${map.trim_zone_low}-${map.trim_zone_high}; protect gains.`;
  return `Wait. Buy zone ${map.buy_zone_low ?? 'n/a'}-${map.buy_zone_high ?? 'n/a'}; trim zone ${map.trim_zone_low ?? 'n/a'}-${map.trim_zone_high ?? 'n/a'}; stop ${map.stop_review ?? 'n/a'}.`;
}

const holdings = list(portfolio).map(row => {
  const theme = themeForTicker(row.ticker, row);
  const exposure = exposureState(row);
  const risk = riskState(row);
  const priceMap = priceDecisionMap(row);
  const current = {
    ticker: row.ticker,
    portfolio_role: row.role || row.exposureBucket || 'role pending',
    linked_macro_theme: theme.linked_macro_theme,
    macro_theme_summary: theme.theme_summary,
    thesis_bridge: thesisBridge(row, theme),
    exposure_state: exposure,
    exposure_reason: `${exposure} because permission is ${permissionLabel(row.decisionPermission)}, risk is ${risk}, freshness is ${text(row.dataFreshness, 'unknown')}, macro evidence is ${theme.evidence_ids.length ? 'present' : 'missing'}.`,
    rule_permission: permissionLabel(row.decisionPermission),
    raw_permission: row.decisionPermission,
    risk_state: risk,
    concentration_state: concentrationState(row),
    sizing_posture: sizingPosture(row, exposure, risk),
    numeric_action: numericAction(row, exposure, risk),
    price_decision_map: priceMap,
    holding_strength_score: holdingStrengthScore(row, theme),
    thesis_quality_score: thesisQuality(row, theme),
    portfolio_weight_pct: num(row.portfolioWeightPct ?? row.weight),
    price: priceMap.current_price,
    day_change_pct: num(row.dayChangePct),
    next_decision_trigger: [
      `Add review: price ${priceMap.buy_zone_low ?? 'n/a'}-${priceMap.buy_zone_high ?? 'n/a'} plus evidence confirmation.`,
      `Trim/protect: price ${priceMap.trim_zone_low ?? 'n/a'}-${priceMap.trim_zone_high ?? 'n/a'}.`,
      `Risk review: stop ${priceMap.stop_review ?? 'n/a'}; hard-exit review ${priceMap.hard_exit_review ?? 'n/a'}.`
    ],
    invalidation: [
      text(row.thesisInvalidation, 'Explicit invalidation evidence required before capital action.'),
      `Numeric invalidation: stop/review ${priceMap.stop_review ?? 'n/a'}; hard-exit review ${priceMap.hard_exit_review ?? 'n/a'}.`
    ],
    evidence_quality: {
      status: theme.evidence_ids.length && String(row.dataFreshness || '').toLowerCase() === 'fresh' ? 'fresh_partial_model_derived' : 'needs_source_upgrade',
      evidence_backed: theme.evidence_ids.length > 0,
      source_confidence: row.sourceConfidence,
      data_freshness: row.dataFreshness,
      macro_confidence: theme.macro_confidence
    },
    data_truth: {
      evidence_backed: theme.evidence_ids.length > 0,
      evidence_ids: theme.evidence_ids,
      freshness_ok: ['fresh', 'aging'].includes(String(row.dataFreshness || '').toLowerCase()),
      data_freshness: row.dataFreshness,
      source_confidence: row.sourceConfidence,
      source_timestamp: row.sourceTimestamp,
      macro_confidence: theme.macro_confidence,
      rule_breaches: list(row.ruleBreaches),
      conflicts: []
    },
    xbrl_fundamentals: row.xbrl_fundamentals || null,
    changed_since_last_cycle: false
  };
  const prev = previousByTicker[current.ticker];
  current.changed_since_last_cycle = !prev || prev.exposure_state !== current.exposure_state || prev.rule_permission !== current.rule_permission || prev.linked_macro_theme !== current.linked_macro_theme || prev.sizing_posture !== current.sizing_posture || JSON.stringify(prev.price_decision_map) !== JSON.stringify(current.price_decision_map) || JSON.stringify(prev.data_truth?.rule_breaches || []) !== JSON.stringify(current.data_truth.rule_breaches);
  return current;
});

const translation = {
  as_of: generatedAt,
  cycle_id: cycleId,
  purpose: 'Numeric-first holding decision map: price zones, permission, risk budget, evidence quality, and invalidation.',
  landscape_cycle_id: landscape.cycle_id || null,
  strategy_cycle_id: strategy.cycle_id || null,
  holdings,
  summary: {
    supported: holdings.filter(h => h.exposure_state === 'supported').length,
    constrained: holdings.filter(h => h.exposure_state === 'constrained').length,
    vulnerable: holdings.filter(h => h.exposure_state === 'vulnerable').length,
    evidence_backed: holdings.filter(h => h.data_truth.evidence_backed).length,
    high_risk: holdings.filter(h => h.risk_state === 'high').length,
    elevated_risk: holdings.filter(h => h.risk_state === 'elevated').length,
    add_eligible: holdings.filter(h => h.sizing_posture === 'inside_buy_zone_add_review').length,
    no_add_or_review: holdings.filter(h => ['watch_only', 'trim_watch', 'exit_review'].includes(h.rule_permission) || h.exposure_state !== 'supported').length,
    average_strength_score: holdings.length ? Number((holdings.reduce((sum, h) => sum + h.holding_strength_score, 0) / holdings.length).toFixed(1)) : 0,
    changed_since_last_cycle: holdings.filter(h => h.changed_since_last_cycle).length
  },
  render_permission: holdings.length > 0 && holdings.every(h => h.ticker && h.portfolio_role && h.price_decision_map && h.rule_permission && h.risk_state && h.sizing_posture && h.next_decision_trigger.length && h.invalidation.length && h.evidence_quality)
};

write('outputs/portfolio-translation-state.json', translation);
write('public/outputs/portfolio-translation-state.json', translation);
console.log(`generated numeric-first portfolio translation state: ${holdings.length} holdings, render_permission=${translation.render_permission}`);
