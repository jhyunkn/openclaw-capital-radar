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
const clamp = n => Math.max(0, Math.min(100, Number(n) || 0));

const style = `<style id="current-market-state-style">
.current-market-state{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:linear-gradient(180deg,rgba(247,243,235,.92),rgba(239,234,224,.55));padding:34px 0}.cms-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto;border:1px solid var(--rule);background:rgba(247,243,235,.84);padding:28px}.cms-kicker,.cms-group span,.cms-metric span,.cms-anomaly span,.cms-meta span{display:block;color:var(--muted);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.16em}.cms-head{display:grid;grid-template-columns:minmax(0,1fr) 340px;gap:24px;border-bottom:1px solid var(--rule);padding-bottom:20px}.cms-title{font-size:clamp(40px,5vw,72px);line-height:.9;letter-spacing:-.078em;margin:10px 0 0;font-weight:500;color:var(--ink)}.cms-copy{max-width:800px;color:rgba(36,35,31,.68);font-size:14px;line-height:1.48;margin-top:14px}.cms-meta{border:1px solid var(--rule);background:rgba(255,255,255,.22);padding:14px;display:grid;align-content:end}.cms-meta b{display:block;font-size:28px;line-height:.94;letter-spacing:-.055em;font-weight:500;color:var(--ink);margin-top:8px}.cms-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:14px}.cms-group{border:1px solid var(--rule);background:rgba(255,255,255,.18);padding:12px;min-width:0}.cms-group h3{font-size:19px;line-height:1;letter-spacing:-.045em;font-weight:500;margin:8px 0 2px;color:var(--ink)}.cms-purpose{color:rgba(87,83,78,.72);font-size:11px;line-height:1.35;min-height:30px;margin:0 0 8px}.cms-metrics{display:grid;gap:6px}.cms-metric{border-top:1px solid var(--rule);padding-top:8px}.cms-metric-main{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;align-items:end}.cms-metric b{font-size:13px;line-height:1.05;font-weight:500;color:var(--ink)}.cms-value{font-family:var(--mono,monospace);font-size:13px;color:var(--ink);white-space:nowrap}.cms-bar{height:3px;background:rgba(201,191,173,.35);margin-top:7px;position:relative}.cms-bar i{position:absolute;inset:0 auto 0 0;background:#A4502F;display:block}.cms-metric small{display:block;color:rgba(87,83,78,.72);font-size:10px;line-height:1.25;margin-top:6px}.cms-anomaly-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px solid var(--rule);padding-top:14px;margin-top:14px}.cms-anomaly{border:1px solid rgba(164,80,47,.36);background:rgba(164,80,47,.07);padding:12px}.cms-anomaly b{display:block;font-size:18px;line-height:1.02;letter-spacing:-.04em;font-weight:500;color:var(--ink);margin-top:8px}.cms-anomaly strong{display:block;font-size:30px;line-height:.9;letter-spacing:-.055em;font-weight:500;color:#A4502F;margin-top:10px}.cms-anomaly p{color:rgba(87,83,78,.82);font-size:12px;line-height:1.38;margin:8px 0 0}.cms-anomaly em{display:block;font-style:normal;color:rgba(87,83,78,.72);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-top:9px}@media(max-width:1120px){.cms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cms-anomaly-row,.cms-head{grid-template-columns:1fr}}@media(max-width:620px){.cms-grid{grid-template-columns:1fr}.cms-title{font-size:42px}.cms-wrap{padding:18px}}
</style>`;

const metricMarkup = metric => `<article class="cms-metric"><div class="cms-metric-main"><b>${esc(metric.label)}</b><div class="cms-value">${esc(metric.value)}${metric.unit && !String(metric.value).includes(String(metric.unit)) ? ' ' + esc(metric.unit) : ''} ${arrow(metric.direction)}</div></div><div class="cms-bar"><i style="width:${clamp(metric.percentile)}%"></i></div><small>${esc(metric.percentile)} pctile · ${esc(metric.state)} · ${esc(metric.freshness)}</small><small>${esc(metric.basis)}</small></article>`;
const groupMarkup = group => `<section class="cms-group"><span>${esc(group.id)}</span><h3>${esc(group.label)}</h3><p class="cms-purpose">${esc(group.purpose)}</p><div class="cms-metrics">${(group.metrics || []).map(metricMarkup).join('')}</div></section>`;
const anomalyMarkup = item => `<article class="cms-anomaly"><span>${esc(item.id)}</span><b>${esc(item.label)}</b><strong>${esc(item.score)}</strong><p>${esc(item.why)}</p><em>${esc((item.series || []).join(' · '))}</em></article>`;

const section = `<section class="current-market-state" id="current-market-state"><div class="cms-wrap"><div class="cms-head"><div><p class="cms-kicker">Current market state · data first</p><h2 class="cms-title">The market speaks before Capital Radar interprets.</h2><p class="cms-copy">This surface shows the observed state variables first: value, percentile, direction, freshness, and evidence basis. Diagnosis, relationships, historical analogs, and portfolio posture must be derived from this layer, not placed above it.</p></div><aside class="cms-meta"><span>As of</span><b>${esc(state.asOf || state.generatedAt || 'unknown')}</b><span style="margin-top:14px">Schema</span><b>${esc(state.schema || 'market_state')}</b></aside></div><div class="cms-grid">${groups.map(groupMarkup).join('')}</div><div class="cms-anomaly-row">${anomalies.map(anomalyMarkup).join('')}</div></div></section>`;

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
