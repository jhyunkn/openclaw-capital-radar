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
const badge = value => {
  const s = String(value || '').toUpperCase();
  if (s.includes('VULNERABLE') || s.includes('HIGH') || s.includes('REDUCE') || s.includes('EXIT') || s.includes('TRIM')) return 'bad';
  if (s.includes('CONSTRAINED') || s.includes('WATCH') || s.includes('REVIEW') || s.includes('VERIFY')) return 'warn';
  if (s.includes('SUPPORTED') || s.includes('ADD') || s.includes('NORMAL')) return 'good';
  return '';
};

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('portfolio-translation-state.json missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (!state.render_permission) throw new Error('portfolio-translation-state render_permission=false');

const s = state.summary || {};
const cards = list(state.holdings).map(h => {
  const m = h.price_decision_map || {};
  return `
  <article class="artifact-card">
    <span class="pill ${badge(h.exposure_state)}">${esc(h.rule_permission)} · ${esc(h.exposure_state)}</span>
    <h3>${esc(h.ticker)}</h3>
    <div class="artifact-list">
      <div><span>Current / day / weight</span><b>${usd(m.current_price ?? h.price)} · ${pct(h.day_change_pct)} · ${pct(h.portfolio_weight_pct)}</b></div>
      <div><span>Buy zone</span><b>${range(m.buy_zone_low, m.buy_zone_high)} · to mid ${pct(m.downside_to_buy_mid_pct)}</b></div>
      <div><span>Trim / protect zone</span><b>${range(m.trim_zone_low, m.trim_zone_high)} · to trim ${pct(m.upside_to_trim_low_pct)}</b></div>
      <div><span>Target / peak proxy</span><b>${usd(m.target_resistance)} · upside ${pct(m.upside_to_target_pct)}</b></div>
      <div><span>Stop / hard exit</span><b>${usd(m.stop_review)} / ${usd(m.hard_exit_review)} · downside ${pct(m.downside_to_stop_pct)} / ${pct(m.downside_to_hard_exit_pct)}</b></div>
      <div><span>Recent range</span><b>${usd(m.recent_range_low)}–${usd(m.recent_range_high)}</b></div>
      <div><span>Accumulation proxy</span><b>${usd(m.recent_accumulation_proxy_low)}–${usd(m.recent_accumulation_proxy_high)} · ${esc(m.institutional_accumulation_status || 'proxy pending')}</b></div>
      <div><span>Decision</span><b>${esc(h.numeric_action || h.sizing_posture)}</b></div>
      <div><span>Role / regime</span><b>${esc(h.portfolio_role)} · ${esc(h.linked_macro_theme)}</b></div>
      <div><span>Evidence quality</span><b>${esc(h.evidence_quality?.status || 'unknown')} · macro ${fmt(h.evidence_quality?.macro_confidence, 2)}</b></div>
    </div>
  </article>`;
}).join('');

const replacement = `<section id="holdings-section" class="panel">
  <div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Numeric holding map</h2></div><a class="button" href="outputs/portfolio-translation-state.json">Open artifact</a></div>
  <p class="judgment">Holdings are shown as numeric decision surfaces: current price, buy zone, trim/protect zone, target, stop, hard-exit level, recent range, accumulation proxy, and action permission.</p>
  <div class="trust-strip">
    <article><span>Supported</span><b>${fmt(s.supported,0)}</b></article>
    <article><span>Constrained</span><b>${fmt(s.constrained,0)}</b></article>
    <article><span>Vulnerable</span><b>${fmt(s.vulnerable,0)}</b></article>
    <article><span>Add-review eligible</span><b>${fmt(s.add_eligible,0)}</b></article>
    <article><span>No add / review</span><b>${fmt(s.no_add_or_review,0)}</b></article>
    <article><span>Avg strength</span><b>${fmt(s.average_strength_score,1)}</b></article>
  </div>
  <div class="artifact-grid">${cards}</div>
</section>`;

let html = fs.readFileSync(indexPath, 'utf8');
const start = html.indexOf('<section id="holdings-section"');
const end = html.indexOf('<section id="opportunities-section"');
if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate Holdings section boundaries');
html = html.slice(0, start) + replacement + html.slice(end);
fs.writeFileSync(indexPath, html);
console.log(`replaced Holdings with numeric holding map: ${list(state.holdings).length} holdings`);
