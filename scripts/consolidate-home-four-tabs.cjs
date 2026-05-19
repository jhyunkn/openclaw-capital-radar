const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="four-tab-consolidation-css">[\s\S]*?<\/style>/, '');
html = html.replace(/<nav class="four-tab-nav"[\s\S]*?<\/nav>/, '');
html = html.replace(/<section id="command-tab" class="tab-cluster-intro[\s\S]*?<\/section>/g, '');
html = html.replace(/<section id="portfolio-tab" class="tab-cluster-intro[\s\S]*?<\/section>/g, '');
html = html.replace(/<section id="workbench-tab" class="tab-cluster-intro[\s\S]*?<\/section>/g, '');
html = html.replace(/<section id="research-tab" class="tab-cluster-intro[\s\S]*?<\/section>/g, '');
html = html.replace(/<section class="decision-poster"[\s\S]*?<\/section>/g, '');
html = html.replace(/<section[^>]*>[\s\S]*?What requires action now\?[\s\S]*?<\/section>/i, '');
html = html.replace(/Read permission before price\.[\s\S]*?Consumer contract[\s\S]*?<\/section>/i, '');
const flowCss = `<style id="homepage-flow-rail-css">.homepage-flow-rail{display:flex;gap:0;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.3);overflow:auto}.homepage-flow-rail span{flex:1 0 220px;padding:10px 16px;border-right:1px solid var(--rule);font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}.homepage-flow-rail b{display:block;color:var(--ink);font-size:15px;letter-spacing:-.03em;text-transform:none;margin-top:3px}@media(max-width:700px){.homepage-flow-rail span{flex:1 0 170px}}</style>`;
html = html.replace(/<style id="homepage-flow-rail-css">[\s\S]*?<\/style>/, '');
html = html.replace('</head>', `${flowCss}</head>`);
html = html.replace(/<div class="homepage-flow-rail">[\s\S]*?<\/div>/, '');
const rail = `<div class="homepage-flow-rail"><span>01<b>Command</b></span><span>02<b>Holdings</b></span><span>03<b>Portfolio</b></span><span>04<b>Research</b></span></div>`;
const mainIdx = html.indexOf('<main');
if(mainIdx >= 0){
 const end = html.indexOf('>', mainIdx);
 html = html.slice(0,end+1)+rail+html.slice(end+1);
}
fs.writeFileSync(indexPath, html);
console.log('removed oversized command manifesto and restored compact operational opening');
