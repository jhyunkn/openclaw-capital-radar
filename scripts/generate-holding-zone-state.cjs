const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const read = (rel, fb) => { try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; } };
const write = (rel, data) => { const f = path.join(root, rel); fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, JSON.stringify(data, null, 2) + '\n'); };
const arr = v => Array.isArray(v) ? v : [];
const num = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null; };
const round = (v, d = 2) => Number.isFinite(Number(v)) ? Number(Number(v).toFixed(d)) : null;
const dist = (a, b) => num(a) && num(b) ? round(((num(b) - num(a)) / num(a)) * 100, 2) : null;
const mid = (a, b) => num(a) && num(b) ? round((num(a) + num(b)) / 2, 2) : null;
function status(m) {
  const c = num(m.current_price), hard = num(m.hard_exit_review), stop = num(m.stop_review);
  const bl = num(m.buy_zone_low), bh = num(m.buy_zone_high), tl = num(m.trim_zone_low), th = num(m.trim_zone_high);
  if (![c, hard, stop, bl, bh, tl, th].every(Number.isFinite)) return 'unmapped';
  if (c <= hard) return 'below_hard_exit';
  if (c <= stop) return 'below_stop';
  if ((c - stop) / c <= 0.03) return 'near_stop';
  if (c >= bl && c <= bh) return 'inside_buy_zone';
  if (c > bh && (c - bh) / c <= 0.03) return 'near_buy_zone';
  if (c >= tl && c <= th) return 'inside_trim_zone';
  if (c < tl && (tl - c) / c <= 0.03) return 'near_trim_zone';
  return 'neutral_hold';
}
function factors(row) {
  const perm = String(row.decisionPermission || row.rule_permission || '').toUpperCase();
  const exp = String(row.exposure_state || '').toLowerCase();
  const risk = String(row.risk_state || '').toLowerCase();
  const w = Number(row.portfolioWeightPct ?? row.portfolio_weight_pct ?? 0);
  const conservative = /TRIM|EXIT|NO_ADD|WATCH/.test(perm) || exp === 'vulnerable' || risk === 'high' || risk === 'elevated' || w >= 12;
  return conservative
    ? { bl: .84, bh: .91, tl: 1.06, th: 1.14, target: 1.16, stop: .90, hard: .83, confidence: .35, method: 'permission_adjusted_proxy_conservative' }
    : { bl: .88, bh: .95, tl: 1.10, th: 1.20, target: 1.24, stop: .88, hard: .80, confidence: .42, method: 'permission_adjusted_proxy_base' };
}
const decision = arr(read('outputs/portfolio-decision-state.json', []));
const translation = read('outputs/portfolio-translation-state.json', { holdings: [] });
const byTicker = Object.fromEntries(arr(translation.holdings).map(h => [String(h.ticker || '').toUpperCase(), h]));
const asOf = new Date().toISOString();
const zones = decision.map(row => {
  const t = String(row.ticker || '').toUpperCase();
  const trans = byTicker[t] || {};
  const p = num(trans.price_decision_map?.current_price ?? trans.price ?? row.price ?? row.livePrice);
  const f = factors({ ...row, ...trans });
  const z = {
    ticker: t,
    as_of: asOf,
    current_price: p,
    buy_zone_low: p ? round(p * f.bl) : null,
    buy_zone_high: p ? round(p * f.bh) : null,
    trim_zone_low: p ? round(p * f.tl) : null,
    trim_zone_high: p ? round(p * f.th) : null,
    target_resistance: p ? round(p * f.target) : null,
    stop_review: p ? round(p * f.stop) : null,
    hard_exit_review: p ? round(p * f.hard) : null,
    recent_range_low: p ? round(p * .94) : null,
    recent_range_high: p ? round(p * 1.04) : null,
    accumulation_proxy_low: p ? round(p * .97) : null,
    accumulation_proxy_high: p ? round(p * 1.01) : null,
    zone_method: f.method,
    zone_confidence: f.confidence,
    source_quality: 'proxy_v1',
    source_fields: ['portfolio-decision-state.price', 'decisionPermission', 'portfolioWeightPct']
  };
  z.buy_zone_mid = mid(z.buy_zone_low, z.buy_zone_high);
  z.trim_zone_mid = mid(z.trim_zone_low, z.trim_zone_high);
  z.distance_to_buy_mid_pct = dist(p, z.buy_zone_mid);
  z.distance_to_trim_low_pct = dist(p, z.trim_zone_low);
  z.distance_to_target_pct = dist(p, z.target_resistance);
  z.distance_to_stop_pct = dist(p, z.stop_review);
  z.distance_to_hard_exit_pct = dist(p, z.hard_exit_review);
  z.zone_status = status(z);
  return z;
});
const counts = zones.reduce((a, z) => ((a[z.zone_status] = (a[z.zone_status] || 0) + 1), a), {});
const state = { as_of: asOf, artifact: 'holding-zone-state', method_level: 'proxy_v1', zones, summary: { buy_zone: (counts.inside_buy_zone || 0) + (counts.near_buy_zone || 0), hold_zone: counts.neutral_hold || 0, trim_zone: (counts.inside_trim_zone || 0) + (counts.near_trim_zone || 0), risk_zone: (counts.near_stop || 0) + (counts.below_stop || 0) + (counts.below_hard_exit || 0), unmapped: counts.unmapped || 0, counts }, render_permission: zones.length > 0 && zones.every(z => z.ticker && z.current_price && z.zone_status !== 'unmapped') };
write('outputs/holding-zone-state.json', state);
write('public/outputs/holding-zone-state.json', state);
console.log(`holding-zone-state: buy=${state.summary.buy_zone} hold=${state.summary.hold_zone} trim=${state.summary.trim_zone} risk=${state.summary.risk_zone} unmapped=${state.summary.unmapped}`);
