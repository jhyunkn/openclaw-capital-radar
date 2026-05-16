const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const outDir = path.join(root, 'outputs');
fs.mkdirSync(outDir, { recursive: true });

const html = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>OpenClaw Chart Cognition</title>
  <style>
    :root{--bg:#050505;--ink:#f4f1ea;--muted:#a7a29a;--line:rgba(244,241,234,.16);--panel:rgba(244,241,234,.07);--good:#62d78e;--warn:#d9a84d;--bad:#ff756d;--blue:#92c7ff}
    *{box-sizing:border-box} body{margin:0;background:#050505;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif}
    body:before{content:"";position:fixed;inset:0;z-index:-1;background:radial-gradient(circle at 75% 5%,rgba(216,168,74,.16),transparent 28%),linear-gradient(180deg,#0d0d0c,#050505 48%,#080806)}
    .page{max-width:1540px;margin:auto;padding:20px clamp(14px,3vw,44px) 70px}.top{position:sticky;top:0;z-index:5;display:flex;justify-content:space-between;align-items:center;gap:12px;padding:14px 0;background:rgba(5,5,5,.8);backdrop-filter:blur(18px);border-bottom:1px solid var(--line)}
    .brand{font-weight:800;letter-spacing:-.03em}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a,button{border:1px solid var(--line);border-radius:999px;background:rgba(244,241,234,.06);color:var(--ink);padding:9px 12px;text-decoration:none;font-size:12px;cursor:pointer}.active{background:var(--ink);color:#050505}.hero{padding:38px 0 22px;border-bottom:1px solid var(--line)}.eyebrow{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.16em;font-weight:850}.hero h1{font-size:clamp(42px,7vw,96px);line-height:.9;letter-spacing:-.07em;margin:12px 0 16px;font-weight:570}.lede{max-width:920px;color:#d7d2ca;font-size:clamp(16px,1.5vw,21px);line-height:1.45}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 370px;gap:16px;padding-top:18px}.panel{border:1px solid var(--line);border-radius:28px;background:linear-gradient(180deg,rgba(244,241,234,.1),var(--panel));padding:16px}.toolbar{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;margin-bottom:12px}.group{display:flex;gap:7px;flex-wrap:wrap}.chartbox{height:590px;border:1px solid var(--line);border-radius:22px;background:#020202;padding:8px}.subgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-top:10px}.subchart{height:140px;border:1px solid var(--line);border-radius:18px;background:#020202;padding:6px}.label{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.13em;font-weight:850}.decision h2{font-size:28px;letter-spacing:-.04em;margin:8px 0}.decision p{color:#d6d0c8;line-height:1.45}.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}.metric{border:1px solid rgba(244,241,234,.12);border-radius:18px;padding:12px;background:rgba(0,0,0,.18)}.metric b{display:block;font-size:22px;margin-top:5px}.zones{display:grid;grid-template-columns:1fr 1fr;gap:8px}.zones label{display:grid;gap:4px}.zones input{width:100%;background:#020202;border:1px solid rgba(244,241,234,.18);border-radius:12px;color:var(--ink);padding:9px}.small{font-size:12px;color:var(--muted);line-height:1.4}pre{white-space:pre-wrap;overflow:auto;background:#020202;border:1px solid rgba(244,241,234,.13);border-radius:18px;padding:12px;color:#d6d0c8;font-size:11px}@media(max-width:1050px){.layout{grid-template-columns:1fr}.subgrid{grid-template-columns:1fr}.chartbox{height:460px}}
  </style>
</head>
<body>
<main class="page">
  <div class="top"><div class="brand">OpenClaw · Chart Cognition</div><nav class="nav"><a href="/">Dashboard</a><a href="/outputs/capital-radar-current.html">Capital Radar</a></nav></div>
  <header class="hero"><p class="eyebrow">Ticker workbench · fail-safe build</p><h1>Chart cognition.</h1><p class="lede">This fail-safe page renders independently of live data. It attempts to load candle JSON when available; otherwise it uses deterministic mock OHLCV so the route always works.</p></header>
  <section class="layout">
    <div class="panel">
      <div class="toolbar"><div class="group" id="symbols"></div><div class="group" id="ranges"></div><div class="group" id="intervals"></div></div>
      <div class="toolbar"><div class="group" id="toggles"></div></div>
      <div class="chartbox"><svg id="priceChart" viewBox="0 0 1120 590" width="100%" height="100%"></svg></div>
      <div class="subgrid"><div class="subchart"><svg id="volumeChart" viewBox="0 0 360 140" width="100%" height="100%"></svg></div><div class="subchart"><svg id="rsiChart" viewBox="0 0 360 140" width="100%" height="100%"></svg></div><div class="subchart"><svg id="macdChart" viewBox="0 0 360 140" width="100%" height="100%"></svg></div></div>
    </div>
    <aside class="panel">
      <div class="decision"><span class="label">Decision</span><h2 id="decisionState">Loading</h2><p id="decisionText">Loading chart...</p></div>
      <div class="metrics"><div class="metric"><span class="label">Technical</span><b id="score">--</b></div><div class="metric"><span class="label">Regime</span><b id="regime">--</b></div><div class="metric"><span class="label">Data</span><b id="dataMode">--</b></div></div>
      <hr style="border-color:rgba(244,241,234,.14);margin:16px 0"><span class="label">Editable zones</span><div class="zones" id="zoneInputs"></div>
      <hr style="border-color:rgba(244,241,234,.14);margin:16px 0"><span class="label">Status</span><pre id="statusBox"></pre>
      <p class="small">Research only. No brokerage execution. The chart is a decision map, not a prediction engine.</p>
    </aside>
  </section>
</main>
<script>
(function(){
  var state={symbol:'SPY',range:'1Y',interval:'1D',mode:'mock',candles:[],toggles:{sma20:true,sma50:true,sma200:true,rsi:true,macd:true,zones:true},zones:{buyLow:0,buyHigh:0,addLow:0,addHigh:0,trimLow:0,trimHigh:0,stopReview:0,hardExit:0,target:0}};
  var seed={SPY:670,MSFT:420,AMZN:220,META:640,GEV:900,CEG:270,NVDA:180,MA:520,NFLX:950,BMNR:24,CONL:8.5,TSLT:23,TSNF:10,QQQ:600,IWM:240,AVGO:360,VRT:150,GOOGL:180,IBIT:60};
  var ranges={'1M':22,'3M':66,'6M':132,'1Y':252,'2Y':504,'MAX':900};
  var intervals={'1D':1,'1W':5,'1M':21};
  function $(id){return document.getElementById(id)}
  function safeName(s){return String(s).replace(/[^A-Za-z0-9._-]/g,'_').toUpperCase()}
  function svgEl(n,a){var e=document.createElementNS('http://www.w3.org/2000/svg',n);Object.keys(a||{}).forEach(function(k){e.setAttribute(k,a[k])});return e}
  function clear(el){while(el.firstChild)el.removeChild(el.firstChild)}
  function text(svg,x,y,t,c,s,anchor){var e=svgEl('text',{x:x,y:y,fill:c||'#a7a29a','font-size':s||11,'text-anchor':anchor||'start'});e.textContent=t;svg.appendChild(e)}
  function generate(base,count){var out=[],prev=base*0.65,start=new Date('2023-01-03T00:00:00Z');for(var i=0;out.length<count;i++){var d=new Date(start);d.setDate(start.getDate()+i);if(d.getDay()===0||d.getDay()===6)continue;var close=Math.max(2,base*0.65+i*(base/count)*0.42+Math.sin(i/18)*base*.045+Math.sin(i/63)*base*.08+Math.sin(i*1.7)*base*.012);var open=prev;var high=Math.max(open,close)+base*.012+Math.abs(Math.sin(i))*base*.015;var low=Math.min(open,close)-base*.012-Math.abs(Math.cos(i))*base*.015;var vol=Math.round(700000+Math.abs(close-open)*52000+Math.abs(Math.sin(i/8))*1400000);out.push({time:d.toISOString().slice(0,10),label:d.toISOString().slice(5,10),open:+open.toFixed(2),high:+high.toFixed(2),low:+low.toFixed(2),close:+close.toFixed(2),volume:vol});prev=close}return out}
  function compress(rows,step){if(step===1)return rows;var out=[];for(var i=0;i<rows.length;i+=step){var g=rows.slice(i,i+step);if(!g.length)continue;out.push({time:g[g.length-1].time,label:g[g.length-1].label,open:g[0].open,high:Math.max.apply(null,g.map(function(x){return x.high})),low:Math.min.apply(null,g.map(function(x){return x.low})),close:g[g.length-1].close,volume:g.reduce(function(s,x){return s+x.volume},0)})}return out}
  function visible(){return compress(state.candles.slice(-ranges[state.range]),intervals[state.interval])}
  function sma(c,p){var o=[];for(var i=p-1;i<c.length;i++){var sum=0;for(var j=i-p+1;j<=i;j++)sum+=c[j].close;o.push({i:i,value:sum/p})}return o}
  function ema(c,p){var k=2/(p+1),prev=c[0]?c[0].close:0;return c.map(function(x,i){var v=i?x.close*k+prev*(1-k):x.close;prev=v;return{i:i,value:v}})}
  function rsi(c,p){p=p||14;var out=[],ag=0,al=0;for(var i=1;i<c.length;i++){var d=c[i].close-c[i-1].close,g=Math.max(d,0),l=Math.max(-d,0);if(i<=p){ag+=g;al+=l;if(i<p)continue;ag/=p;al/=p}else{ag=(ag*(p-1)+g)/p;al=(al*(p-1)+l)/p}var rs=ag/Math.max(al,.0001);out.push({i:i,value:100-100/(1+rs)})}return out}
  function macd(c){var f=ema(c,12),s=ema(c,26);return f.map(function(x,i){return{i:x.i,value:x.value-(s[i]?s[i].value:x.value)}})}
  function path(points){return points.map(function(p,i){return(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)}).join(' ')}
  function drawLine(svg,series,X,Y,color,w,dash){if(series.length<2)return;svg.appendChild(svgEl('path',{d:path(series.map(function(p){return{x:X(p.i),y:Y(p.value)}})),fill:'none',stroke:color,'stroke-width':w||2,'stroke-dasharray':dash||''}))}
  function autoZones(last){var p=last.close;state.zones={buyLow:p*.92,buyHigh:p*.97,addLow:p*.82,addHigh:p*.87,trimLow:p*1.13,trimHigh:p*1.25,stopReview:p*.88,hardExit:p*.80,target:p*1.2}}
  function decision(c){var p=c[c.length-1].close,z=state.zones;if(p<=z.hardExit)return['HARD EXIT','Structure failed. Protect capital.'];if(p<=z.stopReview)return['STOP REVIEW','Freeze new capital. Investigate thesis damage versus panic discount.'];if(p>=z.trimLow)return['TRIM INTO STRENGTH','Price is extended. Protect gains or tighten stop.'];if(p>=z.buyLow&&p<=z.buyHigh)return['BUY ZONE','Starter entry allowed only with thesis confirmation.'];if(p>=z.addLow&&p<=z.addHigh)return['DEEP ADD ZONE','Add only if selling is liquidity-driven, not fundamental damage.'];return['WAIT / HOLD','No chase. Wait for reaction zone or confirmed breakout.']}
  function drawPrice(){var c=visible(),svg=$('priceChart');clear(svg);var W=1120,H=590,p={l:50,r:90,t:28,b:44},pw=W-p.l-p.r,ph=H-p.t-p.b;var vals=[];c.forEach(function(x){vals.push(x.high,x.low)});Object.keys(state.zones).forEach(function(k){vals.push(state.zones[k])});var max=Math.max.apply(null,vals)*1.015,min=Math.min.apply(null,vals)*.985;var X=function(i){return p.l+i/Math.max(1,c.length-1)*pw};var Y=function(v){return p.t+(max-v)/(max-min)*ph};svg.appendChild(svgEl('rect',{width:W,height:H,fill:'#050505'}));for(var i=0;i<7;i++){var v=min+(max-min)*i/6;svg.appendChild(svgEl('line',{x1:p.l,x2:p.l+pw,y1:Y(v),y2:Y(v),stroke:'#202020'}));text(svg,p.l+pw+8,Y(v)+4,'$'+v.toFixed(v<20?2:0))}
    function band(lo,hi,label,color){if(!state.toggles.zones)return;svg.appendChild(svgEl('rect',{x:p.l,y:Y(hi),width:pw,height:Math.max(1,Y(lo)-Y(hi)),fill:color,opacity:.15}));text(svg,p.l+10,Y(hi)+18,label,'#a7a29a',11)}
    band(state.zones.addLow,state.zones.addHigh,'DEEP ADD','#064e3b');band(state.zones.buyLow,state.zones.buyHigh,'BUY','#155e75');band(state.zones.trimLow,state.zones.trimHigh,'TRIM','#713f12');
    ['stopReview','hardExit','target'].forEach(function(k){if(!state.toggles.zones)return;var color=k==='hardExit'?'#ff756d':k==='target'?'#d9a84d':'#d9a84d';svg.appendChild(svgEl('line',{x1:p.l,x2:p.l+pw,y1:Y(state.zones[k]),y2:Y(state.zones[k]),stroke:color,'stroke-dasharray':'6 6'}));text(svg,p.l+pw+8,Y(state.zones[k])+4,k,color,11)});
    var cw=Math.max(1.5,Math.min(8,pw/c.length*.56));c.forEach(function(x,i){var up=x.close>=x.open,cx=X(i),oy=Y(x.open),cy=Y(x.close),hy=Y(x.high),ly=Y(x.low),by=Math.min(oy,cy),bh=Math.max(2,Math.abs(cy-oy));svg.appendChild(svgEl('line',{x1:cx,x2:cx,y1:hy,y2:ly,stroke:up?'#e7e5e4':'#737373'}));svg.appendChild(svgEl('rect',{x:cx-cw/2,y:by,width:cw,height:bh,rx:1,fill:up?'#d6d3d1':'#525252'}))});
    if(state.toggles.sma20)drawLine(svg,sma(c,20),X,Y,'#92c7ff',2);if(state.toggles.sma50)drawLine(svg,sma(c,50),X,Y,'#a78bfa',2);if(state.toggles.sma200)drawLine(svg,sma(c,200),X,Y,'#ff756d',1.5);
    var last=c[c.length-1];svg.appendChild(svgEl('circle',{cx:X(c.length-1),cy:Y(last.close),r:5,fill:'#f4f1ea'}));text(svg,X(c.length-1)-74,Y(last.close)-10,'LAST $'+last.close.toFixed(last.close<20?2:0),'#f4f1ea',11);for(i=0;i<c.length;i+=Math.max(1,Math.floor(c.length/8)))text(svg,X(i),H-18,c[i].label,'#737373',10,'middle')}
  function drawSmall(id,series,label,lines){var c=visible(),svg=$(id);clear(svg);var W=360,H=140,p={l:34,r:18,t:18,b:22};svg.appendChild(svgEl('rect',{width:W,height:H,fill:'#050505'}));text(svg,p.l,14,label,'#737373',10);if(id==='volumeChart'){var max=Math.max.apply(null,c.map(function(x){return x.volume}))||1,bw=(W-p.l-p.r)/c.length;c.forEach(function(x,i){var h=(H-p.t-p.b)*x.volume/max;svg.appendChild(svgEl('rect',{x:p.l+i*bw,y:H-p.b-h,width:Math.max(1,bw-1),height:h,fill:x.close>=x.open?'#57534e':'#404040'}))});return}
    var vals=series.map(function(x){return x.value}).concat(lines||[0]),min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);var X=function(i){return p.l+i/Math.max(1,c.length-1)*(W-p.l-p.r)},Y=function(v){return p.t+(max-v)/Math.max(.001,max-min)*(H-p.t-p.b)};(lines||[]).forEach(function(l){svg.appendChild(svgEl('line',{x1:p.l,x2:W-p.r,y1:Y(l),y2:Y(l),stroke:'#333','stroke-dasharray':'5 5'}))});drawLine(svg,series,X,Y,'#d6d3d1',2)}
  function render(){var c=visible();if(!c.length)return;drawPrice();drawSmall('volumeChart',[], 'VOLUME', []);drawSmall('rsiChart',rsi(c),'RSI 14',[30,50,70]);drawSmall('macdChart',macd(c),'MACD',[0]);var d=decision(c),last=c[c.length-1],s20=sma(c,20).slice(-1)[0];var score=50+(s20&&last.close>s20.value?15:0);$('decisionState').textContent=d[0];$('decisionText').textContent=d[1];$('score').textContent=Math.round(score);$('regime').textContent=score>60?'Trend':'Mixed';$('dataMode').textContent=state.mode==='live'?'Live':'Mock';$('statusBox').textContent='symbol: '+state.symbol+'\ndata: '+state.mode+'\ncandles: '+state.candles.length+'\nvisible: '+c.length+'\nroute: '+location.pathname+location.search;renderZones()}
  function renderControls(){function buttons(id,obj,key){var box=$(id);box.innerHTML='';Object.keys(obj).forEach(function(v){var b=document.createElement('button');b.textContent=v;b.className=state[key]===v?'active':'';b.onclick=function(){state[key]=v;if(key==='symbol'){history.replaceState(null,'','?symbol='+encodeURIComponent(v));load(v)}else renderControls(),render()};box.appendChild(b)})}buttons('symbols',seed,'symbol');buttons('ranges',ranges,'range');buttons('intervals',intervals,'interval');var t=$('toggles');t.innerHTML='';Object.keys(state.toggles).forEach(function(k){var b=document.createElement('button');b.textContent=k.toUpperCase();b.className=state.toggles[k]?'active':'';b.onclick=function(){state.toggles[k]=!state.toggles[k];renderControls();render()};t.appendChild(b)})}
  function renderZones(){var box=$('zoneInputs');box.innerHTML='';Object.keys(state.zones).forEach(function(k){var l=document.createElement('label');var span=document.createElement('span');span.className='label';span.textContent=k;var input=document.createElement('input');input.value=state.zones[k].toFixed(state.zones[k]<20?2:0);input.onchange=function(){var n=Number(input.value);if(Number.isFinite(n)){state.zones[k]=n;render()}};l.appendChild(span);l.appendChild(input);box.appendChild(l)})}
  async function load(symbol){state.symbol=symbol;var payload=null;try{var res=await fetch('/data/market-candles/'+safeName(symbol)+'.json',{cache:'no-store'});if(res.ok)payload=await res.json()}catch(e){}if(payload&&Array.isArray(payload.candles)&&payload.candles.length>30){state.candles=payload.candles.map(function(x){return{time:String(x.time),label:String(x.time).slice(5,10),open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+(x.volume||0)}}).filter(function(x){return Number.isFinite(x.close)});state.mode='live'}else{state.candles=generate(seed[symbol]||100,900);state.mode='mock'}autoZones(state.candles[state.candles.length-1]);renderControls();render()}
  var q=new URLSearchParams(location.search).get('symbol');load((q||'SPY').toUpperCase());
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'chart-cognition.html'), html);
console.log('built fail-safe chart cognition page');
