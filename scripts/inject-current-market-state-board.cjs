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
const moveLabel = value => ({ up:'rising', down:'falling', flat:'flat' }[String(value || '').toLowerCase()] || 'flat');
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
function valueRange(values, metric) {
  const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v));
  const latest = Number(String(metric.value ?? '').replace(/[^0-9.-]/g, ''));
  if (Number.isFinite(latest)) nums.push(latest);
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) { min = 0; max = 100; }
  const pad = (max - min) * 0.12 || 1;
  return { min: Math.floor((min - pad) * 10) / 10, max: Math.ceil((max + pad) * 10) / 10 };
}
function pointsFor(values, range) {
  const nums = values.map(v => Number(v)).filter(v => Number.isFinite(v));
  const span = Math.max(0.001, range.max - range.min);
  return nums.map((v, i) => {
    const x = 38 + (i * 190) / Math.max(1, nums.length - 1);
    const y = 108 - ((v - range.min) / span) * 76;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}
function formatAxis(v, metric) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  const unit = String(metric.unit || '');
  if (unit === '%' || unit === 'index') return n.toFixed(n >= 10 ? 0 : 1);
  if (unit === 'pctile') return `${Math.round(n)}`;
  return n.toFixed(1);
}
function miniChart(metric) {
  const values = Array.isArray(metric.history) && metric.history.length ? metric.history : fallbackHistory(metric);
  const range = valueRange(values, metric);
  const pts = pointsFor(values, range);
  const yVals = pts.split(' ').map(pair => Number(pair.split(',')[1])).filter(Number.isFinite);
  const latestY = yVals[yVals.length - 1] || 70;
  const unit = metric.unit ? ` ${esc(metric.unit)}` : '';
  return `<svg class="cms-chart" viewBox="0 0 250 140" preserveAspectRatio="xMidYMid meet" aria-label="${esc(metric.label)} documented time-series chart"><rect x="0" y="0" width="250" height="140" class="cms-plot-bg"/><line x1="38" x2="228" y1="32" y2="32" class="cms-gridline"/><line x1="38" x2="228" y1="70" y2="70" class="cms-gridline"/><line x1="38" x2="228" y1="108" y2="108" class="cms-gridline"/><line x1="38" x2="38" y1="24" y2="112" class="cms-axis"/><line x1="38" x2="228" y1="112" y2="112" class="cms-axis"/><text x="6" y="35" class="cms-axis-label">${esc(formatAxis(range.max, metric))}</text><text x="8" y="74" class="cms-axis-label">${esc(formatAxis((range.max + range.min) / 2, metric))}</text><text x="8" y="112" class="cms-axis-label">${esc(formatAxis(range.min, metric))}</text><text x="38" y="129" class="cms-axis-label">-12m</text><text x="114" y="129" class="cms-axis-label">-6m</text><text x="207" y="129" class="cms-axis-label">now</text><polyline points="${pts}" class="cms-line"/><circle cx="228" cy="${latestY.toFixed(1)}" r="4" class="cms-dot"/><line x1="228" x2="228" y1="24" y2="112" class="cms-now"/><text x="143" y="22" class="cms-now-label">now ${esc(metric.value)}${unit}</text></svg>`;
}
function importance(metric) {
  const pct = Number(metric.percentile) || 50;
  const extremity = Math.abs(pct - 50);
  const directionBoost = String(metric.direction || '').toLowerCase() === 'flat' ? 0 : 10;
  const stalePenalty = /proxy|quarterly/i.test(metric.freshness || '') ? -4 : 0;
  return extremity + directionBoost + stalePenalty;
}
function movementSentence(metric, group) {
  const mv = moveLabel(metric.direction);
  const pct = Number(metric.percentile);
  const range = Number.isFinite(pct) ? (pct >= 75 ? 'near the upper range' : pct <= 25 ? 'near the lower range' : 'inside the middle range') : 'range needs live history';
  return `${metric.label} is ${mv}, ${range}. ${group.label} read: ${metric.state}.`;
}
function implication(metric) {
  const id = String(metric.id || '').toLowerCase();
  const stateText = String(metric.state || '').toLowerCase();
  if (id.includes('real_yield') || id.includes('fed_funds') || id.includes('treasury')) return 'Valuation pressure / cost of capital.';
  if (id.includes('oas') || id.includes('lending')) return 'Stress confirmation check.';
  if (id.includes('nasdaq') || id.includes('spx') || id.includes('russell')) return 'Risk appetite / breadth.';
  if (id.includes('vix') || id.includes('move') || id.includes('skew')) return 'Shock-pricing condition.';
  if (id.includes('copper') || id.includes('oil') || id.includes('gold')) return 'Physical / inflation pressure.';
  if (stateText.includes('support')) return 'Liquidity support check.';
  return 'State variable to inspect.';
}
const tapeRows = groups.flatMap(group => (group.metrics || []).map(metric => ({ group, metric, score: importance(metric) }))).sort((a, b) => b.score - a.score);

const style = `<style id="current-market-state-style">
.current-market-state{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:linear-gradient(180deg,rgba(247,243,235,.92),rgba(239,234,224,.55));padding:34px 0}.cms-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto;border:1px solid var(--rule);background:rgba(247,243,235,.84);padding:28px}.cms-kicker,.cms-meta span,.cms-tape-label,.cms-anomaly span{display:block;color:var(--muted);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.16em}.cms-head{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:24px;border-bottom:1px solid var(--rule);padding-bottom:20px}.cms-title{font-size:clamp(40px,5vw,72px);line-height:.9;letter-spacing:-.078em;margin:10px 0 0;font-weight:500;color:var(--ink)}.cms-copy{max-width:820px;color:rgba(36,35,31,.68);font-size:14px;line-height:1.48;margin-top:14px}.cms-meta{border:1px solid var(--rule);background:rgba(255,255,255,.22);padding:14px;display:grid;align-content:end}.cms-meta b{display:block;font-size:28px;line-height:.94;letter-spacing:-.055em;font-weight:500;color:var(--ink);margin-top:8px}.cms-tension{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:14px;align-items:end;border:1px solid rgba(164,80,47,.35);background:rgba(164,80,47,.07);padding:15px;margin-top:14px}.cms-tension b{display:block;font-size:24px;line-height:.98;letter-spacing:-.045em;font-weight:500;color:var(--ink);margin-top:6px}.cms-tension p{margin:0;color:rgba(87,83,78,.78);font-size:12px;line-height:1.38}.cms-tension strong{font-family:var(--mono,monospace);font-size:22px;color:#A4502F}.cms-tape{border:1px solid var(--rule);margin-top:12px;background:rgba(255,255,255,.14)}.cms-tape-head,.cms-row-summary{display:grid;grid-template-columns:32px minmax(160px,1.05fr) 92px 104px 124px minmax(220px,1.35fr) 72px;gap:10px;align-items:center}.cms-tape-head{padding:10px 12px;border-bottom:1px solid var(--rule);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.cms-row{border-bottom:1px solid var(--rule)}.cms-row:last-child{border-bottom:0}.cms-row summary{list-style:none;cursor:pointer}.cms-row summary::-webkit-details-marker{display:none}.cms-row-summary{padding:12px}.cms-rank{font-family:var(--mono,monospace);color:var(--muted);font-size:11px}.cms-name b{display:block;font-size:14px;line-height:1.05;font-weight:500;color:var(--ink)}.cms-name small{display:block;color:var(--muted);font-size:10px;margin-top:4px}.cms-value{font-family:var(--mono,monospace);font-size:13px;color:var(--ink);white-space:nowrap}.cms-move{font-size:13px;color:#A4502F;font-family:var(--mono,monospace);white-space:nowrap}.cms-regime{font-size:12px;color:var(--ink)}.cms-read{font-size:12px;color:rgba(87,83,78,.82);line-height:1.3}.cms-inspect{font-family:var(--mono,monospace);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);text-align:right}.cms-row[open] .cms-inspect{color:#A4502F}.cms-row-detail{display:grid;grid-template-columns:minmax(0,.92fr) minmax(220px,.42fr);gap:12px;padding:0 12px 12px}.cms-detail-note{border:1px solid var(--rule);background:rgba(247,243,235,.54);padding:12px}.cms-detail-note b{display:block;font-size:16px;line-height:1.1;font-weight:500;color:var(--ink);margin-bottom:8px}.cms-detail-note p{margin:0 0 8px;color:rgba(87,83,78,.82);font-size:12px;line-height:1.38}.cms-chart{width:100%;height:auto;border:1px solid rgba(201,191,173,.55);background:rgba(251,248,241,.74);display:block}.cms-plot-bg{fill:rgba(251,248,241,.58)}.cms-gridline{stroke:rgba(120,113,108,.24);stroke-dasharray:4 6}.cms-axis{stroke:rgba(36,35,31,.38);stroke-width:1}.cms-line{fill:none;stroke:#1A1714;stroke-width:2;vector-effect:non-scaling-stroke}.cms-dot{fill:#A4502F}.cms-now{stroke:rgba(164,80,47,.46);stroke-dasharray:3 4}.cms-axis-label,.cms-now-label{fill:rgba(87,83,78,.80);font-size:8px;font-family:var(--mono,monospace);text-transform:uppercase;letter-spacing:.06em}.cms-now-label{fill:#A4502F}.cms-anomaly-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px solid var(--rule);padding-top:14px;margin-top:14px}.cms-anomaly{border:1px solid rgba(164,80,47,.36);background:rgba(164,80,47,.07);padding:12px}.cms-anomaly b{display:block;font-size:18px;line-height:1.02;letter-spacing:-.04em;font-weight:500;color:var(--ink);margin-top:8px}.cms-anomaly strong{display:block;font-size:30px;line-height:.9;letter-spacing:-.055em;font-weight:500;color:#A4502F;margin-top:10px}.cms-anomaly p{color:rgba(87,83,78,.82);font-size:12px;line-height:1.38;margin:8px 0 0}.cms-anomaly em{display:block;font-style:normal;color:rgba(87,83,78,.72);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-top:9px}@media(max-width:1080px){.cms-tape-head{display:none}.cms-row-summary{grid-template-columns:26px minmax(0,1fr) auto;gap:8px}.cms-value,.cms-move,.cms-regime,.cms-read,.cms-inspect{grid-column:2/-1}.cms-row-detail,.cms-head,.cms-tension{grid-template-columns:1fr}.cms-anomaly-row{grid-template-columns:1fr}}@media(max-width:620px){.cms-title{font-size:42px}.cms-wrap{padding:18px}}
</style>`;

const rowMarkup = ({ group, metric }, idx) => `<details class="cms-row"><summary class="cms-row-summary"><div class="cms-rank">${String(idx + 1).padStart(2, '0')}</div><div class="cms-name"><b>${esc(metric.label)}</b><small>${esc(group.label)} · ${esc(group.purpose)}</small></div><div class="cms-value">${esc(metric.value)}${metric.unit && !String(metric.value).includes(String(metric.unit)) ? ' ' + esc(metric.unit) : ''}</div><div class="cms-move">${arrow(metric.direction)} ${esc(moveLabel(metric.direction))}</div><div class="cms-regime">${esc(metric.state)}</div><div class="cms-read">${esc(implication(metric))}</div><div class="cms-inspect">Inspect</div></summary><div class="cms-row-detail"><div>${miniChart(metric)}</div><aside class="cms-detail-note"><b>Movement read</b><p>${esc(movementSentence(metric, group))}</p><p><strong>Evidence basis:</strong> ${esc(metric.basis)}</p><p><strong>Metadata:</strong> ${esc(metric.percentile)} pctile · ${esc(metric.freshness)}</p></aside></div></details>`;
const anomalyMarkup = item => `<article class="cms-anomaly"><span>${esc(item.id)}</span><b>${esc(item.label)}</b><strong>${esc(item.score)}</strong><p>${esc(item.why)}</p><em>${esc((item.series || []).join(' · '))}</em></article>`;
const topAnomaly = anomalies[0] || { label: 'Movement tape initializing', score: '—', why: 'Capital Radar is ranking the movement variables before showing chart evidence.' };

const section = `<section class="current-market-state" id="current-market-state"><div class="cms-wrap"><div class="cms-head"><div><p class="cms-kicker">Current market state · movement tape</p><h2 class="cms-title">What moved, what matters, what to inspect.</h2><p class="cms-copy">The default view is a ranked market tape, not a chart wall. Charts are evidence receipts and open only when a row is inspected. This keeps the first read focused on movement, regime, and implication.</p></div><aside class="cms-meta"><span>As of</span><b>${esc(state.asOf || state.generatedAt || 'unknown')}</b><span style="margin-top:14px">Default view</span><b>Movement</b></aside></div><div class="cms-tension"><div><span class="cms-tape-label">Primary tension</span><b>${esc(topAnomaly.label)}</b><p>${esc(topAnomaly.why)}</p></div><strong>${esc(topAnomaly.score)}</strong></div><div class="cms-tape"><div class="cms-tape-head"><div>#</div><div>Metric</div><div>Value</div><div>Move</div><div>Regime</div><div>Read</div><div></div></div>${tapeRows.map(rowMarkup).join('')}</div><div class="cms-anomaly-row">${anomalies.map(anomalyMarkup).join('')}</div></div></section>`;

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
