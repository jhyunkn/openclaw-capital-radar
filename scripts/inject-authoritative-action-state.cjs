const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const actionPath = path.join(root, 'outputs', 'authoritative-action-state.json');
if (!fs.existsSync(actionPath)) throw new Error('Missing outputs/authoritative-action-state.json. Run generate-authoritative-action-state first.');
const action = JSON.parse(fs.readFileSync(actionPath, 'utf8'));
const byTicker = new Map((action.actionStates || []).map(x => [x.ticker, x]));
const pagesDir = path.join(root, 'pages');
const toneClass = t => t === 'danger' ? 'danger' : t === 'positive' ? 'positive' : t === 'caution' ? 'caution' : 'neutral';
function money(v) { return Number.isFinite(Number(v)) ? `$${Number(v).toFixed(Number(v) < 10 ? 2 : 2)}` : '—'; }
function esc(s) { return String(s ?? '').replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function ladderRows(s) {
  return (s.priceLadder || []).map(r => `<div class="authority-ladder-row ${esc(r.role)}" style="--pos:${r.pctOfRange}%"><span>${esc(r.label)}</span><b>${money(r.price)}</b><i><em></em></i></div>`).join('');
}
function block(s) {
  const tc = toneClass(s.authority.tone);
  return `<section id="authoritative-action-state" class="section authority-state ${tc}"><div class="section-head"><div><p class="eyebrow">Authoritative Action State</p><h2>${esc(s.ticker)} — ${esc(s.authority.decision)}</h2></div><span class="authority-badge ${tc}">${esc(s.authority.urgency)}</span></div><div class="authority-grid"><article><span>Current price</span><b>${money(s.price)}</b><p>${esc(s.zone.label)}</p></article><article><span>Allowed</span><b>${esc(s.authority.allowed)}</b><p>${esc(s.authority.reason)}</p></article><article><span>Forbidden</span><b>${esc(s.authority.forbidden)}</b><p>${esc(s.moduleDirective.actionBandOverride)}</p></article></div><div class="authority-ladder"><div class="authority-ladder-head"><span>Strategy ladder</span><b>${esc(s.moduleDirective.chartBadge)}</b></div>${ladderRows(s)}</div><p class="bodyline"><b>Authority rule:</b> raw buy/add bands are review zones only. If hard-exit, trim-watch, verification, or coverage blocks are active, proximity cannot create permission.</p></section>`;
}
const css = `<style id="authority-action-state-css">.authority-state{background:rgba(251,250,246,.22)}.authority-state.danger{background:rgba(159,63,53,.075)}.authority-state.caution{background:rgba(138,106,44,.07)}.authority-state.positive{background:rgba(47,111,78,.06)}.authority-badge{border:1px solid var(--rule);border-radius:999px;padding:9px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.08em}.authority-badge.danger{color:var(--red)}.authority-badge.caution{color:var(--warn)}.authority-badge.positive{color:var(--green)}.authority-grid{display:grid;grid-template-columns:.7fr 1.15fr 1.15fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.authority-grid article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.18)}.authority-grid span,.authority-ladder-head span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px}.authority-grid b{display:block;font-size:24px;line-height:1.12;letter-spacing:-.035em}.authority-grid p{font-size:14px;line-height:1.42;margin-top:10px}.authority-ladder{margin-top:22px;border:1px solid var(--rule);background:rgba(251,250,246,.18);padding:16px}.authority-ladder-head{display:flex;justify-content:space-between;gap:18px;align-items:baseline;border-bottom:1px solid var(--rule);padding-bottom:12px;margin-bottom:12px}.authority-ladder-head b{font-size:18px;letter-spacing:-.035em}.authority-ladder-row{display:grid;grid-template-columns:190px 90px 1fr;gap:12px;align-items:center;padding:8px 0;border-bottom:1px solid rgba(222,219,210,.65)}.authority-ladder-row:last-child{border-bottom:0}.authority-ladder-row span{font-size:13px;color:rgba(36,35,31,.82)}.authority-ladder-row b{font-size:16px;letter-spacing:-.02em}.authority-ladder-row i{display:block;height:8px;background:var(--rule2);border-radius:999px;position:relative;overflow:hidden}.authority-ladder-row i em{display:block;position:absolute;left:0;top:0;bottom:0;width:var(--pos);border-radius:999px;background:var(--muted)}.authority-ladder-row.danger b,.authority-ladder-row.danger span{color:var(--red)}.authority-ladder-row.risk b,.authority-ladder-row.risk span,.authority-ladder-row.trim b,.authority-ladder-row.trim span{color:var(--warn)}.authority-ladder-row.add b,.authority-ladder-row.add span{color:var(--green)}.authority-ladder-row.invalidated b,.authority-ladder-row.invalidated span{text-decoration:line-through;color:var(--red)}.authority-ladder-row.positive b,.authority-ladder-row.positive span{color:var(--green)}.authority-ladder-row.caution b,.authority-ladder-row.caution span{color:var(--warn)}@media(max-width:900px){.authority-grid{grid-template-columns:1fr}.authority-ladder-row{grid-template-columns:1fr 80px}.authority-ladder-row i{grid-column:1/-1}}</style>`;
for (const [ticker, s] of byTicker) {
  const file = path.join(pagesDir, `${ticker.toLowerCase()}.html`);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<style id="authority-action-state-css">[\s\S]*?<\/style>/, '');
  html = html.replace(/<section id="authoritative-action-state"[\s\S]*?<\/section>/, '');
  html = html.replace('</head>', `${css}</head>`);
  const insertAfter = /<\/header>/.test(html) ? '</header>' : '<main class="page">';
  html = html.replace(insertAfter, `${insertAfter}${block(s)}`);
  html = html.replace(/<section class="section chart-cognition"[\s\S]*?<\/section>/, match => match.replace(/<span class="cog-action">[\s\S]*?<\/span>/, `<span class="cog-action">${esc(s.moduleDirective.chartBadge)}</span>`));
  html = html.replace(/<section class="section"><div class="section-head"><div><p class="eyebrow">Action bands<\/p><h2>Numbers to act around<\/h2><\/div><\/div>/, `<section class="section"><div class="section-head"><div><p class="eyebrow">Action bands</p><h2>${esc(s.moduleDirective.buyZoneLabel)}</h2></div><span class="authority-badge ${toneClass(s.authority.tone)}">${esc(s.authority.decision)}</span></div><p class="bodyline"><b>Override:</b> ${esc(s.moduleDirective.actionBandOverride)}</p>`);
  fs.writeFileSync(file, html);
}
console.log(`injected authoritative action state into ${byTicker.size} ticker pages`);
