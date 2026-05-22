const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name,fb={})=>{for(const dir of ['outputs','public/outputs','data']){const f=path.join(root,dir,name);if(fs.existsSync(f)){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{}}}return fb};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const arr=v=>Array.isArray(v)?v:[];const num=v=>Number.isFinite(Number(v))?Number(v):null;const round=(v,d=2)=>num(v)===null?null:Number(num(v).toFixed(d));
const lens=read('market-lens-state.json',{});const confirmation=read('confirmation-state.json',{});const op=read('operational-chart-state.json',{});
const byId=Object.fromEntries(arr(lens.lenses).map(l=>[String(l.id||'').toUpperCase(),l]));
const stance=id=>String(byId[id]?.stance||'NO DATA').toUpperCase();
const isSupportive=id=>/SUPPORTIVE|CONTAINED|CONFIRMING/.test(stance(id));
const isWeak=id=>/DEFENSIVE|STRESS|WEAK/.test(stance(id));
const isWatch=id=>/VERIFY|WATCH|EXTENDED|MIXED/.test(stance(id));
const spx=stance('SPX'),qqq=stance('QQQ'),tlt=stance('TLT'),btc=stance('BTC'),vix=stance('VIX');
let route='transition / verify';let route_id='transition_verify';let risk_budget='neutral';let add_permission='blocked';let trim_permission='selective';let opportunity_permission='research_only';
if(isSupportive('SPX')&&isSupportive('QQQ')&&isSupportive('VIX')&&!isWeak('TLT')){route='risk-on confirmed';route_id='risk_on_confirmed';risk_budget='active';add_permission='selective_allowed';trim_permission='rebalance_only';opportunity_permission='promote_if_evidence_high';}
else if(isSupportive('SPX')&&isWatch('QQQ')){route='risk-on but extended';route_id='risk_on_extended';risk_budget='active_but_disciplined';add_permission='pullback_only';trim_permission='weak_beta';opportunity_permission='near_miss_only';}
else if(isSupportive('SPX')&&isWeak('TLT')){route='rate-constrained growth';route_id='rate_constrained_growth';risk_budget='constrained';add_permission='quality_only';trim_permission='duration_beta';opportunity_permission='quality_discount_only';}
else if(isWeak('SPX')||isWeak('VIX')){route='defensive';route_id='defensive';risk_budget='reduced';add_permission='blocked';trim_permission='active';opportunity_permission='blocked_until_reclaim';}
else if(isSupportive('SPX')&&isSupportive('BTC')&&isSupportive('VIX')){route='liquidity risk-on';route_id='liquidity_risk_on';risk_budget='active';add_permission='selective_allowed';trim_permission='rebalance_only';opportunity_permission='promote_liquidity_sensitive';}
const permissions=[
 {domain:'Core index / broad equity',permission:isWeak('SPX')?'DEFEND':isSupportive('SPX')?'HOLD / SELECTIVE ADD':'VERIFY',driver:`SPX ${spx}`},
 {domain:'AI / growth compounders',permission:isWeak('QQQ')?'BLOCK ADD':isWatch('QQQ')?'PULLBACK ONLY':'SELECTIVE ADD',driver:`QQQ ${qqq}; TLT ${tlt}`},
 {domain:'Duration-sensitive growth',permission:isWeak('TLT')?'CONSTRAINED':isSupportive('TLT')?'SUPPORTED':'VERIFY',driver:`TLT ${tlt}`},
 {domain:'Speculative liquidity / crypto beta',permission:isSupportive('BTC')&&isSupportive('VIX')?'TACTICAL OK':isWeak('BTC')?'BLOCK':'VERIFY',driver:`BTC ${btc}; VIX ${vix}`},
 {domain:'Opportunity promotion',permission:opportunity_permission.replaceAll('_',' ').toUpperCase(),driver:`route ${route}`}
];
const blocks=[]; if(isWeak('VIX'))blocks.push('Volatility stress blocks new risk until VIX cools.'); if(isWeak('SPX'))blocks.push('SPX below regime support blocks broad adds.'); if(isWeak('TLT'))blocks.push('Rate pressure constrains duration/growth multiple expansion.'); if(isWatch('QQQ'))blocks.push('Growth leadership is extended/mixed; require pullback or confirmation.');
const promotes=[]; if(isSupportive('SPX'))promotes.push('Broad market trend supports holding core exposure.'); if(isSupportive('QQQ'))promotes.push('Growth leadership supports AI-linked holdings and candidates.'); if(isSupportive('TLT'))promotes.push('Duration pressure easing supports valuation expansion.'); if(isSupportive('BTC'))promotes.push('Speculative liquidity confirms risk appetite.'); if(isSupportive('VIX'))promotes.push('Contained volatility supports staying invested.');
const action_protocol=[
 {rule:'ADD',permission:add_permission,condition:add_permission==='blocked'?'No adds until route improves.':'Only inside ruled buy zones with source tier AUTH/PARTIAL and evidence score high.'},
 {rule:'HOLD',permission:'allowed',condition:'Maintain core holdings while route is not defensive and holding remains above stop/review zone.'},
 {rule:'TRIM',permission:trim_permission,condition:'Trim weak beta or concentration when price enters trim zones or route deteriorates.'},
 {rule:'PROMOTE OPPORTUNITY',permission:opportunity_permission,condition:'Candidate must match active route and pass evidence/valuation/asymmetry gates.'},
 {rule:'DEFEND',permission:isWeak('SPX')||isWeak('VIX')?'active':'standby',condition:'Activate if SPX loses defense line or VIX enters stress.'}
];
const state={as_of:new Date().toISOString(),artifact:'strategy-routing-state',route_id,route,risk_budget,add_permission,trim_permission,opportunity_permission,confirmation_score:confirmation.regime_score??null,market_lens_regime:lens.regime??null,inputs:{SPX:spx,QQQ:qqq,TLT:tlt,BTC:btc,VIX:vix,operational_chart:op.brief?.market_state||null},permissions,blocks,promotes,action_protocol,render_permission:true};
write('strategy-routing-state.json',state);console.log(`strategy-routing-state: ${route} add=${add_permission} opportunity=${opportunity_permission}`);
