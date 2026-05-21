const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)){console.log('index missing');process.exit(0)}
let html=fs.readFileSync(indexPath,'utf8');const before=html.length;
function stripSection(id){
 const re=new RegExp(`<section\\s+id=["']${id}["'][\\s\\S]*?<\\/section>`, 'gi');
 html=html.replace(re,'');
}
['brief','strategy-section','chart-wall-section','spx-cycle-map-section','cycle-scenario-section','visual-regime-section','artifact-status-section'].forEach(stripSection);
// Older regex fallback for malformed nested sections from prior patch-chain builds.
html=html.replace(/<section id="brief"[\s\S]*?(?=<section id="holdings-section")/gi,'');
html=html.replace(/<section id="strategy-section"[\s\S]*?(?=<section id="holdings-section"|<section id="artifact-status-section"|<footer)/gi,'');
html=html.replace(/<section id="chart-wall-section"[\s\S]*?(?=<section id="spx-cycle-map-section"|<section id="cycle-scenario-section"|<section id="strategy-section"|<section id="holdings-section")/gi,'');
html=html.replace(/<section id="spx-cycle-map-section"[\s\S]*?(?=<section id="cycle-scenario-section"|<section id="strategy-section"|<section id="holdings-section")/gi,'');
html=html.replace(/<section id="cycle-scenario-section"[\s\S]*?(?=<section id="strategy-section"|<section id="holdings-section")/gi,'');
html=html.replace(/<a href="#strategy-section">Strategy<\/a>/g,'');
html=html.replace(/<a href="#brief">Brief<\/a>/g,'');
html=html.replace(/<a href="#chart-wall-section">Regime Charts<\/a>/g,'');
html=html.replace(/<a href="#spx-cycle-map-section">SPX Map<\/a>/g,'');
html=html.replace(/<a href="#cycle-scenario-section">Cycle<\/a>/g,'');
// Collapse repeated operational nav links created by older injectors.
html=html.replace(/(<a href="#decision-brief-section">Brief<\/a>)(?:\s*\1)+/g,'$1');
html=html.replace(/(<a href="#operational-chart-section">Decision Chart<\/a>)(?:\s*\1)+/g,'$1');
fs.writeFileSync(indexPath,html);console.log(`stripped legacy homepage sections: ${before-html.length} bytes removed`);
