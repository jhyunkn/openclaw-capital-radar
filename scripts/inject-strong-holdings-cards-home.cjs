const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'portfolio-translation-state.json');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const list = value => Array.isArray(value) ? value : [];
const fmt = (value, digits = 1) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : esc(value ?? '—');
};
const usd = value => Number.isFinite(Number(value)) ? `$${fmt(value, 2)}` : '—';
const pct = value => Number.isFinite(Number(value)) ? `${fmt(value, 1)}%` : '—';
const range = (low, high) => `${usd(low)}–${usd(high)}`;
const clamp = (v, a = 0, b = 100) => Math.max(a, Math.min(b, v));
const n = value => Number.isFinite(Number(value)) ? Number(value) : null;
const badge = value => {
  const s = String(value || '').toUpperCase();
  if (s.includes('HARD_EXIT') || s.includes('BELOW_STOP') || s.includes('VULNERABLE') || s.includes('HIGH') || s.includes('REDUCE') || s.includes('EXIT')) return 'bad';
  if (s.includes('TRIM') || s.includes('CONSTRAINED') || s.includes('WATCH') || s.includes('REVIEW') || s.includes('VERIFY') || s.includes('NEAR_STOP')) return 'warn';
  if (s.includes('BUY') || s.includes('SUPPORTED') || s.includes('ADD') || s.includes('NORMAL')) return 'good';
  return '';
};
const zoneStatus = m => {
  const c = n(m.current_price);
  const hard = n(m.hard_exit_review);
  const stop = n(m.stop_review);
  const buyLow = n(m.buy_zone_low);
  const buyHigh = n(m.buy_zone_high);
  const trimLow = n(m.trim_zone_low);
  const trimHigh = n(m.trim_zone_high);
  if (![c, hard, stop, buyLow, buyHigh, trimLow, trimHigh].every(Number.isFinite)) return 'unmapped';
  if (c <= hard) return 'below_hard_exit';
  if (c <= stop) return 'below_stop';
  if ((c - stop) / c <= 0.03) return 'near_stop';
  if (c >= buyLow && c <= buyHigh) return 'inside_buy_zone';
  if (c > buyHigh && (c - buyHigh) / c <= 0.03) return 'near_buy_zone';
  if (c >= trimLow && c <= trimHigh) return 'inside_trim_zone';
  if (c < trimLow && (trimLow - c) / c <= 0.03) return 'near_trim_zone';
  return 'neutral_hold';
};
const zoneBar = m => {
  const vals = [m.hard_exit_review, m.stop_review, m.buy_zone_low, m.buy_zone_high, m.trim_zone_low, m.trim_zone_high, m.target_resistance, m.current_price].map(n).filter(Number.isFinite);
  if (vals.length < 5) return '';
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const pos = value => max === min ? 50 : clamp(((n(value) - min) / (max - min)) * 100);
  const seg = (a, b, cls) => `<span class="zone-seg ${cls}" style="left:${pos(a)}%;width:${Math.max(1, pos(b)-pos(a))}%"></span>`;
  return `<div class="zone-bar"><div class="zone-track">
    ${seg(min, m.hard_exit_review, 'hard')}
    ${seg(m.hard_exit_review, m.stop_review, 'risk')}
    ${seg(m.buy_zone_low, m.buy_zone_high, 'buy')}
    ${seg(m.trim_zone_low, m.trim_zone_high, 'trim')}
    <span class="zone-dot" style="left:${pos(m.current_price)}%"></span>
  </div><div class="zone-scale"><span>${usd(min)}</span><span>${usd(m.current_price)}</span><span>${usd(max)}</span></div></div>`;
};

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('portfolio-translation-state.json missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (!state.render_permission) throw new Error('portfolio-translation-state render_permission=false');

const s = state.summary || {};
const zoneCounts = list(state.holdings).reduce((acc, h) => { const z = zoneStatus(h.price_decision_map || {}); acc[z] = (acc[z] || 0) + 1; return acc; }, {});
const cards = list(state.holdings).map(h => {
  const m = h.price_decision_map || {};
  const z = zoneStatus(m);
  return `
  <article class="artifact-card zone-card ${badge(z)}">
    <div class="zone-card-top"><span class="pill ${badge(h.rule_permission)}">${esc(h.rule_permission)}</span><span class="pill ${badge(z)}">${esc(z)}</span></div>
    <h3>${esc(h.ticker)}</h3>
    ${zoneBar(m)}
    <div class="number-grid">
      <div><span>Now</span><b>${usd(m.current_price ?? h.price)}</b><small>${pct(h.day_change_pct)} · W ${pct(h.portfolio_weight_pct)}</small></div>
      <div><span>Buy</span><b>${range(m.buy_zone_low, m.buy_zone_high)}</b><small>${pct(m.downside_to_buy_mid_pct)}</small></div>
      <div><span>Trim</span><b>${range(m.trim_zone_low, m.trim_zone_high)}</b><small>${pct(m.upside_to_trim_low_pct)}</small></div>
      <div><span>Target</span><b>${usd(m.target_resistance)}</b><small>${pct(m.upside_to_target_pct)}</small></div>
      <div><span>Stop</span><b>${usd(m.stop_review)}</b><small>${pct(m.downside_to_stop_pct)}</small></div>
      <div><span>Exit</span><b>${usd(m.hard_exit_review)}</b><small>${pct(m.downside_to_hard_exit_pct)}</small></div>
    </div>
    <div class="mini-row"><span>Range</span><b>${usd(m.recent_range_low)}–${usd(m.recent_range_high)}</b><span>Accum.</span><b>${usd(m.recent_accumulation_proxy_low)}–${usd(m.recent_accumulation_proxy_high)}</b></div>
    <div class="mini-row"><span>Role</span><b>${esc(h.portfolio_role)}</b><span>Evidence</span><b>${esc(h.evidence_quality?.status || 'unknown')}</b></div>
  </article>`;
}).join('');

const replacement = `<section id="holdings-section" class="panel">
  <div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Price-zone radar</h2></div><a class="button" href="outputs/portfolio-translation-state.json">Open artifact</a></div>
  <div class="trust-strip">
    <article><span>Buy zone</span><b>${fmt((zoneCounts.inside_buy_zone || 0) + (zoneCounts.near_buy_zone || 0),0)}</b></article>
    <article><span>Hold zone</span><b>${fmt(zoneCounts.neutral_hold || 0,0)}</b></article>
    <article><span>Trim zone</span><b>${fmt((zoneCounts.inside_trim_zone || 0) + (zoneCounts.near_trim_zone || 0),0)}</b></article>
    <article><span>Risk zone</span><b>${fmt((zoneCounts.near_stop || 0) + (zoneCounts.below_stop || 0) + (zoneCounts.below_hard_exit || 0),0)}</b></article>
    <article><span>No add / review</span><b>${fmt(s.no_add_or_review,0)}</b></article>
    <article><span>Avg strength</span><b>${fmt(s.average_strength_score,1)}</b></article>
  </div>
  <div class="artifact-grid">${cards}</div>
</section>`;

let html = fs.readFileSync(indexPath, 'utf8');
const style = `<style>
.zone-card-top{display:flex;gap:8px;flex-wrap:wrap;justify-content:space-between}.zone-bar{margin:14px 0 12px}.zone-track{position:relative;height:12px;border:1px solid var(--rule);border-radius:999px;background:rgba(251,250,246,.18);overflow:hidden}.zone-seg{position:absolute;top:0;bottom:0}.zone-seg.hard{background:rgba(80,31,31,.62)}.zone-seg.risk{background:rgba(159,63,53,.55)}.zone-seg.buy{background:rgba(47,111,78,.58)}.zone-seg.trim{background:rgba(174,124,44,.62)}.zone-dot{position:absolute;top:50%;width:14px;height:14px;border-radius:999px;background:var(--ink);border:2px solid var(--paper);transform:translate(-50%,-50%);box-shadow:0 0 0 1px var(--rule)}.zone-scale{display:flex;justify-content:space-between;color:var(--muted);font-size:10px;margin-top:5px}.number-grid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:10px}.number-grid div{padding:10px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}.number-grid span,.mini-row span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.number-grid b{display:block;font-size:16px;line-height:1.1;margin-top:4px}.number-grid small{display:block;color:var(--muted);margin-top:4px}.mini-row{display:grid;grid-template-columns:.5fr 1fr .5fr 1fr;gap:8px;border-top:1px solid var(--rule2);padding-top:8px;margin-top:8px;align-items:start}.mini-row b{font-size:12px;line-height:1.25}@media(max-width:720px){.number-grid{grid-template-columns:repeat(2,1fr)}.mini-row{grid-template-columns:1fr}}
</style>`;
if (!html.includes('.zone-bar{')) html = html.replace('</head>', `${style}</head>`);
const start = html.indexOf('<section id="holdings-section"');
const end = html.indexOf('<section id="opportunities-section"');
if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Holdings section boundaries');
html = html.slice(0, start) + replacement + html.slice(end);
fs.writeFileSync(indexPath, html);
console.log(`replaced Holdings with compact price-zone radar: ${list(state.holdings).length} holdings`);
