const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requestedIndexPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath = path.isAbsolute(requestedIndexPath) ? requestedIndexPath : path.join(root, requestedIndexPath);
const statePath = path.join(root, 'outputs', 'macro-portfolio-translation-state.json');
if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(statePath)) throw new Error(`macro portfolio translation state missing at ${statePath}`);

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const list = items => (Array.isArray(items) ? items : []).map(item => `<em>${esc(item)}</em>`).join('');

const style = `<style id="macro-portfolio-translation-style">
.macro-portfolio-board{border-top:1px solid var(--macro-rule,var(--rule));border-bottom:1px solid var(--macro-rule,var(--rule));background:#ffffff;padding:34px 0}.mpb-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto}.mpb-head{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:22px;border-bottom:1px solid var(--macro-rule,var(--rule));padding-bottom:18px}.mpb-kicker,.mpb-card span,.mpb-rule span,.mpb-lesson span,.mpb-missing span{display:block;color:var(--macro-warm,var(--muted));font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.14em}.mpb-title{font-size:clamp(32px,4.6vw,64px);line-height:.9;letter-spacing:-.075em;font-weight:500;margin:9px 0 0;color:var(--macro-ink,var(--ink))}.mpb-copy{max-width:760px;color:rgba(26,23,20,.66);font-size:14px;line-height:1.45;margin:12px 0 0}.mpb-posture,.mpb-card,.mpb-rule,.mpb-lesson,.mpb-missing{border:1px solid var(--macro-rule,var(--rule));background:rgba(255,255,255,.16);padding:12px}.mpb-posture b{display:block;font-size:29px;line-height:.96;letter-spacing:-.055em;font-weight:500;margin-top:8px;color:var(--macro-ink,var(--ink))}.mpb-posture-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:6px;margin-top:12px}.mpb-posture-grid article{border-top:1px solid var(--macro-rule,var(--rule));padding-top:7px}.mpb-posture-grid strong{display:block;font-size:15px;line-height:1.05;letter-spacing:-.035em;font-weight:500;color:var(--macro-ink,var(--ink))}.mpb-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:12px}.mpb-card b,.mpb-rule b,.mpb-lesson b{display:block;font-size:16px;line-height:1.05;letter-spacing:-.035em;font-weight:500;margin-top:8px;color:var(--macro-ink,var(--ink))}.mpb-card p,.mpb-rule p,.mpb-lesson p,.mpb-missing p{color:rgba(26,23,20,.66);font-size:11px;line-height:1.35;margin:8px 0 0}.mpb-rules{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}.mpb-lessons{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:8px}.mpb-missing{margin-top:8px}.mpb-list{display:grid;gap:5px;margin-top:8px}.mpb-list em{font-style:normal;color:rgba(26,23,20,.72);font-size:11px;line-height:1.25;border-top:1px solid rgba(201,191,173,.42);padding-top:5px}@media(max-width:1100px){.mpb-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.mpb-rules,.mpb-lessons{grid-template-columns:repeat(2,minmax(0,1fr))}.mpb-head{grid-template-columns:1fr}}@media(max-width:640px){.mpb-grid,.mpb-rules,.mpb-lessons,.mpb-posture-grid{grid-template-columns:1fr}.mpb-title{font-size:40px}}
</style>`;

const posture = state.posture || {};
const biases = Array.isArray(state.allocationBias) ? state.allocationBias : [];
const rules = Array.isArray(state.riskRules) ? state.riskRules : [];
const lessons = Array.isArray(state.historicalLessons) ? state.historicalLessons : [];
const biasMarkup = biases.map(item => `<article class="mpb-card"><span>${esc(item.bucket)}</span><b>${esc(item.bias)}</b><p>${esc(item.rationale)}</p></article>`).join('');
const ruleMarkup = rules.map(item => `<article class="mpb-rule"><span>${esc(item.trigger)}</span><b>${esc(item.watch)}</b><p>${esc(item.action)}</p></article>`).join('');
const lessonMarkup = lessons.map(item => `<article class="mpb-lesson"><span>${esc(item.period)}</span><b>${esc(item.lesson)}</b></article>`).join('');
const missing = (state.missingEvidence || []).map(item => `<p>${esc(item)}</p>`).join('');

const section = `<section class="macro-portfolio-board" id="macro-portfolio-board"><div class="mpb-wrap"><div class="mpb-head"><div><p class="mpb-kicker">Portfolio translation v1</p><h2 class="mpb-title">Configuration becomes allocation posture, not automatic trades.</h2><p class="mpb-copy">This layer translates the current configuration and historical memory into risk posture, allocation bias, invalidation triggers, and missing evidence. It is the Macro decision layer before ticker-specific execution.</p></div><aside class="mpb-posture"><span>Current posture</span><b>${esc(posture.label)}</b><div class="mpb-posture-grid"><article><span>Risk</span><strong>${esc(posture.riskLevel)}</strong></article><article><span>Cash discipline</span><strong>${esc(posture.cashDiscipline)}</strong></article><article><span>Duration</span><strong>${esc(posture.durationPosture)}</strong></article><article><span>Credit</span><strong>${esc(posture.creditPosture)}</strong></article></div></aside></div><div class="mpb-grid">${biasMarkup}</div><div class="mpb-rules">${ruleMarkup}</div><div class="mpb-lessons">${lessonMarkup}</div><aside class="mpb-missing"><span>Missing evidence</span>${missing}</aside></div></section>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="macro-portfolio-translation-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-portfolio-board" id="macro-portfolio-board">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
const history = html.indexOf('id="macro-historical-board"');
const relationship = html.indexOf('id="relationship-intelligence"');
const anchor = history >= 0 ? history : relationship;
if (anchor >= 0) {
  const end = html.indexOf('</section>', anchor);
  html = html.slice(0, end + 10) + section + html.slice(end + 10);
} else {
  const firstSectionEnd = html.indexOf('</section>');
  html = html.slice(0, firstSectionEnd + 10) + section + html.slice(firstSectionEnd + 10);
}
fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-portfolio-board"')) throw new Error('Macro portfolio board injection verification failed');
console.log(`injected Macro portfolio translation board into ${path.relative(root, indexPath)}`);
