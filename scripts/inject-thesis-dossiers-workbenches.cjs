const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const dossierPath = path.join(root, 'outputs', 'thesis-dossiers.json');
if (!fs.existsSync(pagesDir)) throw new Error('pages directory missing');
if (!fs.existsSync(dossierPath)) throw new Error('outputs/thesis-dossiers.json missing');
const data = JSON.parse(fs.readFileSync(dossierPath, 'utf8'));
const byTicker = new Map((data.all || []).map(x => [String(x.ticker || '').toLowerCase(), x]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function bullets(items){ return (Array.isArray(items) && items.length ? items : ['Not mapped.']).map(x => `<li>${esc(x)}</li>`).join(''); }
function section(d){
  return `<!-- THESIS_DOSSIER_START --><section class="section thesis-dossier"><div class="section-title"><p class="eyebrow">Thesis Dossier</p><h2>${esc(d.ticker)} operating thesis</h2><a class="button" href="../outputs/thesis-dossiers.json">Open dossier JSON</a></div><div class="dossier-grid"><article class="dossier-hero"><span>Business model</span><p>${esc(d.businessModel)}</p></article><article><span>Portfolio role</span><b>${esc(d.role)}</b><p>${esc(d.portfolioFit)}</p></article><article><span>Action / urgency</span><b>${esc(d.actionPermission)} · ${esc(d.urgency)}</b><p>${esc(d.dossierConfidence?.level || 'Unknown')} confidence · ${esc(d.dossierConfidence?.score ?? '—')}/100</p></article><article><span>Valuation question</span><p>${esc(d.valuationQuestion)}</p></article><article><span>Technical question</span><p>${esc(d.technicalQuestion)}</p></article></div><div class="dossier-columns"><article><span>Why it matters now</span><ul>${bullets(d.whyItMattersNow)}</ul></article><article><span>Macro linkage</span><ul>${bullets(d.macroLinkage)}</ul></article><article><span>Base case</span><p>${esc(d.cases?.base)}</p></article><article><span>Bull case</span><p>${esc(d.cases?.bull)}</p></article><article><span>Bear case</span><p>${esc(d.cases?.bear)}</p></article><article><span>Confirm before add</span><ul>${bullets(d.confirmBeforeAdd)}</ul></article><article><span>Trim condition</span><p>${esc(d.trimCondition)}</p></article><article><span>Exit condition</span><p>${esc(d.exitCondition)}</p></article><article><span>Key risks</span><ul>${bullets(d.keyRisks)}</ul></article><article><span>Data gaps</span><ul>${bullets(d.dataGaps)}</ul></article></div></section><!-- THESIS_DOSSIER_END -->`;
}
const css = `<style id="thesis-dossier-css">.thesis-dossier{padding-top:28px}.thesis-dossier .section-title{display:flex;justify-content:space-between;gap:18px;align-items:flex-end}.dossier-grid{display:grid;grid-template-columns:1.4fr 1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:16px}.dossier-grid article,.dossier-columns article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:rgba(251,250,246,.14)}.dossier-grid span,.dossier-columns span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:500;margin-bottom:9px}.dossier-grid b{display:block;font-size:24px;line-height:1.04;letter-spacing:-.04em}.dossier-grid p,.dossier-columns p,.dossier-columns li{font-size:13px;line-height:1.42;color:rgba(36,35,31,.82)}.dossier-columns{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.dossier-columns ul{margin:0;padding-left:18px}.dossier-columns li{margin:5px 0}@media(max-width:1000px){.dossier-grid,.dossier-columns{grid-template-columns:1fr}.thesis-dossier .section-title{display:block}.thesis-dossier .section-title .button{margin-top:12px}}</style>`;
let count = 0;
for (const file of fs.readdirSync(pagesDir).filter(x => x.endsWith('.html'))) {
  const ticker = file.replace(/\.html$/, '').toLowerCase();
  const d = byTicker.get(ticker);
  if (!d) continue;
  const filePath = path.join(pagesDir, file);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<style id="thesis-dossier-css">[\s\S]*?<\/style>/, '');
  html = html.replace(/<!-- THESIS_DOSSIER_START -->[\s\S]*?<!-- THESIS_DOSSIER_END -->/g, '');
  html = html.replace('</head>', `${css}</head>`);
  const insert = section(d);
  const chartIdx = html.indexOf('<section class="section chart-section"');
  if (chartIdx >= 0) {
    const nextIdx = html.indexOf('<section class="section ', chartIdx + 10);
    if (nextIdx >= 0) html = html.slice(0, nextIdx) + insert + html.slice(nextIdx);
    else html = html.replace('</main>', `${insert}</main>`);
  } else {
    html = html.replace('</main>', `${insert}</main>`);
  }
  fs.writeFileSync(filePath, html);
  count++;
}
console.log(`injected thesis dossiers into ${count} ticker workbenches`);
