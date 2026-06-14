const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requestedIndexPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath = path.isAbsolute(requestedIndexPath) ? requestedIndexPath : path.join(root, requestedIndexPath);
const statePath = path.join(root, 'outputs', 'macro-configuration-state.json');
if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(statePath)) throw new Error(`macro configuration state missing at ${statePath}`);

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const axes = Array.isArray(state.axes) ? state.axes : [];
const tensions = Array.isArray(state.tensions) ? state.tensions : [];
const implication = state.portfolioImplication || {};

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const arrow = value => ({ up:'↑', down:'↓', flat:'→' }[String(value || '').toLowerCase()] || '→');

const style = `<style id="macro-configuration-style">
.macro-configuration-board{border-top:1px solid var(--macro-rule,var(--rule));border-bottom:1px solid var(--macro-rule,var(--rule));background:#ffffff;padding:34px 0}.mcb-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto}.mcb-head{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:22px;border-bottom:1px solid var(--macro-rule,var(--rule));padding-bottom:18px}.mcb-kicker,.mcb-axis span,.mcb-tension span,.mcb-implication span{display:block;color:var(--macro-warm,var(--muted));font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.14em}.mcb-title{font-size:clamp(32px,4.6vw,64px);line-height:.9;letter-spacing:-.075em;font-weight:500;margin:9px 0 0;color:var(--macro-ink,var(--ink))}.mcb-copy{max-width:760px;color:rgba(26,23,20,.66);font-size:14px;line-height:1.45;margin:12px 0 0}.mcb-diagnosis{border:1px solid var(--macro-rule,var(--rule));background:rgba(255,255,255,.18);padding:14px}.mcb-diagnosis b{display:block;font-size:28px;line-height:.96;letter-spacing:-.055em;font-weight:500;margin-top:9px;color:var(--macro-ink,var(--ink))}.mcb-diagnosis strong{display:block;font-size:40px;line-height:.88;letter-spacing:-.06em;font-weight:500;margin-top:15px;color:var(--macro-earth,#A4502F)}.mcb-axis-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:12px}.mcb-axis,.mcb-tension,.mcb-implication{border:1px solid var(--macro-rule,var(--rule));background:rgba(255,255,255,.16);padding:12px;min-width:0}.mcb-axis b{display:block;font-size:21px;line-height:.96;letter-spacing:-.045em;font-weight:500;margin-top:8px;color:var(--macro-ink,var(--ink))}.mcb-axis strong{display:block;font-size:34px;line-height:.88;letter-spacing:-.06em;font-weight:500;margin-top:10px;color:var(--macro-ink,var(--ink))}.mcb-axis p,.mcb-tension p,.mcb-implication p{color:rgba(26,23,20,.66);font-size:11px;line-height:1.35;margin:8px 0 0}.mcb-bar{height:3px;background:var(--macro-soft,rgba(201,191,173,.28));margin-top:11px;position:relative}.mcb-bar i{position:absolute;inset:0 auto 0 0;background:var(--macro-earth,#A4502F);display:block}.mcb-meta{display:grid;grid-template-columns:1fr auto;gap:6px;align-items:end;margin-top:8px}.mcb-meta small{font-family:var(--mono,monospace);font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:var(--macro-warm,var(--muted))}.mcb-lower{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:8px;margin-top:8px}.mcb-tension-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mcb-tension{border-color:rgba(164,80,47,.42);background:rgba(164,80,47,.06)}.mcb-tension b,.mcb-implication b{display:block;font-size:16px;line-height:1.05;letter-spacing:-.035em;font-weight:500;margin-top:8px;color:var(--macro-ink,var(--ink))}.mcb-implication{display:grid;gap:10px}.mcb-list{display:grid;gap:5px;margin-top:8px}.mcb-list em{font-style:normal;color:rgba(26,23,20,.72);font-size:11px;line-height:1.25;border-top:1px solid rgba(201,191,173,.42);padding-top:5px}@media(max-width:1100px){.mcb-axis-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.mcb-lower,.mcb-head{grid-template-columns:1fr}.mcb-tension-grid{grid-template-columns:1fr}}@media(max-width:640px){.mcb-axis-grid{grid-template-columns:1fr}.mcb-title{font-size:40px}}
</style>`;

const axisMarkup = axes.map(axis => {
  const evidence = (axis.evidence || []).slice(0, 3).join(' · ');
  const missing = (axis.missingEvidence || []).slice(0, 1).join('');
  return `<article class="mcb-axis"><span>${esc(axis.label)}</span><b>${esc(axis.state)} ${arrow(axis.direction)}</b><strong>${esc(axis.score)}</strong><div class="mcb-bar"><i style="width:${Math.max(0, Math.min(100, Number(axis.score) || 0))}%"></i></div><div class="mcb-meta"><small>confidence</small><small>${esc(axis.confidence)}%</small></div><p>${esc(evidence)}</p>${missing ? `<p>Missing: ${esc(missing)}</p>` : ''}</article>`;
}).join('');

const tensionMarkup = tensions.map(item => `<article class="mcb-tension"><span>${esc(item.id)}</span><b>${esc(item.label)}</b><p>${esc(item.interpretation)}</p></article>`).join('');
const list = items => (Array.isArray(items) ? items : []).map(item => `<em>${esc(item)}</em>`).join('');

const section = `<section class="macro-configuration-board" id="macro-configuration-board"><div class="mcb-wrap"><div class="mcb-head"><div><p class="mcb-kicker">Configuration engine v1</p><h2 class="mcb-title">The warehouse compresses into six market states.</h2><p class="mcb-copy">Configuration is the bridge between the evidence warehouse and the market diagnosis. Each axis carries score, direction, confidence, evidence basis, and missing evidence so the diagnosis can be audited rather than accepted as prose.</p></div><aside class="mcb-diagnosis"><span>Generated diagnosis</span><b>${esc(state.diagnosis?.label)}</b><strong>${esc(state.diagnosis?.confidence)}%</strong></aside></div><div class="mcb-axis-grid">${axisMarkup}</div><div class="mcb-lower"><div class="mcb-tension-grid">${tensionMarkup}</div><aside class="mcb-implication"><div><span>Favor</span><div class="mcb-list">${list(implication.favor)}</div></div><div><span>Avoid</span><div class="mcb-list">${list(implication.avoid)}</div></div><div><span>Watch</span><div class="mcb-list">${list(implication.watch)}</div></div></aside></div></div></section>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="macro-configuration-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-configuration-board" id="macro-configuration-board">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
const diagnosis = html.indexOf('id="market-diagnosis-board"');
const relationship = html.indexOf('id="relationship-intelligence"');
const evidence = html.indexOf('id="evidence-annotation-layer"');
const anchor = diagnosis >= 0 ? diagnosis : relationship >= 0 ? relationship : evidence;
if (anchor >= 0) {
  const end = html.indexOf('</section>', anchor);
  html = html.slice(0, end + 10) + section + html.slice(end + 10);
} else {
  const firstSectionEnd = html.indexOf('</section>');
  html = html.slice(0, firstSectionEnd + 10) + section + html.slice(firstSectionEnd + 10);
}
fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-configuration-board"')) throw new Error('Macro configuration board injection verification failed');
console.log(`injected Macro configuration board into ${path.relative(root, indexPath)}`);
