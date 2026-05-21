const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)){console.log('index.html missing; skip visual regime strip');process.exit(0)}
let html=fs.readFileSync(indexPath,'utf8');
const before=html.length;
html=html.replace(/<section id="regime-section" class="panel visual-regime">[\s\S]*?<section id="chart-wall-section"/, '<section id="chart-wall-section"');
html=html.replace(/<section id="regime-section" class="panel visual-regime">[\s\S]*?<section id="holdings-section"/, '<section id="holdings-section"');
html=html.replace(/<style>\.visual-regime\{[\s\S]*?<\/style>/g, '');
html=html.replace(/<a href="#regime-section">Regime<\/a>/g, '');
html=html.replace(/<a href="#regime-section">Regime<\/a>/g, '');
fs.writeFileSync(indexPath,html);
console.log(`stripped abstract visual regime board: ${before-html.length} bytes removed`);
