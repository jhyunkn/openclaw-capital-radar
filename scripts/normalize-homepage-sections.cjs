const fs=require('fs');const path=require('path');const {spawnSync}=require('child_process');
const root=path.join(__dirname,'..');const indexPath=path.join(root,'index.html');

const brain=spawnSync('node scripts/inject-today-market-brain.cjs',{cwd:root,shell:true,stdio:'inherit'});
if(brain.status!==0) throw new Error('today market brain injection failed');
const brainRefine=spawnSync('node scripts/refine-today-market-brain.cjs',{cwd:root,shell:true,stdio:'inherit'});
if(brainRefine.status!==0) throw new Error('today market brain refinement failed');

if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');

// Production visual pass: order the homepage as an operational market brain.
const ids=['decision-brief-section','market-lens-section','strategy-routing-section','operational-chart-section','holdings-section','opportunities-section','market-section','kostolany-egg-section','system-health-section','trust-section'];

function findSections(source,id){const token=`<section id="${id}"`;const found=[];let start=source.indexOf(token);while(start>=0){let next=source.indexOf('<section id="',start+token.length);let footer=source.indexOf('<footer',start+token.length);let mainEnd=source.indexOf('</main>',start+token.length);let candidates=[next,footer,mainEnd].filter(i=>i>=0);let end=candidates.length?Math.min(...candidates):source.length;found.push({start,end,text:source.slice(start,end)});start=source.indexOf(token,end);}return found;}
function removeSection(source,id){const token=`<section id="${id}"`;let out=source;let start=out.indexOf(token);while(start>=0){let next=out.indexOf('<section id="',start+token.length);let footer=out.indexOf('<footer',start+token.length);let mainEnd=out.indexOf('</main>',start+token.length);let candidates=[next,footer,mainEnd].filter(i=>i>=0);let end=candidates.length?Math.min(...candidates):out.length;out=out.slice(0,start)+out.slice(end);start=out.indexOf(token);}return out;}
function reorderSections(source){const collected=[];let out=source;for(const id of ids){const found=findSections(out,id);if(!found.length)continue;collected.push({id,text:found[0].text});out=removeSection(out,id);}if(!collected.length)return out;const ordered=ids.map(id=>collected.find(item=>item.id===id)).filter(Boolean).map(item=>item.text).join('\n    ');const footer=out.indexOf('<footer');const mainEnd=out.indexOf('</main>');const insertAt=footer>=0?footer:(mainEnd>=0?mainEnd:out.length);return out.slice(0,insertAt)+ordered+'\n    '+out.slice(insertAt);}
function rebuildNav(source){const labels={
  'today-market-brain-section':'Brain',
  'decision-brief-section':'Macro',
  'market-lens-section':'Movement',
  'strategy-routing-section':'Route',
  'operational-chart-section':'Levels',
  'holdings-section':'Holdings',
  'opportunities-section':'Opportunities',
  'market-section':'Tape',
  'kostolany-egg-section':'Egg',
  'system-health-section':'Health'
};
const navOrder=['today-market-brain-section',...ids];
const navHtml=navOrder.filter(id=>labels[id]&&source.includes(`id="${id}"`)).map(id=>`<a href="#${id}">${labels[id]}</a>`).join('');
return source.replace(/<nav class="nav">[\s\S]*?<\/nav>/,`<nav class="nav">${navHtml}</nav>`);}

html=removeSection(html,'macro-cycle-section');
for(const id of ids.concat(['today-market-brain-section'])){let found=findSections(html,id);if(found.length<=1)continue;const keep=found[0].text;let rebuilt='';let cursor=0;for(let i=0;i<found.length;i++){rebuilt+=html.slice(cursor,found[i].start);if(i===0)rebuilt+=keep;cursor=found[i].end;}rebuilt+=html.slice(cursor);html=rebuilt;console.log(`normalized duplicate section ${id}: ${found.length}->1`);}
html=reorderSections(html);
html=rebuildNav(html);
fs.writeFileSync(indexPath,html);console.log('homepage section normalization complete: operational market brain order');