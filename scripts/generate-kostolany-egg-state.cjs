const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name,fb={})=>{for(const dir of ['outputs','public/outputs','config']){const f=path.join(root,dir,name);if(fs.existsSync(f)){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{}}}return fb};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const macro=read('macro-cycle-state.json',{});const phaseId=macro.phase_id||'expansion_risk_on';
const phaseMap={
 crisis_capitulation:{code:'A1',label:'Capitulation',macro:'Crisis / capitulation',market:'Bear exaggeration',action:'Accumulate slowly',next:'A2'},
 contraction_reset:{code:'A2',label:'Reset',macro:'Contraction / reset',market:'Bear adjustment',action:'Defend / prepare',next:'B'},
 recovery_early_easing:{code:'B',label:'Recovery',macro:'Recovery / early easing',market:'Monetary turn',action:'Deploy selectively',next:'C'},
 transition_verification:{code:'C',label:'Verification',macro:'Transition / verification',market:'Accumulation / test',action:'Wait for confirmation',next:'D'},
 expansion_risk_on:{code:'D',label:'Expansion',macro:'Expansion / risk-on',market:'Bull adjustment',action:'Hold / add pullbacks',next:'E'},
 euphoria_late_risk_on:{code:'E',label:'Euphoria',macro:'Euphoria / late risk-on',market:'Bull exaggeration',action:'Hold / trim excess',next:'F'},
 distribution_defensive_reset:{code:'F',label:'Distribution',macro:'Distribution / defensive reset',market:'Top / liquidity warning',action:'Rebalance / defend',next:'A1'}
};
const sequence=['crisis_capitulation','contraction_reset','recovery_early_easing','transition_verification','expansion_risk_on','euphoria_late_risk_on','distribution_defensive_reset'];
const current=phaseMap[phaseId]||phaseMap.expansion_risk_on;const currentIndex=sequence.indexOf(phaseId);const previousId=sequence[(currentIndex-1+sequence.length)%sequence.length];const nextId=sequence[(currentIndex+1)%sequence.length];
const scores=macro.driver_scores||{};const axis={
 monetary_axis:{label:'Monetary',score:scores.rates??50,read:macro.pressure_detail?.rate_regime||'mixed rate signal'},
 liquidity_axis:{label:'Liquidity',score:scores.liquidity??50,read:macro.pressure_detail?.liquidity_regime||'mixed liquidity'},
 psychology_axis:{label:'Psychology',score:phaseId==='euphoria_late_risk_on'?78:phaseId==='distribution_defensive_reset'?32:phaseId==='crisis_capitulation'?20:60,read:phaseId==='euphoria_late_risk_on'?'sentiment excess risk':phaseId==='crisis_capitulation'?'fear / forced selling':'balanced psychology'},
 market_structure_axis:{label:'Market structure',score:Math.round(((scores.spx_trend??50)+(scores.growth_leadership??50)+(scores.volatility??50))/3),read:`SPX ${macro.pressure_detail?.equity_trend||'pending'}; QQQ ${macro.pressure_detail?.growth_leadership||'mixed'}`},
 valuation_axis:{label:'Valuation',score:phaseId==='euphoria_late_risk_on'?35:phaseId==='crisis_capitulation'?78:phaseId==='contraction_reset'?68:55,read:phaseId==='euphoria_late_risk_on'?'valuation / expectation pressure elevated':'valuation pressure not fully modeled yet'}
};
const phases=sequence.map((id,i)=>{const p=phaseMap[id];return{...p,id,index:i,state:id===phaseId?'current':id===previousId?'previous':id===nextId?'next':'dormant'}});
const broad=macro.allocation_posture||[];const equity=macro.equity_posture||[];
const favorBroad=broad.filter(x=>/ACCUMULATE|FAVORED|HOLD|ADD|INCREASE|REBUILD/i.test(x.posture)).slice(0,5);
const reduceBroad=broad.filter(x=>/TRIM|REDUCE|AVOID|WAIT|STRICT|RESEARCH ONLY/i.test(x.posture)).slice(0,5);
const favorEquity=(macro.equity_groups?.favor||[]).slice(0,6);const avoidEquity=(macro.equity_groups?.avoid_or_trim||[]).slice(0,6);
const nextProbs={};sequence.forEach(id=>nextProbs[id]=5);nextProbs[phaseId]=50;nextProbs[nextId]=30;nextProbs[previousId]=10;
const state={as_of:new Date().toISOString(),artifact:'kostolany-egg-state',method:'Kostolany-inspired capital-cycle map. Rates are a primary transmission mechanism, but phase is governed by monetary, liquidity, psychology, market structure, and valuation axes.',phase_code:current.code,macro_phase:current.macro,phase_label:current.label,phase_confidence:macro.cycle_confidence||null,stress_type:macro.pressure_detail?.stress_type||'balanced',stress_id:macro.stress_id||null,center_action:current.action,capital_action:current.action,phase_market_meaning:current.market,phases,axis,next_phase_probability:nextProbs,broad_asset_posture:broad,equity_subcategory_posture:equity,visual_summary:{favor_broad:favorBroad.map(x=>({asset:x.asset,posture:x.posture})),reduce_broad:reduceBroad.map(x=>({asset:x.asset,posture:x.posture})),favor_equity:favorEquity,avoid_equity:avoidEquity},invalidation:macro.phase_invalidation||'Invalidation pending',self_check:{q1:'A1–F notation remains visible but secondary to clear macro labels.',q2:'Center prioritizes capital action first; stress type is shown underneath.',q3:'First production version is clean/minimal; density can be added later.'},source:'outputs/macro-cycle-state.json',render_permission:true};
write('kostolany-egg-state.json',state);console.log(`kostolany-egg-state: ${state.phase_code} ${state.macro_phase} action=${state.capital_action}`);
