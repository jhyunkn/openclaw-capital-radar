const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const mapPath = path.join(root, 'outputs', 'portfolio-exposure-map.json');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(mapPath)) throw new Error('portfolio-exposure-map.json missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function cls(pressure){ if(pressure === 'over-cap') return 'bad'; if(pressure === 'near-cap') return 'warn'; if(pressure === 'inside-cap') return 'good'; return 'neutral'; }
function bucketCard(b){ const width = Math.max(2, Math.min(100, Math.round((Number(b.weightPct || 0) / Math.max(1, Number(b.capPct || 1))) * 100))); return `<article class="exposure-card ${cls(b.pressure)}"><div><span>${esc(b.label)}</span><b>${esc(b.weightPct)}%</b></div><div class="exposure-bar"><i style="width:${width}%"></i></div><p>${esc(b.interpretation)}</p><small>${esc((b.members || []).map(m => m.ticker).join(' · ') || 'No mapped members')}</small></article>`; }
const why = Array.isArray(data.whyTodayMatters) ? data.whyTodayMatters : [];
const buckets = Array.isArray(data.buckets) ? data.buckets : [];
const html = `<section id="portfolio-exposure" class="panel portfolio-exposure"><div class="section-head"><div><p class="eyebrow">Portfolio Pressure Map</p><h2>Why today matters</h2></div><a class="button" href="outputs/portfolio-exposure-map.json">Open exposure JSON</a></div><div class="why-grid"><article><span>Current interpretation</span><ul>${(why.length ? why : ['No major portfolio pressure detected from current processed data.']).slice(0,6).map(x => `<li>${esc(x)}</li>`).join('')}</ul></article></div><div class="exposure-grid">${buckets.map(bucketCard).join('')}</div></section>`;
const css = `<style>.portfolio-exposure{background:#ffffff}.why-grid{display:grid;grid-template-columns:1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:22px}.why-grid article{padding:18px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff}.why-grid span,.exposure-card span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:500}.why-grid ul{margin:12px 0 0;padding-left:18px}.why-grid li{font-size:14px;line-height:1.45;margin:7px 0}.exposure-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.exposure-card{padding:16px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff;overflow:hidden}.exposure-card div:first-child{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.exposure-card b{font-size:28px;line-height:1;letter-spacing:-.045em}.exposure-card p{font-size:13px;line-height:1.42;margin:12px 0;color:rgba(36,35,31,.82)}.exposure-card small{display:block;color:var(--muted);font-size:12px;line-height:1.35;overflow-wrap:anywhere}.exposure-bar{height:7px;background:rgba(36,35,31,.1);margin-top:13px;overflow:hidden}.exposure-bar i{display:block;height:100%;background:rgba(36,35,31,.45)}.exposure-card.good .exposure-bar i{background:var(--green)}.exposure-card.warn .exposure-bar i{background:var(--warn)}.exposure-card.bad .exposure-bar i{background:var(--red)}</style>`;
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.portfolio-exposure[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="portfolio-exposure"[\s\S]*?<section id="strategy-command"/, '<section id="strategy-command"');
index = index.replace('</head>', `${css}</head>`);
if (index.includes('<section id="strategy-command"')) index = index.replace('<section id="strategy-command"', `${html}<section id="strategy-command"`);
else if (index.includes('<section id="brief"')) index = index.replace('<section id="brief"', `${html}<section id="brief"`);
else index = index.replace('</main>', `${html}</main>`);
fs.writeFileSync(indexPath, index);
console.log(`injected portfolio exposure map with ${buckets.length} buckets`);
