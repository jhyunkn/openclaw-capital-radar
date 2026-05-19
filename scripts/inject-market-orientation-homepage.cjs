const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const mapPath = path.join(root, 'outputs', 'market-orientation-map.json');

function fail(message) {
  console.error(`MARKET ORIENTATION HOMEPAGE INJECTION FAILED: ${message}`);
  process.exit(1);
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function cls(value) {
  const text = String(value ?? '').toLowerCase();
  if (/stress|stressed|avoid|invalid|tight|weak|risk|threat/.test(text)) return 'bad';
  if (/mixed|watch|neutral|monitor|dependent|caution/.test(text)) return 'warn';
  if (/expand|expanding|support|bullish|lean|positive|quality/.test(text)) return 'good';
  return 'warn';
}

function list(items) { return Array.isArray(items) ? items : []; }

if (!fs.existsSync(indexPath)) fail('index.html missing');
if (!fs.existsSync(mapPath)) fail('outputs/market-orientation-map.json missing');

const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
let html = fs.readFileSync(indexPath, 'utf8');

const themeCards = list(map.themes).slice(0, 6).map(theme => {
  const tickers = list(theme.tickers).map(t => `<span>${esc(t.ticker)} <em>${Number(t.weightPct || 0).toFixed(1)}%</em></span>`).join('');
  const deps = list(theme.dependencies).slice(0, 5).map(x => `<span>${esc(x.replace(/_/g, ' '))}</span>`).join('');
  const question = list(theme.watchQuestions)[0] || 'What confirms or invalidates this structural pressure?';
  return `<article class="orientation-node ${cls(theme.pressureState)}"><div class="node-top"><span>${esc(theme.phase || 'phase pending')}</span><b>${esc(theme.pressureState || 'mixed')}</b></div><h3>${esc(theme.title)}</h3><p>${esc(theme.directionalBias || 'Directional bias pending.')}</p><div class="node-deps">${deps}</div><div class="node-tickers">${tickers}</div><small>${esc(question)}</small></article>`;
}).join('');

const layers = list(map.layers).map(layer => `<article><span>${esc(layer.role || layer.id)}</span><b>${esc(layer.title)}</b><small>${esc(layer.question)}</small></article>`).join('');
const thesis = map.directionalThesis || {};
const weather = map.macroWeather || {};

const orientationHtml = `
<div id="market-orientation" class="market-orientation-surface" data-orientation-map="true">
  <div class="orientation-kicker">Capital Radar / Market Orientation Map</div>
  <div class="orientation-hero">
    <div>
      <h2>Market Weather → Structural Pressure → Decision Direction</h2>
      <p>${esc(thesis.summary || 'Capital Radar orients macro regime, structural pressure, holdings, and opportunity discovery through one map surface.')}</p>
    </div>
    <div class="weather-stack">
      <article><span>Posture</span><b class="${cls(weather.posture)}">${esc(weather.posture || 'mixed')}</b></article>
      <article><span>Stress</span><b class="${cls(weather.stress)}">${esc(weather.stress || 'monitoring')}</b></article>
      <article><span>10Y</span><b>${esc(weather.tenYearYield ?? '—')}</b></article>
      <article><span>HY OAS</span><b>${esc(weather.highYieldOAS ?? '—')}</b></article>
    </div>
  </div>
  <div class="orientation-layers">${layers}</div>
  <div class="orientation-map-grid">${themeCards}</div>
  <div class="thesis-corridor">
    <article><span>Lean into</span>${list(thesis.leanInto).map(x => `<b>${esc(x)}</b>`).join('')}</article>
    <article><span>Avoid</span>${list(thesis.avoid).map(x => `<b>${esc(x)}</b>`).join('')}</article>
    <article><span>Invalidates if</span>${list(thesis.invalidateIf).map(x => `<b>${esc(x)}</b>`).join('')}</article>
  </div>
</div>`;

const orientationCss = `
<style id="market-orientation-css">
.market-orientation-surface{margin-top:28px;padding:34px clamp(16px,3vw,36px);border:1px solid rgba(36,35,31,.12);border-radius:24px;background:radial-gradient(circle at 16% 0%,rgba(36,35,31,.08),transparent 32%),rgba(251,250,246,.35)}.orientation-kicker{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:rgba(36,35,31,.52);margin-bottom:16px}.orientation-hero{display:grid;grid-template-columns:minmax(0,1fr) minmax(300px,.68fr);gap:28px;align-items:end}.orientation-hero h2{font-size:clamp(30px,3.8vw,58px);line-height:.94;letter-spacing:-.058em;margin:0 0 14px;font-weight:500}.orientation-hero p{font-size:clamp(14px,1.2vw,18px);line-height:1.36;color:rgba(36,35,31,.74);max-width:980px}.weather-stack{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid rgba(36,35,31,.14);border-left:1px solid rgba(36,35,31,.14)}.weather-stack article{padding:12px;border-right:1px solid rgba(36,35,31,.14);border-bottom:1px solid rgba(36,35,31,.14);background:rgba(255,255,255,.2)}.weather-stack span,.orientation-layers span,.node-top span,.thesis-corridor span{display:block;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:rgba(36,35,31,.48)}.weather-stack b{display:block;margin-top:8px;font-size:18px;line-height:1.05}.orientation-layers{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;border-top:1px solid rgba(36,35,31,.13);border-left:1px solid rgba(36,35,31,.13);margin-top:26px}.orientation-layers article{padding:13px;border-right:1px solid rgba(36,35,31,.13);border-bottom:1px solid rgba(36,35,31,.13);background:rgba(255,255,255,.16)}.orientation-layers b{display:block;font-size:15px;margin:7px 0 6px}.orientation-layers small{display:block;font-size:12px;line-height:1.32;color:rgba(36,35,31,.56)}.orientation-map-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;margin-top:22px}.orientation-node{position:relative;padding:18px;border:1px solid rgba(36,35,31,.12);border-radius:18px;background:rgba(251,250,246,.58);box-shadow:0 14px 40px rgba(36,35,31,.035);overflow:hidden}.orientation-node:before{content:"";position:absolute;inset:0 auto 0 0;width:4px;background:#8a6a2c}.orientation-node.good:before{background:#4d7c59}.orientation-node.bad:before{background:#9d3b30}.node-top{display:flex;justify-content:space-between;gap:12px}.node-top b{text-transform:uppercase;font-size:11px;letter-spacing:.05em}.orientation-node h3{font-size:clamp(22px,2.4vw,36px);line-height:.98;letter-spacing:-.048em;margin:18px 0 10px;font-weight:500}.orientation-node p{font-size:14px;line-height:1.38;color:rgba(36,35,31,.74);min-height:58px}.node-deps,.node-tickers{display:flex;flex-wrap:wrap;gap:6px;margin-top:14px}.node-deps span,.node-tickers span{font-size:11px;border:1px solid rgba(36,35,31,.1);border-radius:999px;padding:6px 8px;background:rgba(255,255,255,.32);text-transform:capitalize}.node-tickers span{font-weight:600}.node-tickers em{font-style:normal;color:rgba(36,35,31,.48);font-weight:500}.orientation-node small{display:block;border-top:1px solid rgba(36,35,31,.1);margin-top:14px;padding-top:12px;font-size:12px;line-height:1.34;color:rgba(36,35,31,.55)}.thesis-corridor{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:22px}.thesis-corridor article{padding:16px;border:1px solid rgba(36,35,31,.12);border-radius:16px;background:rgba(255,255,255,.18)}.thesis-corridor b{display:block;font-size:13px;line-height:1.34;margin-top:10px;color:rgba(36,35,31,.78)}.good{color:#4d7c59!important}.warn{color:#8a6a2c!important}.bad{color:#9d3b30!important}@media(max-width:980px){.orientation-hero{grid-template-columns:1fr}.orientation-layers{grid-template-columns:1fr 1fr}.thesis-corridor{grid-template-columns:1fr}}@media(max-width:640px){.weather-stack,.orientation-layers{grid-template-columns:1fr}.orientation-map-grid{grid-template-columns:1fr}}
</style>`;

html = html.replace(/<style id="market-orientation-css">[\s\S]*?<\/style>/, '');
html = html.replace(/<section id="market-orientation"[\s\S]*?<\/section>/, '');
html = html.replace(/<div id="market-orientation"[\s\S]*?<\/div>\s*(?=<section|<\/main>)/, '');
html = html.replace('</head>', `${orientationCss}</head>`);

const briefMatch = html.match(/(<section[^>]*id="brief"[\s\S]*?)(<\/section>)/);
if (briefMatch) {
  html = html.replace(briefMatch[0], `${briefMatch[1]}${orientationHtml}${briefMatch[2]}`);
} else {
  html = html.replace(/<main[^>]*>/, match => `${match}${orientationHtml}`);
}

fs.writeFileSync(indexPath, html);
console.log(`injected market orientation inside brief: ${list(map.themes).length} themes`);
