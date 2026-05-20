const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');
const read=(rel,fb)=>{try{return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))}catch{return fb}};
const write=(name,data)=>{for(const dir of ['outputs','public/outputs']){const f=path.join(root,dir,name);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(data,null,2)+'\n')}};
const arr=v=>Array.isArray(v)?v:[];const num=v=>Number.isFinite(Number(v))?Number(v):null;const round=(v,d=2)=>Number.isFinite(Number(v))?Number(Number(v).toFixed(d)):null;
const holdings=arr(read('outputs/portfolio-decision-state.json',[]));
const records=holdings.map(h=>{const p=num(h.price);return{symbol:h.ticker,as_of:new Date().toISOString(),current_price:p,day_change_pct:num(h.dayChangePct),portfolio_weight_pct:num(h.portfolioWeightPct),proxy_support:p?round(p*.9):null,proxy_resistance:p?round(p*1.15):null,proxy_stop:p?round(p*.88):null,proxy_target:p?round(p*1.24):null,source_name:'portfolio-decision-state',source_type:'internal_market_snapshot',method_level:'proxy_until_ohlcv_available',reliability_score:p?0.55:0.2}});
const state={as_of:new Date().toISOString(),artifact:'market-structure-collection',records,summary:{records:records.length,priced:records.filter(r=>r.current_price).length,missing_price:records.filter(r=>!r.current_price).length},render_permission:true};
write('market-structure-collection.json',state);console.log(`market structure collection: records=${records.length} priced=${state.summary.priced}`);
