const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = (value, digits = 1) => num(value) === null ? '—' : num(value).toLocaleString(undefined, { maximumFractionDigits: digits });
const usd = value => num(value) && num(value) > 0 ? `$${fmt(value, 2)}` : '—';
const range = (a, b) => `${usd(a)}–${usd(b)}`;
const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function badge(value) {
  const s = String(value || '').toUpperCase();
  if (/HARD|BELOW|RISK|EXIT|STOP|MISSING/.test(s)) return 'bad';
  if (/TRIM|WATCH|REVIEW|VERIFY|PROXY|PARTIAL/.test(s)) return 'warn';
  if (/BUY|ADD|SUPPORTED|NORMAL|AUTH/.test(s)) return 'good';
  return '';
}

function sourceTier(zone) {
  return zone.zone_source_tier || zone.source_authority || (String(zone.zone_method || '').includes('authoritative') ? 'AUTH' : String(zone.zone_method || '').includes('proxy') ? 'PROXY' : 'PARTIAL');
}

function sourceLabel(zone) {
  return zone.zone_source_label || zone.source_authority_label || zone.source_quality || zone.zone_method || 'source pending';
}

function zoneBar(zone) {
  const values = [zone.hard_exit_review, zone.stop_review, zone.buy_zone_low, zone.buy_zone_high, zone.trim_zone_low, zone.trim_zone_high, zone.target_resistance, zone.current_price].map(num).filter(Number.isFinite);
  if (values.length < 5) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const pos = value => max === min ? 50 : clamp(((num(value) - min) / (max - min)) * 100);
  const seg = (a, b, cls) => `<span class="zone-seg ${cls}" style="left:${pos(a)}%;width:${Math.max(1, pos(b) - pos(a))}%"></span>`;
  return `<div class="zone-bar"><div class="zone-track">${seg(min, zone.hard_exit_review, 'hard')}${seg(zone.hard_exit_review, zone.stop_review, 'risk')}${seg(zone.buy_zone_low, zone.buy_zone_high, 'buy')}${seg(zone.trim_zone_low, zone.trim_zone_high, 'trim')}<span class="zone-dot" style="left:${pos(zone.current_price)}%"></span></div></div>`;
}

function buildLookup(rows, key = 'ticker') {
  return Object.fromEntries(arr(rows).map(item => [String(item[key] || '').toUpperCase(), item]));
}

function renderZoneCard(zone, translationByTicker, decisionByTicker) {
  const ticker = String(zone.ticker || '').toUpperCase();
  const holding = translationByTicker[ticker] || {};
  const decision = decisionByTicker[ticker] || {};
  const tier = sourceTier(zone);
  const soft = zone.zone_source_soft || zone.demote_visual || tier === 'PROXY' || tier === 'MISSING';
  const execution = zone.execution_permission || zone.route_permission || holding.rule_permission || decision.decisionPermission || 'permission pending';
  const permissionTone = zone.capital_allowed ? 'capital allowed' : zone.loss_minimization_required ? 'loss control' : 'blocked / verify';
  return `<article class="zone-card ${badge(zone.zone_status)} ${soft ? 'soft-source' : ''}">
    <div class="zone-head"><div><span>${esc(zone.zone_status || 'zone')}</span><h3>${esc(ticker)}</h3></div><b>${esc(tier)}</b></div>
    <p class="zone-source">${esc(sourceLabel(zone))}</p>
    ${zoneBar(zone)}
    <div class="zone-metrics">
      <div><span>Now</span><b>${usd(zone.current_price)}</b></div>
      <div><span>Buy</span><b>${range(zone.buy_zone_low, zone.buy_zone_high)}</b></div>
      <div><span>Trim</span><b>${range(zone.trim_zone_low, zone.trim_zone_high)}</b></div>
      <div><span>Stop</span><b>${usd(zone.stop_review)}</b></div>
    </div>
    <div class="permission-row ${zone.capital_allowed ? 'allow' : zone.loss_minimization_required ? 'loss' : 'block'}"><span>Permission</span><b>${esc(execution)}</b><em>${esc(permissionTone)}</em></div>
    <p class="zone-note">${esc(zone.route_action || zone.permission_blocker || holding.rule_permission || decision.decisionPermission || 'permission pending')}</p>
  </article>`;
}

