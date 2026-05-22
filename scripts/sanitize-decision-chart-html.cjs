const fs=require('fs');
const path=require('path');
const root=path.join(__dirname,'..');
const targets=[path.join(root,'index.html'),path.join(root,'public','index.html')];
function sanitize(file){
  if(!fs.existsSync(file)) return {file,changed:false,reason:'missing'};
  let html=fs.readFileSync(file,'utf8');
  const before=html;
  // Remove main-pane volume histogram. It places billion-scale volume on the SPX price axis.
  html=html.replace(/const volume=chart\.addHistogramSeries\(\{priceFormat:\{type:'volume'\},priceScaleId:'',scaleMargins:\{top:\.86,bottom:0\}\}\);volume\.setData\(payload\.series\.map\(d=>\(\{time:d\.time,value:d\.volume\|\|0,color:d\.close>=d\.open\?'rgba\(79,155,130,\.18\)':'rgba\(199,107,96,\.18\)'\}\)\)\);/g,"/* sanitized: volume removed from main SPX price pane */");
  // Remove scenario path line series. A bad point near 0 creates the blue L-shape and expands the y-axis.
  html=html.replace(/const scenarioColors=\{bull:'#2f6f4e',base:'#ae7c2c',correction:'#9f3f35'\};payload\.scenarios\.forEach\(sc=>\{const ser=chart\.addLineSeries\(\{color:scenarioColors\[sc\.id\]\|\|'#555',lineWidth:2,lineStyle:LightweightCharts\.LineStyle\.LargeDashed,priceLineVisible:false,lastValueVisible:false\}\);ser\.setData\(sc\.path\.filter\(p=>p\.time&&Number\.isFinite\(Number\(p\.value\)\)\)\.map\(p=>\(\{time:p\.time,value:p\.value\}\)\)\);\}\);/g,"/* sanitized: scenario projection paths removed from main SPX price pane */");
  // Remove path data from inline payload if present so no downstream script can draw it.
  html=html.replace(/,path:\s*arr\(sc\.path\)\.map\(p=>\(\{time:Math\.floor\(\(p\.t\|\|0\)\/1000\),value:p\.v\}\)\)/g,'');
  html=html.replace(/,"path":\[[^\]]*?\]/g,'');
  // Normalize wording so the UI does not claim scenario paths are drawn in the price pane.
  html=html.replace(/conditional scenario paths/g,'conditional scenario levels');
  html=html.replace(/two-quarter scenario logic/g,'two-quarter scenario levels');
  html=html.replace(/Candles are real SPX OHLCV/g,'Candles are real SPX OHLC');
  // Add/normalize clamp if the generated code still only fitContent()s.
  const oldFit='chart.timeScale().fitContent();setTimeout(paintZones,100);';
  const newFit="chart.timeScale().fitContent();try{const vals=[b.addLow,b.addHigh,b.trimLow,b.trimHigh,b.ma50,b.ma200,b.hardRisk,b.target,last?.close].map(Number).filter(Number.isFinite);if(vals.length){const lo=Math.min(...vals),hi=Math.max(...vals),pad=Math.max((hi-lo)*0.18,250);candle.applyOptions({autoscaleInfoProvider:()=>({priceRange:{minValue:lo-pad,maxValue:hi+pad}})});}}catch(e){}setTimeout(paintZones,100);";
  if(html.includes(oldFit)&&!html.includes('autoscaleInfoProvider:()=>')) html=html.replace(oldFit,newFit);
  if(html!==before){fs.writeFileSync(file,html);return {file,changed:true};}
  return {file,changed:false,reason:'no matching chart artifacts'};
}
const results=targets.map(sanitize);
console.log(JSON.stringify({status:'decision-chart-sanitized',results},null,2));
