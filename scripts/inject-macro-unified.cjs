'use strict';
// Unified macro section — replaces macro-cycle-panel, decision-brief-section,
// current-market-state, and macro-intelligence-panel with one clean section.
//
// Tier 1 (always visible): phase, brief, 6 metrics, 6 axes, top analog
// Tier 2 (collapsed):      full tape + workbench detail

const fs   = require('fs');
const path = require('path');

const root           = path.join(__dirname, '..');
const requestedPath  = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath      = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const read = (rel, fallback = {}) => {
  const p = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
};

const egg        = read('outputs/kostolany-egg-state.json');
const brief      = read('outputs/market-decision-brief-state.json');
const config     = read('outputs/macro-configuration-state.json');
const analogs    = read('outputs/macro-historical-analog-state.json');
const portfolio  = read('outputs/macro-portfolio-translation-state.json');

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const fmt = (v, unit) => {
  const n = num(v);
  if (n == null) return '—';
  if (unit === 'index') return n.toLocaleString('en-US', {maximumFractionDigits: 0});
  if (unit === '%') return n.toFixed(2) + '%';
  return String(n);
};

// ── Tier 1: Phase strip ───────────────────────────────────────────────────────
const phase     = esc(egg.phase_label || egg.macro_phase || 'Unknown');
const phaseCode = esc(egg.phase_code || '?');
const conf      = num(egg.phase_confidence) ?? 0;
const action    = esc(egg.center_action || '—');
const diagLabel = esc(config.diagnosis?.label || '—');
const diagConf  = num(config.diagnosis?.confidence) ?? 0;

const phaseStrip = `
<div class="mu-phase-strip">
  <div class="mu-phase-left">
    <span class="mu-eyebrow">Cycle position · Kostolany Phase ${phaseCode}</span>
    <b class="mu-phase-name">${phase}</b>
    <span class="mu-action">${action}</span>
  </div>
  <div class="mu-phase-right">
    <span class="mu-eyebrow">Macro diagnosis · ${diagConf}% conf</span>
    <b class="mu-diag">${diagLabel}</b>
  </div>
  <div class="mu-phase-conf">
    <span class="mu-eyebrow">Cycle confidence</span>
    <b class="mu-conf-num">${conf}%</b>
  </div>
</div>`;

// ── Tier 1: Brief text ────────────────────────────────────────────────────────
const briefText   = esc(brief.brief || '—');
const permission  = esc(brief.portfolio_action || '—');
const changeRule  = esc(brief.change_rule || '—');

const briefBlock = `
<div class="mu-brief-block">
  <p class="mu-brief-text">${briefText}</p>
  <div class="mu-permission-row">
    <div class="mu-perm"><span>Permission</span><b>${permission}</b></div>
    <div class="mu-perm"><span>Change rule</span><b>${changeRule}</b></div>
  </div>
</div>`;

// ── Tier 1: 6 key metrics ─────────────────────────────────────────────────────
const mvMap = Object.fromEntries((brief.macro_values || []).map(m => [m.key, m]));
const METRICS = [
  { key: 'spx',          label: 'S&P 500',   unit: 'index' },
  { key: 'vix',          label: 'VIX',        unit: 'vol'   },
  { key: 'dgs10',        label: '10Y',        unit: '%'     },
  { key: 'hy_oas',       label: 'HY OAS',     unit: ''      },
  { key: 'confirmation', label: 'Confirm',    unit: '/100'  },
  { key: 'rsi14',        label: 'RSI 14',     unit: ''      },
];

const metricsHtml = METRICS.map(m => {
  const mv = mvMap[m.key];
  const val = mv ? fmt(mv.value, m.unit) + (m.unit && m.unit !== 'index' && m.unit !== 'vol' && m.unit !== '/100' ? '' : '') : '—';
  const display = mv ? (m.unit === '/100' ? `${mv.value}${m.unit}` : m.unit === '%' ? val : val + (m.unit && m.unit !== 'index' ? ` ${m.unit}` : '')) : '—';
  return `<div class="mu-metric"><span>${esc(m.label)}</span><b>${esc(display)}</b></div>`;
}).join('');

const metricsBlock = `<div class="mu-metrics">${metricsHtml}</div>`;

