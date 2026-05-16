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
    :root{--bg:#f3f2ed;--paper:#fbfaf6;--ink:#24231f;--muted:#747168;--rule:#dedbd2;--bad:#9f3f35;--good:#2f6f4e;--warn:#8a6a2c}
    *{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Arial,sans-serif}.top{position:sticky;top:0;display:flex;justify-content:space-between;gap:16px;padding:18px clamp(18px,4vw,56px);border-bottom:1px solid var(--rule);background:rgba(243,242,237,.9);backdrop-filter:blur(18px)}a{color:var(--ink)}.nav{display:flex;gap:18px}.nav a{text-decoration:none;font-size:14px}.hero{padding:84px clamp(18px,4vw,56px) 44px;border-bottom:1px solid var(--rule)}.eyebrow{color:var(--muted);font-size:14px}.hero h1{font-size:clamp(54px,9vw,122px);line-height:.88;letter-spacing:-.075em;font-weight:500;margin:14px 0}.lede{font-size:clamp(18px,2vw,27px);line-height:1.28;max-width:980px}.layout{display:grid;grid-template-columns:minmax(0,1fr) 380px;gap:0}.main{padding:28px clamp(18px,4vw,56px);border-right:1px solid var(--rule)}.side{padding:28px}.panel{border:1px solid var(--rule);background:rgba(251,250,246,.35);padding:22px}.chartbox{height:580px;border:1px solid var(--rule);background:#fff}.label{display:block;color:var(--muted);font-size:12px;margin-bottom:8px}.metricgrid{display:grid;grid-template-columns:repeat(3,1fr);border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin:22px 0}.metric{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px}.metric b{display:block;font-size:28px;font-weight:500}.button{display:inline-flex;border:1px solid var(--ink);border-radius:999px;padding:10px 15px;text-decoration:none;margin-right:8px;margin-top:16px}.button:hover{background:var(--ink);color:var(--bg)}pre{white-space:pre-wrap;background:#fff;border:1px solid var(--rule);padding:14px;color:var(--muted);font-size:12px;overflow:auto}.bad{color:var(--bad)}.good{color:var(--good)}.warn{color:var(--warn)}@media(max-width:1000px){.layout{grid-template-columns:1fr}.main{border-right:0}.chartbox{height:420px}}
  </style>
</head>
<body>
  <div class="top"><strong>OpenClaw · Chart Cognition</strong><nav class="nav"><a href="/">Dashboard</a><a href="/outputs/capital-radar-current.html#holdings">Ticker workspaces</a></nav></div>
  <header class="hero"><span class="eyebrow">Verified market data only</span><h1 id="title">Chart cognition</h1><p class="lede">This route no longer renders synthetic candles as if they were market truth. It displays a chart only when verified OHLCV candle JSON exists. Otherwise, use the combined rating + real-chart ticker workspace.</p></header>
  <section class="layout">
    <main class="main">
      <div id="chartState" class="panel"></div>
      <div class="chartbox"><svg id="priceChart" viewBox="0 0 1120 580" width="100%" height="100%"></svg></div>
    </main>
    <aside class="side">
      <span class="label">Decision</span><h2 id="decisionState">Checking feed</h2><p id="decisionText">Loading verified candle source...</p>
      <div class="metricgrid"><div class="metric"><span class="label">Data</span><b id="dataMode">--</b></div><div class="metric"><span class="label">Candles</span><b id="count">--</b></div><div class="metric"><span class="label">Status</span><b id="status">--</b></div></div>
      <a class="button" id="workspaceLink" href="/outputs/capital-radar-current.html#holdings">Open rating + real chart</a>
      <pre id="statusBox"></pre>
    </aside>
  </section>
<script>
(function(){
  var symbol=(new URLSearchParams(location.search).get('symbol')||'SPY').toUpperCase();
  var title=document.getElementById('title');
  var stateBox=document.getElementById('chartState');
  var svg=document.getElementById('priceChart');
  var workspace=document.getElementById('workspaceLink');
  title.textContent=symbol+' chart cognition';
  workspace.href='/pages/'+symbol.toLowerCase()+'.html';
  workspace.textContent='Open '+symbol+' rating + real chart';
  function safeName(s){return String(s).replace(/[^A-Za-z0-9._-]/g,'_').toUpperCase()}
  function el(n,a){var e=document.createElementNS('http://www.w3.org/2000/svg',n);Object.keys(a||{}).forEach(function(k){e.setAttribute(k,a[k])});return e}
  function txt(x,y,t,c,s){var e=el('text',{x:x,y:y,fill:c||'#747168','font-size':s||14});e.textContent=t;svg.appendChild(e)}
  function setStatus(mode,count,status,msg){document.getElementById('dataMode').textContent=mode;document.getElementById('count').textContent=count;document.getElementById('status').textContent=status;document.getElementById('decisionState').textContent=status;document.getElementById('decisionText').textContent=msg;document.getElementById('statusBox').textContent='symbol: '+symbol+'\nfile: /data/market-candles/'+safeName(symbol)+'.json\nmode: '+mode+'\nstatus: '+status+'\nmessage: '+msg}
  function draw(c){while(svg.firstChild)svg.removeChild(svg.firstChild);var W=1120,H=580,p={l:56,r:94,t:34,b:48},pw=W-p.l-p.r,ph=H-p.t-p.b;var vals=[];c.forEach(function(x){vals.push(x.high,x.low)});var max=Math.max.apply(null,vals)*1.012,min=Math.min.apply(null,vals)*.988;var X=function(i){return p.l+i/Math.max(1,c.length-1)*pw};var Y=function(v){return p.t+(max-v)/(max-min)*ph};svg.appendChild(el('rect',{width:W,height:H,fill:'#fff'}));for(var i=0;i<7;i++){var v=min+(max-min)*i/6;svg.appendChild(el('line',{x1:p.l,x2:p.l+pw,y1:Y(v),y2:Y(v),stroke:'#ebe8df'}));txt(p.l+pw+8,Y(v)+4,'$'+v.toFixed(v<20?2:0),'#747168',11)}var cw=Math.max(1.5,Math.min(8,pw/c.length*.56));c.forEach(function(x,i){var up=x.close>=x.open,cx=X(i),oy=Y(x.open),cy=Y(x.close),hy=Y(x.high),ly=Y(x.low),by=Math.min(oy,cy),bh=Math.max(2,Math.abs(cy-oy));svg.appendChild(el('line',{x1:cx,x2:cx,y1:hy,y2:ly,stroke:up?'#24231f':'#999'}));svg.appendChild(el('rect',{x:cx-cw/2,y:by,width:cw,height:bh,rx:1,fill:up?'#24231f':'#aaa'}))});var last=c[c.length-1];svg.appendChild(el('circle',{cx:X(c.length-1),cy:Y(last.close),r:5,fill:'#24231f'}));txt(X(c.length-1)-76,Y(last.close)-10,'LAST $'+last.close.toFixed(last.close<20?2:0),'#24231f',12)}
  async function load(){try{var res=await fetch('/data/market-candles/'+safeName(symbol)+'.json',{cache:'no-store'});if(!res.ok)throw new Error('No verified candle file deployed');var payload=await res.json();var candles=(payload.candles||[]).map(function(x){return{time:String(x.time),open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+(x.volume||0)}}).filter(function(x){return Number.isFinite(x.close)&&Number.isFinite(x.open)&&Number.isFinite(x.high)&&Number.isFinite(x.low)});if(candles.length<30)throw new Error('Verified candle file has insufficient OHLCV rows');draw(candles.slice(-252));stateBox.innerHTML='<strong class="good">Verified OHLCV feed loaded.</strong><p>Rendering last 252 daily candles from deployed market-candles JSON.</p>';setStatus('Verified',candles.length,'Live chart','Chart is using deployed OHLCV data, not synthetic fallback.')}catch(e){while(svg.firstChild)svg.removeChild(svg.firstChild);svg.appendChild(el('rect',{width:1120,height:580,fill:'#fff'}));txt(56,92,'No verified OHLCV candle feed for '+symbol,'#9f3f35',28);txt(56,138,'Synthetic candles are disabled. Use the ticker workspace real chart until a verified candle pipeline is deployed.','#747168',16);stateBox.innerHTML='<strong class="bad">No verified candle feed.</strong><p>This page intentionally refuses to render mock candles as market truth. Open the ticker workspace for the real Finviz chart image, numeric bands, flow read, and rating.</p>';setStatus('None',0,'Feed missing',e.message)}}
  load();
})();
</script>
</body>
</html>`;

fs.writeFileSync(path.join(outDir, 'chart-cognition.html'), html);
console.log('built verified-data-only chart cognition page');