function renderTrustStrip(summary = {}) {
  const counts = summary.zone_source_counts || summary.authority_counts || {};
  const rows = [
    ['Buy zone', summary.buy_zone],
    ['Add allowed', summary.capital_allowed_add_review],
    ['Loss control', summary.loss_minimization_required],
    ['Hold zone', summary.hold_zone],
    ['Trim zone', summary.trim_zone],
    ['Risk zone', summary.risk_zone],
    ['AUTH', counts.AUTH],
    ['PARTIAL', counts.PARTIAL],
    ['PROXY', counts.PROXY],
    ['MISSING', counts.MISSING],
  ];
  return rows.map(([label, value]) => `<article><span>${esc(label)}</span><b>${fmt(value, 0)}</b></article>`).join('');
}

function renderHoldingsSection({ zoneState, translation, decision }) {
  const translationByTicker = buildLookup(translation?.holdings || []);
  const decisionByTicker = buildLookup(decision || []);
  const zones = arr(zoneState.zones);
  const cards = zones.map(zone => renderZoneCard(zone, translationByTicker, decisionByTicker)).join('');
  return `<section id="holdings-section" class="panel">
    <div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Price-zone radar</h2></div><a class="button" href="outputs/holding-zone-state.json">Open artifact</a></div>
    <p class="bodyline">Terms stay familiar: Buy means a buy-zone signal. Permission shows whether capital is actually allowed, blocked for verification, or routed to loss-control.</p>
    <div class="trust-strip">${renderTrustStrip(zoneState.summary || {})}</div>
    <div class="zone-grid">${cards}</div>
  </section>`;
}

function renderHoldingsStyle() {
  return `<style id="holdings-compact-style">.zone-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:10px}.zone-card{border:1px solid var(--rule);border-radius:14px;background:rgba(251,250,246,.18);padding:14px;min-width:0;overflow:hidden}.zone-card.soft-source{opacity:.8}.zone-head{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.zone-head span,.zone-metrics span,.permission-row span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.zone-head h3{font-size:24px;margin:3px 0 0}.zone-head>b{font-size:12px;color:var(--green)}.zone-source,.zone-note{font-size:12px!important;color:var(--muted);line-height:1.35;margin:8px 0 0}.zone-bar{margin:12px 0}.zone-track{position:relative;height:10px;border:1px solid var(--rule);border-radius:999px;background:rgba(251,250,246,.3);overflow:hidden}.zone-seg{position:absolute;top:0;bottom:0}.zone-seg.hard{background:rgba(80,31,31,.62)}.zone-seg.risk{background:rgba(159,63,53,.55)}.zone-seg.buy{background:rgba(47,111,78,.58)}.zone-seg.trim{background:rgba(174,124,44,.62)}.zone-dot{position:absolute;top:50%;width:12px;height:12px;border-radius:999px;background:var(--ink);border:2px solid var(--paper);transform:translate(-50%,-50%)}.zone-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.zone-metrics div{padding:8px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);min-width:0}.zone-metrics b{display:block;font-size:15px;line-height:1.2;margin-top:3px;overflow-wrap:anywhere}.permission-row{margin-top:10px;border:1px solid var(--rule);border-radius:12px;padding:9px;background:rgba(251,250,246,.12)}.permission-row b{display:block;font-size:13px;line-height:1.2;margin-top:3px}.permission-row em{display:block;font-style:normal;font-size:11px;color:var(--muted);margin-top:3px}.permission-row.allow b{color:var(--green)}.permission-row.loss b{color:var(--red)}.permission-row.block b{color:var(--warn)}.trust-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:8px;margin-bottom:14px}.trust-strip article{border:1px solid var(--rule);border-radius:12px;padding:10px;background:rgba(251,250,246,.16)}.trust-strip span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.trust-strip b{font-size:16px}</style>`;
}

module.exports = { renderHoldingsSection, renderHoldingsStyle };