// ── Tier 1: 6 macro axes ──────────────────────────────────────────────────────
const axes = Array.isArray(config.axes) ? config.axes : [];
const axisColor = s => s >= 75 ? '#A4502F' : s >= 50 ? '#8a6a2c' : 'rgba(36,35,31,.38)';

const axesHtml = axes.map(a => {
  const score = Math.max(0, Math.min(100, Number(a.score) || 0));
  const color = axisColor(score);
  return `<div class="mu-axis">
    <div class="mu-axis-head">
      <span>${esc(a.label)}</span>
      <b style="color:${color}">${esc(a.state)}</b>
    </div>
    <div class="mu-bar"><i style="width:${score}%;background:${color}"></i></div>
    <span class="mu-axis-score">${score}</span>
  </div>`;
}).join('');

const axesBlock = `<div class="mu-axes">${axesHtml}</div>`;

// ── Tier 1: Top analog + posture ──────────────────────────────────────────────
const topAnalog  = (analogs.analogs || [])[0] || {};
const posture    = portfolio.posture || {};

const analogBlock = topAnalog.period ? `
<div class="mu-bottom-grid">
  <div class="mu-analog-card">
    <div class="mu-analog-head">
      <div>
        <span class="mu-eyebrow">Closest historical analog</span>
        <b class="mu-analog-period">${esc(topAnalog.period)}</b>
        <span class="mu-analog-label">${esc(topAnalog.label)}</span>
      </div>
      <b class="mu-similarity">${esc(topAnalog.similarity)}%</b>
    </div>
    <p class="mu-lesson">${esc(topAnalog.portfolioLesson)}</p>
  </div>
  <div class="mu-posture-card">
    <span class="mu-eyebrow">Portfolio posture</span>
    <b class="mu-posture-label">${esc(posture.label || '—')}</b>
    <p class="mu-posture-detail">${esc(posture.equityPosture || '')}${posture.durationPosture ? ' · ' + posture.durationPosture : ''}</p>
  </div>
</div>` : '';

// ── Tier 2: extract existing section HTML for collapsed detail ────────────────
let html = fs.readFileSync(indexPath, 'utf8');

function extractSectionHtml(html, id) {
  let s = 0;
  while (s < html.length) {
    const i = html.indexOf('<section', s);
    if (i < 0) return '';
    const j = html.indexOf('>', i);
    if (html.slice(i, j + 1).includes(`id="${id}"`)) {
      // Find the next top-level section to delimit this one
      let next = html.length;
      let search = j + 1;
      while (search < html.length) {
        const ni = html.indexOf('<section', search);
        if (ni < 0) break;
        const nj = html.indexOf('>', ni);
        const tag = html.slice(ni, nj + 1);
        // Only count top-level sections (not nested ones without id)
        if (tag.includes('id=') && ni !== i) { next = ni; break; }
        search = ni + 1;
      }
      return html.slice(i, next);
    }
    s = i + 1;
  }
  return '';
}

// Strip section id when embedding in tier 2 so nested ids don't pollute the top-level section list
function archiveId(sectionHtml) {
  return sectionHtml.replace(/(<section[^>]*)\sid="([^"]*)"/, '$1 data-macro-archived="$2"');
}
const dbHtml  = archiveId(extractSectionHtml(html, 'decision-brief-section'));
const cmsHtml = archiveId(extractSectionHtml(html, 'current-market-state'));

// Remaining analogs (2 and 3)
const remainingAnalogs = (analogs.analogs || []).slice(1).map(a => `
  <div class="mu-analog-extra">
    <div class="mu-analog-head">
      <div>
        <b class="mu-analog-period">${esc(a.period)}</b>
        <span class="mu-analog-label">${esc(a.label)}</span>
      </div>
      <b class="mu-similarity">${esc(a.similarity)}%</b>
    </div>
    <p class="mu-lesson">${esc(a.portfolioLesson)}</p>
  </div>`).join('');

const detailSection = `
<details class="mu-details">
  <summary class="mu-details-toggle">Full macro analysis — workbenches, full tape, all analogs ↓</summary>
  <div class="mu-details-body">
    ${remainingAnalogs ? `<div class="mu-detail-group"><h4>Additional historical analogs</h4>${remainingAnalogs}</div>` : ''}
    ${cmsHtml ? `<div class="mu-detail-group">${cmsHtml}</div>` : ''}
    ${dbHtml  ? `<div class="mu-detail-group">${dbHtml}</div>`  : ''}
  </div>
</details>`;

