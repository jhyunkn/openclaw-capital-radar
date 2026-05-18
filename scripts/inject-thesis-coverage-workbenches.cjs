const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const mapPath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
if (!fs.existsSync(mapPath)) throw new Error('portfolio-thesis-coverage-map.json missing');
if (!fs.existsSync(pagesDir)) throw new Error('pages directory missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const rows = Array.isArray(data.holdings) ? data.holdings : [];
const css = `<style>.thesis-workbench{background:rgba(251,250,246,.18)}.coverage-banner{border:1px solid var(--rule);background:rgba(251,250,246,.28);padding:18px;margin-bottom:24px}.coverage-banner.constrained,.coverage-banner.partial{border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.07)}.coverage-banner.underwritten{border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.06)}.coverage-banner h3{font-size:clamp(22px,2.2vw,34px);letter-spacing:-.04em;margin:0 0 8px}.coverage-banner p{max-width:960px}.coverage-score-grid{display:grid;grid-template-columns:260px 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:22px}.coverage-score-card,.coverage-chain{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:22px;background:rgba(251,250,246,.14)}.coverage-score-card span{display:block;color:var(--muted);font-size:13px;text-transform:uppercase;letter-spacing:.12em}.coverage-score-card b{display:block;font-size:64px;line-height:.9;letter-spacing:-.07em;font-weight:500;margin-top:12px}.coverage-pill{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:5px 9px;font-size:12px;margin-top:12px}.coverage-pill.underwritten{color:var(--green)}.coverage-pill.constrained,.coverage-pill.thin{color:var(--red)}.coverage-pill.partial{color:var(--warn)}.coverage-chain ol{margin:0;padding-left:20px}.coverage-chain li{margin:0 0 8px;color:rgba(36,35,31,.88);line-height:1.45}.coverage-categories{width:100%;border-collapse:collapse}.coverage-categories th,.coverage-categories td{border-top:1px solid var(--rule);padding:12px;text-align:left;vertical-align:top}.coverage-categories th{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted)}.coverage-categories td:first-child{font-weight:600}.coverage-status{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:4px 8px;font-size:12px}.coverage-status.covered,.coverage-status.not_applicable{color:var(--green)}.coverage-status.missing,.coverage-status.breach{color:var(--red)}.coverage-missing{margin-top:22px;border-top:1px solid var(--rule);padding-top:16px}.coverage-missing ul{margin:10px 0 0;padding-left:20px}.coverage-missing li{margin-bottom:8px}.coverage-json-link{display:inline-flex;margin-top:18px;border:1px solid rgba(36,35,31,.72);border-radius:999px;padding:9px 12px;text-decoration:none;font-size:13px}.coverage-json-link:hover{background:rgba(36,35,31,.88);color:var(--bg)}@media(max-width:900px){.coverage-score-grid{grid-template-columns:1fr}.coverage-score-card b{font-size:48px}}</style>`;
function categoryRows(h) {
  return Object.entries(h.categories || {}).map(([key, c]) => `<tr><td>${esc(key)}</td><td><span class="coverage-status ${esc(c.status)}">${esc(c.status)}</span></td><td>${esc(c.score)} / ${esc(c.max)}</td><td>${esc(c.finding)}</td></tr>`).join('');
}
function panel(h) {
  const missing = Array.isArray(h.missingEvidence) ? h.missingEvidence : [];
  const chain = h.thesisChain || {};
  const bannerTitle = h.coverageState === 'constrained'
    ? 'Capital action blocked: coverage is not permission'
    : h.coverageState === 'partial'
      ? 'Partial underwriting: missing evidence remains'
      : h.coverageState === 'thin'
        ? 'Thin underwriting: thesis not ready'
        : 'Underwritten for monitoring';
  const bannerText = h.blockedForAction
    ? 'This holding may have documentation, but signal state, action permission, or sizing breach prevents clean capital action.'
    : 'This holding has enough structure for monitoring, while source evidence and human judgment still govern capital action.';
  return `<section id="thesis-coverage-workbench" class="section thesis-workbench"><div class="section-head"><div><p class="eyebrow">Thesis Coverage</p><h2>Underwriting workbench</h2></div><a class="coverage-json-link" href="/outputs/portfolio-thesis-coverage-map.json">Open coverage map</a></div><div class="coverage-banner ${esc(h.coverageState)}"><h3>${esc(bannerTitle)}</h3><p>${esc(bannerText)}</p></div><div class="coverage-score-grid"><article class="coverage-score-card"><span>Coverage score</span><b>${esc(h.thesisCoverageScore)}%</b><span>Required ${esc(h.minimumRequired)}%</span><span class="coverage-pill ${esc(h.coverageState)}">${esc(h.coverageState)}</span></article><article class="coverage-chain"><h3>Thesis → signal → permission chain</h3><ol><li><b>Thesis:</b> ${esc(chain.thesis || 'Missing thesis.')}</li><li><b>Signal:</b> ${esc(chain.signal || h.signal || 'Review')}</li><li><b>Nearest threshold:</b> ${esc(chain.nearestThreshold?.label || 'No threshold mapped')} ${chain.nearestThreshold?.value != null ? `· ${esc(chain.nearestThreshold.value)}` : ''}</li><li><b>Action permission:</b> ${esc(chain.actionPermission || h.actionPermission || 'Research required')}</li><li><b>Human review:</b> ${h.humanReviewRequired ? 'Required' : 'Not flagged by current rules'}</li></ol></article></div><div class="table-wrap"><table class="coverage-categories"><thead><tr><th>Category</th><th>Status</th><th>Score</th><th>Finding</th></tr></thead><tbody>${categoryRows(h)}</tbody></table></div><div class="coverage-missing"><h3>Missing evidence / breach list</h3>${missing.length ? `<ul>${missing.map(m => `<li><b>${esc(m.category)}:</b> ${esc(m.finding)}</li>`).join('')}</ul>` : '<p>No missing evidence or breach flagged by current coverage model.</p>'}<p class="bodyline"><b>Next step:</b> ${esc(h.nextStep || 'Continue monitoring.')}</p></div></section>`;
}
let count = 0;
for (const h of rows) {
  const file = path.join(pagesDir, `${String(h.ticker).toLowerCase()}.html`);
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/<style>\.thesis-workbench[\s\S]*?<\/style>/, '');
  html = html.replace(/<section id="thesis-coverage-workbench"[\s\S]*?<section class="section chart-section">/, '<section class="section chart-section">');
  html = html.replace('</head>', `${css}</head>`);
  if (html.includes('<section class="section chart-section">')) {
    html = html.replace('<section class="section chart-section">', `${panel(h)}<section class="section chart-section">`);
  } else {
    html = html.replace('</main>', `${panel(h)}</main>`);
  }
  fs.writeFileSync(file, html);
  count += 1;
}
console.log(`injected thesis coverage workbench into ${count} ticker pages`);
