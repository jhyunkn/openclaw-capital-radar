const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

function readJson(rel) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); }
  catch { return null; }
}

function rows(series) {
  return Array.isArray(series)
    ? series.filter(r => r && r.date && Number.isFinite(Number(r.value))).map(r => ({ date: r.date, value: Number(r.value) }))
    : [];
}

function percentile(values, current) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length || !Number.isFinite(Number(current))) return null;
  return Math.round((sorted.filter(v => v <= current).length / sorted.length) * 100);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

function metric(label, source, series) {
  const data = rows(series);
  const last = data[data.length - 1] || {};
  const p = percentile(data.map(d => d.value), last.value);
  const zone = p == null ? 'Pending' : p >= 75 ? 'High' : p <= 25 ? 'Low' : 'Mid';
  return { label, source, data, current: last.value, date: last.date, percentile: p, zone };
}

function svgSpark(metric) {
  const data = metric.data;
  if (data.length < 2) return '<div class="ea-spark-empty">No series</div>';
  const w = 240, h = 68, pad = 8;
  const vals = data.map(d => d.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const span = Math.max(0.000001, max - min);
  const pts = data.map((d, i) => {
    const x = pad + i * (w - pad * 2) / (data.length - 1);
    const y = pad + (1 - (d.value - min) / span) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  const median = vals.slice().sort((a, b) => a - b)[Math.floor(vals.length / 2)];
  const yMed = pad + (1 - (median - min) / span) * (h - pad * 2);
  const yLast = pad + (1 - (data[data.length - 1].value - min) / span) * (h - pad * 2);
  return `<svg class="ea-spark" viewBox="0 0 ${w} ${h}"><line x1="${pad}" y1="${yMed.toFixed(1)}" x2="${w - pad}" y2="${yMed.toFixed(1)}" class="ea-med"/><polyline points="${pts}" class="ea-line"/><circle cx="${w - pad}" cy="${yLast.toFixed(1)}" r="3.2" class="ea-dot"/></svg>`;
}

function card(m) {
  const current = Number.isFinite(Number(m.current)) ? Number(m.current).toFixed(Math.abs(m.current) < 10 ? 2 : 1) : '—';
  const pct = m.percentile == null ? '—' : `${m.percentile}%`;
  return `<article class="ea-card"><span>${esc(m.source)}</span><b>${esc(m.label)}</b>${svgSpark(m)}<div class="ea-row"><em>Current</em><strong>${esc(current)}</strong></div><div class="ea-row"><em>Percentile</em><strong>${esc(pct)}</strong></div><div class="ea-row"><em>Zone</em><strong>${esc(m.zone)}</strong></div></article>`;
}

const fx = readJson('data/cache/fx-dollar-series.json');
const vol = readJson('data/cache/volatility-series.json');
const cmd = readJson('data/cache/commodities-series.json');
const real = readJson('data/cache/real-assets-series.json');

const metrics = [
  metric('DXY', 'FX & Funding', fx?.series?.DXY),
  metric('VIX', 'Volatility', vol?.series?.VIX),
  metric('MOVE', 'Volatility', vol?.series?.MOVE),
  metric('Oil', 'Commodities', cmd?.series?.OIL),
  metric('Copper', 'Commodities', cmd?.series?.COPPER),
  metric('Housing Price Index', 'Real Assets', real?.series?.HPI)
];

const config = [
  ['Dollar / funding', metrics[0].percentile >= 65 ? 'Firm' : 'Mid', `DXY ${metrics[0].percentile ?? '—'} percentile`],
  ['Disorder pricing', metrics[1].percentile >= 65 || metrics[2].percentile >= 65 ? 'Elevated' : 'Contained', `VIX ${metrics[1].percentile ?? '—'} / MOVE ${metrics[2].percentile ?? '—'}`],
  ['Physical constraint', metrics[3].percentile >= 65 || metrics[4].percentile >= 65 ? 'Tightening' : 'Neutral', `Oil ${metrics[3].percentile ?? '—'} / Copper ${metrics[4].percentile ?? '—'}`],
  ['Collateral', metrics[5].percentile >= 75 ? 'Expensive' : 'Mid', `HPI ${metrics[5].percentile ?? '—'} percentile`]
];

const style = `<style id="evidence-annotation-layer-style">
.evidence-annotation-layer{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.22);padding:34px 0}.ea-wrap{width:min(1180px,calc(100% - 36px));margin:0 auto}.ea-kicker,.ea-card span,.ea-config span,.ea-row em{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.11em;font-style:normal}.ea-title{font-size:clamp(30px,4vw,54px);line-height:.98;letter-spacing:-.055em;margin:8px 0 12px}.ea-sub{max-width:780px;color:var(--muted);font-size:14px;line-height:1.45}.ea-flow,.ea-grid,.ea-config{display:grid;gap:10px}.ea-flow{grid-template-columns:repeat(3,1fr);margin:18px 0}.ea-grid{grid-template-columns:repeat(3,1fr)}.ea-config{grid-template-columns:repeat(4,1fr);margin-top:12px}.ea-flow article,.ea-card,.ea-config article{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.26);padding:14px}.ea-flow b,.ea-card b,.ea-config b{display:block;font-weight:500;margin-top:6px}.ea-spark{width:100%;height:auto;margin:10px 0}.ea-line{fill:none;stroke:rgba(36,35,31,.72);stroke-width:2}.ea-med{stroke:rgba(36,35,31,.24);stroke-dasharray:4 4}.ea-dot{fill:var(--earth,#A4502F)}.ea-row{display:grid;grid-template-columns:1fr auto;border-top:1px solid var(--rule);padding-top:7px;margin-top:7px;gap:8px}.ea-row strong{font-size:14px;font-weight:500}.ea-config b{font-size:20px}.ea-config small{display:block;color:var(--muted);font-size:11px;line-height:1.3;margin-top:5px}.ea-note{color:var(--muted);font-size:12px;line-height:1.4;margin-top:14px}@media(max-width:900px){.ea-grid{grid-template-columns:repeat(2,1fr)}.ea-config,.ea-flow{grid-template-columns:1fr 1fr}}@media(max-width:620px){.ea-grid,.ea-config,.ea-flow{grid-template-columns:1fr}}
</style>`;

const section = `<section class="evidence-annotation-layer" id="evidence-annotation-layer"><div class="ea-wrap"><p class="ea-kicker">Evidence annotation prototype</p><h2 class="ea-title">Raw data first. Annotation second. Configuration third.</h2><p class="ea-sub">This is the visual bridge between asset-class workbenches and the intelligence layer. Each card shows seed history, current value, percentile position, and a configuration read.</p><div class="ea-flow"><article><span>01 Raw evidence</span><b>Historical series remains visible.</b></article><article><span>02 Annotation</span><b>Current value, percentile, zone.</b></article><article><span>03 Configuration</span><b>Market state inferred from visible evidence.</b></article></div><div class="ea-grid">${metrics.map(card).join('')}</div><div class="ea-config">${config.map(([k,v,e]) => `<article><span>${esc(k)}</span><b>${esc(v)}</b><small>${esc(e)}</small></article>`).join('')}</div><p class="ea-note">Traceability rule: every configuration label above is derived from visible chart annotations. Historical analog scoring is intentionally not active yet.</p></div></section>`;

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="evidence-annotation-layer-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="evidence-annotation-layer" id="evidence-annotation-layer">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
if (/<main[^>]*>/.test(html)) html = html.replace(/(<main[^>]*>)/, `$1${section}`);
else html = html.replace(/(<body[^>]*>)/, `$1${section}`);
fs.writeFileSync(indexPath, html);
console.log('injected evidence annotation layer');
