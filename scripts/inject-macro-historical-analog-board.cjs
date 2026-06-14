const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requestedIndexPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath = path.isAbsolute(requestedIndexPath) ? requestedIndexPath : path.join(root, requestedIndexPath);
const statePath = path.join(root, 'outputs', 'macro-historical-analog-state.json');
if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(statePath)) throw new Error(`macro historical analog state missing at ${statePath}`);

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const analogs = Array.isArray(state.analogs) ? state.analogs : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const qualityClass = q => String(q || '').toLowerCase().replace(/[^a-z0-9_-]/g, '-');

const style = `<style id="macro-historical-analog-style">
.macro-historical-board{border-top:1px solid var(--macro-rule,var(--rule));border-bottom:1px solid var(--macro-rule,var(--rule));background:#ffffff;padding:34px 0}.mhb-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto}.mhb-head{display:grid;grid-template-columns:minmax(0,1fr) 320px;gap:22px;border-bottom:1px solid var(--macro-rule,var(--rule));padding-bottom:18px}.mhb-kicker,.mhb-card span,.mhb-missing span{display:block;color:var(--macro-warm,var(--muted));font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.14em}.mhb-title{font-size:clamp(32px,4.6vw,64px);line-height:.9;letter-spacing:-.075em;font-weight:500;margin:9px 0 0;color:var(--macro-ink,var(--ink))}.mhb-copy{max-width:760px;color:rgba(26,23,20,.66);font-size:14px;line-height:1.45;margin:12px 0 0}.mhb-vector{border:1px solid var(--macro-rule,var(--rule));background:rgba(255,255,255,.18);padding:14px}.mhb-vector-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:10px}.mhb-vector-grid article{border-top:1px solid var(--macro-rule,var(--rule));padding-top:8px}.mhb-vector-grid b{display:block;font-size:24px;line-height:.9;letter-spacing:-.05em;font-weight:500;color:var(--macro-ink,var(--ink))}.mhb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:12px}.mhb-card,.mhb-missing{border:1px solid var(--macro-rule,var(--rule));background:rgba(255,255,255,.16);padding:12px}.mhb-card b{display:block;font-size:21px;line-height:.98;letter-spacing:-.045em;font-weight:500;margin-top:8px;color:var(--macro-ink,var(--ink))}.mhb-card strong{display:block;font-size:34px;line-height:.9;letter-spacing:-.06em;font-weight:500;margin-top:10px;color:var(--macro-earth,#A4502F)}.mhb-card p,.mhb-missing p{color:rgba(26,23,20,.66);font-size:11px;line-height:1.35;margin:8px 0 0}.mhb-card.good{border-color:rgba(47,111,78,.38)}.mhb-card.usable{border-color:rgba(174,124,44,.42)}.mhb-card.partial{border-color:rgba(159,63,53,.36)}.mhb-missing{margin-top:8px}@media(max-width:1050px){.mhb-head{grid-template-columns:1fr}.mhb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.mhb-grid,.mhb-vector-grid{grid-template-columns:1fr}.mhb-title{font-size:40px}}
</style>`;

const vector = state.sourceConfiguration || {};
const vectorItems = Object.entries(vector).map(([k,v]) => `<article><span>${esc(k.replace(/_/g,' '))}</span><b>${esc(v)}</b></article>`).join('');
const cards = analogs.map(item => `<article class="mhb-card ${qualityClass(item.evidenceQuality)}"><span>${esc(item.period)} · ${esc(item.evidenceQuality)} · ${esc(item.similarity)}%</span><b>${esc(item.label)}</b><strong>${esc(item.similarity)}</strong><p>${esc(item.pattern)}</p><p>Difference: ${esc(item.difference)}</p><p>Lesson: ${esc(item.portfolioLesson)}</p></article>`).join('');
const missing = (state.missingEvidence || []).map(item => `<p>${esc(item)}</p>`).join('');

const section = `<section class="macro-historical-board" id="macro-historical-board"><div class="mhb-wrap"><div class="mhb-head"><div><p class="mhb-kicker">Historical memory v1</p><h2 class="mhb-title">The current configuration is tested against long market memory.</h2><p class="mhb-copy">Historical analogs compare full configuration patterns, not isolated chart shapes. Each analog discloses similarity, evidence quality, difference from today, and portfolio lesson.</p></div><aside class="mhb-vector"><span>Configuration vector</span><div class="mhb-vector-grid">${vectorItems}</div></aside></div><div class="mhb-grid">${cards}</div><aside class="mhb-missing"><span>Missing evidence</span>${missing}</aside></div></section>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="macro-historical-analog-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-historical-board" id="macro-historical-board">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
const config = html.indexOf('id="macro-configuration-board"');
const relationship = html.indexOf('id="relationship-intelligence"');
const anchor = config >= 0 ? config : relationship;
if (anchor >= 0) {
  const end = html.indexOf('</section>', anchor);
  html = html.slice(0, end + 10) + section + html.slice(end + 10);
} else {
  const firstSectionEnd = html.indexOf('</section>');
  html = html.slice(0, firstSectionEnd + 10) + section + html.slice(firstSectionEnd + 10);
}
fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-historical-board"')) throw new Error('Macro historical analog board injection verification failed');
console.log(`injected Macro historical analog board into ${path.relative(root, indexPath)}`);
