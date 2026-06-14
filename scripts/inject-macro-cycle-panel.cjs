'use strict';
// Beat 1: Cycle Position panel.
// Combines Kostolany Egg phase + 6 macro axes + diagnosis into one read.
// Replaces: inject-market-diagnosis-board + inject-macro-configuration-board

const fs   = require('fs');
const path = require('path');

const root              = path.join(__dirname, '..');
const requestedPath     = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath         = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);
const eggStatePath      = path.join(root, 'outputs', 'kostolany-egg-state.json');
const configStatePath   = path.join(root, 'outputs', 'macro-configuration-state.json');

if (!fs.existsSync(indexPath))      throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(eggStatePath))   throw new Error(`kostolany-egg-state.json missing`);
if (!fs.existsSync(configStatePath)) throw new Error(`macro-configuration-state.json missing`);

const egg    = JSON.parse(fs.readFileSync(eggStatePath, 'utf8'));
const config = JSON.parse(fs.readFileSync(configStatePath, 'utf8'));
const axes   = Array.isArray(config.axes) ? config.axes : [];
const diag   = config.diagnosis || {};

const esc   = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arrow = v => ({up:'↑',down:'↓',flat:'→'}[String(v||'').toLowerCase()] || '→');
const clamp = (n, lo=0, hi=100) => Math.max(lo, Math.min(hi, Number(n)||0));

// Score to colour: high = warm red-earth (restrictive/tight), low = muted
function axisColor(score) {
  if (score >= 75) return 'var(--mcp-high, #A4502F)';
  if (score >= 55) return 'var(--mcp-mid,  #8a6a2c)';
  return 'var(--mcp-low, rgba(36,35,31,.38))';
}

// Render the phase arc: small dots for dormant, large lit dot for current, shaded for previous
const phases = Array.isArray(egg.phases) ? egg.phases : [];
const phaseArc = phases.map(p => {
  const isCurrent  = p.state === 'current';
  const isPrevious = p.state === 'previous';
  const cls = isCurrent ? 'mcp-phase mcp-phase-current' : isPrevious ? 'mcp-phase mcp-phase-prev' : 'mcp-phase mcp-phase-dormant';
  return `<div class="${cls}" title="${esc(p.macro)}"><span>${esc(p.code)}</span><b>${esc(p.label)}</b></div>`;
}).join('');

const axisRows = axes.map(a => {
  const score = clamp(a.score);
  const color = axisColor(score);
  return `<div class="mcp-axis">
    <div class="mcp-axis-meta">
      <span class="mcp-axis-label">${esc(a.label)}</span>
      <span class="mcp-axis-state">${esc(a.state)} ${arrow(a.direction)}</span>
    </div>
    <div class="mcp-bar"><i style="width:${score}%;background:${color}"></i></div>
    <div class="mcp-axis-foot">
      <small>${esc((a.evidence||[]).slice(0,2).join(' · '))}</small>
      <b style="color:${color}">${score}</b>
    </div>
  </div>`;
}).join('');

