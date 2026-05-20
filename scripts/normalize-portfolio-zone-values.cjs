const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targets = [
  path.join(root, 'outputs', 'portfolio-translation-state.json'),
  path.join(root, 'public', 'outputs', 'portfolio-translation-state.json')
];

const n = value => Number.isFinite(Number(value)) ? Number(value) : null;
const round = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : null;
const pctDistance = (from, to) => n(from) && n(to) ? round(((n(to) - n(from)) / n(from)) * 100, 2) : null;
const midpoint = (a, b) => n(a) !== null && n(b) !== null ? round((n(a) + n(b)) / 2, 2) : null;

function zoneStatus(map) {
  const c = n(map.current_price);
  const hard = n(map.hard_exit_review);
  const stop = n(map.stop_review);
  const buyLow = n(map.buy_zone_low);
  const buyHigh = n(map.buy_zone_high);
  const trimLow = n(map.trim_zone_low);
  const trimHigh = n(map.trim_zone_high);
  if (![c, hard, stop, buyLow, buyHigh, trimLow, trimHigh].every(Number.isFinite)) return 'unmapped';
  if (c <= hard) return 'below_hard_exit';
  if (c <= stop) return 'below_stop';
  if ((c - stop) / c <= 0.03) return 'near_stop';
  if (c >= buyLow && c <= buyHigh) return 'inside_buy_zone';
  if (c > buyHigh && (c - buyHigh) / c <= 0.03) return 'near_buy_zone';
  if (c >= trimLow && c <= trimHigh) return 'inside_trim_zone';
  if (c < trimLow && (trimLow - c) / c <= 0.03) return 'near_trim_zone';
  return 'neutral_hold';
}

function fillMap(holding) {
  const map = { ...(holding.price_decision_map || {}) };
  const current = n(map.current_price ?? holding.price);
  if (!current) return map;

  const hasSourceZones = [map.buy_zone_low, map.buy_zone_high, map.trim_zone_low, map.trim_zone_high, map.stop_review, map.hard_exit_review, map.target_resistance].some(value => n(value) !== null);
  const highRisk = ['high', 'elevated'].includes(String(holding.risk_state || '').toLowerCase()) || /trim|exit/i.test(String(holding.rule_permission || ''));
  const conservative = String(holding.exposure_state || '') !== 'supported' || highRisk;

  const factors = conservative
    ? { buyLow: 0.86, buyHigh: 0.92, trimLow: 1.08, trimHigh: 1.16, target: 1.18, stop: 0.90, hard: 0.84, rangeLow: 0.94, rangeHigh: 1.04, accLow: 0.97, accHigh: 1.01 }
    : { buyLow: 0.90, buyHigh: 0.96, trimLow: 1.12, trimHigh: 1.22, target: 1.25, stop: 0.88, hard: 0.80, rangeLow: 0.95, rangeHigh: 1.05, accLow: 0.98, accHigh: 1.02 };

  map.current_price = current;
  map.buy_zone_low = n(map.buy_zone_low) ?? round(current * factors.buyLow, 2);
  map.buy_zone_high = n(map.buy_zone_high) ?? round(current * factors.buyHigh, 2);
  map.buy_zone_mid = n(map.buy_zone_mid) || midpoint(map.buy_zone_low, map.buy_zone_high);
  map.trim_zone_low = n(map.trim_zone_low) ?? round(current * factors.trimLow, 2);
  map.trim_zone_high = n(map.trim_zone_high) ?? round(current * factors.trimHigh, 2);
  map.trim_zone_mid = n(map.trim_zone_mid) || midpoint(map.trim_zone_low, map.trim_zone_high);
  map.stop_review = n(map.stop_review) ?? round(current * factors.stop, 2);
  map.hard_exit_review = n(map.hard_exit_review) ?? round(current * factors.hard, 2);
  map.target_resistance = n(map.target_resistance) ?? round(current * factors.target, 2);
  map.upside_to_target_pct = n(map.upside_to_target_pct) ?? pctDistance(current, map.target_resistance);
  map.upside_to_trim_low_pct = n(map.upside_to_trim_low_pct) ?? pctDistance(current, map.trim_zone_low);
  map.downside_to_buy_mid_pct = n(map.downside_to_buy_mid_pct) ?? pctDistance(current, map.buy_zone_mid);
  map.downside_to_stop_pct = n(map.downside_to_stop_pct) ?? pctDistance(current, map.stop_review);
  map.downside_to_hard_exit_pct = n(map.downside_to_hard_exit_pct) ?? pctDistance(current, map.hard_exit_review);
  map.recent_range_low = n(map.recent_range_low) ?? round(current * factors.rangeLow, 2);
  map.recent_range_high = n(map.recent_range_high) ?? round(current * factors.rangeHigh, 2);
  map.recent_accumulation_proxy_low = n(map.recent_accumulation_proxy_low) ?? round(current * factors.accLow, 2);
  map.recent_accumulation_proxy_high = n(map.recent_accumulation_proxy_high) ?? round(current * factors.accHigh, 2);
  map.institutional_accumulation_status = map.institutional_accumulation_status || 'proxy_only_not_actual_institutional_cost_basis';
  map.zone_method = hasSourceZones ? 'source_zone_levels_partial' : 'fallback_model_from_current_price';
  map.zone_status = zoneStatus(map);
  return map;
}

for (const file of targets) {
  if (!fs.existsSync(file)) continue;
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  state.holdings = (state.holdings || []).map(holding => {
    const priceMap = fillMap(holding);
    return {
      ...holding,
      price_decision_map: priceMap,
      sizing_posture: priceMap.zone_status === 'inside_buy_zone' || priceMap.zone_status === 'near_buy_zone'
        ? 'inside_buy_zone_add_review'
        : holding.sizing_posture
    };
  });
  const counts = state.holdings.reduce((acc, h) => {
    const status = h.price_decision_map?.zone_status || 'unmapped';
    acc[status] = (acc[status] || 0) + 1;
    return acc;
  }, {});
  state.zone_summary = {
    buy_zone: (counts.inside_buy_zone || 0) + (counts.near_buy_zone || 0),
    hold_zone: counts.neutral_hold || 0,
    trim_zone: (counts.inside_trim_zone || 0) + (counts.near_trim_zone || 0),
    risk_zone: (counts.near_stop || 0) + (counts.below_stop || 0) + (counts.below_hard_exit || 0),
    unmapped: counts.unmapped || 0,
    counts
  };
  state.summary = {
    ...(state.summary || {}),
    add_eligible: state.zone_summary.buy_zone,
    zone_buy: state.zone_summary.buy_zone,
    zone_hold: state.zone_summary.hold_zone,
    zone_trim: state.zone_summary.trim_zone,
    zone_risk: state.zone_summary.risk_zone,
    zone_unmapped: state.zone_summary.unmapped
  };
  fs.writeFileSync(file, JSON.stringify(state, null, 2) + '\n');
  console.log(`normalized portfolio zones: ${path.relative(root, file)} buy=${state.zone_summary.buy_zone} hold=${state.zone_summary.hold_zone} trim=${state.zone_summary.trim_zone} risk=${state.zone_summary.risk_zone} unmapped=${state.zone_summary.unmapped}`);
}
