const fs=require('fs');
const path=require('path');
const {renderRealAssetsWorkbench,renderRealAssetsWorkbenchStyle}=require('../components/radar/real-assets-workbench/render.cjs');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
const statePath=path.join(root,'outputs','real-assets-state.json');
function read(f){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}}
if(!fs.existsSync(indexPath))throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const state=read(statePath);
html=html.replace(/<style>\.real-assets-workbench\{[\s\S]*?<\/style>/g,'');
html=html.replace(/<section class="macro-operating-block real-assets-workbench">[\s\S]*?<\/section>\s*/g,'');
html=html.replace('</head>',renderRealAssetsWorkbenchStyle()+'</head>');
const commodities='<section class="macro-operating-block commodities-workbench">';
const volatility='<section class="macro-operating-block volatility-workbench">';
const source='<details class="macro-source-ledger">';
function endSection(start){return start>=0?html.indexOf('</section>',start):-1;}
let inserted=false;
for(const marker of [commodities,volatility]){const start=html.indexOf(marker),end=endSection(start);if(end>=0){html=html.slice(0,end+10)+renderRealAssetsWorkbench(state)+html.slice(end+10);inserted=true;break;}}
if(!inserted&&html.includes(source)){html=html.replace(source,renderRealAssetsWorkbench(state)+source);inserted=true;}
if(!inserted)throw new Error('Macro insertion point not found for Real Assets workbench');
fs.writeFileSync(indexPath,html);
console.log('injected Real Assets workbench into Macro section');
