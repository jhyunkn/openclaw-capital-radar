const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(name,fb={})=>{for(const dir of ['outputs','public/outputs','data']){const f=path.join(root,dir,name);if(fs.existsSync(f)){try{return JSON.parse(fs.readFileSync(f,'utf8'))}catch{}}}return fb};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const num=v=>Number.isFinite(Number(v))?Number(v):null;const round=(v,d=2)=>num(v)===null?null:Number(num(v).toFixed(d));
const op=read('operational-chart-state.json',{});const tape=read('market-tape-state.json',{});const brief=read('market-decision-brief-state.json',{});
const c=op.action_bands||{};const chart=op.chart||{};const ind=chart.indicators||{};const confirmations=Array.isArray(chart.confirmations)?chart.confirmations:[];
const spx=num(c.current),ma50=num(chart.overlays?.ma50),ma200=num(chart.overlays?.ma200),vix=num(ind.vix),rsi=num(ind.rsi14),macd=num(ind.macd12_26);
function state(name,status,value,weight,why){return{name,status,value,weight,why}}
const factors=[];
factors.push(state('Price trend',spx&&ma50&&spx>ma50&&spx>ma200?'supportive':spx&&ma200&&spx<ma200?'defensive':'mixed',round(spx),22,'SPX location versus 50D and 200D defines the primary regime.'));
factors.push(state('Volatility',vix!==null&&vix<20?'supportive':vix!==null&&vix<25?'watch':'defensive',round(vix,1),18,'VIX confirms or contradicts the price trend.'));
factors.push(state('Momentum',rsi!==null&&rsi>72?'stretched':rsi!==null&&rsi<45?'weak':'normal',round(rsi,1),14,'RSI tells whether trend is overextended or losing pressure.'));
factors.push(state('MACD',macd!==null&&macd>0?'supportive':macd!==null&&macd<0?'watch':'neutral',round(macd,2),10,'MACD supports momentum direction and trend persistence.'));
for(const x of confirmations){if(!factors.find(f=>f.name===x.name))factors.push(state(x.name,x.status,x.value,8,x.why));}
const tapeSignals=Array.isArray(tape.signals)?tape.signals:[];const confirming=tapeSignals.filter(s=>/confirm/i.test(s.confirmation_status||'')).length;const contradicting=tapeSignals.filter(s=>/contradict/i.test(s.confirmation_status||'')).length;
factors.push(state('Market tape',confirming>contradicting?'supportive':contradicting>confirming?'defensive':'mixed',`${confirming}/${contradicting}`,14,'Live tape checks whether external market pressure confirms the chart.'));
function scoreStatus(s){if(/supportive|contained|confirming|normal|neutral/i.test(s))return 1;if(/stretched|watch|mixed|weak/i.test(s))return 0;return -1}
const totalWeight=factors.reduce((a,b)=>a+(num(b.weight)||0),0)||1;const raw=factors.reduce((a,b)=>a+scoreStatus(b.status)*(num(b.weight)||0),0)/totalWeight;const score=Math.round(50+raw*50);
let regime='selective risk-on';if(score>=72)regime='risk-on confirmed';else if(score>=55)regime='selective risk-on';else if(score>=42)regime='transition / verify';else regime='defensive';
let action='Hold core; add only on ruled pullbacks.';if(regime==='risk-on confirmed')action='Hold core; selective adds allowed only at ruled zones.';if(regime==='transition / verify')action='Hold core; stop adding until confirmation improves.';if(regime==='defensive')action='Defend; raise cash and wait for reclaim.';
const stateOut={as_of:new Date().toISOString(),artifact:'confirmation-state',regime_score:score,regime,action,factors,source_artifacts:['operational-chart-state.json','market-tape-state.json','market-decision-brief-state.json'],render_permission:true};
write('confirmation-state.json',stateOut);console.log(`confirmation-state: ${regime} score=${score}`);
