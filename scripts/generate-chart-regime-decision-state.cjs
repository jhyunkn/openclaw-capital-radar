const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name,fallback={})=>{for(const dir of ['outputs','public/outputs','data']){const p=path.join(root,dir,name);if(fs.existsSync(p)){try{return JSON.parse(fs.readFileSync(p,'utf8'))}catch{}}}return fallback};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const num=v=>Number.isFinite(Number(v))?Number(v):null;const pct=v=>num(v)===null?null:Number(num(v).toFixed(2));
const chartState=read('market-chart-panels.json',{panels:[]});const panels=Array.isArray(chartState.panels)?chartState.panels:[];
const strategy=read('strategy-state.json',{});const landscape=read('market-landscape-state.json',{});const portfolio=read('portfolio-translation-state.json',{});
function find(symbol){return panels.find(p=>p.symbol===symbol)||{}}
function score(){const spx=find('^GSPC'),ndx=find('^NDX'),vix=find('^VIX'),tnx=find('^TNX'),btc=find('BTC-USD'),tlt=find('TLT'),dxy=find('DX-Y.NYB');let s=0,notes=[];
 const spxDist=num(spx?.levels?.distance_to_200d_pct); if(spxDist!==null){s+=spxDist>6?2:spxDist>0?1:spxDist<-5?-2:-1;notes.push(`SPX vs 200D ${spxDist}%`)}
 const ndxDist=num(ndx?.levels?.distance_to_200d_pct); if(ndxDist!==null){s+=ndxDist>8?2:ndxDist>0?1:ndxDist<-6?-2:-1;notes.push(`NDX vs 200D ${ndxDist}%`)}
 const v=num(vix?.current); if(v!==null){s+=v<16?2:v<22?1:v<28?-1:-2;notes.push(`VIX ${v}`)}
 const bt=num(btc?.levels?.distance_to_200d_pct); if(bt!==null){s+=bt>10?1:bt<-10?-1:0;notes.push(`BTC vs 200D ${bt}%`)}
 const rate=num(tnx?.trend?.trend_score); if(rate!==null){s+=rate>=75?-1:rate<=25?1:0;notes.push(`10Y trend ${rate}`)}
 const bond=num(tlt?.trend?.trend_score); if(bond!==null){s+=bond>=75?1:bond<=25?-1:0;notes.push(`TLT trend ${bond}`)}
 const dollar=num(dxy?.trend?.trend_score); if(dollar!==null){s+=dollar>=75?-1:dollar<=25?1:0;notes.push(`Dollar trend ${dollar}`)}
 return {raw:s,notes}
}
function classify(raw){
 if(raw>=5)return {regime:'risk_on_extension',regimeLabel:'Risk-On Extension',capitalPosture:'Participate, Do Not Chase',stance:'Trend is constructive, but new capital should wait for pullback/retest evidence.'};
 if(raw>=2)return {regime:'constructive_but_selective',regimeLabel:'Constructive, Selective',capitalPosture:'Selective Adds Only',stance:'Risk is supported, but adds need chart confirmation and ticker-specific valuation discipline.'};
 if(raw>=-1)return {regime:'transition_or_distribution_watch',regimeLabel:'Transition / Distribution Watch',capitalPosture:'Hold Core, Wait For Confirmation',stance:'Mixed regime. Use chart levels to decide whether this is consolidation, distribution, or a reset.'};
 if(raw>=-4)return {regime:'risk_off_or_correction',regimeLabel:'Risk-Off / Correction',capitalPosture:'Protect, Review Liquidity',stance:'Risk pressure is dominant. Prioritize invalidation, cash, and watchlist reset.'};
 return {regime:'stress_liquidation',regimeLabel:'Stress / Liquidation',capitalPosture:'Defense First',stance:'Stress regime. No new risk until breadth, volatility, and liquidity recover.'};
}
const sc=score();const cls=classify(sc.raw);
function panelDecision(p){const dist=num(p?.levels?.distance_to_200d_pct),dd=num(p?.levels?.drawdown_from_high_pct),trend=num(p?.trend?.trend_score),cur=num(p?.current);let role='Context',read='Observe',why='Requires cross-chart confirmation.',forward='No portfolio change from this chart alone.',invalidates='Opposite confirmation across trend, volatility, and liquidity charts.';
 if(p.kind==='index'){
  role='Market Direction';
  if(dist!==null&&dist>10){read='Extended Above Long-Term Trend';why='Price is far above the 200D average, so upside may continue but entry risk is elevated.';forward='Hold winners; avoid chasing broad index exposure until pullback/retest.';invalidates='A controlled pullback that holds 20D/50D keeps trend intact; loss of 200D shifts to risk review.'}
  else if(dist!==null&&dist>0){read='Constructive Above 200D';why='Index is above long-term trend but not extremely extended.';forward='Selective risk is allowed if VIX/rates do not contradict.';invalidates='Failed reclaim or close below 200D weakens risk permission.'}
  else {read='Below Regime Support';why='Index is below or near its long-term trend support.';forward='Reduce broad-add permission; wait for reclaim or capitulation setup.';invalidates='Reclaim of 200D with falling VIX improves posture.'}
 }
 else if(p.kind==='volatility'){
  role='Fear / Volatility';
  if(cur!==null&&cur<16){read='Complacency Zone';why='Low VIX means fear is low; this can support trends but also reduces margin of safety.';forward='Do not chase; look for pullbacks, hedge review, or rotation confirmation.';invalidates='VIX rising above 20 while indexes fall confirms risk-off pressure.'}
  else if(cur!==null&&cur<22){read='Normal Volatility';why='Volatility is not yet signaling panic.';forward='Risk budget can remain normal if index trends hold.';invalidates='Sustained move above 22 raises correction probability.'}
  else {read='Stress Volatility';why='Elevated VIX signals investors are paying for protection.';forward='Reduce impulse buying; require reversal confirmation before adding risk.';invalidates='VIX falling back below 20 with index reclaim.'}
 }
 else if(p.kind==='rates'){
  role='Discount Rate';
  if(trend!==null&&trend>=75){read='Rates Pressure Rising';why='Rising yields compress long-duration valuation multiples.';forward='Be stricter on AI/growth valuation; favor cash-flow durability.';invalidates='Yield trend rolls over and TLT confirms bid.'}
  else if(trend!==null&&trend<=25){read='Rates Relief';why='Falling yield pressure supports duration assets.';forward='Growth and bonds get better permission if index trend confirms.';invalidates='10Y breaks back above moving-average band.'}
  else {read='Rates Mixed';why='Yield signal is not decisive.';forward='Do not let rates alone drive allocation.';invalidates='Trend acceleration in either direction.'}
 }
 else if(p.kind==='crypto'){
  role='Speculative Liquidity';
  if(dist!==null&&dist>10){read='Speculative Risk Bid';why='BTC above its 200D often reflects improving liquidity/risk appetite.';forward='Crypto-adjacent ideas can stay on radar, but avoid late-cycle chase.';invalidates='BTC loses 200D or fails after rally.'}
  else if(dist!==null&&dist<0){read='Speculative Liquidity Weak';why='BTC below long-term trend weakens high-beta liquidity signal.';forward='Lower crypto-beta permission until reclaim.';invalidates='Reclaim of 200D with improving breadth.'}
  else {read='Neutral Crypto Impulse';why='BTC is not giving a strong regime signal.';forward='Use only as secondary confirmation.';invalidates='Breakout or breakdown from 200D band.'}
 }
 else if(p.kind==='bonds'){
  role='Duration / Safety Bid';
  if(trend!==null&&trend>=50){read='Bond Bid Improving';why='Bond strength can signal rates relief or defensive demand.';forward='Watch for growth multiple support, but distinguish relief from recession fear.';invalidates='TLT loses moving-average support.'}
  else {read='Bond Weakness';why='Weak bonds keep duration pressure alive.';forward='Keep high-duration exposure disciplined.';invalidates='TLT reclaims 50D/200D.'}
 }
 else if(p.kind==='fx'){
  role='Dollar / Global Liquidity';
  if(trend!==null&&trend>=75){read='Dollar Pressure';why='Strong dollar often tightens global liquidity and pressures risk assets.';forward='Be cautious on crypto, commodities, and high-beta risk.';invalidates='Dollar rolls over below moving averages.'}
  else if(trend!==null&&trend<=25){read='Dollar Relief';why='Weak dollar can support risk assets and global liquidity.';forward='Improves risk backdrop if indexes confirm.';invalidates='Dollar trend reversal higher.'}
  else {read='Dollar Neutral';why='Dollar is not the dominant driver.';forward='Let index/rates/volatility lead.';invalidates='Dollar breaks trend range.'}
 }
 else if(p.kind==='energy'){
  role='Inflation / Energy Shock';
  read=trend!==null&&trend>=65?'Energy Pressure Rising':trend!==null&&trend<=35?'Energy Pressure Cooling':'Energy Mixed';
  why='Oil modifies inflation, rates, and sector rotation pressure.';forward='Rising oil favors energy/inflation hedges but can pressure margins and rates.';invalidates='Oil trend reversal through moving-average band.';
 }
 return {symbol:p.symbol,label:p.label,kind:p.kind,role,current_read:read,decision:read,why_it_matters:why,forward_implication:forward,regimeInputs:{current:cur,trendScore:trend,distanceTo200dPct:pct(dist),drawdownPct:pct(dd)},annotations:[why,forward],invalidates}
}
function relationships(){const spx=find('^GSPC'),ndx=find('^NDX'),vix=find('^VIX'),tnx=find('^TNX'),tlt=find('TLT'),dxy=find('DX-Y.NYB'),btc=find('BTC-USD'),oil=find('CL=F');
 const spxRisk=(num(spx?.levels?.distance_to_200d_pct)||0)>0;const ndxRisk=(num(ndx?.levels?.distance_to_200d_pct)||0)>0;const vixCalm=(num(vix?.current)||99)<22;const ratesHot=(num(tnx?.trend?.trend_score)||0)>=75;const tltBid=(num(tlt?.trend?.trend_score)||0)>=50;const dollarHot=(num(dxy?.trend?.trend_score)||0)>=75;const btcBid=(num(btc?.levels?.distance_to_200d_pct)||0)>0;const oilHot=(num(oil?.trend?.trend_score)||0)>=65;
 return [
  {pair:'SPX / NDX ↔ VIX',relationship:'Index trend should be confirmed by falling or contained volatility.',status:spxRisk&&ndxRisk&&vixCalm?'confirmed':spxRisk&&!vixCalm?'conflicted':'weak',read:spxRisk&&ndxRisk&&vixCalm?'Risk trend confirmed by contained fear.':spxRisk&&!vixCalm?'Index strength is vulnerable because volatility is elevated.':'Index trend lacks strong confirmation.'},
  {pair:'10Y Yield ↔ Growth / AI',relationship:'Rising rates pressure long-duration growth multiples.',status:ratesHot?'pressure':'neutral',read:ratesHot?'High-duration AI/growth needs stricter valuation and entry discipline.':'Rates are not the dominant constraint right now.'},
  {pair:'10Y Yield ↔ TLT',relationship:'TLT should move opposite yield pressure; bond bid can signal rate relief or defensiveness.',status:ratesHot&&tltBid?'conflicted':!ratesHot&&tltBid?'relief':'pressure',read:ratesHot&&tltBid?'Bond market is mixed; verify whether this is defensive demand or rate relief.':!ratesHot&&tltBid?'Duration relief supports growth multiples if equities confirm.':'Bond weakness keeps discount-rate pressure alive.'},
  {pair:'Dollar ↔ Global Liquidity',relationship:'Strong dollar often tightens global liquidity and weighs on risk assets.',status:dollarHot?'pressure':'supportive',read:dollarHot?'Dollar pressure reduces risk permission, especially crypto/global cyclicals.':'Dollar is not blocking risk appetite.'},
  {pair:'BTC ↔ Speculative Liquidity',relationship:'BTC above long trend can confirm speculative liquidity.',status:btcBid?'risk_bid':'weak',read:btcBid?'Speculative liquidity is supportive, but must align with VIX and rates.':'High-beta liquidity confirmation is weak.'},
  {pair:'Oil ↔ Inflation / Rates',relationship:'Oil strength can revive inflation and rates pressure.',status:oilHot?'pressure':'neutral',read:oilHot?'Energy pressure may challenge margins and rate-sensitive valuations.':'Oil is not adding major inflation pressure.'}
 ];}
const state={as_of:new Date().toISOString(),artifact:'chart-regime-decision-state',regime:cls.regime,regime_label:cls.regimeLabel,capital_posture:cls.capitalPosture,chart_board_stance:cls.stance,regime_score:sc.raw,regime_evidence:sc.notes,relationships:relationships(),source_artifacts:['market-chart-panels.json','market-landscape-state.json','strategy-state.json','portfolio-translation-state.json'],strategy_context:{posture:strategy.posture||strategy.strategy_posture||null,capital_action:strategy.capital_action||null,landscape_headline:landscape.headline||landscape.market_focus||null,portfolio_action:portfolio.capital_action||portfolio.summary?.capital_action||null},panels:panels.map(panelDecision),rules:['Charts are evidence surfaces for regime permission, strategy posture, invalidation, and capital allocation.','Every chart declares role, current read, forward implication, and invalidation.','Market regime is produced from cross-chart confirmation: index trend, volatility, rates, dollar, bonds, and speculative liquidity.'],render_permission:true};
write('chart-regime-decision-state.json',state);console.log(`chart regime decision state: ${state.regime_label} score=${state.regime_score} panels=${state.panels.length} relationships=${state.relationships.length}`);
