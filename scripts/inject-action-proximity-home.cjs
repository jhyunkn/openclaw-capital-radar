const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const actionPath = path.join(root, 'outputs', 'authoritative-action-state.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const actionState = fs.existsSync(actionPath) ? JSON.parse(fs.readFileSync(actionPath, 'utf8')) : { actionStates: [] };
const authorityByTicker = new Map((actionState.actionStates || []).map(x => [String(x.ticker || '').toUpperCase(), x]));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n = value => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; };
function distance(current, target) { return current > 0 && target > 0 ? ((target - current) / current) * 100 : null; }
function permissionTone(authority, labelTone) {
  const decision = String(authority?.authority?.decision || '').toUpperCase();
  if (decision === 'ADD REVIEW ALLOWED' && labelTone === 'good') return 'good';
  if (/EXIT|TRIM|BLOCKED|VERIFY|WAIT|HOLD/.test(decision)) return 'blocked';
  if (labelTone === 'bad') return 'bad';
  return 'neutral';
}
function permissionLabel(authority, row) {
  const a = authority?.authority;
  if (!a) return 'No authority state mapped';
  if (a.decision === 'ADD REVIEW ALLOWED' && row.label.includes('add')) return 'Permission open · review only';
  if (row.label.includes('add')) return `Blocked · ${a.decision}`;
  return `${a.decision} · ${a.urgency}`;
}
function classify(h) {
  const ticker = String(h.ticker || '').toUpperCase();
  const current = n(h.livePrice);
  const t = h.signalThresholds || {};
  const authority = authorityByTicker.get(ticker);
  const candidates = [
    ['Vol-adjusted add', t.addPrice, t.addPct, 'good'],
    ['Vol-adjusted trim', t.trimPrice, t.trimPct, 'warn'],
    ['Vol-adjusted risk review', t.riskReviewPrice, t.riskReviewPct, 'bad']
  ].map(([label, level, thresholdPct, labelTone]) => ({ ticker, price: current, label, labelTone, level: n(level), thresholdPct: n(thresholdPct), distancePct: Number.isFinite(n(level)) ? distance(current, n(level)) : null, authority, href: `pages/${ticker.toLowerCase()}.html#authoritative-action-state` }))
    .filter(x => Number.isFinite(x.distancePct));
  if (!candidates.length) return null;
  const closest = candidates.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct))[0];
  closest.tone = permissionTone(authority, closest.labelTone);
  closest.permission = permissionLabel(authority, closest);
  closest.reason = authority?.authority?.reason || 'Price proximity is not execution permission.';
  return closest;
}
const rows = holdings.map(classify).filter(Boolean).sort((a, b) => {
  const rank = { bad: 0, blocked: 1, warn: 2, good: 3, neutral: 4 };
  return (rank[a.tone] ?? 9) - (rank[b.tone] ?? 9) || Math.abs(a.distancePct) - Math.abs(b.distancePct);
}).slice(0, 8);
const css = `<style>.action-proximity{background:rgba(251,250,246,.08)}.proximity-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.proximity-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:rgba(251,250,246,.14);text-decoration:none;min-height:178px}.proximity-card span{display:block;color:var(--muted);font-size:12px;margin-bottom:8px}.proximity-card b{display:block;font-size:31px;line-height:.95;letter-spacing:-.05em;font-weight:500}.proximity-card em{display:block;font-style:normal;margin-top:10px;font-size:13px}.proximity-card small{display:block;color:var(--muted);margin-top:6px;line-height:1.32}.proximity-card.good em{color:var(--green)}.proximity-card.warn em{color:var(--warn)}.proximity-card.bad em{color:var(--red)}.proximity-card.blocked{background:rgba(36,35,31,.035)}.proximity-card.blocked em{color:var(--muted)}.proximity-card.blocked b,.proximity-card.blocked span{text-decoration:none;color:rgba(36,35,31,.62)}.proximity-card.blocked:before{content:'No action permission';display:inline-flex;margin-bottom:10px;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--red)}</style>`;
const html = `<section id="action-proximity" class="panel action-proximity"><div class="section-head"><div><p class="eyebrow">Level Proximity</p><h2>Nearby levels, filtered by command permission</h2></div><a class="button" href="outputs/authoritative-action-state.json">Open action state</a></div><p class="strategy-intro">Green only appears when the authoritative command layer permits add review. Otherwise proximity is shown as blocked or informational.</p><div class="proximity-grid">${rows.map(row => `<a class="proximity-card ${row.tone}" href="${esc(row.href)}"><span>${esc(row.label)}</span><b>${esc(row.ticker)}</b><em>${row.distancePct >= 0 ? '+' : ''}${row.distancePct.toFixed(2)}% to $${row.level.toLocaleString(undefined, { maximumFractionDigits: 2 })}</em><small>${esc(row.permission)}<br>${esc(row.reason)}</small></a>`).join('') || '<p class="muted">No volatility-adjusted action bands mapped yet.</p>'}</div></section>`;
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.action-proximity[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="action-proximity"[\s\S]*?<section id="holdings-section"/, '<section id="holdings-section"');
index = index.replace('</head>', `${css}</head>`);
index = index.replace('<section id="holdings-section"', `${html}<section id="holdings-section"`);
fs.writeFileSync(indexPath, index);
console.log(`injected ${rows.length} permission-gated proximity cards`);
