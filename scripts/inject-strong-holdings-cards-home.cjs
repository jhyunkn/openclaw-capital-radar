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
const cards = list(state.holdings).map(h => `
  <article class="artifact-card">
    <span class="pill ${badge(h.exposure_state)}">${esc(h.exposure_state)} · ${esc(h.rule_permission)}</span>
    <h3>${esc(h.ticker)}</h3>
    <p>${esc(h.thesis_bridge || h.macro_theme_summary)}</p>
    <div class="artifact-list">
      <div><span>Macro theme</span><b>${esc(h.linked_macro_theme)}</b></div>
      <div><span>Sizing posture</span><b>${esc(h.sizing_posture)}</b></div>
      <div><span>Risk / concentration</span><b>${esc(h.risk_state)} · ${esc(h.concentration_state)}</b></div>
      <div><span>Strength / thesis quality</span><b>${fmt(h.holding_strength_score,0)} / ${fmt(h.thesis_quality_score,0)}</b></div>
      <div><span>Price / day / weight</span><b>$${fmt(h.price,2)} · ${fmt(h.day_change_pct,2)}% · ${fmt(h.portfolio_weight_pct,2)}%</b></div>
      <div><span>Action protocol</span><b>${esc(list(h.action_protocol).join(' '))}</b></div>
      <div><span>Next evidence</span><b>${esc(list(h.next_evidence).join('; '))}</b></div>
      <div><span>Invalidation</span><b>${esc(list(h.invalidation).join('; '))}</b></div>
      <div><span>Data truth</span><b>${h.data_truth?.evidence_backed ? 'evidence-backed' : 'macro link pending'} · ${esc(h.data_truth?.data_freshness)} · ${esc(h.data_truth?.source_confidence)} · macro ${fmt(h.data_truth?.macro_confidence,2)}</b></div>
    </div>
  </article>`).join('');

const replacement = `<section id="holdings-section" class="panel">
  <div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Capital-control exposure board</h2></div><a class="button" href="outputs/portfolio-translation-state.json">Open artifact</a></div>
  <p class="judgment">Holdings are evaluated as exposure systems: macro linkage, permission, sizing posture, concentration, thesis quality, next evidence, and invalidation.</p>
  <div class="trust-strip">
    <article><span>Supported</span><b>${fmt(s.supported,0)}</b></article>
    <article><span>Constrained</span><b>${fmt(s.constrained,0)}</b></article>
    <article><span>Vulnerable</span><b>${fmt(s.vulnerable,0)}</b></article>
    <article><span>Add eligible</span><b>${fmt(s.add_eligible,0)}</b></article>
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
console.log(`replaced Holdings with capital-control board: ${list(state.holdings).length} holdings`);
