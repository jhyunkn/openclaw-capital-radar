const fs=require('fs');
const path=require('path');
const {renderEquityOwnershipWorkbench,renderEquityOwnershipWorkbenchStyle}=require('../components/radar/equity-ownership-workbench/render.cjs');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
const statePath=path.join(root,'outputs','equity-ownership-state.json');
function read(f){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}}
if(!fs.existsSync(indexPath))throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const state=read(statePath);
html=html.replace(/<style>\.equity-ownership-workbench\{[\s\S]*?<\/style>/g,'');
html=html.replace(/<section class="macro-operating-block equity-ownership-workbench">[\s\S]*?<\/section>\s*/g,'');
html=html.replace('</head>',renderEquityOwnershipWorkbenchStyle()+'</head>');
const credit='<section class="macro-operating-block credit-workbench">';
const duration='<section class="macro-operating-block duration-workbench">';
const source='<details class="macro-source-ledger">';
function endSection(start){return start>=0?html.indexOf('</section>',start):-1;}
let inserted=false;
for(const marker of [credit,duration]){const start=html.indexOf(marker),end=endSection(start);if(end>=0){html=html.slice(0,end+10)+renderEquityOwnershipWorkbench(state)+html.slice(end+10);inserted=true;break;}}
if(!inserted&&html.includes(source)){html=html.replace(source,renderEquityOwnershipWorkbench(state)+source);inserted=true;}
if(!inserted)throw new Error('Macro insertion point not found for Equity Ownership workbench');
fs.writeFileSync(indexPath,html);
console.log('injected Equity Ownership workbench into Macro section');
