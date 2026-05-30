const fs=require('fs');
const path=require('path');
const {renderCommoditiesWorkbench,renderCommoditiesWorkbenchStyle}=require('../components/radar/commodities-workbench/render.cjs');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
const statePath=path.join(root,'outputs','commodities-state.json');
function read(f){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}}
if(!fs.existsSync(indexPath))throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const state=read(statePath);
html=html.replace(/<style>\.commodities-workbench\{[\s\S]*?<\/style>/g,'');
html=html.replace(/<section class="macro-operating-block commodities-workbench">[\s\S]*?<\/section>\s*/g,'');
html=html.replace('</head>',renderCommoditiesWorkbenchStyle()+'</head>');
const volatility='<section class="macro-operating-block volatility-workbench">';
const fx='<section class="macro-operating-block fx-dollar-workbench">';
const source='<details class="macro-source-ledger">';
function endSection(start){return start>=0?html.indexOf('</section>',start):-1;}
let inserted=false;
for(const marker of [volatility,fx]){const start=html.indexOf(marker),end=endSection(start);if(end>=0){html=html.slice(0,end+10)+renderCommoditiesWorkbench(state)+html.slice(end+10);inserted=true;break;}}
if(!inserted&&html.includes(source)){html=html.replace(source,renderCommoditiesWorkbench(state)+source);inserted=true;}
if(!inserted)throw new Error('Macro insertion point not found for Commodities workbench');
fs.writeFileSync(indexPath,html);
console.log('injected Commodities workbench into Macro section');
