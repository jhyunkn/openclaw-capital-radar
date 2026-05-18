const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const home = path.join(root, 'index.html');
const actionPath = path.join(root, 'outputs', 'authoritative-action-state.json');
if (!fs.existsSync(home)) throw new Error('Missing index.html');
if (!fs.existsSync(actionPath)) throw new Error('Missing authoritative action state');
const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));
const states = action.actionStates || [];
const esc = s => String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
const money = v => Number.isFinite(Number(v)) ? `$${Number(v).toFixed(Number(v) < 10 ? 2 : 2)}` : '—';
const tone = s => s.authority?.tone === 'danger' ? 'danger' : s.authority?.tone === 'positive' ? 'positive' : s.authority?.tone === 'caution' ? 'caution' : 'neutral';
const ordered = [...states].sort((a,b) => ({IMMEDIATE:0,'THIS WEEK':1,SOON:2,REVIEW:3,MONITOR:4}[a.authority.urgency] ?? 9) - ({IMMEDIATE:0,'THIS WEEK':1,SOON:2,REVIEW:3,MONITOR:4}[b.authority.urgency] ?? 9));
const rows = ordered.map(s => `<article class="home-authority-card ${tone(s)}"><a href="pages/${esc(s.ticker.toLowerCase())}.html"><span>${esc(s.ticker)}</span><b>${esc(s.authority.decision)}</b></a><p>${money(s.price)} · ${esc(s.zone.label)}</p><p><strong>Allowed:</strong> ${esc(s.authority.allowed)}</p><p><strong>Forbidden:</strong> ${esc(s.authority.forbidden)}</p></article>`).join('');
const css = `<style id="home-authority-css">.home-authority{background:rgba(251,250,246,.22)}.home-authority-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.home-authority-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:rgba(251,250,246,.16);min-height:178px}.home-authority-card a{text-decoration:none}.home-authority-card span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}.home-authority-card b{display:block;font-size:22px;line-height:1.05;letter-spacing:-.04em}.home-authority-card p{font-size:13px;line-height:1.38;margin-top:9px}.home-authority-card.danger b{color:var(--red)}.home-authority-card.caution b{color:var(--warn)}.home-authority-card.positive b{color:var(--green)}.home-authority-summary{display:flex;gap:10px;flex-wrap:wrap;margin:16px 0 24px}.home-authority-summary span{border:1px solid var(--rule);border-radius:999px;padding:8px 11px;font-size:12px;color:var(--muted)}@media(max-width:1100px){.home-authority-grid{grid-template-columns:1fr 1fr}}@media(max-width:640px){.home-authority-grid{grid-template-columns:1fr}}</style>`;
const block = `<section id="authoritative-action-home" class="section home-authority"><div class="section-head"><div><p class="eyebrow">Authoritative Action State</p><h2>What the portfolio is allowed to do now</h2></div><a class="coverage-json-link" href="/outputs/authoritative-action-state.json">Action-state JSON</a></div><p class="bodyline">This is the command layer. It overrides raw buy-zone proximity whenever hard-exit, trim-watch, verification, coverage, or risk-budget blocks are active.</p><div class="home-authority-summary"><span>Immediate: ${esc(action.summary.immediate.join(', ') || 'none')}</span><span>Add review allowed: ${esc(action.summary.addReviewAllowed.join(', ') || 'none')}</span><span>Buy zones invalidated: ${esc(action.summary.contradictionsPrevented.join(', ') || 'none')}</span></div><div class="home-authority-grid">${rows}</div></section>`;
let html = fs.readFileSync(home, 'utf8');
html = html.replace(/<style id="home-authority-css">[\s\S]*?<\/style>/, '');
html = html.replace(/<section id="authoritative-action-home"[\s\S]*?<\/section>/, '');
html = html.replace('</head>', `${css}</head>`);
const anchors = ['<section id="live-reaction-panel"', '<section id="information-hierarchy"', '<section id="brief"', '<main class="shell">', '<main class="page">'];
let inserted = false;
for (const anchor of anchors) {
  const idx = html.indexOf(anchor);
  if (idx >= 0) {
    if (anchor.startsWith('<section')) html = html.slice(0, idx) + block + html.slice(idx);
    else html = html.slice(0, idx + anchor.length) + block + html.slice(idx + anchor.length);
    inserted = true;
    break;
  }
}
if (!inserted) throw new Error('No stable homepage anchor found for authoritative action layer');
fs.writeFileSync(home, html);
console.log('injected homepage authoritative action layer');
