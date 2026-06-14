// LEGACY / ROLLBACK ONLY
//
// Do not add this script back to config/homepage-sections.json.
// Operational Chart Phase 2 moved this behavior into:
//   components/radar/operational-chart/render.cjs
//
// Former responsibility:
// - top decision strip
// - decision workboard wrapper
// - primary callout
// - side rail callouts
// - confirmation strip
// - chart layout adjustment
//
// Current authority:
// - The Operational Chart renderer owns annotation composition.
// - scripts/inject-operational-chart-home.cjs passes decision-chart-annotation-state.json into the renderer.
// - scripts/render-capital-radar-home.cjs fails the build if this command reappears in the active manifest.
//
// Keep this file temporarily as a rollback/reference artifact only.

const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');const statePath=path.join(root,'outputs','decision-chart-annotation-state.json');
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const arr=v=>Array.isArray(v)?v:[];
if(!fs.existsSync(indexPath))throw new Error('index.html missing');if(!fs.existsSync(statePath))throw new Error('decision-chart-annotation-state missing');
const s=JSON.parse(fs.readFileSync(statePath,'utf8'));if(s.render_permission===false){console.log('decision chart v2 not permitted');process.exit(0)}
function tone(v){const x=String(v||'').toLowerCase();if(/support|contained|risk-on|allowed|pass|active|normal|confirm/.test(x))return'good';if(/defensive|stress|blocked|hard|risk|fail/.test(x))return'bad';return'warn'}
const strip=arr(s.top_strip).map(x=>`<article class="${tone(x.value+' '+x.sub)}"><span>${esc(x.label)}</span><b>${esc(x.value)}</b><small>${esc(x.sub)}</small></article>`).join('');
const rail=arr(s.callouts).map(c=>`<article class="${tone(c.label+' '+c.message)}"><span>${esc(c.type)} · ${esc(c.label)}</span><b>${esc(c.level)}</b><small>${c.distance_pct==null?'distance —':`${esc(c.distance_pct)}% from now`}</small><p>${esc(c.message)}</p></article>`).join('');
const conf=arr(s.confirmation_strip).map(c=>`<article class="${tone(c.state)}"><span>${esc(c.label)}</span><b>${esc(c.state)}</b><p>${esc(c.read)}</p></article>`).join('');
const htmlBlock=`<div class="decision-chart-v2-shell"><div class="decision-chart-top-strip">${strip}</div><div class="decision-chart-workboard"><aside class="decision-chart-rail"><article class="primary ${tone(s.primary_callout?.rule)}"><span>${esc(s.primary_callout?.type)} · ${esc(s.primary_callout?.label)}</span><b>${esc(s.primary_callout?.value)}</b><p>${esc(s.primary_callout?.message)}</p><small>${esc(s.primary_callout?.rule)}</small></article>${rail}</aside></div><div class="decision-chart-confirmation-strip">${conf}</div></div>`;
let html=fs.readFileSync(indexPath,'utf8');
const style=`<style>.operational-chart{max-width:none}.decision-chart-v2-shell{margin:14px 0}.decision-chart-top-strip{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin:10px 0 14px}.decision-chart-top-strip article,.decision-chart-rail article,.decision-chart-confirmation-strip article{border:1px solid rgba(201,191,173,.45);border-radius:0;background:#ffffff;padding:10px}.decision-chart-top-strip article.good,.decision-chart-confirmation-strip article.good{border-color:rgba(47,111,78,.42)}.decision-chart-top-strip article.warn,.decision-chart-confirmation-strip article.warn{border-color:rgba(174,124,44,.45)}.decision-chart-top-strip article.bad,.decision-chart-confirmation-strip article.bad{border-color:rgba(159,63,53,.45)}.decision-chart-top-strip span,.decision-chart-rail span,.decision-chart-confirmation-strip span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.decision-chart-top-strip b{display:block;font-size:18px;text-transform:uppercase;margin-top:4px;line-height:1.1}.decision-chart-top-strip small{display:block;color:var(--muted);font-size:10px;margin-top:4px}.decision-chart-workboard{display:grid;grid-template-columns:minmax(0,1fr) 300px;gap:12px}.decision-chart-workboard .lwc-shell{grid-column:1}.decision-chart-rail{grid-column:2;display:grid;gap:8px;align-self:stretch}.decision-chart-rail article.primary{border-color:rgba(44,42,37,.35);background:rgba(44,42,37,.06)}.decision-chart-rail b{display:block;font-size:20px;margin-top:4px}.decision-chart-rail small{display:block;color:var(--muted);font-size:11px;margin-top:5px}.decision-chart-rail p,.decision-chart-confirmation-strip p{margin:6px 0 0;color:var(--muted);font-size:12px;line-height:1.35}.decision-chart-confirmation-strip{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}.decision-chart-confirmation-strip b{display:block;font-size:13px;text-transform:uppercase;margin-top:4px}.operational-chart .lwc-chart{height:880px}.operational-chart .working-verdict{display:none}.operational-chart .lwc-note{display:none}.operational-chart .action-band-strip{grid-template-columns:repeat(7,1fr)}@media(max-width:1180px){.decision-chart-top-strip{grid-template-columns:repeat(3,1fr)}.decision-chart-workboard{grid-template-columns:1fr}.decision-chart-rail{grid-column:1;grid-template-columns:repeat(2,1fr)}.decision-chart-confirmation-strip{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.decision-chart-top-strip,.decision-chart-rail,.decision-chart-confirmation-strip{grid-template-columns:1fr}.operational-chart .lwc-chart{height:620px}}</style>`;
html=html.replace(/<style>\.operational-chart\{max-width:none\}[\s\S]*?<\/style>/g,'');html=html.replace('</head>',`${style}</head>`);
html=html.replace(/<div class="decision-chart-v2-shell">[\s\S]*?<\/div><\/div><\/div>/g,'');
html=html.replace(/(<div class="lwc-shell">[\s\S]*?<\/div><\/div>)/,`<div class="decision-chart-v2-shell"><div class="decision-chart-top-strip">${strip}</div><div class="decision-chart-workboard">$1<aside class="decision-chart-rail"><article class="primary ${tone(s.primary_callout?.rule)}"><span>${esc(s.primary_callout?.type)} · ${esc(s.primary_callout?.label)}</span><b>${esc(s.primary_callout?.value)}</b><p>${esc(s.primary_callout?.message)}</p><small>${esc(s.primary_callout?.rule)}</small></article>${rail}</aside></div><div class="decision-chart-confirmation-strip">${conf}</div></div>`);
fs.writeFileSync(indexPath,html);console.log('enhanced decision chart v2');