const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name,fallback={})=>{for(const dir of ['outputs','public/outputs','data']){const p=path.join(root,dir,name);if(fs.existsSync(p)){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{}}}return fallback};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const num=v=>Number.isFinite(Number(v))?Number(v):null;const round=(v,d=2)=>num(v)===null?null:Number(num(v).toFixed(d));const clamp=(v,a=0,b=100)=>Math.max(a,Math.min(b,Math.round(v)));
const charts=read('market-chart-panels.json',{panels:[]});const decision=read('chart-regime-decision-state.json',{relationships:[],panels:[]});const tape=read('market-tape-state.json',{});
const panels=Array.isArray(charts.panels)?charts.panels:[];const rels=Array.isArray(decision.relationships)?decision.relationships:[];
const find=s=>panels.find(p=>p.symbol===s)||{};
const spx=find('^GSPC'),ndx=find('^NDX'),vix=find('^VIX'),tnx=find('^TNX'),tlt=find('TLT'),btc=find('BTC-USD'),dxy=find('DX-Y.NYB'),oil=find('CL=F');
const spxCur=num(spx.current),spx200=num(spx.ma?.ma200),spx50=num(spx.ma?.ma50),spxDist=num(spx.levels?.distance_to_200d_pct),spxDD=num(spx.levels?.drawdown_from_high_pct);
const ndxDist=num(ndx.levels?.distance_to_200d_pct),vixCur=num(vix.current),tenY=num(tnx.current),tltTrend=num(tlt.trend?.trend_score),btcDist=num(btc.levels?.distance_to_200d_pct),dxyTrend=num(dxy.trend?.trend_score),oilTrend=num(oil.trend?.trend_score);
const relConfirmed=rels.filter(r=>/confirmed|support|relief|risk_bid/i.test(r.status||'')).length;const relPressure=rels.filter(r=>/pressure|conflict/i.test(r.status||'')).length;
function phase(){
 if(spxDist!==null&&spxDist>8&&vixCur!==null&&vixCur<18)return {id:'E',label:'Late Bull / Expansion',assetBias:'Quality growth, core equity, selective high-beta',read:'Trend remains strong, but margin of safety is shrinking.'};
 if(spxDist!==null&&spxDist>0&&vixCur!==null&&vixCur<22)return {id:'D/E',label:'Recovery Into Late Bull',assetBias:'Core equity with selective rotation',read:'Risk assets are supported, but confirmation must come from volatility and rates.'};
 if(spxDist!==null&&spxDist<0&&vixCur!==null&&vixCur>=22)return {id:'B/C',label:'Correction / Accumulation Watch',assetBias:'Cash, bonds, staged accumulation watchlist',read:'Risk reset may create opportunity only after volatility cools and support holds.'};
 if(spxDist!==null&&spxDist<-5)return {id:'B',label:'Bear / Bottoming Watch',assetBias:'Defense first, prepare staged re-entry',read:'Price is below regime support; wait for capitulation or reclaim.'};
 return {id:'Transition',label:'Transition Phase',assetBias:'Hold core, wait for confirmation',read:'Signals are mixed; do not over-commit until relationships confirm.'};
}
const ph=phase();
const trendSupport=clamp(((spxDist??0)+10)*4 + ((ndxDist??0)+10)*3);const volSupport=vixCur===null?50:clamp(100-(vixCur-12)*6);const rateSupport=tenY===null?50:clamp(100-(tenY-3.5)*30);const specSupport=btcDist===null?50:clamp(50+btcDist*2);const dollarSupport=dxyTrend===null?50:clamp(100-dxyTrend);const energyPressure=oilTrend===null?45:clamp(oilTrend);
let bull=clamp(trendSupport*.35+volSupport*.2+rateSupport*.15+specSupport*.15+dollarSupport*.1+(relConfirmed*4));
let bear=clamp((100-trendSupport)*.35+(100-volSupport)*.25+(100-rateSupport)*.2+energyPressure*.1+(relPressure*5));
let correction=clamp(100-Math.abs(bull-bear)*.75);
const total=bull+bear+correction||1;bull=Math.round(bull/total*100);bear=Math.round(bear/total*100);correction=100-bull-bear;
const spxSeries=Array.isArray(spx.series)?spx.series.filter(x=>num(x.c)!==null).slice(-160):[];
const now=spxCur||num(spxSeries.at(-1)?.c)||100;
function futurePath(type){const m=[1,2,3,4,5,6,7,8,9,10,11,12];if(type==='bull')return m.map(i=>round(now*(1+0.012*i+0.01*Math.sin(i/2))));if(type==='correction')return m.map(i=>{const trough=now*.88; if(i<=5)return round(now-(now-trough)*(i/5)); return round(trough+(now*.97-trough)*((i-5)/7));});return m.map(i=>round(now*(1-0.025*i-0.008*Math.sin(i/1.5))));}
const actual=spxSeries.map((x,i)=>({x:i,y:round(x.c),label:'REAL'}));const start=actual.length?actual.at(-1).x:0;
const scenario_paths={actual,projection_start_index:start,current:round(now),paths:[
 {id:'bull',label:'Bull path',type:'PROJ',points:futurePath('bull').map((y,i)=>({x:start+i+1,y}))},
 {id:'correction',label:'Correction/recovery path',type:'PROJ',points:futurePath('correction').map((y,i)=>({x:start+i+1,y}))},
 {id:'bear',label:'Bear/regime-break path',type:'PROJ',points:futurePath('bear').map((y,i)=>({x:start+i+1,y}))}
]};
const evidence_warnings=[];if(!spxCur)evidence_warnings.push('SPX current value unavailable; scenario paths degraded.');if(!spx50||!spx200)evidence_warnings.push('SPX moving averages unavailable; trend triggers degraded.');if(!vixCur)evidence_warnings.push('VIX unavailable; volatility trigger degraded.');
const state={as_of:new Date().toISOString(),artifact:'cycle-scenario-state',source_artifacts:['market-chart-panels.json','chart-regime-decision-state.json','market-tape-state.json'],data_quality:{real:['SPX/NDX/VIX/10Y/BTC/oil/dollar/TLT chart panels from market data adapter','current values, moving averages, drawdown, distance to 200D'],estimated:['Kostolany phase inference','cross-chart relationship scoring','scenario probability scoring'],projected:['bull/correction/bear paths','trigger/action rules']},evidence_warnings,current:{spx:spxCur,spx_50d:spx50,spx_200d:spx200,spx_distance_to_200d_pct:spxDist,spx_drawdown_from_high_pct:spxDD,ndx_distance_to_200d_pct:ndxDist,vix:vixCur,ten_year_yield:tenY,btc_distance_to_200d_pct:btcDist,relationships_confirmed:relConfirmed,relationships_pressure:relPressure},kostolany_phase:ph,scenario_probabilities:{bull_continues:bull,correction_then_recover:correction,bear_market:bear},scenario_paths,signals:[
 {name:'Trend health',value:trendSupport,label:spxDist!==null&&spxDist>0?'Above long-term trend':'Below/near long-term support',real:true,watch:spx50&&spx200?`Watch 50D ${Math.round(spx50).toLocaleString()} and 200D ${Math.round(spx200).toLocaleString()}`:'Watch 50D / 200D reclaim'},
 {name:'Volatility / fear',value:volSupport,label:vixCur!==null&&vixCur<18?'Calm / complacency':vixCur!==null&&vixCur<22?'Normal':'Stress',real:true,watch:'VIX > 22 = correction risk; VIX > 28 = stress regime'},
 {name:'Rates pressure',value:rateSupport,label:tenY!==null&&tenY>4.5?'Pressure on duration':tenY!==null&&tenY<4?'Rates relief':'Mixed',real:true,watch:'Rising 10Y pressures AI/growth multiples'},
 {name:'Speculative liquidity',value:specSupport,label:btcDist!==null&&btcDist>0?'BTC supports risk appetite':'BTC not confirming risk',real:true,watch:'BTC loss/reclaim of 200D modifies crypto-beta permission'},
 {name:'Relationship confirmation',value:clamp(50+relConfirmed*10-relPressure*8),label:`${relConfirmed} confirming / ${relPressure} pressure`,real:false,watch:'Cross-chart agreement matters more than any single chart'}
],scenarios:[
 {id:'bull',title:'Bull Continues',probability:bull,requires:['SPX/NDX hold above 50D/200D','VIX remains contained','10Y does not accelerate higher','AI/earnings continue to carry index'],action:'Hold core equity; avoid broad chase; add only on controlled retests.',trigger:'New highs with VIX contained and rates stable.'},
 {id:'correction',title:'Correction Then Recover',probability:correction,requires:['SPX loses 50D but holds/reclaims 200D','VIX spikes then rolls over','rates/oil shock cools','Fear resets without structural credit stress'],action:'Trim weak beta on 50D loss; prepare staged adds near 200D/reclaim.',trigger:'Drawdown into support with volatility peak.'},
 {id:'bear',title:'Bear Market / Regime Break',probability:bear,requires:['SPX loses 200D','VIX sustains above stress zone','rates/dollar/oil pressure remain elevated','earnings/AI narrative breaks'],action:'Defense first; raise cash; wait for capitulation/reclaim before re-entry.',trigger:'Failed 200D reclaim plus rising volatility.'}
],render_permission:evidence_warnings.length<3};
write('cycle-scenario-state.json',state);console.log(`cycle scenario state: phase=${ph.label} bull=${bull} correction=${correction} bear=${bear} warnings=${evidence_warnings.length}`);
