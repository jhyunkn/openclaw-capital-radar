const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const indexPath=path.join(root,'index.html');
if(!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html=fs.readFileSync(indexPath,'utf8');
let changed=false;

// 1) Remove volume from the main price pane. It can force SPX autoscale into volume units.
html=html.replace(/const volume=chart\.addHistogramSeries\([\s\S]*?volume\.setData\([\s\S]*?\}\)\)\);/,()=>{changed=true;return "/* volume removed from main price pane: keep SPX scale price-only */"});

// 2) Remove scenario/projection path line series from the main price pane.
// A bad scenario point near 0 created the blue L-shaped line and forced the axis to include zero.
html=html.replace(/const scenarioColors=\{[\s\S]*?payload\.scenarios\.forEach\(sc=>\{[\s\S]*?ser\.setData\([\s\S]*?\);\}\);/,()=>{changed=true;return "/* scenario path lines removed from main price pane: scenarios remain in cards/labels only so decorative projections cannot control autoscale */"});

// 3) Hide any scenario artifact that may have survived because of minified/generated formatting.
html=html.replace(/payload\.scenarios\.forEach\(sc=>\{[\s\S]*?\}\);const b=payload\.bands\|\|\{\};/,()=>{changed=true;return "/* scenario path lines removed from main price pane */const b=payload.bands||{};"});

// 4) Clamp autoscale to actionable SPX levels only. Do not use all plotted objects.
const oldFit="chart.timeScale().fitContent();setTimeout(paintZones,100);";
const newFit="chart.timeScale().fitContent();try{const vals=[b.addLow,b.addHigh,b.trimLow,b.trimHigh,b.ma50,b.ma200,b.hardRisk,b.target,last?.close].map(Number).filter(Number.isFinite);if(vals.length){const lo=Math.min(...vals),hi=Math.max(...vals),pad=Math.max((hi-lo)*0.18,250);candle.applyOptions({autoscaleInfoProvider:()=>({priceRange:{minValue:lo-pad,maxValue:hi+pad}})});}}catch(e){}setTimeout(paintZones,100);";
if(html.includes(oldFit) && !html.includes('autoscaleInfoProvider:()=>')){html=html.replace(oldFit,newFit);changed=true;}

// 5) If a prior clamp exists, normalize it to the tighter version.
html=html.replace(/chart\.timeScale\(\)\.fitContent\(\);try\{const vals=\[b\.addLow[\s\S]*?setTimeout\(paintZones,100\);/,()=>{changed=true;return newFit});

if(changed){fs.writeFileSync(indexPath,html);console.log('patched decision chart: removed volume, removed scenario paths, clamped to actionable SPX range');}
else {console.log('decision chart patch found no matching chart blocks');}
