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
function includesAny(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  return needles.some(n => h.includes(String(n).toLowerCase()));
}
function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, Math.round(n))); }

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
  return clamp(score);
}
function sizingPosture(row, exposure, risk) {
  const weight = num(row.portfolioWeightPct ?? row.weight) ?? 0;
  if (exposure === 'vulnerable' || risk === 'high') return 'reduce_or_freeze_until_invalidation_review';
  if (exposure === 'constrained' || risk === 'elevated') return 'no_adds_hold_or_trim_review';
  if (exposure === 'supported' && weight < 3) return 'starter_add_only_at_ruled_zone';
  if (exposure === 'supported' && weight <= 8) return 'hold_add_only_if_trigger_confirms';
  if (exposure === 'supported') return 'hold_do_not_concentrate_without_fresh_evidence';
  return 'watch_only';
}
function actionProtocol(row, exposure, risk) {
  const permission = permissionLabel(row.decisionPermission);
  const protocol = [];
  if (permission === 'add_allowed_at_ruled_zone') protocol.push('Add only inside pre-defined add zone and only if macro theme remains supported.');
  if (permission === 'hold_verify') protocol.push('Hold, verify thesis evidence, and wait for next catalyst or price-zone confirmation.');
  if (permission === 'watch_only') protocol.push('No new capital. Resolve missing evidence before any promotion.');
  if (permission === 'trim_watch') protocol.push('Prepare trim review. Check whether move is thesis-confirming or risk-expanding.');
  if (permission === 'exit_review') protocol.push('Run exit review. Do not average down without invalidation reversal.');
  if (risk === 'high') protocol.push('Escalate risk review before any exposure increase.');
  if (exposure === 'vulnerable') protocol.push('Treat as vulnerable exposure until macro support, price structure, and evidence improve.');
  return protocol;
}
function concentrationState(row) {
  const weight = num(row.portfolioWeightPct ?? row.weight) ?? 0;
  if (weight >= 20) return 'concentration_high';
  if (weight >= 12) return 'concentration_elevated';
  if (weight >= 5) return 'position_material';
  if (weight > 0) return 'position_small';
  return 'no_weight_or_tracking_only';
}
function thesisBridge(row, theme) {
  return `This position is judged through ${theme.linked_macro_theme}: ${theme.theme_summary}`;
}

const holdings = list(portfolio).map(row => {
  const theme = themeForTicker(row.ticker, row);
  const exposure = exposureState(row);
  const risk = riskState(row);
  const current = {
    ticker: row.ticker,
    linked_macro_theme: theme.linked_macro_theme,
    macro_theme_summary: theme.theme_summary,
    thesis_bridge: thesisBridge(row, theme),
    exposure_state: exposure,
    exposure_reason: `${exposure} because permission is ${permissionLabel(row.decisionPermission)}, risk is ${risk}, data freshness is ${text(row.dataFreshness, 'unknown')}, and macro evidence link is ${theme.evidence_ids.length ? 'present' : 'missing'}.`,
    rule_permission: permissionLabel(row.decisionPermission),
    raw_permission: row.decisionPermission,
    risk_state: risk,
    concentration_state: concentrationState(row),
    sizing_posture: sizingPosture(row, exposure, risk),
    holding_strength_score: holdingStrengthScore(row, theme),
    thesis_quality_score: thesisQuality(row, theme),
    portfolio_weight_pct: num(row.portfolioWeightPct ?? row.weight),
    price: num(row.price),
    day_change_pct: num(row.dayChangePct),
    action_protocol: actionProtocol(row, exposure, risk),
    next_evidence: [
      text(row.nextEvidenceRequired, 'Refresh price, valuation, thesis evidence, and source confidence.'),
      ...(theme.evidence_ids.length ? [] : ['Add explicit macro-theme evidence link before promotion.']),
      ...(text(row.addZone).length > 10 ? [] : ['Define add zone before any increase.'])
    ],
    invalidation: [
      text(row.thesisInvalidation, 'Explicit invalidation evidence required before capital action.'),
      text(row.exitTrigger, 'Exit review if thesis invalidation or source trust breach occurs.')
    ].filter(Boolean),
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
    changed_since_last_cycle: false
  };
  const prev = previousByTicker[current.ticker];
  current.changed_since_last_cycle = !prev || prev.exposure_state !== current.exposure_state || prev.rule_permission !== current.rule_permission || prev.linked_macro_theme !== current.linked_macro_theme || prev.sizing_posture !== current.sizing_posture || prev.holding_strength_score !== current.holding_strength_score || JSON.stringify(prev.data_truth?.rule_breaches || []) !== JSON.stringify(current.data_truth.rule_breaches);
  return current;
});

const translation = {
  as_of: generatedAt,
  cycle_id: cycleId,
  purpose: 'Translate market landscape into ticker-level portfolio exposure, permission, sizing posture, next evidence, invalidation, and data-truth state.',
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
    add_eligible: holdings.filter(h => h.rule_permission === 'add_allowed_at_ruled_zone' && h.exposure_state === 'supported').length,
    no_add_or_review: holdings.filter(h => ['watch_only', 'trim_watch', 'exit_review'].includes(h.rule_permission)).length,
    average_strength_score: holdings.length ? Number((holdings.reduce((sum, h) => sum + h.holding_strength_score, 0) / holdings.length).toFixed(1)) : 0,
    changed_since_last_cycle: holdings.filter(h => h.changed_since_last_cycle).length
  },
  render_permission: holdings.length > 0 && holdings.every(h => h.ticker && h.linked_macro_theme && h.thesis_bridge && h.exposure_state && h.exposure_reason && h.rule_permission && h.risk_state && h.sizing_posture && h.action_protocol.length && h.next_evidence.length && h.invalidation.length && h.data_truth)
};

write('outputs/portfolio-translation-state.json', translation);
write('public/outputs/portfolio-translation-state.json', translation);
console.log(`generated portfolio translation state: ${holdings.length} holdings, render_permission=${translation.render_permission}`);
