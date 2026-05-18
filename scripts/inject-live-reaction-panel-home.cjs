const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const reactionPath = path.join(root, 'outputs', 'live-reaction-state.json');
const deltaPath = path.join(root, 'outputs', 'reaction-state-delta.json');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(reactionPath)) throw new Error('live-reaction-state.json missing');
const reactions = JSON.parse(fs.readFileSync(reactionPath, 'utf8'));
const delta = fs.existsSync(deltaPath) ? JSON.parse(fs.readFileSync(deltaPath, 'utf8')) : null;
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = v => typeof v === 'number' ? v.toLocaleString(undefined, { maximumFractionDigits: 2 }) : '—';
const list = v => Array.isArray(v) ? v : [];
function tone(row) {
  const text = `${row.reaction?.state || row.state || ''} ${row.reaction?.permission || row.permission || ''} ${row.freshness?.status || ''}`;
  if (/EXIT|STOP|BLOCK|NO ADD|STALE|REVIEW/i.test(text)) return 'bad';
  if (/WAIT|WATCH|CAUTION|VERIFY/i.test(text)) return 'warn';
  return 'good';
}
function row(r) {
  const permission = r.reaction?.permission || r.permission || '—';
  const state = r.reaction?.state || r.state || '—';
  const fresh = r.freshness || {};
  return `<tr class="${tone(r)}"><td><b>${esc(r.ticker)}</b></td><td>$${fmt(r.price)}</td><td>${esc(state)}</td><td>${esc(permission)}</td><td>${esc(fresh.status || 'unknown')} · ${esc(fresh.minutesOld ?? '—')}m</td><td>${esc(r.reaction?.read || r.read || fresh.note || '')}</td></tr>`;
}
const actionRows = [...list(reactions.actionNow), ...list(reactions.reviewSoon)];
const allRows = list(reactions.all);
const panelRows = allRows.length ? allRows : actionRows;
const html = `<section id="live-reaction-state" class="panel live-reaction-state"><div class="section-head"><div><p class="eyebrow">Operational Reaction State</p><h2>Live action permissions</h2></div><div class="reaction-score"><span>Posture</span><b>${esc(reactions.posture || '—')}</b></div></div><div class="reaction-summary"><article><span>Action now</span><b>${list(reactions.actionNow).length}</b><p>${list(reactions.actionNow).map(x => esc(x.ticker)).join(' · ') || 'No clean action permission.'}</p></article><article><span>Review soon</span><b>${list(reactions.reviewSoon).length}</b><p>${list(reactions.reviewSoon).map(x => esc(x.ticker)).join(' · ') || 'No near-term review queue.'}</p></article><article><span>Delta / alerts</span><b>${esc(delta?.counts?.alertQueue ?? '—')}</b><p>${esc(delta?.summary || 'Delta layer not generated.')}</p></article></div><div class="table-wrap"><table class="table live-reaction-table"><thead><tr><th>Ticker</th><th>Now</th><th>State</th><th>Permission</th><th>Freshness</th><th>Read</th></tr></thead><tbody>${panelRows.map(row).join('') || '<tr><td colspan="6">No live reaction state loaded.</td></tr>'}</tbody></table></div><p class="muted">Source: <a href="outputs/live-reaction-state.json">live-reaction-state.json</a> · <a href="outputs/reaction-state-delta.json">reaction-state-delta.json</a>. Stale or blocked permissions override price proximity.</p></section>`;
const css = `<style>.live-reaction-state{background:rgba(251,250,246,.12)}.reaction-score{text-align:right}.reaction-score span,.reaction-summary span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.06em}.reaction-score b{font-size:32px;line-height:1;letter-spacing:-.05em}.reaction-summary{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:22px}.reaction-summary article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:rgba(251,250,246,.16)}.reaction-summary b{display:block;font-size:42px;line-height:.9;letter-spacing:-.06em;margin:8px 0}.live-reaction-table tr.bad td:first-child{border-left:4px solid #9d3b30}.live-reaction-table tr.warn td:first-child{border-left:4px solid #c1872d}.live-reaction-table tr.good td:first-child{border-left:4px solid #4d7c59}@media(max-width:820px){.reaction-summary{grid-template-columns:1fr}.live-reaction-table{font-size:12px}}</style>`;
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.live-reaction-state[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="live-reaction-state"[\s\S]*?(?=<section|<footer|<\/main>)/, '');
index = index.replace('</head>', `${css}</head>`);
const anchor = '<section id="portfolio-scoreboard"';
if (index.includes(anchor)) index = index.replace(anchor, `${html}${anchor}`);
else if (index.includes('<section id="holdings-section"')) index = index.replace('<section id="holdings-section"', `${html}<section id="holdings-section"`);
else index = index.replace('</main>', `${html}</main>`);
fs.writeFileSync(indexPath, index);
console.log(`injected live reaction panel with ${panelRows.length} rows`);
