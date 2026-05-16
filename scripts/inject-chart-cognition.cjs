const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const notesDir = path.join(root, 'agent-notes', 'tickers');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function list(value) { return Array.isArray(value) ? value : []; }
function price(value) { return typeof value === 'number' && Number.isFinite(value) ? `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : '—'; }
function readNote(ticker) {
  const file = path.join(notesDir, `${String(ticker).toLowerCase()}.json`);
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
}
function distance(current, target) {
  if (!(current > 0) || !(target > 0)) return null;
  return ((target - current) / current) * 100;
}
function nearest(current, values) {
  const nums = list(values).filter(v => typeof v === 'number' && Number.isFinite(v));
  if (!nums.length || !(current > 0)) return null;
  return nums.map(v => ({ value: v, distancePct: distance(current, v) })).sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];
}
function row(label, values, current, tone) {
  const near = nearest(current, values);
  return `<article class="cog-row ${tone}"><span>${esc(label)}</span><b>${list(values).map(price).join(' · ') || '—'}</b><p>${near ? `${near.distancePct >= 0 ? '+' : ''}${near.distancePct.toFixed(2)}% from nearest level (${price(near.value)})` : 'No numeric level mapped.'}</p></article>`;
}
function htmlFor(h, note) {
  const current = Number(h.livePrice || 0);
  const map = note.technicalMap || {};
  const nearestBuy = nearest(current, map.buyZone);
  const nearestTrim = nearest(current, map.trimZone);
  const nearestStop = nearest(current, map.stopZone);
  const action = nearestStop && nearestStop.distancePct > -4 ? 'Stop/review proximity' : nearestBuy && Math.abs(nearestBuy.distancePct) < 4 ? 'Near add zone' : nearestTrim && Math.abs(nearestTrim.distancePct) < 5 ? 'Near trim zone' : 'Inside operating range';
  return `<section class="section chart-cognition" id="chart-cognition"><div class="section-head"><div><p class="eyebrow">Chart Cognition</p><h2>Action map before loading chart</h2></div><span class="cog-action">${esc(action)}</span></div><div class="cog-grid"><article class="cog-primary"><span>Current price</span><b>${price(current)}</b><p>${esc(map.multiTimeframeRead || 'Multi-timeframe read pending.')}</p></article>${row('Buy / add zone', map.buyZone, current, 'good')}${row('Support', map.supportLevels, current, 'good')}${row('Resistance', map.resistanceLevels, current, 'warn')}${row('Trim zone', map.trimZone, current, 'warn')}${row('Stop / review', map.stopZone, current, 'bad')}</div><div class="cog-checklist"><article><span>Chart-event checklist</span><ul><li>Confirm whether price is approaching an action band or simply moving inside noise.</li><li>Compare daily trend against weekly/monthly thesis persistence.</li><li>Check volume expansion before upgrading a buy/add signal.</li><li>Do not override thesis invalidation with short-term chart strength.</li></ul></article><article><span>Fractal read</span><p>${esc(map.fractalRead || 'Fractal read pending.')}</p></article></div></section>`;
}
const css = `<style>.chart-cognition{background:rgba(251,250,246,.12)}.cog-action{border:1px solid var(--rule);border-radius:999px;padding:10px 14px;color:var(--muted);font-size:13px}.cog-grid{display:grid;grid-template-columns:1.2fr repeat(5,1fr);gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.cog-row,.cog-primary,.cog-checklist article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.18)}.cog-row span,.cog-primary span,.cog-checklist span{display:block;color:var(--muted);font-size:13px;margin-bottom:12px}.cog-row b,.cog-primary b{display:block;font-size:28px;line-height:1;letter-spacing:-.04em;font-weight:500}.cog-row p,.cog-primary p{margin-top:14px;font-size:14px}.cog-row.good b{color:var(--green)}.cog-row.warn b{color:var(--warn)}.cog-row.bad b{color:var(--red)}.cog-checklist{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.cog-checklist ul{margin:0;padding-left:18px}.cog-checklist li{margin-bottom:8px;line-height:1.42;color:rgba(36,35,31,.84)}@media(max-width:1200px){.cog-grid{grid-template-columns:1fr 1fr 1fr}}@media(max-width:760px){.cog-grid,.cog-checklist{grid-template-columns:1fr}}</style>`;
let count = 0;
for (const h of holdings) {
  const note = readNote(h.ticker);
  if (!note) continue;
  const pagePath = path.join(pagesDir, `${String(h.ticker).toLowerCase()}.html`);
  if (!fs.existsSync(pagePath)) continue;
  let page = fs.readFileSync(pagePath, 'utf8');
  page = page.replace(/<style>\.chart-cognition[\s\S]*?<\/style>/, '');
  page = page.replace(/<section class="section chart-cognition"[\s\S]*?<section class="section chart-section">/, '<section class="section chart-section">');
  if (!page.includes('.chart-cognition')) page = page.replace('</head>', `${css}</head>`);
  page = page.replace('<section class="section chart-section">', `${htmlFor(h, note)}<section class="section chart-section">`);
  fs.writeFileSync(pagePath, page);
  count += 1;
}
console.log(`injected chart cognition into ${count} ticker workspaces`);
