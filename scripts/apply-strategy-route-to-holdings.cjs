const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const files=['outputs/holding-zone-state.json','public/outputs/holding-zone-state.json'];
const read=(rel,fb={})=>{try{return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))}catch{return fb}};
const write=(rel,data)=>{const f=path.join(root,rel);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')};
const route=read('outputs/strategy-routing-state.json',{});
const add=String(route.add_permission||'blocked'); const risk=String(route.risk_budget||'neutral'); const routeId=String(route.route_id||'transition_verify');
function holdingRoutePermission(z){
 const zone=String(z.zone_status||''); const source=String(z.zone_source_tier||z.source_authority||z.source_quality||''); const conf=Number(z.zone_confidence||0);
 if(/defensive/.test(routeId)||add==='blocked') return {route_permission:'NO_ADD',route_overlay:'route blocks adds',route_action:'Hold/defend only until route improves.'};
 if(/inside_buy_zone|near_buy_zone/.test(zone) && /AUTH|PARTIAL|authoritative|institutional/i.test(source) && conf>=0.6 && /selective_allowed|quality_only|pullback_only/.test(add)) return {route_permission:'ADD_REVIEW',route_overlay:'route allows selective add review',route_action:'Eligible for add review if holding thesis/evidence remains valid.'};
 if(/inside_trim_zone|near_trim_zone/.test(zone)) return {route_permission:'TRIM_REVIEW',route_overlay:'price zone overrides add permission',route_action:'Review trim/rebalance, especially if concentration or beta is high.'};
 if(/near_stop|below_stop|below_hard_exit/.test(zone)) return {route_permission:'DEFEND_REVIEW',route_overlay:'risk zone active',route_action:'Review stop/hard-exit protocol before new exposure.'};
 if(source==='PROXY'||source==='MISSING') return {route_permission:'HOLD_VERIFY',route_overlay:'source tier blocks action',route_action:'No action from proxy levels; require better source authority.'};
 return {route_permission:'HOLD',route_overlay:'route supports holding only',route_action:'Maintain exposure; wait for zone or route change.'};
}
for(const rel of files){const file=path.join(root,rel);if(!fs.existsSync(file))continue;const state=read(rel,{});const zones=Array.isArray(state.zones)?state.zones:[];const counts={};for(const z of zones){Object.assign(z,holdingRoutePermission(z));z.strategy_route_id=routeId;z.strategy_route=route.route||null;z.strategy_risk_budget=risk;counts[z.route_permission]=(counts[z.route_permission]||0)+1;}state.summary={...(state.summary||{}),route_permissions:counts,strategy_route:route.route||null,add_permission:add,risk_budget:risk};state.route_applied_at=new Date().toISOString();write(rel,state);}console.log('strategy route applied to holdings');