const style = `<style id="macro-cycle-panel-style">
.macro-cycle-panel{border-top:1px solid var(--rule);padding:48px 0;background:#ffffff;margin:0 auto;display:grid;grid-template-columns:minmax(280px,.9fr) minmax(0,1.1fr);gap:32px;align-items:start}
.mcp-kicker{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin:0 0 14px}
.mcp-phase-label{font-size:clamp(38px,5.5vw,82px);line-height:.88;letter-spacing:-.075em;font-weight:500;margin:0 0 6px}
.mcp-sub{font-size:14px;color:rgba(36,35,31,.66);line-height:1.45;margin:10px 0 22px;max-width:420px}
.mcp-action{border:1px solid var(--rule);padding:16px 18px;display:grid;grid-template-columns:1fr auto;align-items:end;gap:8px;background:rgba(255,255,255,.22)}
.mcp-action span{font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:var(--muted);display:block;margin-bottom:7px}
.mcp-action b{font-size:22px;letter-spacing:-.04em;line-height:1;font-weight:500}
.mcp-action strong{font-size:44px;letter-spacing:-.06em;line-height:.88;font-weight:500;color:var(--mcp-high,#A4502F)}
.mcp-arc{display:flex;gap:0;border:1px solid var(--rule);background:rgba(255,255,255,.16);margin-top:16px;overflow:hidden}
.mcp-phase{flex:1;padding:12px 10px;border-right:1px solid var(--rule);text-align:center;min-width:0}
.mcp-phase:last-child{border-right:none}
.mcp-phase span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}
.mcp-phase b{display:block;font-size:11px;line-height:1.2;color:var(--muted);font-weight:500}
.mcp-phase-current{background:rgba(164,80,47,.12);border-bottom:3px solid var(--mcp-high,#A4502F)}
.mcp-phase-current span{color:var(--mcp-high,#A4502F);font-weight:600}
.mcp-phase-current b{color:var(--ink);font-size:12px}
.mcp-phase-prev{background:rgba(164,80,47,.04)}
.mcp-right-head{display:flex;justify-content:space-between;align-items:end;margin-bottom:14px}
.mcp-right-head h3{font-size:clamp(22px,2.4vw,36px);letter-spacing:-.05em;font-weight:500;line-height:.96;margin:0}
.mcp-diagnosis-pill{border:1px solid var(--rule);background:rgba(255,255,255,.2);padding:8px 14px;font-size:12px;text-align:right;max-width:200px}
.mcp-diagnosis-pill span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:4px}
.mcp-diagnosis-pill b{font-size:13px;line-height:1.25;font-weight:500}
.mcp-axes{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
.mcp-axis{border:1px solid var(--rule);padding:12px 14px;background:rgba(255,255,255,.16)}
.mcp-axis-meta{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:8px}
.mcp-axis-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.mcp-axis-state{font-size:12px;font-weight:500}
.mcp-bar{height:3px;background:rgba(36,35,31,.1);position:relative}
.mcp-bar i{position:absolute;inset:0 auto 0 0;display:block;transition:width .3s}
.mcp-axis-foot{display:flex;justify-content:space-between;align-items:baseline;margin-top:7px}
.mcp-axis-foot small{font-size:10px;color:var(--muted);line-height:1.2}
.mcp-axis-foot b{font-size:16px;letter-spacing:-.04em;font-weight:500}
@media(max-width:960px){.mcp-wrap{grid-template-columns:1fr}}
@media(max-width:560px){.mcp-axes{grid-template-columns:1fr}.mcp-arc{flex-wrap:wrap}}
</style>`;

const section = `<section class="macro-cycle-panel" id="macro-cycle-panel">
  <div class="mcp-wrap">
    <div class="mcp-left">
      <p class="mcp-kicker">Cycle position · Kostolany framework</p>
      <h2 class="mcp-phase-label">${esc(egg.phase_label || egg.macro_phase)}</h2>
      <p class="mcp-sub">${esc(egg.phase_market_meaning || '')}${egg.stress_type ? ' · ' + egg.stress_type : ''}</p>
      <div class="mcp-action">
        <div><span>Capital action</span><b>${esc(egg.center_action)}</b></div>
        <strong>${esc(egg.phase_confidence)}%</strong>
      </div>
      <div class="mcp-arc">${phaseArc}</div>
    </div>
    <div class="mcp-right">
      <div class="mcp-right-head">
        <h3>Macro axes</h3>
        <div class="mcp-diagnosis-pill">
          <span>Diagnosis · ${esc(diag.confidence)}% conf</span>
          <b>${esc(diag.label)}</b>
        </div>
      </div>
      <div class="mcp-axes">${axisRows}</div>
    </div>
  </div>
</section>`;

let html = fs.readFileSync(indexPath, 'utf8');

// Remove old diagnosis and config boards if present
html = html.replace(/<style id="market-diagnosis-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="macro-configuration-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="macro-cycle-panel-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="market-diagnosis-board"[\s\S]*?<\/section>/g, '');
html = html.replace(/<section class="macro-configuration-board"[\s\S]*?<\/section>/g, '');
html = html.replace(/<section class="macro-cycle-panel"[\s\S]*?<\/section>/g, '');

html = html.replace('</head>', style + '</head>');

// Insert before decision-brief-section or current-market-state (whichever comes first).
// These are reliable top-level anchors that don't require depth tracking.
function findTopLevelSection(html, ...ids) {
  let best = -1;
  for (const id of ids) {
    const search = (s, start = 0) => {
      while (start < s.length) {
        const sec = s.indexOf('<section', start);
        if (sec < 0) return -1;
        const close = s.indexOf('>', sec);
        if (s.slice(sec, close + 1).includes(`id="${id}"`)) return sec;
        start = sec + 1;
      }
      return -1;
    };
    const pos = search(html);
    if (pos >= 0 && (best < 0 || pos < best)) best = pos;
  }
  return best;
}

const insertAt = findTopLevelSection(html, 'decision-brief-section', 'current-market-state', 'market-diagnosis-board');
if (insertAt >= 0) {
  html = html.slice(0, insertAt) + section + html.slice(insertAt);
} else {
  html = html.slice(0, html.lastIndexOf('</main>')) + section + html.slice(html.lastIndexOf('</main>'));
}

fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-cycle-panel"')) throw new Error('macro-cycle-panel injection failed');
console.log(`injected macro cycle panel into ${path.relative(root, indexPath)}`);
