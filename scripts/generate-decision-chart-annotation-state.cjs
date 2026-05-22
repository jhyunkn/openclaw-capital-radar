const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name,fb={})=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);if(fs.existsSync(f)){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{}}}return fb};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const arr=v=>Array.isArray(v)?v:[];const num=v=>Number.isFinite(Number(v))?Number(v):null;const fmt=(v,d=0)=>num(v)===null?null:Number(num(v).toFixed(d));
const chart=read('operational-chart-state.json',{});const route=read('strategy-routing-state.json',{});const lens=read('market-lens-state.json',{});const conf=read('confirmation-state.json',{});const trust=read('trust-strip-state.json',{});
const bands=chart.action_bands||{};const overlays=chart.chart?.overlays||{};const indicators=chart.chart?.indicators||{};const add=arr(bands.add_zone),trim=arr(bands.trim_zone);
const lenses=Object.fromEntries(arr(lens.lenses).map(l=>[String(l.id||'').toUpperCase(),l]));
function stance(id){return lenses[id]?.stance||'NO DATA'}
function pctDist(a,b){return num(a)&&num(b)?fmt(((num(b)-num(a))/num(a))*100,1):null}
const current=num(bands.current);const addMid=num(add[0])&&num(add[1])?(num(add[0])+num(add[1]))/2:null;
const primary_callout={label:'NOW',value:fmt(current),type:'REAL',message:chart.brief?.market_state||'SPX regime state pending',rule:chart.brief?.portfolio_posture||'No route loaded'};
const callouts=[
 {label:'ADD REVIEW',type:'EST',level:add.length?`${fmt(add[0])}–${fmt(add[1])}`:'—',distance_pct:pctDist(current,addMid),message:`Allowed only if route permission is ${String(route.add_permission||'unknown').replaceAll('_',' ')} and holding source tier is not proxy.`},
 {label:'HOLD ABOVE',type:'EST',level:fmt(bands.hold_above),distance_pct:pctDist(current,bands.hold_above),message:'Core exposure remains acceptable while price holds above this trend support.'},
 {label:'TRIM / NO CHASE',type:'EST',level:trim.length?`${fmt(trim[0])}–${fmt(trim[1])}`:'—',distance_pct:pctDist(current,trim[0]),message:'Avoid broad chase; rebalance weak beta or concentration if price pushes into this zone.'},
 {label:'DEFEND BELOW',type:'EST',level:fmt(bands.defense_below),distance_pct:pctDist(current,bands.defense_below),message:'Break below 200D with volatility expansion shifts route defensive.'},
 {label:'HARD RISK',type:'EST',level:fmt(bands.hard_risk),distance_pct:pctDist(current,bands.hard_risk),message:'Hard risk line: stop adding, reassess holdings, reset opportunity list.'}
];
const top_strip=[
 {label:'SPX',value:fmt(current),sub:'real close'},
 {label:'Route',value:route.route||'—',sub:route.risk_budget||'—'},
 {label:'Add permission',value:String(route.add_permission||'—').replaceAll('_',' '),sub:'route-gated'},
 {label:'Confirmation',value:conf.regime_score!=null?`${conf.regime_score}/100`:'—',sub:conf.regime||'—'},
 {label:'VIX',value:fmt(indicators.vix,1),sub:stance('VIX')},
 {label:'10Y / TLT',value:stance('TLT'),sub:`rates ${arr(chart.chart?.confirmations).find(c=>c.name==='Rates')?.status||'—'}`},
 {label:'Trust',value:trust.status||'—',sub:'data quality'}
];
const confirmation_strip=[
 {id:'SPX',label:'Broad regime',state:stance('SPX'),read:lenses.SPX?.read||'SPX lens pending'},
 {id:'QQQ',label:'AI / growth',state:stance('QQQ'),read:lenses.QQQ?.read||'QQQ lens pending'},
 {id:'TLT',label:'Rates / duration',state:stance('TLT'),read:lenses.TLT?.read||'TLT lens pending'},
 {id:'BTC',label:'Liquidity beta',state:stance('BTC'),read:lenses.BTC?.read||'BTC lens pending'},
 {id:'VIX',label:'Volatility',state:stance('VIX'),read:lenses.VIX?.read||'VIX lens pending'}
];
const state={as_of:new Date().toISOString(),artifact:'decision-chart-annotation-state',current_price:fmt(current),trend_line_50d:fmt(overlays.ma50),regime_line_200d:fmt(overlays.ma200),add_review_zone:add.map(x=>fmt(x)),trim_zone:trim.map(x=>fmt(x)),defense_line:fmt(bands.defense_below),hard_risk_line:fmt(bands.hard_risk),target:fmt(bands.target),active_route:route.route||null,add_permission:route.add_permission||null,trim_permission:route.trim_permission||null,opportunity_permission:route.opportunity_permission||null,confirmation_score:conf.regime_score??null,primary_callout,callouts,top_strip,confirmation_strip,invalidation_trigger:chart.brief?.risk_trigger||'Invalidation trigger pending',next_action:chart.brief?.change_trigger||'Next action pending',render_permission:true};
write('decision-chart-annotation-state.json',state);console.log(`decision-chart-annotation-state: route=${state.active_route||'n/a'} current=${state.current_price}`);
