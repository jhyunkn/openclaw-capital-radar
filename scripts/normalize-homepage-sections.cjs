const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
const ids=['decision-brief-section','operational-chart-section','holdings-section','opportunities-section','market-section'];
function findSections(source,id){const token=`<section id="${id}"`;const found=[];let start=source.indexOf(token);while(start>=0){let next=source.indexOf('<section id="',start+token.length);let footer=source.indexOf('<footer',start+token.length);let end;if(next>=0&&(footer<0||next<footer))end=next;else if(footer>=0)end=footer;else end=source.length;found.push({start,end,text:source.slice(start,end)});start=source.indexOf(token,end);}return found;}
for(const id of ids){let found=findSections(html,id);if(found.length<=1)continue;const keep=found[0].text;let rebuilt='';let cursor=0;for(let i=0;i<found.length;i++){rebuilt+=html.slice(cursor,found[i].start);if(i===0)rebuilt+=keep;cursor=found[i].end;}rebuilt+=html.slice(cursor);html=rebuilt;console.log(`normalized duplicate section ${id}: ${found.length}->1`);}
const navTargets=['decision-brief-section','operational-chart-section','holdings-section','opportunities-section','market-section'];
for(const id of navTargets){const re=new RegExp(`<a href="#${id}">([^<]+)<\\/a>`,'g');let seen=false;html=html.replace(re,(m)=>{if(seen)return'';seen=true;return m;});}
fs.writeFileSync(indexPath,html);console.log('homepage section normalization complete');
