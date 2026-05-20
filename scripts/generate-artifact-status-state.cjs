const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name)=>{try{return JSON.parse(fs.readFileSync(path.join(root,'outputs',name),'utf8'))}catch{return null}};
const write=(name,data)=>{const f=path.join(root,'outputs',name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n');const p=path.join(root,'public','outputs',name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(data,null,2)+'\n')};
const arr=v=>Array.isArray(v)?v:[];const bool=v=>v===true?'valid':'degraded';
const files=[
  {key:'strategy',label:'Strategy',file:'strategy-state.json',count:s=>s?.highest_conviction_themes?.length||0,changed:s=>!!s?.changed_since_last_cycle,status:s=>bool(s?.render_permission)},
  {key:'landscape',label:'Landscape',file:'market-landscape-state.json',count:s=>arr(s?.market_focus).length+arr(s?.market_worries).length,changed:s=>s?.state_change_level&&s.state_change_level!=='minor',status:s=>bool(s?.render_permission)},
  {key:'holdings',label:'Holdings',file:'holding-zone-state.json',count:s=>arr(s?.zones).length,changed:s=>false,status:s=>bool(s?.render_permission)},
  {key:'portfolio',label:'Portfolio',file:'portfolio-translation-state.json',count:s=>arr(s?.holdings).length,changed:s=>(s?.summary?.changed_since_last_cycle||0)>0,status:s=>bool(s?.render_permission)},
  {key:'opportunity',label:'Opportunity',file:'opportunity-asymmetry-state.json',count:s=>s?.summary?.candidates||0,changed:s=>(s?.summary?.changed_since_last_cycle||0)>0,status:s=>bool(s?.render_permission)},
  {key:'evidence',label:'Evidence',file:'institutional-evidence-map.json',count:s=>arr(s?.evidence).length,changed:s=>false,status:s=>arr(s?.evidence).length?'valid':'degraded'},
  {key:'data_truth',label:'Data Truth',file:'data-truth-state.json',count:s=>arr(s?.staleSources).length+arr(s?.blockedSources).length,changed:s=>false,status:s=>s?.homepageSafeToRender?'valid':'blocked'}
];
const as_of=new Date().toISOString();
const artifacts=files.map(meta=>{const s=read(meta.file);return{key:meta.key,label:meta.label,file:meta.file,status:s?meta.status(s):'missing',count:s?meta.count(s):0,changed:s?meta.changed(s):false,as_of:s?.as_of||s?.generatedAt||null,open:`outputs/${meta.file}`}});
const state={as_of,artifact:'artifact-status-state',artifacts,summary:{valid:artifacts.filter(a=>a.status==='valid').length,degraded:artifacts.filter(a=>a.status==='degraded').length,blocked:artifacts.filter(a=>a.status==='blocked').length,missing:artifacts.filter(a=>a.status==='missing').length,changed:artifacts.filter(a=>a.changed).length},render_permission:true};
write('artifact-status-state.json',state);
console.log(`artifact-status-state: valid=${state.summary.valid} degraded=${state.summary.degraded} blocked=${state.summary.blocked} missing=${state.summary.missing}`);
