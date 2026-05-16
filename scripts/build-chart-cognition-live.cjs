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
    :root{--bg:#f5f5f2;--paper:#fff;--ink:#111;--muted:#6b6b64;--rule:#d8d8d0;--soft:#ededE7;--good:#1c7c43;--warn:#9a6700;--bad:#b42318;--blue:#2454d6}
    *{box-sizing:border-box} html{scroll-behavior:smooth} body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}
    .page{max-width:none;margin:0}.top{position:sticky;top:0;z-index:10;display:flex;justify-content:space-between;align-items:center;gap:16px;padding:18px clamp(18px,4vw,56px);border-bottom:1px solid var(--rule);background:rgba(245,245,242,.92);backdrop-filter:blur(18px)}
    .brand{font-weight:650;letter-spacing:-.02em}.nav{display:flex;gap:18px;align-items:center}.nav a{color:var(--ink);text-decoration:none;font-size:14px}.nav a:hover{text-decoration:underline;text-underline-offset:4px}.hero{min-height:360px;padding:82px clamp(18px,4vw,56px) 46px;border-bottom:1px solid var(--rule)}
    .eyebrow{font-size:14px;line-height:1.35;color:var(--muted);margin:0 0 26px}.hero h1{font-size:clamp(58px,9vw,132px);line-height:.88;letter-spacing:-.075em;margin:0;font-weight:500}.lede{font-size:clamp(19px,2vw,28px);line-height:1.25;letter-spacing:-.03em;max-width:980px;margin-top:26px;color:var(--ink)}
    .layout{display:grid;grid-template-columns:minmax(0,1fr) 390px;gap:0;border-bottom:1px solid var(--rule)}.mainpanel{padding:28px clamp(18px,4vw,56px);border-right:1px solid var(--rule)}.side{padding:28px;border-left:0}.toolbar{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;margin-bottom:14px}.group{display:flex;flex-wrap:wrap;gap:8px}button{border:1px solid var(--rule);border-radius:999px;background:transparent;color:var(--ink);padding:9px 12px;font-size:13px;cursor:pointer}button:hover,.active{background:var(--ink);color:var(--bg);border-color:var(--ink)}
    .chartbox{height:620px;border:1px solid var(--rule);background:#fff;overflow:hidden}.subgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;border-left:1px solid var(--rule);border-top:1px solid var(--rule)}.subchart{height:150px;border-right:1px solid var(--rule);background:#fff}.label{display:block;color:var(--muted);font-size:12px;margin-bottom:8px}.decision h2{font-size:clamp(32px,3.6vw,58px);line-height:.94;letter-spacing:-.055em;font-weight:500;margin:8px 0 16px}.decision p{font-size:16px;line-height:1.45}.metrics{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin:24px 0}.metric{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px}.metric b{display:block;font-size:28px;font-weight:500;letter-spacing:-.04em}.zones{display:grid;grid-template-columns:1fr 1fr;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.zones label{display:grid;gap:4px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px}.zones input{width:100%;border:0;background:transparent;border-bottom:1px solid var(--rule);padding:6px 0;font-size:14px}pre{white-space:pre-wrap;background:#fff;border:1px solid var(--rule);padding:14px;font-size:12px;color:var(--muted);overflow:auto}.small{font-size:13px;color:var(--muted);line-height:1.45}.fade{animation:fadeUp .7s ease both}@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}@media(max-width:1080px){.layout{grid-template-columns:1fr}.mainpanel{border-right:0}.subgrid{grid-template-columns:1fr}.chartbox{height:470px}.side{border-top:1px solid var(--rule)}}
  </style>
</head>
<body>
<main class="page">
  <div class="top"><div class="brand">OpenClaw · Chart Cognition</div><nav class="nav"><a href="/">Dashboard</a><a href="/outputs/capital-radar-current.html">Capital Radar</a></nav></div>
  <header class="hero fade"><p class="eyebrow">Ticker workbench</p><h1>Chart cognition.</h1><p class="lede">A quiet analyst surface for price structure, indicators, reaction zones, and ticker-specific market behavior.</p></header>
  <section class="layout">
    <div class="mainpanel fade">
      <div class="toolbar"><div class="group" id="symbols"></div><div class="group" id="ranges"></div><div class="group" id="intervals"></div></div>
      <div class="toolbar"><div class="group" id="toggles"></div></div>
      <div class="chartbox"><svg id="priceChart" viewBox="0 0 1120 620" width="100%" height="100%"></svg></div>
      <div class="subgrid"><div class="subchart"><svg id="volumeChart" viewBox="0 0 360 150" width="100%" height="100%"></svg></div><div class="subchart"><svg id="rsiChart" viewBox="0 0 360 150" width="100%" height="100%"></svg></div><div class="subchart"><svg id="macdChart" viewBox="0 0 360 150" width="100%" height="100%"></svg></div></div>
    </div>
    <aside class="side fade">
      <div class="decision"><span class="label">Decision</span><h2 id="decisionState">Loading</h2><p id="decisionText">Loading chart...</p></div>
      <div class="metrics"><div class="metric"><span class="label">Technical</span><b id="score">--</b></div><div class="metric"><span class="label">Regime</span><b id="regime">--</b></div><div class="metric"><span class="label">Data</span><b id="dataMode">--</b></div></div>
      <span class="label">Editable zones</span><div class="zones" id="zoneInputs"></div>
      <br><span class="label">Status</span><pre id="statusBox"></pre>
      <p class="small">Fallback data is symbol-specific and intentionally non-identical. Real candle files override mock curves when available.</p>
    </aside>
  </section>
</main>
<script>
(function(){
  var profiles={
    SPY:{base:670,trend:.36,vol:.018,cycle:.055,shock:-.055,recovery:.04,bias:.06},
    MSFT:{base:420,trend:.50,vol:.016,cycle:.04,shock:-.035,recovery:.08,bias:.12},
    AMZN:{base:220,trend:.44,vol:.026,cycle:.075,shock:-.09,recovery:.12,bias:.02},
    META:{base:640,trend:.62,vol:.03,cycle:.085,shock:-.13,recovery:.20,bias:.16},
    GEV:{base:900,trend:.84,vol:.034,cycle:.095,shock:-.07,recovery:.22,bias:.26},
    CEG:{base:270,trend:.58,vol:.028,cycle:.07,shock:-.045,recovery:.14,bias:.18},
    NVDA:{base:180,trend:.76,vol:.04,cycle:.11,shock:-.16,recovery:.24,bias:.28},
    MA:{base:520,trend:.34,vol:.014,cycle:.035,shock:-.025,recovery:.035,bias:.05},
    NFLX:{base:950,trend:.54,vol:.032,cycle:.09,shock:-.115,recovery:.18,bias:.11},
    BMNR:{base:24,trend:.08,vol:.09,cycle:.18,shock:-.42,recovery:.26,bias:-.08},
    CONL:{base:8.5,trend:.04,vol:.13,cycle:.22,shock:-.55,recovery:.32,bias:-.18},
    TSLT:{base:23,trend:.10,vol:.11,cycle:.20,shock:-.36,recovery:.22,bias:-.05},
    TSNF:{base:10,trend:.06,vol:.12,cycle:.21,shock:-.45,recovery:.20,bias:-.12},
    QQQ:{base:600,trend:.48,vol:.022,cycle:.065,shock:-.075,recovery:.10,bias:.12},
    IWM:{base:240,trend:.18,vol:.03,cycle:.085,shock:-.10,recovery:.06,bias:-.02},
    AVGO:{base:360,trend:.70,vol:.035,cycle:.09,shock:-.11,recovery:.20,bias:.22},
    VRT:{base:150,trend:.82,vol:.05,cycle:.13,shock:-.18,recovery:.30,bias:.30},
    GOOGL:{base:180,trend:.38,vol:.02,cycle:.055,shock:-.06,recovery:.08,bias:.08},
    IBIT:{base:60,trend:.42,vol:.07,cycle:.16,shock:-.28,recovery:.20,bias:.10}
  };
  var state={symbol:'SPY',range:'1Y',interval:'1D',mode:'mock',candles:[],toggles:{sma20:true,sma50:true,sma200:true,rsi:true,macd:true,zones:true},zones:{buyLow:0,buyHigh:0,addLow:0,addHigh:0,trimLow:0,trimHigh:0,stopReview:0,hardExit:0,target:0}};
  var ranges={'1M':22,'3M':66,'6M':132,'1Y':252,'2Y':504,'MAX':900};
  var intervals={'1D':1,'1W':5,'1M':21};
  function $(id){return document.getElementById(id)}
  function safeName(s){return String(s).replace(/[^A-Za-z0-9._-]/g,'_').toUpperCase()}
  function svgEl(n,a){var e=document.createElementNS('http://www.w3.org/2000/svg',n);Object.keys(a||{}).forEach(function(k){e.setAttribute(k,a[k])});return e}
  function clear(el){while(el.firstChild)el.removeChild(el.firstChild)}
  function text(svg,x,y,t,c,s,anchor){var e=svgEl('text',{x:x,y:y,fill:c||'#666','font-size':s||11,'text-anchor':anchor||'start'});e.textContent=t;svg.appendChild(e)}
  function hash(s){var h=0;for(var i=0;i<s.length;i++)h=(h*31+s.charCodeAt(i))%9973;return h}
  function generate(symbol,count){var p=profiles[symbol]||{base:100,trend:.25,vol:.03,cycle:.07,shock:-.08,recovery:.06,bias:0};var out=[],prev=p.base*(.72+p.bias*.1),start=new Date('2023-01-03T00:00:00Z'),h=hash(symbol);for(var i=0;out.length<count;i++){var d=new Date(start);d.setDate(start.getDate()+i);if(d.getDay()===0||d.getDay()===6)continue;var t=out.length;var shock=0;if(t>count*.38&&t<count*.48)shock=p.shock*p.base*((t-count*.38)/(count*.10));if(t>=count*.48&&t<count*.64)shock=p.shock*p.base+p.recovery*p.base*((t-count*.48)/(count*.16));var chop=Math.sin((t+h%17)/(10+h%9))*p.base*p.cycle+Math.sin((t+h%29)/(37+h%11))*p.base*p.cycle*.65;var late=(t>count*.72?(t-count*.72)/(count*.28)*p.base*p.trend*.45:0);var close=Math.max(1,p.base*.70+t*(p.base/count)*p.trend+late+shock+chop+Math.sin(t*(1.17+(h%7)/10))*p.base*p.vol);var open=prev;var high=Math.max(open,close)+p.base*(.006+p.vol*.25)+Math.abs(Math.sin(t*.73+h))*p.base*p.vol;var low=Math.min(open,close)-p.base*(.006+p.vol*.25)-Math.abs(Math.cos(t*.51+h))*p.base*p.vol;var vol=Math.round(600000+Math.abs(close-open)*62000+Math.abs(Math.sin(t/(5+h%9)))*1800000+p.vol*18000000);out.push({time:d.toISOString().slice(0,10),label:d.toISOString().slice(5,10),open:+open.toFixed(2),high:+high.toFixed(2),low:+low.toFixed(2),close:+close.toFixed(2),volume:vol});prev=close}return out}
  function compress(rows,step){if(step===1)return rows;var out=[];for(var i=0;i<rows.length;i+=step){var g=rows.slice(i,i+step);if(!g.length)continue;out.push({time:g[g.length-1].time,label:g[g.length-1].label,open:g[0].open,high:Math.max.apply(null,g.map(function(x){return x.high})),low:Math.min.apply(null,g.map(function(x){return x.low})),close:g[g.length-1].close,volume:g.reduce(function(s,x){return s+x.volume},0)})}return out}
  function visible(){return compress(state.candles.slice(-ranges[state.range]),intervals[state.interval])}
  function sma(c,p){var o=[];for(var i=p-1;i<c.length;i++){var sum=0;for(var j=i-p+1;j<=i;j++)sum+=c[j].close;o.push({i:i,value:sum/p})}return o}
  function ema(c,p){var k=2/(p+1),prev=c[0]?c[0].close:0;return c.map(function(x,i){var v=i?x.close*k+prev*(1-k):x.close;prev=v;return{i:i,value:v}})}
  function rsi(c,p){p=p||14;var out=[],ag=0,al=0;for(var i=1;i<c.length;i++){var d=c[i].close-c[i-1].close,g=Math.max(d,0),l=Math.max(-d,0);if(i<=p){ag+=g;al+=l;if(i<p)continue;ag/=p;al/=p}else{ag=(ag*(p-1)+g)/p;al=(al*(p-1)+l)/p}var rs=ag/Math.max(al,.0001);out.push({i:i,value:100-100/(1+rs)})}return out}
  function macd(c){var f=ema(c,12),s=ema(c,26);return f.map(function(x,i){return{i:x.i,value:x.value-(s[i]?s[i].value:x.value)}})}
  function path(points){return points.map(function(p,i){return(i?'L':'M')+p.x.toFixed(1)+','+p.y.toFixed(1)}).join(' ')}
  function drawLine(svg,series,X,Y,color,w,dash){if(series.length<2)return;svg.appendChild(svgEl('path',{d:path(series.map(function(p){return{x:X(p.i),y:Y(p.value)}})),fill:'none',stroke:color,'stroke-width':w||2,'stroke-dasharray':dash||''}))}
  function autoZones(last){var p=last.close;state.zones={buyLow:p*.92,buyHigh:p*.97,addLow:p*.82,addHigh:p*.87,trimLow:p*1.13,trimHigh:p*1.25,stopReview:p*.88,hardExit:p*.80,target:p*1.2}}
  function decision(c){var p=c[c.length-1].close,z=state.zones;if(p<=z.hardExit)return['Hard exit','Structure failed. Protect capital.'];if(p<=z.stopReview)return['Stop review','Freeze new capital. Investigate thesis damage versus panic discount.'];if(p>=z.trimLow)return['Trim into strength','Price is extended. Protect gains or tighten stop.'];if(p>=z.buyLow&&p<=z.buyHigh)return['Buy zone','Starter entry allowed only with thesis confirmation.'];if(p>=z.addLow&&p<=z.addHigh)return['Deep add zone','Add only if selling is liquidity-driven, not fundamental damage.'];return['Wait / hold','No chase. Wait for reaction zone or confirmed breakout.']}
  function drawPrice(){var c=visible(),svg=$('priceChart');clear(svg);var W=1120,H=620,p={l:54,r:92,t:30,b:46},pw=W-p.l-p.r,ph=H-p.t-p.b;var vals=[];c.forEach(function(x){vals.push(x.high,x.low)});Object.keys(state.zones).forEach(function(k){vals.push(state.zones[k])});var max=Math.max.apply(null,vals)*1.015,min=Math.min.apply(null,vals)*.985;var X=function(i){return p.l+i/Math.max(1,c.length-1)*pw};var Y=function(v){return p.t+(max-v)/(max-min)*ph};svg.appendChild(svgEl('rect',{width:W,height:H,fill:'#fff'}));for(var i=0;i<7;i++){var v=min+(max-min)*i/6;svg.appendChild(svgEl('line',{x1:p.l,x2:p.l+pw,y1:Y(v),y2:Y(v),stroke:'#ededE7'}));text(svg,p.l+pw+8,Y(v)+4,'$'+v.toFixed(v<20?2:0),'#777',11)}
    function band(lo,hi,label,color){if(!state.toggles.zones)return;svg.appendChild(svgEl('rect',{x:p.l,y:Y(hi),width:pw,height:Math.max(1,Y(lo)-Y(hi)),fill:color,opacity:.08}));text(svg,p.l+10,Y(hi)+18,label,'#666',11)}band(state.zones.addLow,state.zones.addHigh,'deep add','#1c7c43');band(state.zones.buyLow,state.zones.buyHigh,'buy','#2454d6');band(state.zones.trimLow,state.zones.trimHigh,'trim','#9a6700');['stopReview','hardExit','target'].forEach(function(k){if(!state.toggles.zones)return;var color=k==='hardExit'?'#b42318':k==='target'?'#9a6700':'#9a6700';svg.appendChild(svgEl('line',{x1:p.l,x2:p.l+pw,y1:Y(state.zones[k]),y2:Y(state.zones[k]),stroke:color,'stroke-dasharray':'6 6'}));text(svg,p.l+pw+8,Y(state.zones[k])+4,k,color,11)});
    var cw=Math.max(1.4,Math.min(8,pw/c.length*.56));c.forEach(function(x,i){var up=x.close>=x.open,cx=X(i),oy=Y(x.open),cy=Y(x.close),hy=Y(x.high),ly=Y(x.low),by=Math.min(oy,cy),bh=Math.max(2,Math.abs(cy-oy));svg.appendChild(svgEl('line',{x1:cx,x2:cx,y1:hy,y2:ly,stroke:up?'#111':'#777'}));svg.appendChild(svgEl('rect',{x:cx-cw/2,y:by,width:cw,height:bh,rx:1,fill:up?'#111':'#aaa'}))});
    if(state.toggles.sma20)drawLine(svg,sma(c,20),X,Y,'#2454d6',2);if(state.toggles.sma50)drawLine(svg,sma(c,50),X,Y,'#666',1.7);if(state.toggles.sma200)drawLine(svg,sma(c,200),X,Y,'#b42318',1.4);
    var last=c[c.length-1];svg.appendChild(svgEl('circle',{cx:X(c.length-1),cy:Y(last.close),r:5,fill:'#111'}));text(svg,X(c.length-1)-76,Y(last.close)-10,'LAST $'+last.close.toFixed(last.close<20?2:0),'#111',11);for(i=0;i<c.length;i+=Math.max(1,Math.floor(c.length/8)))text(svg,X(i),H-18,c[i].label,'#777',10,'middle')}
  function drawSmall(id,series,label,lines){var c=visible(),svg=$(id);clear(svg);var W=360,H=150,p={l:36,r:18,t:20,b:24};svg.appendChild(svgEl('rect',{width:W,height:H,fill:'#fff'}));text(svg,p.l,15,label,'#777',10);if(id==='volumeChart'){var max=Math.max.apply(null,c.map(function(x){return x.volume}))||1,bw=(W-p.l-p.r)/c.length;c.forEach(function(x,i){var h=(H-p.t-p.b)*x.volume/max;svg.appendChild(svgEl('rect',{x:p.l+i*bw,y:H-p.b-h,width:Math.max(1,bw-1),height:h,fill:x.close>=x.open?'#111':'#aaa'}))});return}var vals=series.map(function(x){return x.value}).concat(lines||[0]),min=Math.min.apply(null,vals),max=Math.max.apply(null,vals);var X=function(i){return p.l+i/Math.max(1,c.length-1)*(W-p.l-p.r)},Y=function(v){return p.t+(max-v)/Math.max(.001,max-min)*(H-p.t-p.b)};(lines||[]).forEach(function(l){svg.appendChild(svgEl('line',{x1:p.l,x2:W-p.r,y1:Y(l),y2:Y(l),stroke:'#ddd','stroke-dasharray':'5 5'}))});drawLine(svg,series,X,Y,'#111',1.8)}
  function render(){var c=visible();if(!c.length)return;drawPrice();drawSmall('volumeChart',[], 'Volume', []);drawSmall('rsiChart',rsi(c),'RSI 14',[30,50,70]);drawSmall('macdChart',macd(c),'MACD',[0]);var d=decision(c),last=c[c.length-1],s20=sma(c,20).slice(-1)[0],s50=sma(c,50).slice(-1)[0];var score=50+(s20&&last.close>s20.value?15:0)+(s20&&s50&&s20.value>s50.value?10:0);$('decisionState').textContent=d[0];$('decisionText').textContent=d[1];$('score').textContent=Math.round(score);$('regime').textContent=score>65?'Trend':score<45?'Risk':'Mixed';$('dataMode').textContent=state.mode==='live'?'Live':'Mock';$('statusBox').textContent='symbol: '+state.symbol+'\ndata: '+state.mode+'\ncandles: '+state.candles.length+'\nvisible: '+c.length+'\nprofile: '+(profiles[state.symbol]?'ticker-specific':'generic');renderZones()}
  function renderControls(){function buttons(id,obj,key){var box=$(id);box.innerHTML='';Object.keys(obj).forEach(function(v){var b=document.createElement('button');b.textContent=v;b.className=state[key]===v?'active':'';b.onclick=function(){state[key]=v;if(key==='symbol'){history.replaceState(null,'','?symbol='+encodeURIComponent(v));load(v)}else renderControls(),render()};box.appendChild(b)})}buttons('symbols',profiles,'symbol');buttons('ranges',ranges,'range');buttons('intervals',intervals,'interval');var t=$('toggles');t.innerHTML='';Object.keys(state.toggles).forEach(function(k){var b=document.createElement('button');b.textContent=k.toUpperCase();b.className=state.toggles[k]?'active':'';b.onclick=function(){state.toggles[k]=!state.toggles[k];renderControls();render()};t.appendChild(b)})}
  function renderZones(){var box=$('zoneInputs');box.innerHTML='';Object.keys(state.zones).forEach(function(k){var l=document.createElement('label'),span=document.createElement('span'),input=document.createElement('input');span.className='label';span.textContent=k;input.value=state.zones[k].toFixed(state.zones[k]<20?2:0);input.onchange=function(){var n=Number(input.value);if(Number.isFinite(n)){state.zones[k]=n;render()}};l.appendChild(span);l.appendChild(input);box.appendChild(l)})}
  async function load(symbol){state.symbol=symbol;var payload=null;try{var res=await fetch('/data/market-candles/'+safeName(symbol)+'.json',{cache:'no-store'});if(res.ok)payload=await res.json()}catch(e){}if(payload&&Array.isArray(payload.candles)&&payload.candles.length>30){state.candles=payload.candles.map(function(x){return{time:String(x.time),label:String(x.time).slice(5,10),open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+(x.volume||0)}}).filter(function(x){return Number.isFinite(x.close)});state.mode='live'}else{state.candles=generate(symbol,900);state.mode='mock'}autoZones(state.candles[state.candles.length-1]);renderControls();render()}
  var q=new URLSearchParams(location.search).get('symbol');load((q||'SPY').toUpperCase());
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'chart-cognition.html'), html);
console.log('built OpenAI-inspired ticker-specific chart cognition page');
