const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
function distance(current, target) { return current > 0 && target > 0 ? ((target - current) / current) * 100 : null; }
function classify(h) {
  const current = n(h.livePrice);
  const t = h.signalThresholds || {};
  const candidates = [
    ['Vol-adjusted add', t.addPrice, t.addPct, 'good'],
    ['Vol-adjusted trim', t.trimPrice, t.trimPct, 'warn'],
    ['Vol-adjusted risk review', t.riskReviewPrice, t.riskReviewPct, 'bad']
  ].map(([label, level, thresholdPct, tone]) => ({ ticker: h.ticker, price: current, label, tone, level: n(level), thresholdPct: n(thresholdPct), distancePct: Number.isFinite(n(level)) ? distance(current, n(level)) : null, href: `pages/${String(h.ticker).toLowerCase()}.html#chart-cognition` }))
    .filter(x => Number.isFinite(x.distancePct));
  if (!candidates.length) return null;
  return candidates.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];
}
const rows = holdings.map(classify).filter(Boolean).sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct)).slice(0, 8);
const css = `<style>.action-proximity{background:rgba(251,250,246,.11)}.proximity-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.proximity-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.18);text-decoration:none}.proximity-card span{display:block;color:var(--muted);font-size:13px;margin-bottom:10px}.proximity-card b{display:block;font-size:34px;line-height:.95;letter-spacing:-.05em;font-weight:500}.proximity-card em{display:block;font-style:normal;margin-top:12px;font-size:14px}.proximity-card small{display:block;color:var(--muted);margin-top:6px}.proximity-card.good em{color:var(--green)}.proximity-card.warn em{color:var(--warn)}.proximity-card.bad em{color:var(--red)}</style>`;
const html = `<section id="action-proximity" class="panel action-proximity"><div class="section-head"><div><p class="eyebrow">Action Proximity</p><h2>Closest holdings to volatility-adjusted strategy bands</h2></div><a class="button" href="outputs/signal-thresholds.json">Open thresholds JSON</a></div><div class="proximity-grid">${rows.map(row => `<a class="proximity-card ${row.tone}" href="${esc(row.href)}"><span>${esc(row.label)}</span><b>${esc(row.ticker)}</b><em>${row.distancePct >= 0 ? '+' : ''}${row.distancePct.toFixed(2)}% to $${row.level.toLocaleString(undefined, { maximumFractionDigits: 2 })}</em><small>${row.thresholdPct >= 0 ? '+' : ''}${row.thresholdPct.toFixed(2)}% signal band</small></a>`).join('') || '<p class="muted">No volatility-adjusted action bands mapped yet.</p>'}</div></section>`;
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.action-proximity[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="action-proximity"[\s\S]*?<section id="holdings-section"/, '<section id="holdings-section"');
index = index.replace('</head>', `${css}</head>`);
index = index.replace('<section id="holdings-section"', `${html}<section id="holdings-section"`);
fs.writeFileSync(indexPath, index);
console.log(`injected ${rows.length} volatility-adjusted action proximity cards`);
