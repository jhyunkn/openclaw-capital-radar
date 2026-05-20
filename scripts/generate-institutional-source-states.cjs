const fs=require('fs');const path=require('path');
const root=path.join(__dirname,'..');const out=path.join(root,'outputs');const pub=path.join(root,'public','outputs');
const read=(rel,fb)=>{try{return JSON.parse(fs.readFileSync(path.join(root,rel),'utf8'))}catch{return fb}};
const write=(name,data)=>{for(const base of [out,pub]){fs.mkdirSync(base,{recursive:true});fs.writeFileSync(path.join(base,name),JSON.stringify(data,null,2)+'\n')}};
const arr=v=>Array.isArray(v)?v:[];const now=new Date().toISOString();
const evidence=read('outputs/institutional-evidence-map.json',{evidence:[]});
const holdings=read('outputs/portfolio-decision-state.json',[]);
const tickers=arr(holdings).map(h=>h.ticker).filter(Boolean);
function pick(types){return arr(evidence.evidence).filter(e=>types.some(t=>String(e.source_type||'').toLowerCase().includes(t)))}
const company=pick(['filing','earnings','company','press','presentation']).map(e=>({id:e.id,ticker:e.ticker||null,source_name:e.source_name,source_type:e.source_type,url:e.url||e.citation,publish_date:e.publish_date,extracted_metric:e.extracted_metric||null,extracted_value:e.extracted_value||null,affected_thesis:e.affected_thesis,reliability_score:e.reliability_score||e.confidence||0.5}));
const institutional=pick(['13f','13d','13g','form 4','insider','holder','ownership','fund']).map(e=>({id:e.id,ticker:e.ticker||null,institution:e.institution||e.source_name,source_type:e.source_type,filing_date:e.publish_date,report_period:e.period||null,shares:e.shares||null,change_in_shares:e.change_in_shares||null,estimated_value:e.estimated_value||null,ownership_signal:e.extracted_insight||null,reliability_score:e.reliability_score||e.confidence||0.5}));
const structure=arr(holdings).map(h=>({symbol:h.ticker,metric:'live_price',value:h.price,as_of:now,lookback_window:'current',source_name:'portfolio-decision-state',source_type:'internal_market_data_snapshot',reliability_score:h.price?0.55:0.2}));
const common={as_of:now,source_contract:'config/institutional-data-contract.json'};
write('company-verified-evidence-state.json',{...common,artifact:'company-verified-evidence-state',tickers,records:company,summary:{records:company.length,covered_tickers:new Set(company.map(r=>r.ticker).filter(Boolean)).size,missing_tickers:tickers.filter(t=>!company.some(r=>r.ticker===t))},render_permission:true});
write('institutional-positioning-state.json',{...common,artifact:'institutional-positioning-state',tickers,records:institutional,summary:{records:institutional.length,covered_tickers:new Set(institutional.map(r=>r.ticker).filter(Boolean)).size,missing_tickers:tickers.filter(t=>!institutional.some(r=>r.ticker===t))},render_permission:true});
write('market-structure-state.json',{...common,artifact:'market-structure-state',records:structure,summary:{records:structure.length,coverage:tickers.length?structure.filter(r=>r.value).length/tickers.length:0,missing_tickers:tickers.filter(t=>!structure.some(r=>r.symbol===t&&r.value))},render_permission:true});
console.log(`source states: company=${company.length} institutional=${institutional.length} structure=${structure.length}`);
