const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const ids=['kostolany-egg-section','decision-brief-section','operational-chart-section','market-lens-section','strategy-routing-section','holdings-section','opportunities-section','market-section','trust-section'];
function findSections(source,id){const token=`<section id="${id}"`;const found=[];let start=source.indexOf(token);while(start>=0){let next=source.indexOf('<section id="',start+token.length);let footer=source.indexOf('<footer',start+token.length);let mainEnd=source.indexOf('</main>',start+token.length);let candidates=[next,footer,mainEnd].filter(i=>i>=0);let end=candidates.length?Math.min(...candidates):source.length;found.push({start,end,text:source.slice(start,end)});start=source.indexOf(token,end);}return found;}
function removeSection(source,id){const token=`<section id="${id}"`;let out=source;let start=out.indexOf(token);while(start>=0){let next=out.indexOf('<section id="',start+token.length);let footer=out.indexOf('<footer',start+token.length);let mainEnd=out.indexOf('</main>',start+token.length);let candidates=[next,footer,mainEnd].filter(i=>i>=0);let end=candidates.length?Math.min(...candidates):out.length;out=out.slice(0,start)+out.slice(end);start=out.indexOf(token);}return out;}
html=removeSection(html,'macro-cycle-section');
for(const id of ids){let found=findSections(html,id);if(found.length<=1)continue;const keep=found[0].text;let rebuilt='';let cursor=0;for(let i=0;i<found.length;i++){rebuilt+=html.slice(cursor,found[i].start);if(i===0)rebuilt+=keep;cursor=found[i].end;}rebuilt+=html.slice(cursor);html=rebuilt;console.log(`normalized duplicate section ${id}: ${found.length}->1`);}
const navTargets=['kostolany-egg-section','decision-brief-section','operational-chart-section','market-lens-section','strategy-routing-section','holdings-section','opportunities-section','market-section','trust-section'];
for(const id of navTargets){const re=new RegExp(`<a href="#${id}">([^<]+)<\\/a>`,'g');let seen=false;html=html.replace(re,(m)=>{if(seen)return'';seen=true;return m;});}
fs.writeFileSync(indexPath,html);console.log('homepage section normalization complete');
