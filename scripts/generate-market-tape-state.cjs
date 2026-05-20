const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const read=(rel,fb)=>{try{return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))}catch{return fb}};const write=(rel,data)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')};
const arr=v=>Array.isArray(v)?v:[];const txt=v=>String(v??'').trim();
const regime=read('outputs/market-regime-state.json',{});const truth=read('outputs/data-truth-state.json',{});const strategy=read('outputs/strategy-state.json',{});const holdingZones=read('outputs/holding-zone-state.json',{});
const as_of=new Date().toISOString();
function state(value){const s=txt(value).toLowerCase();if(/high|tight|stress|risk|elevated|blocked|stale|degraded/.test(s))return'contradicting';if(/support|loose|fresh|usable|normal|constructive/.test(s))return'confirming';return'neutral'}
const raw=[
  ['Rates',regime.ratesPressure,'Long-duration and valuation-sensitive exposure'],
  ['Credit',regime.creditPressure,'Risk appetite and funding stress'],
  ['Volatility',regime.volatilityState,'Position sizing and drawdown risk'],
  ['Liquidity',regime.liquidityState,'Beta permission and speculative appetite'],
  ['Crypto liquidity',regime.cryptoLiquidity,'BTC and risk-substitution exposure'],
  ['AI infrastructure',regime.aiInfrastructurePressure,'Power, data-center, and capex bottleneck themes'],
  ['Data truth',truth.homepageSafeToRender?'usable':'blocked','Whether rendered signals are trustworthy'],
  ['Holding zones',`buy ${holdingZones.summary?.buy_zone??0} hold ${holdingZones.summary?.hold_zone??0} trim ${holdingZones.summary?.trim_zone??0} risk ${holdingZones.summary?.risk_zone??0}`,'Portfolio position relative to price zones']
];
const signals=raw.map(([signal,value,affects])=>({signal,value:value??'unavailable',pressure_state:state(value),confirmation_status:state(value)==='contradicting'?'contradicts_strategy':state(value)==='confirming'?'confirms_strategy':'neutral_or_unavailable',affected_thesis:affects,affected_holdings:'portfolio_level'}));
const counts=signals.reduce((a,s)=>((a[s.confirmation_status]=(a[s.confirmation_status]||0)+1),a),{});
const tape={as_of,artifact:'market-tape-state',strategy_cycle_id:strategy.cycle_id||null,signals,summary:{confirming:counts.confirms_strategy||0,contradicting:counts.contradicts_strategy||0,neutral:counts.neutral_or_unavailable||0,stale_sources:arr(truth.staleSources).length,blocked_sources:arr(truth.blockedSources).length},render_permission:true};
write('outputs/market-tape-state.json',tape);write('public/outputs/market-tape-state.json',tape);console.log(`market-tape-state: confirming=${tape.summary.confirming} contradicting=${tape.summary.contradicting} neutral=${tape.summary.neutral}`);
