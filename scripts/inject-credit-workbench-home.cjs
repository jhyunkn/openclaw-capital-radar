const fs=require('fs');
const path=require('path');
const {renderCreditWorkbench,renderCreditWorkbenchStyle}=require('../components/radar/credit-workbench/render.cjs');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
const statePath=path.join(root,'outputs','credit-state.json');
function read(f){try{return JSON.parse(fs.readFileSync(f,'utf8'));}catch{return null;}}
if(!fs.existsSync(indexPath))throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const state=read(statePath);
html=html.replace(/<style>\.credit-workbench\{[\s\S]*?<\/style>/g,'');
html=html.replace(/<section class="macro-operating-block credit-workbench">[\s\S]*?<\/section>\s*/g,'');
html=html.replace('</head>',renderCreditWorkbenchStyle()+'</head>');
const duration='<section class="macro-operating-block duration-workbench">';
const money='<section class="macro-operating-block money-cash-workbench">';
const source='<details class="macro-source-ledger">';
function endSection(start){return start>=0?html.indexOf('</section>',start):-1;}
const dStart=html.indexOf(duration),dEnd=endSection(dStart);
if(dEnd>=0){html=html.slice(0,dEnd+10)+renderCreditWorkbench(state)+html.slice(dEnd+10);}else{const mStart=html.indexOf(money),mEnd=endSection(mStart);if(mEnd>=0)html=html.slice(0,mEnd+10)+renderCreditWorkbench(state)+html.slice(mEnd+10);else if(html.includes(source))html=html.replace(source,renderCreditWorkbench(state)+source);else throw new Error('Macro insertion point not found for Credit workbench');}
fs.writeFileSync(indexPath,html);
console.log('injected Credit workbench into Macro section');
