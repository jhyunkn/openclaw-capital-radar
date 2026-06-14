const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const evidencePath = path.join(root, 'outputs', 'research-evidence-packets.json');
if (!fs.existsSync(pagesDir)) throw new Error('pages directory missing');
if (!fs.existsSync(evidencePath)) throw new Error('outputs/research-evidence-packets.json missing');
const data = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));
const byTicker = new Map((data.all || []).map(x => [String(x.ticker || '').toLowerCase(), x]));
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = value => value === null || value === undefined || value === '' ? '—' : esc(value);
function bullets(items){ return (Array.isArray(items) && items.length ? items : ['Not mapped.']).map(x => `<li>${esc(typeof x === 'string' ? x : x.description || x.factor || JSON.stringify(x))}</li>`).join(''); }
function sources(items){ return (Array.isArray(items) && items.length ? items : []).map(s => `<tr><td>${esc(s.label)}</td><td>${esc(s.type)}</td><td>${fmt(s.asOf)}</td><td>${esc(s.confidence)}</td><td>${esc((s.fields || []).slice(0,4).join(', '))}</td></tr>`).join(''); }
function macro(items){ return (Array.isArray(items) && items.length ? items : []).map(m => `<article><span>${esc(m.factor)}</span><b>${esc(m.direction)}</b><p>${esc(m.note)}</p></article>`).join(''); }
function catalysts(items){ return (Array.isArray(items) && items.length ? items : []).map(c => `<article><span>${esc(c.type)}</span><b>${fmt(c.date)}</b><p>${esc(c.description)}</p><small>${esc(c.confidence)}</small></article>`).join(''); }
function section(p){
  if (!p) return '';
  const v = p.valuationSnapshot || {};
  const c = p.dataConfidence || {};
  const f = p.freshness || {};
  return `<section class="section research-evidence"><div class="section-title"><p class="eyebrow">Research Evidence Engine</p><h2>${esc(p.ticker)} evidence packet</h2><a class="button" href="../outputs/research-evidence-packets.json">Open evidence JSON</a></div><div class="evidence-summary"><article><span>Evidence summary</span><p>${esc(p.evidenceSummary)}</p></article><article><span>Freshness</span><b>${esc(f.label || 'unknown')}</b><p>${fmt(f.latestSourceAsOf)} · ${fmt(f.ageDays)} days</p></article><article><span>Data confidence</span><b>${esc(c.level || 'unknown')} · ${fmt(c.score)}/100</b><p>${esc(c.interpretation || '')}</p></article></div><div class="evidence-grid"><article><span>Valuation snapshot</span><dl><div><dt>Forward PE</dt><dd>${fmt(v.forwardPE)}</dd></div><div><dt>FCF Yield</dt><dd>${fmt(v.fcfYield)}</dd></div><div><dt>Relevance</dt><dd>${esc(v.relevance || 'unknown')}</dd></div></dl><p>${esc(v.interpretation || '')}</p></article><article><span>Unresolved questions</span><ul>${bullets(p.unresolvedQuestions)}</ul></article></div><div class="evidence-subgrid"><section><span>Macro sensitivity</span><div>${macro(p.macroSensitivity)}</div></section><section><span>Earnings / catalyst calendar</span><div>${catalysts(p.earningsCatalystCalendar)}</div></section></div><div class="source-table"><span>Source list</span><table><thead><tr><th>Source</th><th>Type</th><th>As of</th><th>Confidence</th><th>Fields</th></tr></thead><tbody>${sources(p.sourceList)}</tbody></table></div></section>`;
}
const css = `<style>.research-evidence{padding-top:28px}.research-evidence .section-title{display:flex;justify-content:space-between;gap:18px;align-items:flex-end}.evidence-summary{display:grid;grid-template-columns:2fr 1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:16px}.evidence-summary article,.evidence-grid article,.evidence-subgrid section,.source-table{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:#ffffff}.research-evidence span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;font-weight:500;margin-bottom:9px}.research-evidence b{display:block;font-size:22px;line-height:1.05;letter-spacing:-.035em}.research-evidence p,.research-evidence li,.research-evidence dd,.research-evidence td{font-size:13px;line-height:1.42;color:rgba(36,35,31,.82)}.evidence-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.evidence-grid dl{margin:0;display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.evidence-grid dt{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)}.evidence-grid dd{margin:3px 0 0;font-variant-numeric:tabular-nums}.evidence-subgrid{display:grid;grid-template-columns:1fr 1fr;gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.evidence-subgrid section>div{display:grid;gap:8px}.evidence-subgrid article{border:1px solid var(--rule);padding:12px;background:#ffffff}.evidence-subgrid small{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-top:8px}.source-table{border-left:1px solid var(--rule);border-top:1px solid var(--rule);margin-top:18px;overflow:auto}.source-table table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}.source-table th{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);text-align:left;padding:8px;border-bottom:1px solid var(--rule)}.source-table td{padding:8px;border-bottom:1px solid var(--rule);vertical-align:top}@media(max-width:1000px){.evidence-summary,.evidence-grid,.evidence-subgrid{grid-template-columns:1fr}.research-evidence .section-title{display:block}.research-evidence .section-title .button{margin-top:12px}}</style>`;
let count = 0;
for (const file of fs.readdirSync(pagesDir).filter(x => x.endsWith('.html'))) {
  const ticker = file.replace(/\.html$/, '').toLowerCase();
  const packet = byTicker.get(ticker);
  if (!packet) continue;
  const filePath = path.join(pagesDir, file);
  let html = fs.readFileSync(filePath, 'utf8');
  html = html.replace(/<style>\.research-evidence[\s\S]*?<\/style>/, '');
  html = html.replace(/<section class="section research-evidence">[\s\S]*?<\/section>(?=\s*<section|\s*<\/main>)/, '');
  html = html.replace('</head>', `${css}</head>`);
  const thesisMatch = html.match(/<section class="section thesis-dossier">[\s\S]*?<\/section>/);
  if (thesisMatch) html = html.replace(thesisMatch[0], `${thesisMatch[0]}${section(packet)}`);
  else {
    const chartMatch = html.match(/<section class="section chart-section">[\s\S]*?<\/section>/);
    if (chartMatch) html = html.replace(chartMatch[0], `${chartMatch[0]}${section(packet)}`);
    else html = html.replace('</main>', `${section(packet)}</main>`);
  }
  fs.writeFileSync(filePath, html);
  count++;
}
console.log(`injected research evidence packets into ${count} ticker workbenches`);
