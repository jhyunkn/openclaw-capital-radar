const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
let changed=false;
const before=/const volume=chart\.addHistogramSeries\(\{priceFormat:\{type:'volume'\},priceScaleId:'',scaleMargins:\{top:\.86,bottom:0\}\}\);volume\.setData\(payload\.series\.map\(d=>\(\{time:d\.time,value:d\.volume\|\|0,color:d\.close>=d\.open\?'rgba\(79,155,130,\.18\)':'rgba\(199,107,96,\.18\)'\}\)\)\);/;
if(before.test(html)){
  html=html.replace(before,"/* volume intentionally removed from main price pane: it was forcing SPX autoscale into billions and compressing the decision chart */");
  changed=true;
}
// Add explicit visible-range clamp around actionable SPX levels after fitContent.
const fit="chart.timeScale().fitContent();setTimeout(paintZones,100);";
const clamp="chart.timeScale().fitContent();try{const vals=[b.addLow,b.addHigh,b.trimLow,b.trimHigh,b.ma50,b.ma200,b.hardRisk,b.target,last?.close].map(Number).filter(Number.isFinite);if(vals.length){const lo=Math.min(...vals),hi=Math.max(...vals),pad=(hi-lo)*0.18||300;candle.priceScale().applyOptions({autoScale:false,mode:LightweightCharts.PriceScaleMode.Normal});candle.applyOptions({autoscaleInfoProvider:original=>{const res=original();return {priceRange:{minValue:lo-pad,maxValue:hi+pad}};}});}}catch(e){}setTimeout(paintZones,100);";
if(html.includes(fit) && !html.includes('autoscaleInfoProvider:original')){
  html=html.replace(fit,clamp);
  changed=true;
}
// Hide any residual right-axis volume label if browser cached old chart markup.
const style='</head>';
const patchStyle='<style>.operational-chart .tv-lightweight-charts table tr td:has(div[style*=\"5.44B\"]){display:none}</style></head>';
// Do not rely on :has patch; only leave code path above as primary.
if(changed){fs.writeFileSync(indexPath,html);console.log('patched decision chart price scale: removed main-pane volume and clamped SPX actionable range');}
else console.log('decision chart scale patch found no matching legacy volume block');
