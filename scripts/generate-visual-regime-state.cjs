const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(rel,fb)=>{try{return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))}catch{return fb}};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const regime=read('outputs/market-regime-state.json',{});const tape=read('outputs/market-tape-state.json',{});const truth=read('outputs/data-truth-state.json',{});
const extract=(s,re)=>{const m=String(s||'').match(re);return m?Number(m[1]):null};
const clamp=v=>Math.max(0,Math.min(100,Math.round(v)));
const vix=extract(regime.volatilityState,/VIX\s+([0-9.]+)/i);const tenY=extract(regime.ratesPressure,/([0-9.]+)%/);const hy=extract(regime.creditPressure,/([0-9.]+)/);const btcDay=extract(regime.cryptoLiquidity,/day\s+(-?[0-9.]+)%/i);
const volatilityPressure=vix?clamp((vix-12)*5):50;const ratesPressure=tenY?clamp((tenY-3.5)*35):50;const creditStress=hy?clamp((hy-2)*18):45;const btcRisk=btcDay!==null?clamp(55+btcDay*5):50;const dataTrust=truth.homepageSafeToRender?85:25;
const inputs=[
 {key:'sp500_trend',label:'S&P trend',score:62,value:'proxy',source:'pending chart adapter'},
 {key:'nasdaq_trend',label:'Nasdaq trend',score:66,value:'proxy',source:'pending chart adapter'},
 {key:'vix_pressure',label:'VIX pressure',score:volatilityPressure,value:vix?String(vix):'—',source:'market-regime-state'},
 {key:'fear_greed',label:'Fear & Greed',score:50,value:'pending',source:'adapter pending'},
 {key:'liquidity',label:'Liquidity',score:45,value:regime.liquidityState||'pending',source:'FRED/credit proxy'},
 {key:'rates_pressure',label:'Rates pressure',score:ratesPressure,value:tenY?`${tenY}%`:'—',source:'FRED 10Y'},
 {key:'breadth',label:'Breadth',score:48,value:'pending',source:'adapter pending'},
 {key:'credit_stress',label:'Credit stress',score:creditStress,value:hy?String(hy):'—',source:'HY OAS'},
 {key:'btc_risk',label:'BTC risk',score:btcRisk,value:regime.cryptoLiquidity||'pending',source:'Yahoo chart proxy'},
 {key:'data_trust',label:'Data trust',score:dataTrust,value:truth.homepageSafeToRender?'safe':'degraded',source:'data-truth-state'}
];
const trend=Math.round((inputs[0].score+inputs[1].score)/2);const risk=Math.round((volatilityPressure+ratesPressure+creditStress)/3);const liquidity=inputs.find(x=>x.key==='liquidity').score;const composite=clamp(trend*.35+(100-risk)*.25+liquidity*.2+btcRisk*.1+dataTrust*.1);
const label=composite>=70?'risk_on':composite>=55?'risk_on_fragile':composite>=40?'selective_chop':'risk_off';
const permissions={broad_add:clamp(composite-risk*.25),selective_hunt:clamp(composite+15-risk*.1),trim_pressure:clamp(risk*.75+(100-trend)*.25),cash_buffer:clamp(risk*.55+(100-liquidity)*.35),ai_beta:clamp(trend*.45+(100-ratesPressure)*.25+liquidity*.15+dataTrust*.15),crypto_beta:clamp(btcRisk*.55+liquidity*.25+(100-risk)*.2)};
write('visual-regime-state.json',{as_of:new Date().toISOString(),artifact:'visual-regime-state',inputs,composite:{score:composite,label,trend_score:trend,risk_pressure:risk,liquidity_score:liquidity},permissions,render_permission:true});
console.log(`visual-regime-state: ${label} score=${composite}`);
