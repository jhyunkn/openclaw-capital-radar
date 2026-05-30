const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const out=[path.join(root,'outputs','macro-intelligence-state.json'),path.join(root,'public','outputs','macro-intelligence-state.json')];
const readJson=p=>{try{return JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));}catch{return null;}};
const write=(p,d)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');};
const n=v=>Number.isFinite(Number(v))?Number(v):null;
const pick=(o,p)=>p.split('.').reduce((a,k)=>a&&a[k],o);
function zoneFromScore(v,labels=['LOW','MID','HIGH']){const x=n(v);if(x==null)return'UNKNOWN';if(x>=70)return labels[2];if(x<=35)return labels[0];return labels[1];}
function lens(id,label,source,value,zone,trace,missing=[]){return{id,label,source,value:n(value),zone:zone||'UNKNOWN',trace,missing_evidence:missing};}
const files={money:readJson('outputs/money-cash-state.json'),duration:readJson('outputs/duration-state.json'),credit:readJson('outputs/credit-state.json'),equities:readJson('outputs/equity-ownership-state.json'),fx:readJson('outputs/fx-dollar-state.json'),volatility:readJson('outputs/volatility-state.json'),commodities:readJson('outputs/commodities-state.json'),real_assets:readJson('outputs/real-assets-state.json')};
const lenses={
  money_market: lens('money_market','Money Market / Reward for Waiting','Money Market',pick(files.money,'derived.cash_competitiveness_score.value')??pick(files.money,'capital_behavior.score'),zoneFromScore(pick(files.money,'derived.cash_competitiveness_score.value'),['ACCOMMODATIVE','BALANCED','RESTRICTIVE']),['outputs/money-cash-state.json','derived.cash_competitiveness_score','capital_behavior'],files.money?.missing_evidence||[]),
  duration: lens('duration','Duration / Price of Time','Duration',pick(files.duration,'derived.duration_pressure_score.value')??pick(files.duration,'historical_reference.real_yield.current_percentile'),zoneFromScore(pick(files.duration,'derived.duration_pressure_score.value')??pick(files.duration,'historical_reference.real_yield.current_percentile'),['EASY_DURATION','BALANCED','RESTRICTIVE']),['outputs/duration-state.json','real yield','yield curve','duration pressure'],files.duration?.missing_evidence||[]),
  credit: lens('credit','Credit / Repayment Trust','Credit',pick(files.credit,'derived.credit_stress_score.value')??pick(files.credit,'historical_reference.high_yield_oas.current_percentile'),zoneFromScore(pick(files.credit,'derived.credit_stress_score.value')??pick(files.credit,'historical_reference.high_yield_oas.current_percentile'),['HEALTHY','NORMAL','STRESSED']),['outputs/credit-state.json','HY spread','IG spread','credit stress'],files.credit?.missing_evidence||[]),
  equity_breadth: lens('equity_breadth','Equity Breadth / Ownership Participation','Equities',pick(files.equities,'derived.breadth_proxy_momentum.value'),zoneFromScore(pick(files.equities,'derived.breadth_proxy_momentum.value'),['NARROW','MIXED','BROAD']),['outputs/equity-ownership-state.json','breadth proxy momentum','participation chart'],files.equities?.missing_evidence||[]),
  dollar: lens('dollar','Dollar / Funding Access','FX & Funding',pick(files.fx,'historical_reference.dxy.current_percentile'),zoneFromScore(pick(files.fx,'historical_reference.dxy.current_percentile'),['DOLLAR_WEAK','MID','DOLLAR_FIRM']),['outputs/fx-dollar-state.json','DXY','USDJPY','USDCNY','funding proxies'],files.fx?.missing_evidence||[]),
  volatility: lens('volatility','Volatility / Disorder Pricing','Volatility',pick(files.volatility,'derived.volatility_stress_score.value'),zoneFromScore(pick(files.volatility,'derived.volatility_stress_score.value'),['CONTAINED','ELEVATED','STRESSED']),['outputs/volatility-state.json','VIX','MOVE','VVIX'],files.volatility?.missing_evidence||[]),
  commodities: lens('commodities','Commodity Scarcity / Physical Constraint','Commodities',pick(files.commodities,'derived.physical_constraint_score.value'),zoneFromScore(pick(files.commodities,'derived.physical_constraint_score.value'),['ABUNDANT','MID','TIGHT']),['outputs/commodities-state.json','energy lens','industrial lens','food lens','monetary metal lens'],files.commodities?.missing_evidence||[]),
  collateral: lens('collateral','Collateral / Real Asset Pressure','Real Assets',pick(files.real_assets,'derived.collateral_pressure_score.value'),zoneFromScore(pick(files.real_assets,'derived.collateral_pressure_score.value'),['CHEAP','MID','EXPENSIVE']),['outputs/real-assets-state.json','housing','affordability','CRE','farmland','infrastructure'],files.real_assets?.missing_evidence||[]),
  monetary_trust: lens('monetary_trust','Monetary Trust Alternatives','Monetary Alternatives',null,'PENDING',['outputs/monetary-alternatives-state.json pending'],['Gold/Bitcoin/Silver state not yet generated'])
};
const configuration={};
for(const [k,v] of Object.entries(lenses))configuration[k]=v.zone;
const behavior={wait:0,lend:0,own:0,defend:0,store_value:0,speculate:0,seek_scarcity:0,seek_liquidity:0};
function add(k,v){behavior[k]=Math.max(0,Math.min(100,(behavior[k]||0)+v));}
if(configuration.money_market==='RESTRICTIVE')add('wait',24); else add('speculate',10);
if(configuration.duration==='RESTRICTIVE')add('defend',12); else add('own',10);
if(configuration.credit==='HEALTHY')add('lend',18); if(configuration.credit==='STRESSED')add('defend',24);
if(configuration.equity_breadth==='BROAD')add('own',22); if(configuration.equity_breadth==='NARROW')add('defend',12);
if(configuration.dollar==='DOLLAR_FIRM')add('seek_liquidity',18);
if(configuration.volatility==='CONTAINED')add('own',14); if(configuration.volatility==='STRESSED')add('defend',22);
if(configuration.commodities==='TIGHT')add('seek_scarcity',20);
if(configuration.collateral==='EXPENSIVE')add('defend',10);
const total=Object.values(behavior).reduce((a,b)=>a+b,0)||1;
for(const k of Object.keys(behavior))behavior[k]=Math.round(behavior[k]/total*100);
const state={artifact:'macro-intelligence-state',version:1,as_of:new Date().toISOString(),doctrine:'Dataset -> Lens -> Configuration -> Historical Analog -> Capital Behavior',coverage:{asset_classes:Object.fromEntries(Object.entries(files).map(([k,v])=>[k,!!v])),monetary_alternatives:false,historical_analog_engine:false},lens_states:lenses,configuration,capital_behavior:{scores:behavior,interpretation:'First-pass behavior scoring from visible lens states only. Not a portfolio instruction.',trace:['lens_states','configuration','rule-based score contributions'],missing_evidence:['Monetary Alternatives state','Historical analog scoring library','Global liquidity lens','Sector rotation lens']},historical_analogs:{status:'PENDING',rule:'Configuration-based analogs only; narrative analogs forbidden.',next:['2000 dotcom','2008 GFC','2020 COVID shock','2022 tightening shock']},macro_vs_holdings_boundary:'Macro produces evidence, configuration, analog, and behavior. Holdings owns allocation, sizing, entries, exits, invalidation.',invalidation:'If any lens is seed-only, missing, or proxy-based, intelligence output remains provisional.'};
for(const f of out)write(f,state);
console.log('generated macro-intelligence-state');
