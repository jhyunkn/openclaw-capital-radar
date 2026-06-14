const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const healthPath = path.join(root, 'outputs', 'data-health.json');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function ageLabel(ms) {
  const minutes = Math.max(0, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function freshnessTone(ms) {
  const hours = ms / 36e5;
  if (hours < 24) return 'fresh';
  if (hours < 48) return 'aging';
  return 'stale';
}

if (!fs.existsSync(indexPath)) throw new Error('index.html not found');
if (!fs.existsSync(healthPath)) throw new Error('outputs/data-health.json not found');

const health = JSON.parse(fs.readFileSync(healthPath, 'utf8'));
const refreshedAt = health.reportGeneratedAt || health.generatedAt;
const refreshedDate = refreshedAt ? new Date(refreshedAt) : null;
if (!refreshedDate || !Number.isFinite(refreshedDate.getTime())) throw new Error('data-health.json has no valid reportGeneratedAt/generatedAt timestamp');

const ageMs = Date.now() - refreshedDate.getTime();
const label = `Data refreshed ${ageLabel(ageMs)}`;
const tone = freshnessTone(ageMs);
const indicator = `<div class="freshness-indicator ${tone}" title="${esc(label)}"><span class="freshness-dot"></span><span>${esc(label)}</span></div>`;
const style = `<style>.freshness-indicator{display:inline-flex;align-items:center;gap:8px;border:1px solid var(--rule);padding:8px 10px;font-size:12px;line-height:1;border-radius:999px;background:#ffffff;white-space:nowrap}.freshness-dot{width:9px;height:9px;border-radius:50%;display:inline-block}.freshness-indicator.fresh .freshness-dot{background:#2f6f4e}.freshness-indicator.aging .freshness-dot{background:#8a6a2c}.freshness-indicator.stale .freshness-dot{background:#9f3f35}@media(max-width:760px){.freshness-indicator{width:100%;justify-content:center}}</style>`;
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style>\.freshness-indicator[\s\S]*?<\/style>/, '');
html = html.replace('</head>', `${style}</head>`);
html = html.replace(/<div class="freshness-indicator [\s\S]*?<\/div>/, '');
html = html.replace('<div id="generated">Static JSON render</div>', `<div id="generated">Static JSON render</div>${indicator}`);
fs.writeFileSync(indexPath, html);
console.log(`Injected homepage freshness indicator: ${label} (${tone})`);
