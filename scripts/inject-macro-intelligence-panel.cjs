'use strict';
// Beat 2: Macro Intelligence panel.
// Historical analogs + portfolio translation in one cohesive read.
// Replaces: inject-macro-historical-analog-board + inject-macro-portfolio-translation-board

const fs   = require('fs');
const path = require('path');

const root           = path.join(__dirname, '..');
const requestedPath  = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath      = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);
const analogPath     = path.join(root, 'outputs', 'macro-historical-analog-state.json');
const translationPath = path.join(root, 'outputs', 'macro-portfolio-translation-state.json');

if (!fs.existsSync(indexPath))       throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(analogPath))      throw new Error(`macro-historical-analog-state.json missing`);
if (!fs.existsSync(translationPath)) throw new Error(`macro-portfolio-translation-state.json missing`);

const analogState      = JSON.parse(fs.readFileSync(analogPath, 'utf8'));
const translationState = JSON.parse(fs.readFileSync(translationPath, 'utf8'));

const analogs     = (Array.isArray(analogState.analogs) ? analogState.analogs : []).slice(0, 3);
const posture     = translationState.posture || {};
const allocation  = Array.isArray(translationState.allocationBias) ? translationState.allocationBias : [];
const riskRules   = Array.isArray(translationState.riskRules) ? translationState.riskRules : [];

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function similarityColor(pct) {
  const n = Number(pct) || 0;
  if (n >= 85) return '#A4502F';
  if (n >= 70) return '#8a6a2c';
  return 'rgba(36,35,31,.5)';
}

const analogCards = analogs.map(a => {
  const color = similarityColor(a.similarity);
  return `<article class="mip-analog">
    <div class="mip-analog-head">
      <div>
        <span class="mip-label">Historical analog</span>
        <b class="mip-analog-period">${esc(a.period)}</b>
      </div>
      <strong class="mip-similarity" style="color:${color}">${esc(a.similarity)}%</strong>
    </div>
    <p class="mip-analog-label">${esc(a.label)}</p>
    <p class="mip-analog-pattern">${esc(a.pattern)}</p>
    <div class="mip-lesson"><span>Portfolio lesson</span><b>${esc(a.portfolioLesson)}</b></div>
  </article>`;
}).join('');

const allocationRows = allocation.slice(0, 5).map(a => {
  const biasClass = /overweight|favor/i.test(a.bias) ? 'mip-bias-over' : /underweight|avoid/i.test(a.bias) ? 'mip-bias-under' : 'mip-bias-watch';
  return `<div class="mip-alloc">
    <div class="mip-alloc-head">
      <span>${esc(a.bucket)}</span>
      <b class="${biasClass}">${esc(a.bias)}</b>
    </div>
    <p>${esc(a.rationale)}</p>
  </div>`;
}).join('');

const ruleRows = riskRules.slice(0, 4).map(r => `<div class="mip-rule">
  <div class="mip-rule-trigger"><span>Watch</span><b>${esc(r.watch)}</b></div>
  <div class="mip-rule-action"><span>Then</span><b>${esc(r.action)}</b></div>
</div>`).join('');

