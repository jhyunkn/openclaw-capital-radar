const fs=require('fs');
const path=require('path');
const {renderFxDollarWorkbench,renderFxDollarWorkbenchStyle}=require('../components/radar/fx-dollar-workbench/render.cjs');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
const statePath=path.join(root,'outputs','fx-dollar-state.json');
function read(f){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}}
if(!fs.existsSync(indexPath))throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const state=read(statePath);
html=html.replace(/<style>\.fx-dollar-workbench\{[\s\S]*?<\/style>/g,'');
html=html.replace(/<section class="macro-operating-block fx-dollar-workbench">[\s\S]*?<\/section>\s*/g,'');
html=html.replace('</head>',renderFxDollarWorkbenchStyle()+'</head>');
const equity='<section class="macro-operating-block equity-ownership-workbench">';
const credit='<section class="macro-operating-block credit-workbench">';
const source='<details class="macro-source-ledger">';
function endSection(start){return start>=0?html.indexOf('</section>',start):-1;}
let inserted=false;
for(const marker of [equity,credit]){const start=html.indexOf(marker),end=endSection(start);if(end>=0){html=html.slice(0,end+10)+renderFxDollarWorkbench(state)+html.slice(end+10);inserted=true;break;}}
if(!inserted&&html.includes(source)){html=html.replace(source,renderFxDollarWorkbench(state)+source);inserted=true;}
if(!inserted)throw new Error('Macro insertion point not found for FX Dollar workbench');
fs.writeFileSync(indexPath,html);
console.log('injected FX Dollar workbench into Macro section');
