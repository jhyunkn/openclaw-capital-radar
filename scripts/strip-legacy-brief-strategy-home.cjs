const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)){console.log('index missing');process.exit(0)}
let html=fs.readFileSync(indexPath,'utf8');const before=html.length;
html=html.replace(/<section id="strategy-section"[\s\S]*?<section id="artifact-status-section"/,'<section id="artifact-status-section"');
html=html.replace(/<section id="brief"[\s\S]*?<section id="holdings-section"/,'<section id="holdings-section"');
html=html.replace(/<a href="#strategy-section">Strategy<\/a>/g,'');
html=html.replace(/<a href="#brief">Brief<\/a>/g,'');
fs.writeFileSync(indexPath,html);console.log(`stripped legacy strategy/brief: ${before-html.length} bytes removed`);
