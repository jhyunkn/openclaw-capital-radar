const fs=require('fs');const path=require('path');const https=require('https');
const root=path.join(__dirname,'..');
const read=(name,fb={})=>{for(const dir of ['outputs','public/outputs','data']){const f=path.join(root,dir,name);if(fs.existsSync(f)){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{}}}return fb};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const get=url=>new Promise(resolve=>{const req=https.get(url,{headers:{'User-Agent':'CapitalRadar/1.0'}},res=>{let b='';res.on('data',d=>b+=d);res.on('end',()=>resolve(b))});req.on('error',()=>resolve(''));req.setTimeout(15000,()=>{req.destroy();resolve('')})});
const num=v=>{if(v===null||v===undefined||v==='')return null;const n=Number(v);return Number.isFinite(n)?n:null};const round=(v,d=2)=>num(v)===null?null:Number(num(v).toFixed(d));
function parseFredCsv(csv){const lines=String(csv||'').trim().split(/\r?\n/);const out=[];for(const line of lines.slice(1)){const [date,value]=line.split(',');const n=num(value);if(date&&n!==null)out.push({date,value:n})}return out}
async function fred(id){const csv=await get(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`);return parseFredCsv(csv)}
function latest(rows){return rows.filter(r=>num(r.value)!==null).at(-1)||null}
function yoy(rows){const l=latest(rows);if(!l)return null;const d=new Date(l.date);const target=new Date(d);target.setFullYear(target.getFullYear()-1);let prev=null;for(const r of rows){const rd=new Date(r.date);if(rd<=target)prev=r}return prev?round((l.value-prev.value)/prev.value*100,2):null}
function tapeValue(tape,signalName){const found=(tape.signals||[]).find(s=>String(s.signal||'').toLowerCase()===String(signalName||'').toLowerCase());return found?String(found.value||''):''}
function firstNumberAfter(text,label){const s=String(text||'');const afterLabel=label?s.slice(Math.max(0,s.toLowerCase().indexOf(String(label).toLowerCase()))+String(label).length):s;const m=afterLabel.match(/-?\d+(?:\.\d+)?/);return m?num(m[0]):null}
function rateFromTape(text){return firstNumberAfter(text,'Treasury')??firstNumberAfter(text,'10Y')??firstNumberAfter(text,'Live:')}
function spreadFromTape(text){return firstNumberAfter(text,'HY OAS')??firstNumberAfter(text,'OAS')??firstNumberAfter(text,'Live:')}
function cleanMacroValues(values){return values.filter(item=>num(item.value)!==null)}
(async()=>{const op=read('operational-chart-state.json',{});const conf=read('confirmation-state.json',{});const tape=read('market-tape-state.json',{});const bands=op.action_bands||{};const chart=op.chart||{};const [m2Rows,dgs10Rows,hyRows,dffRows]=await Promise.all([fred('M2SL'),fred('DGS10'),fred('BAMLH0A0HYM2'),fred('DFF')]);
const m2=latest(m2Rows),dgs10=latest(dgs10Rows),hy=latest(hyRows),dff=latest(dffRows);const m2YoY=yoy(m2Rows);const tapeDgs10=rateFromTape(tapeValue(tape,'Rates'));const tapeHy=spreadFromTape(tapeValue(tape,'Credit'))??spreadFromTape(tapeValue(tape,'Liquidity'));const spx=num(bands.current);const ma50=num(chart.overlays?.ma50);const ma200=num(chart.overlays?.ma200);const vix=num(chart.indicators?.vix);const rsi=num(chart.indicators?.rsi14);
const confRegime=conf.regime||'transition / verify';const confScore=conf.regime_score??null;const factorLine=Array.isArray(conf.factors)?conf.factors.slice(0,4).map(f=>`${f.name}: ${f.status}`).join(' · '):'';
let market='SPX trend is intact but not a blind add setup.';if(spx&&ma50&&spx<ma50)market='SPX is below/near 50D: trend is weakening and confirmation matters.';if(spx&&ma200&&spx<ma200)market='SPX is below 200D: regime defense takes priority.';if(spx&&ma50&&spx>ma50&&vix!==null&&vix<20)market='SPX is above 50D with volatility contained.';
const dgs10Value=round(dgs10?.value??tapeDgs10,2);const hyValue=round(hy?.value??tapeHy,2);
let macro='Macro backdrop is mixed.';if(dgs10Value!==null&&dgs10Value>=4.5)macro='Rates remain a valuation headwind for long-duration growth.';else if(dgs10Value!==null&&dgs10Value<4)macro='Rates are less restrictive and support duration-sensitive assets.';if(m2YoY!==null&&m2YoY>4)macro+=` M2 is expanding YoY, supporting liquidity.`;else if(m2YoY!==null&&m2YoY<0)macro+=` M2 remains contracting YoY, limiting liquidity beta.`;if(hyValue!==null&&hyValue>4)macro+=` Credit spreads are a risk warning.`;else if(hyValue!==null&&hyValue<3)macro+=` Credit stress remains contained.`;
const action=conf.action||op.brief?.portfolio_posture||'Hold core / no broad chase';const trigger=op.brief?.change_trigger||'Use chart bands for add/trim/defense triggers.';
const brief=`${market} Confirmation regime: ${confRegime}${confScore!==null?` (${confScore}/100)`:''}. ${macro} Action: ${action} Change rule: ${trigger}`;
const macro_values=cleanMacroValues([
 {key:'confirmation',label:'Confirmation',value:confScore,unit:'/100',type:'EST',source:'confirmation-state'},
 {key:'spx',label:'S&P 500',value:round(spx),unit:'index',type:'REAL',source:'operational-chart-state'},
 {key:'vix',label:'VIX',value:round(vix,1),unit:'vol',type:'REAL',source:'Yahoo chart API'},
 {key:'dgs10',label:'10Y Treasury',value:dgs10Value,unit:'%',type:dgs10?.value!==undefined?'REAL':'DERIVED',source:dgs10?.value!==undefined?'FRED DGS10':'market-tape fallback',date:dgs10?.date},
 {key:'dff',label:'Effective Fed Funds',value:round(dff?.value,2),unit:'%',type:'REAL',source:'FRED DFF',date:dff?.date},
 {key:'m2',label:'M2',value:round(m2?.value,1),unit:'USD billions',type:'REAL',source:'FRED M2SL',date:m2?.date},
 {key:'m2_yoy',label:'M2 YoY',value:m2YoY,unit:'%',type:'EST',source:'derived from FRED M2SL'},
 {key:'hy_oas',label:'HY OAS',value:hyValue,unit:'spread',type:hy?.value!==undefined?'REAL':'DERIVED',source:hy?.value!==undefined?'FRED BAMLH0A0HYM2':'market-tape fallback',date:hy?.date},
 {key:'rsi14',label:'RSI 14',value:round(rsi,1),unit:'',type:'EST',source:'derived from SPX closes'}
]);
const state={as_of:new Date().toISOString(),artifact:'market-decision-brief-state',brief,market_read:market,macro_read:macro,confirmation_read:factorLine,portfolio_action:action,change_rule:trigger,risk_rule:op.brief?.risk_trigger||null,macro_values,macro_omissions:['dff','m2','m2_yoy'].filter(key=>!macro_values.some(item=>item.key===key)),chart_reference:{symbol:op.symbol||'^GSPC',current:spx,ma50:round(ma50),ma200:round(ma200),add_zone:bands.add_zone,trim_zone:bands.trim_zone,defense_below:bands.defense_below,hard_risk:bands.hard_risk},render_permission:true};
write('market-decision-brief-state.json',state);console.log('market decision brief state generated from confirmation-state');
})().catch(e=>{write('market-decision-brief-state.json',{as_of:new Date().toISOString(),artifact:'market-decision-brief-state',render_permission:false,error:String(e.message||e)});console.error(e);process.exit(0)});