const style = `<style id="macro-intelligence-panel-style">
.macro-intelligence-panel{border-top:1px solid var(--rule);padding:48px 0;background:linear-gradient(180deg,rgba(243,240,232,.68),rgba(235,230,218,.38))}
.mip-wrap{width:min(1280px,calc(100% - 48px));margin:0 auto}
.mip-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:24px;gap:20px;border-bottom:1px solid var(--rule);padding-bottom:18px}
.mip-head h2{font-size:clamp(28px,3.8vw,58px);letter-spacing:-.065em;font-weight:500;line-height:.92;margin:0}
.mip-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);display:block;margin-bottom:8px}
.mip-posture{border:1px solid var(--rule);padding:14px 18px;background:rgba(255,255,255,.22);max-width:340px;text-align:right}
.mip-posture span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}
.mip-posture b{font-size:15px;line-height:1.25;font-weight:500}
.mip-grid{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:24px}
.mip-col-head{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 12px;padding-bottom:10px;border-bottom:1px solid var(--rule)}
.mip-analog{border:1px solid var(--rule);padding:16px;background:rgba(255,255,255,.18);margin-bottom:8px}
.mip-analog:last-child{margin-bottom:0}
.mip-analog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
.mip-label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:4px}
.mip-analog-period{font-size:28px;letter-spacing:-.05em;font-weight:500;line-height:.95;display:block}
.mip-similarity{font-size:36px;letter-spacing:-.06em;font-weight:500;line-height:.88}
.mip-analog-label{font-size:13px;font-weight:500;margin:0 0 6px;color:var(--ink)}
.mip-analog-pattern{font-size:12px;color:rgba(36,35,31,.68);line-height:1.4;margin:0 0 10px}
.mip-lesson{border-top:1px solid var(--rule);padding-top:10px}
.mip-lesson span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:4px}
.mip-lesson b{font-size:12px;line-height:1.35;font-weight:500}
.mip-alloc{border:1px solid var(--rule);padding:12px 14px;background:rgba(255,255,255,.16);margin-bottom:6px}
.mip-alloc:last-child{margin-bottom:0}
.mip-alloc-head{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:5px}
.mip-alloc-head span{font-size:11px;color:rgba(36,35,31,.72);font-weight:500}
.mip-alloc p{font-size:11px;color:var(--muted);line-height:1.35;margin:0}
.mip-bias-over{font-size:11px;font-weight:600;color:var(--pos,#2f6f4e)}
.mip-bias-under{font-size:11px;font-weight:600;color:var(--neg,#9f3f35)}
.mip-bias-watch{font-size:11px;font-weight:600;color:var(--warn,#8a6a2c)}
.mip-rules-head{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:18px 0 10px;padding-top:16px;border-top:1px solid var(--rule)}
.mip-rule{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid var(--rule);margin-bottom:6px;background:rgba(255,255,255,.14)}
.mip-rule:last-child{margin-bottom:0}
.mip-rule-trigger,.mip-rule-action{padding:10px 12px}
.mip-rule-trigger{border-right:1px solid var(--rule)}
.mip-rule span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px}
.mip-rule b{font-size:11px;line-height:1.3;font-weight:500}
@media(max-width:900px){.mip-grid{grid-template-columns:1fr}.mip-head{flex-direction:column;align-items:flex-start}.mip-posture{max-width:100%;text-align:left}}
@media(max-width:560px){.mip-rule{grid-template-columns:1fr}}
</style>`;

const section = `<section class="macro-intelligence-panel" id="macro-intelligence-panel">
  <div class="mip-wrap">
    <div class="mip-head">
      <div>
        <span class="mip-kicker">Macro intelligence · history + portfolio action</span>
        <h2>What does history say? What do I do?</h2>
      </div>
      <div class="mip-posture">
        <span>Current posture</span>
        <b>${esc(posture.label)}</b>
      </div>
    </div>
    <div class="mip-grid">
      <div>
        <p class="mip-col-head">Historical memory — top matches</p>
        ${analogCards}
      </div>
      <div>
        <p class="mip-col-head">Allocation bias</p>
        ${allocationRows}
        <p class="mip-rules-head">Risk rules</p>
        ${ruleRows}
      </div>
    </div>
  </div>
</section>`;

let html = fs.readFileSync(indexPath, 'utf8');

// Remove old panels if present
html = html.replace(/<style id="macro-historical-analog-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="macro-portfolio-translation-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="macro-intelligence-panel-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-historical-board"[\s\S]*?<\/section>/g, '');
html = html.replace(/<section class="macro-portfolio-board"[\s\S]*?<\/section>/g, '');
html = html.replace(/<section class="macro-intelligence-panel"[\s\S]*?<\/section>/g, '');

html = html.replace('</head>', style + '</head>');

// Insert after macro-cycle-panel, or after relationship-intelligence, or after decision-brief
const anchors = ['id="macro-cycle-panel"', 'id="relationship-intelligence"', 'id="evidence-annotation-layer"'];
let inserted = false;
for (const anchor of anchors) {
  const idx = html.indexOf(anchor);
  if (idx >= 0) {
    const secEnd = html.indexOf('</section>', idx);
    if (secEnd >= 0) {
      html = html.slice(0, secEnd + 10) + section + html.slice(secEnd + 10);
      inserted = true;
      break;
    }
  }
}
if (!inserted) {
  const firstEnd = html.indexOf('</section>');
  html = html.slice(0, firstEnd + 10) + section + html.slice(firstEnd + 10);
}

fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-intelligence-panel"')) throw new Error('macro-intelligence-panel injection failed');
console.log(`injected macro intelligence panel into ${path.relative(root, indexPath)}`);