// ── CSS ───────────────────────────────────────────────────────────────────────
const style = `<style id="macro-unified-style">
.macro-unified{border-bottom:1px solid var(--rule);padding:0;background:linear-gradient(180deg,rgba(247,243,235,.9),rgba(239,234,224,.6))}
.mu-wrap{width:min(1280px,calc(100% - 48px));margin:0 auto;padding:40px 0}
.mu-eyebrow{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin-bottom:6px}

/* Phase strip */
.mu-phase-strip{display:grid;grid-template-columns:1fr 1fr auto;gap:16px;align-items:start;padding-bottom:24px;border-bottom:1px solid var(--rule);margin-bottom:24px}
.mu-phase-name{display:block;font-size:clamp(32px,4vw,56px);letter-spacing:-.065em;font-weight:500;line-height:.95;margin:4px 0 8px}
.mu-action{font-size:15px;color:rgba(36,35,31,.72)}
.mu-diag{display:block;font-size:clamp(16px,1.8vw,24px);letter-spacing:-.04em;font-weight:500;line-height:1.1;margin-top:4px}
.mu-conf-num{display:block;font-size:clamp(42px,5vw,72px);letter-spacing:-.07em;font-weight:500;line-height:.9;color:var(--mcp-high,#A4502F);text-align:right}

/* Brief */
.mu-brief-block{margin-bottom:24px}
.mu-brief-text{font-size:clamp(18px,1.8vw,26px);line-height:1.2;letter-spacing:-.035em;color:rgba(36,35,31,.9);margin:0 0 14px;max-width:1100px}
.mu-permission-row{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.mu-perm{border:1px solid var(--rule);padding:12px 16px;background:rgba(255,255,255,.22)}
.mu-perm span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:5px}
.mu-perm b{font-size:14px;line-height:1.3;font-weight:500}

/* Metrics */
.mu-metrics{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:20px}
.mu-metric{border:1px solid var(--rule);background:rgba(255,255,255,.2);padding:12px 14px}
.mu-metric span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:6px}
.mu-metric b{font-size:22px;letter-spacing:-.04em;font-weight:500;line-height:1}

/* Axes */
.mu-axes{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:24px}
.mu-axis{border:1px solid var(--rule);background:rgba(255,255,255,.18);padding:10px 12px}
.mu-axis-head{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:7px}
.mu-axis-head span{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.mu-axis-head b{font-size:11px;font-weight:600}
.mu-bar{height:3px;background:rgba(36,35,31,.1)}
.mu-bar i{display:block;height:100%}
.mu-axis-score{display:block;font-size:18px;letter-spacing:-.04em;font-weight:500;margin-top:6px}

/* Bottom grid: analog + posture */
.mu-bottom-grid{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(0,.8fr);gap:16px;margin-bottom:24px}
.mu-analog-card,.mu-posture-card{border:1px solid var(--rule);background:rgba(255,255,255,.2);padding:16px 18px}
.mu-analog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
.mu-analog-period{display:block;font-size:28px;letter-spacing:-.05em;font-weight:500;line-height:.95}
.mu-analog-label{display:block;font-size:12px;color:var(--muted);margin-top:4px}
.mu-similarity{font-size:36px;letter-spacing:-.06em;font-weight:500;color:#A4502F;line-height:.9}
.mu-lesson{font-size:13px;line-height:1.4;margin:0;color:rgba(36,35,31,.78)}
.mu-posture-label{display:block;font-size:clamp(16px,1.6vw,22px);letter-spacing:-.04em;font-weight:500;line-height:1.1;margin:6px 0 8px}
.mu-posture-detail{font-size:12px;color:var(--muted);line-height:1.4;margin:0}

/* Collapsed detail */
.mu-details{border-top:1px solid var(--rule);margin-top:4px}
.mu-details-toggle{cursor:pointer;padding:14px 0;font-size:13px;color:var(--muted);list-style:none;letter-spacing:.01em}
.mu-details-toggle::-webkit-details-marker{display:none}
.mu-details-toggle:hover{color:var(--ink)}
.mu-details-body{border-top:1px solid var(--rule);padding-top:24px}
.mu-detail-group{margin-bottom:32px}
.mu-detail-group h4{font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin:0 0 12px;border-bottom:1px solid var(--rule);padding-bottom:10px}
.mu-analog-extra{border:1px solid var(--rule);padding:14px 16px;background:rgba(255,255,255,.15);margin-bottom:8px}

@media(max-width:1100px){.mu-phase-strip{grid-template-columns:1fr 1fr}.mu-conf-num{text-align:left}}
@media(max-width:900px){.mu-phase-strip{grid-template-columns:1fr}.mu-metrics{grid-template-columns:repeat(3,1fr)}.mu-axes{grid-template-columns:repeat(3,1fr)}.mu-bottom-grid{grid-template-columns:1fr}.mu-permission-row{grid-template-columns:1fr}}
@media(max-width:560px){.mu-metrics{grid-template-columns:repeat(2,1fr)}.mu-axes{grid-template-columns:repeat(2,1fr)}}
</style>`;

