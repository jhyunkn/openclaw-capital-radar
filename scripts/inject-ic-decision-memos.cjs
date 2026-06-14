const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const memoPath = path.join(root, 'outputs', 'ic-decision-memos.json');
if (!fs.existsSync(memoPath)) throw new Error('ic-decision-memos.json missing. Run generate-ic-decision-memos first.');
const data = JSON.parse(fs.readFileSync(memoPath, 'utf8'));
const memos = Array.isArray(data.memos) ? data.memos : [];
function esc(s){ return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function money(v){ const x = Number(v); return Number.isFinite(x) ? `$${x.toLocaleString(undefined,{maximumFractionDigits:x<1?4:2})}` : 'n/a'; }
function pct(v){ const x = Number(v); return Number.isFinite(x) ? `${x>=0?'+':''}${x.toFixed(2)}%` : 'n/a'; }
function css(){ return `<style>.ic-decision-memo{background:#ffffff;padding-top:34px!important}.ic-card{border:1px solid var(--rule);background:#ffffff;padding:22px}.ic-card.danger{border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.07)}.ic-card.caution{border-color:rgba(138,106,44,.42);background:rgba(138,106,44,.07)}.ic-card.positive{border-color:rgba(47,111,78,.36);background:rgba(47,111,78,.06)}.ic-topline{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;border-bottom:1px solid var(--rule);padding-bottom:16px;margin-bottom:16px}.ic-topline h2{font-size:clamp(36px,4.8vw,82px)}.ic-badge{border:1px solid var(--rule);border-radius:999px;padding:8px 12px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;white-space:nowrap}.ic-badge.danger{color:var(--red)}.ic-badge.caution{color:var(--warn)}.ic-badge.positive{color:var(--green)}.ic-grid{display:grid;grid-template-columns:1.2fr 1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.ic-grid article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:#ffffff}.ic-grid span,.ic-evidence span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:9px}.ic-grid b{display:block;font-size:20px;line-height:1.2;letter-spacing:-.03em}.ic-grid p{font-size:14px;line-height:1.42;margin-top:8px}.ic-evidence{margin-top:18px;border-top:1px solid var(--rule);padding-top:16px}.ic-evidence ul{margin:8px 0 0;padding-left:18px}.ic-evidence li{font-size:14px;line-height:1.42;margin:5px 0}.ic-links{display:flex;gap:10px;flex-wrap:wrap;margin-top:16px}.ic-links a{border:1px solid var(--rule);border-radius:999px;padding:8px 11px;text-decoration:none;font-size:12px;color:var(--muted)}.ic-links a:hover{color:var(--ink);border-color:rgba(36,35,31,.55)}@media(max-width:900px){.ic-topline{display:block}.ic-badge{display:inline-flex;margin-top:14px}.ic-grid{grid-template-columns:1fr}}</style>`; }
function block(m){
  const t = m.nearestThreshold;
  const threshold = t ? `${esc(t.label)} · ${money(t.value)} · ${pct(t.distancePct)} from current` : 'No mapped threshold';
  const evidence = Array.isArray(m.missingEvidence) && m.missingEvidence.length ? m.missingEvidence.map(x => `<li><b>${esc(x.category)}:</b> ${esc(x.finding)}</li>`).join('') : `<li>No missing evidence flagged by current memo model.</li>`;
  return `<section id="ic-decision-memo" class="section ic-decision-memo"><div class="ic-card ${esc(m.tone)}"><div class="ic-topline"><div><p class="eyebrow">Fused IC Memo</p><h2>${esc(m.oneLine || `${m.ticker} — ${m.decision}`)}</h2></div><span class="ic-badge ${esc(m.tone)}">${esc(m.decision)}</span></div><p>${esc(m.reason)}</p><div class="ic-grid"><article><span>Allowed action</span><b>${esc(m.allowedAction)}</b><p>${esc(m.forbiddenAction || 'Do not treat this memo as automatic execution.')}</p></article><article><span>Nearest threshold</span><b>${threshold}</b><p>Threshold proximity is a review trigger, not execution permission.</p></article><article><span>Coverage / permission</span><b>${esc(m.coverageState)} · ${esc(m.thesisCoverageScore)}% / ${esc(m.minimumRequired)}%</b><p>${esc(m.actionPermission || 'Permission not mapped')} · Human review: ${m.humanReviewRequired ? 'required' : 'not flagged'}</p></article></div><div class="ic-evidence"><span>Evidence needed / blocking issues</span><ul>${evidence}</ul></div><div class="ic-links"><a href="/outputs/ic-decision-memos.json">IC memo JSON</a><a href="/outputs/portfolio-thesis-coverage-map.json">Coverage map</a><a href="/outputs/strategy-interpretations.json">Strategy interpretations</a></div></div></section>`;
}
function inject(html, m){
  html = html.replace(/<section id="ic-decision-memo"[\s\S]*?<\/section>/, '');
  if (!html.includes('.ic-decision-memo')) html = html.replace('</head>', `${css()}</head>`);
  const marker = '</section><section id="thesis-coverage-workbench"';
  const idx = html.indexOf(marker);
  if (idx >= 0) return html.slice(0, idx + '</section>'.length) + block(m) + html.slice(idx + '</section>'.length);
  const memoMarker = '<section id="investment-committee-memo"';
  const s = html.indexOf(memoMarker);
  if (s >= 0) {
    const e = html.indexOf('</section>', s);
    if (e >= 0) return html.slice(0, e + '</section>'.length) + block(m) + html.slice(e + '</section>'.length);
  }
  return html.replace('</main>', `${block(m)}</main>`);
}
let count = 0;
for (const m of memos) {
  const ticker = String(m.ticker || '').toLowerCase();
  const file = path.join(pagesDir, `${ticker}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, inject(html, m));
  count += 1;
}
console.log(`injected IC decision memos into ${count} ticker pages`);
