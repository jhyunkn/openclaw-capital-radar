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
function text(value, fallback = '') {
  const s = String(value ?? '').trim();
  return s || fallback;
}
function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}
function includesAny(haystack, needles) {
  const h = String(haystack || '').toLowerCase();
  return needles.some(n => h.includes(String(n).toLowerCase()));
}

const generatedAt = new Date().toISOString();
const cycleId = generatedAt.slice(0, 13).replace(/[-:T]/g, '');
const portfolio = read('outputs/portfolio-decision-state.json', []);
const landscape = read('outputs/market-landscape-state.json', {});
const evidenceMap = read('outputs/institutional-evidence-map.json', { evidence: [] });
const orientation = read('outputs/market-orientation-map.json', { themes: [] });
const previous = read('outputs/portfolio-translation-state.json', { holdings: [] });

const evidenceIds = new Set(list(evidenceMap.evidence).map(ev => ev.id));
const macroThemes = list(landscape.market_focus).map(item => ({
  theme: text(item.theme, 'unmapped macro theme'),
  summary: text(item.summary),
  evidence_ids: list(item.evidence_ids).filter(id => evidenceIds.has(id))
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
      evidence_ids: focus?.evidence_ids?.length ? focus.evidence_ids : list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id))
    };
  }

  const search = `${row.thesisStatus || ''} ${row.nextEvidenceRequired || ''} ${row.addZone || ''}`;
  const focus = macroThemes.find(item => includesAny(search, item.theme.split(/\s+/).filter(w => w.length > 3)));
  return {
    linked_macro_theme: focus?.theme || macroThemes[0]?.theme || 'macro linkage requires research mapping',
    theme_summary: focus?.summary || macroThemes[0]?.summary || 'No explicit macro theme link found yet.',
    evidence_ids: focus?.evidence_ids?.length ? focus.evidence_ids : list(landscape.directional_thesis?.evidence_ids).filter(id => evidenceIds.has(id))
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
  if (String(row.decisionPermission || '').includes('EXIT') || day >= 7) return 'high';
  if (String(row.decisionPermission || '').includes('TRIM') || day >= 5 || list(row.ruleBreaches).length) return 'elevated';
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

const holdings = list(portfolio).map(row => {
  const theme = themeForTicker(row.ticker, row);
  const current = {
    ticker: row.ticker,
    linked_macro_theme: theme.linked_macro_theme,
    macro_theme_summary: theme.theme_summary,
    exposure_state: exposureState(row),
    rule_permission: permissionLabel(row.decisionPermission),
    raw_permission: row.decisionPermission,
    risk_state: riskState(row),
    portfolio_weight_pct: num(row.portfolioWeightPct),
    price: num(row.price),
    day_change_pct: num(row.dayChangePct),
    next_evidence: [
      text(row.nextEvidenceRequired, 'Refresh price, valuation, thesis evidence, and source confidence.'),
      ...(theme.evidence_ids.length ? [] : ['Add explicit macro-theme evidence link before promotion.'])
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
      rule_breaches: list(row.ruleBreaches),
      conflicts: []
    },
    changed_since_last_cycle: false
  };
  const prev = previousByTicker[current.ticker];
  current.changed_since_last_cycle = !prev || prev.exposure_state !== current.exposure_state || prev.rule_permission !== current.rule_permission || prev.linked_macro_theme !== current.linked_macro_theme || JSON.stringify(prev.data_truth?.rule_breaches || []) !== JSON.stringify(current.data_truth.rule_breaches);
  return current;
});

const translation = {
  as_of: generatedAt,
  cycle_id: cycleId,
  purpose: 'Translate market landscape into ticker-level portfolio exposure, permission, next evidence, invalidation, and data-truth state.',
  landscape_cycle_id: landscape.cycle_id || null,
  holdings,
  summary: {
    supported: holdings.filter(h => h.exposure_state === 'supported').length,
    constrained: holdings.filter(h => h.exposure_state === 'constrained').length,
    vulnerable: holdings.filter(h => h.exposure_state === 'vulnerable').length,
    evidence_backed: holdings.filter(h => h.data_truth.evidence_backed).length,
    changed_since_last_cycle: holdings.filter(h => h.changed_since_last_cycle).length
  },
  render_permission: holdings.length > 0 && holdings.every(h => h.ticker && h.linked_macro_theme && h.rule_permission && h.risk_state && h.next_evidence.length && h.invalidation.length && h.data_truth)
};

write('outputs/portfolio-translation-state.json', translation);
write('public/outputs/portfolio-translation-state.json', translation);
console.log(`generated portfolio translation state: ${holdings.length} holdings, render_permission=${translation.render_permission}`);