// ── Assemble section ──────────────────────────────────────────────────────────
const section = `<section id="macro-unified-section" class="macro-unified">
  <div class="mu-wrap">
    ${phaseStrip}
    ${briefBlock}
    ${metricsBlock}
    ${axesBlock}
    ${analogBlock}
    ${detailSection}
  </div>
</section>`;

// ── Remove old macro sections + insert unified ────────────────────────────────
const removeIds = [
  'macro-cycle-panel', 'decision-brief-section', 'current-market-state', 'macro-intelligence-panel'
];

// Remove old styles
html = html.replace(/<style id="macro-cycle-panel-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="macro-intelligence-panel-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="current-market-state-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="macro-unified-style">[\s\S]*?<\/style>/g, '');
html = html.replace('</head>', style + '</head>');

// Find the earliest of the 4 sections — insert unified before it, remove all 4
function findSectionPos(html, id) {
  let s = 0;
  while (s < html.length) {
    const i = html.indexOf('<section', s);
    if (i < 0) return -1;
    const j = html.indexOf('>', i);
    if (html.slice(i, j + 1).includes(`id="${id}"`)) return i;
    s = i + 1;
  }
  return -1;
}

// Find insertion point (earliest of the 4)
const positions = removeIds.map(id => ({ id, pos: findSectionPos(html, id) })).filter(x => x.pos >= 0);
positions.sort((a, b) => a.pos - b.pos);
const insertBefore = positions[0]?.pos ?? html.lastIndexOf('</main>');

// Remove all 4 sections (work backwards through the HTML)
// Strategy: remove from last to first so positions stay valid
const toRemove = [];
for (const id of removeIds) {
  const start = findSectionPos(html, id);
  if (start < 0) continue;
  // Find end: next top-level section or </main>
  let s = start + 1;
  let end = html.length;
  while (s < html.length) {
    const ni = html.indexOf('<section', s);
    if (ni < 0) break;
    const nj = html.indexOf('>', ni);
    const tag = html.slice(ni, nj + 1);
    if (tag.includes('id=') && ni !== start) { end = ni; break; }
    s = ni + 1;
  }
  // Also check </main>
  const mainClose = html.lastIndexOf('</main>');
  if (mainClose > start && mainClose < end) end = mainClose;
  toRemove.push({ start, end });
}
toRemove.sort((a, b) => b.start - a.start);

// Remove all target sections
for (const { start, end } of toRemove) {
  html = html.slice(0, start) + html.slice(end);
}

// Insert unified section at the right place (recalculate position after removals)
const insertPos = findSectionPos(html, 'operational-chart-section');
if (insertPos >= 0) {
  html = html.slice(0, insertPos) + section + html.slice(insertPos);
} else {
  const mainClose = html.lastIndexOf('</main>');
  html = html.slice(0, mainClose) + section + html.slice(mainClose);
}

fs.writeFileSync(indexPath, html);

if (!html.includes('id="macro-unified-section"')) throw new Error('macro-unified-section injection failed');
console.log(`injected unified macro section into ${path.relative(root, indexPath)}`);
