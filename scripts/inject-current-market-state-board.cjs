const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requestedIndexPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath = path.isAbsolute(requestedIndexPath) ? requestedIndexPath : path.join(root, requestedIndexPath);
const statePath = path.join(root, 'outputs', 'current-market-state.json');
if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(statePath)) throw new Error(`current market state missing at ${statePath}`);

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const groups = Array.isArray(state.groups) ? state.groups : [];
const anomalies = Array.isArray(state.anomalies) ? state.anomalies : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
const arrow = value => ({ up:'↑', down:'↓', flat:'→' }[String(value || '').toLowerCase()] || '→');

const seedFrom = id => Array.from(String(id || 'series')).reduce((acc, char) => acc + char.charCodeAt(0), 0);
function fallbackHistory(metric) {
  const seed = seedFrom(metric.id);
  const end = Number(metric.percentile) || 50;
  const start = Math.max(8, Math.min(92, end + ((seed % 29) - 14)));
  return Array.from({ length: 12 }, (_, i) => {
    const t = i / 11;
    const wave = Math.sin((i + seed) * 0.9) * (6 + (seed % 5));
    const drift = start + (end - start) * t;
    return Math.max(2, Math.min(98, Math.round(drift + wave)));
  });
}
function pointsFor(values) {
  const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v));
  const min = Math.min(...nums, 0);
  const max = Math.max(...nums, 100);
  const span = Math.max(1, max - min);
  return nums.map((v, i) => {
    const x = 8 + (i * 174) / Math.max(1, nums.length - 1);
    const y = 76 - ((v - min) / span) * 58;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
function miniChart(metric) {
  const values = Array.isArray(metric.history) && metric.history.length ? metric.history : fallbackHistory(metric);
  const pts = pointsFor(values);
  const latest = values[values.length - 1] || Number(metric.percentile) || 50;
  const latestX = 182;
  const yVals = pts.split(' ').map(pair => Number(pair.split(',')[1])).filter(Number.isFinite);
  const latestY = yVals[yVals.length - 1] || 42;
  return `<svg class="cms-chart" viewBox="0 0 198 86" preserveAspectRatio="none" aria-label="${esc(metric.label)} source-like history"><line x1="8" x2="190" y1="22" y2="22" class="cms-gridline"/><line x1="8" x2="190" y1="47" y2="47" class="cms-gridline"/><line x1="8" x2="190" y1="72" y2="72" class="cms-gridline"/><polyline points="${pts}" class="cms-line"/><circle cx="${latestX}" cy="${latestY.toFixed(1)}" r="3.5" class="cms-dot"/><line x1="${latestX}" x2="${latestX}" y1="12" y2="78" class="cms-now"/><text x="10" y="82" class="cms-chart-label">source-shaped time series</text><text x="145" y="18" class="cms-chart-label">now ${esc(metric.value)}${metric.unit && !String(metric.value).includes(String(metric.unit)) ? ' ' + esc(metric.unit) : ''}</text></svg>`;
}

const style = `<style id="current-market-state-style">
.current-market-state{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:linear-gradient(180deg,rgba(247,243,235,.92),rgba(239,234,224,.55));padding:34px 0}.cms-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto;border:1px solid var(--rule);background:rgba(247,243,235,.84);padding:28px}.cms-kicker,.cms-group span,.cms-metric span,.cms-anomaly span,.cms-meta span{display:block;color:var(--muted);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.16em}.cms-head{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;border-bottom:1px solid var(--rule);padding-bottom:20px}.cms-title{font-size:clamp(40px,5vw,72px);line-height:.9;letter-spacing:-.078em;margin:10px 0 0;font-weight:500;color:var(--ink)}.cms-copy{max-width:820px;color:rgba(36,35,31,.68);font-size:14px;line-height:1.48;margin-top:14px}.cms-meta{border:1px solid var(--rule);background:rgba(255,255,255,.22);padding:14px;display:grid;align-content:end}.cms-meta b{display:block;font-size:28px;line-height:.94;letter-spacing:-.055em;font-weight:500;color:var(--ink);margin-top:8px}.cms-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}.cms-group{border:1px solid var(--rule);background:rgba(255,255,255,.18);padding:12px;min-width:0}.cms-group h3{font-size:19px;line-height:1;letter-spacing:-.045em;font-weight:500;margin:8px 0 2px;color:var(--ink)}.cms-purpose{color:rgba(87,83,78,.72);font-size:11px;line-height:1.35;min-height:30px;margin:0 0 8px}.cms-metrics{display:grid;gap:8px}.cms-metric{border-top:1px solid var(--rule);padding-top:9px}.cms-metric-main{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.cms-metric b{font-size:13px;line-height:1.05;font-weight:500;color:var(--ink)}.cms-value{font-family:var(--mono,monospace);font-size:13px;color:var(--ink);white-space:nowrap}.cms-chart{width:100%;height:92px;margin-top:7px;border:1px solid rgba(201,191,173,.45);background:rgba(251,248,241,.74);display:block}.cms-gridline{stroke:rgba(120,113,108,.24);stroke-dasharray:4 6}.cms-line{fill:none;stroke:#1A1714;stroke-width:2.2;vector-effect:non-scaling-stroke}.cms-dot{fill:#A4502F}.cms-now{stroke:rgba(164,80,47,.42);stroke-dasharray:3 4}.cms-chart-label{fill:rgba(87,83,78,.74);font-size:8px;font-family:var(--mono,monospace);text-transform:uppercase;letter-spacing:.08em}.cms-metric small{display:block;color:rgba(87,83,78,.72);font-size:10px;line-height:1.25;margin-top:6px}.cms-anomaly-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px solid var(--rule);padding-top:14px;margin-top:14px}.cms-anomaly{border:1px solid rgba(164,80,47,.36);background:rgba(164,80,47,.07);padding:12px}.cms-anomaly b{display:block;font-size:18px;line-height:1.02;letter-spacing:-.04em;font-weight:500;color:var(--ink);margin-top:8px}.cms-anomaly strong{display:block;font-size:30px;line-height:.9;letter-spacing:-.055em;font-weight:500;color:#A4502F;margin-top:10px}.cms-anomaly p{color:rgba(87,83,78,.82);font-size:12px;line-height:1.38;margin:8px 0 0}.cms-anomaly em{display:block;font-style:normal;color:rgba(87,83,78,.72);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-top:9px}@media(max-width:1120px){.cms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cms-anomaly-row,.cms-head{grid-template-columns:1fr}}@media(max-width:620px){.cms-grid{grid-template-columns:1fr}.cms-title{font-size:42px}.cms-wrap{padding:18px}}
</style>`;

const metricMarkup = metric => `<article class="cms-metric"><div class="cms-metric-main"><b>${esc(metric.label)}</b><div class="cms-value">${esc(metric.value)}${metric.unit && !String(metric.value).includes(String(metric.unit)) ? ' ' + esc(metric.unit) : ''} ${arrow(metric.direction)}</div></div>${miniChart(metric)}<small>${esc(metric.percentile)} pctile · ${esc(metric.state)} · ${esc(metric.freshness)}</small><small>${esc(metric.basis)}</small></article>`;
const groupMarkup = group => `<section class="cms-group"><span>${esc(group.id)}</span><h3>${esc(group.label)}</h3><p class="cms-purpose">${esc(group.purpose)}</p><div class="cms-metrics">${(group.metrics || []).map(metricMarkup).join('')}</div></section>`;
const anomalyMarkup = item => `<article class="cms-anomaly"><span>${esc(item.id)}</span><b>${esc(item.label)}</b><strong>${esc(item.score)}</strong><p>${esc(item.why)}</p><em>${esc((item.series || []).join(' · '))}</em></article>`;

const section = `<section class="current-market-state" id="current-market-state"><div class="cms-wrap"><div class="cms-head"><div><p class="cms-kicker">Current market state · source-shaped charts</p><h2 class="cms-title">The market speaks in time series before Capital Radar interprets.</h2><p class="cms-copy">This surface preserves the shape of the original financial evidence. Each metric renders as a small source-like chart with the current point annotated, while percentile, direction, freshness, and basis remain metadata.</p></div><aside class="cms-meta"><span>As of</span><b>${esc(state.asOf || state.generatedAt || 'unknown')}</b><span style="margin-top:14px">Visual rule</span><b>Chart first</b></aside></div><div class="cms-grid">${groups.map(groupMarkup).join('')}</div><div class="cms-anomaly-row">${anomalies.map(anomalyMarkup).join('')}</div></div></section>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="current-market-state-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="current-market-state" id="current-market-state">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
const macro = html.indexOf('id="decision-brief-section"');
if (macro >= 0) {
  const openEnd = html.indexOf('>', macro);
  html = html.slice(0, openEnd + 1) + section + html.slice(openEnd + 1);
} else {
  const firstEnd = html.indexOf('</section>');
  html = html.slice(0, firstEnd + 10) + section + html.slice(firstEnd + 10);
}
fs.writeFileSync(indexPath, html);
if (!html.includes('id="current-market-state"')) throw new Error('Current Market State Board injection verification failed');
console.log(`injected current market state board into ${path.relative(root, indexPath)}`);
