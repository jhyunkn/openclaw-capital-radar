const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const files = [path.join(root, 'outputs', 'chart-cognition.html'), path.join(root, 'public', 'outputs', 'chart-cognition.html')];
const loader = `
async function fetchJsonSafe(url){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)return null;return await r.json()}catch(e){return null}}
function safeName(symbol){return String(symbol).replace(/[^A-Za-z0-9._-]/g,'_').toUpperCase()}
async function loadManifest(){const m=await fetchJsonSafe('/data/market-candles/manifest.json');if(m&&Array.isArray(m.symbols)&&m.symbols.length){for(const s of m.symbols){if(!seeds[s])seeds[s]=100}renderControls()}const params=new URLSearchParams(location.search);const q=params.get('symbol');if(q){state.symbol=q.toUpperCase();if(!seeds[state.symbol])seeds[state.symbol]=100}await loadSymbolLive(state.symbol)}
async function loadSymbolLive(symbol){const payload=await fetchJsonSafe('/data/market-candles/'+safeName(symbol)+'.json');if(payload&&Array.isArray(payload.candles)&&payload.candles.length>30){state.all=payload.candles.map(x=>({time:String(x.time),label:String(x.time).slice(5,10),open:+x.open,high:+x.high,low:+x.low,close:+x.close,volume:+(x.volume||0)})).filter(x=>Number.isFinite(x.close));document.getElementById('contractText').textContent='STATIC LIVE CANDLES /data/market-candles/'+safeName(symbol)+'.json\\nsource: '+(payload.source||'market candle builder')+'\\nasOf: '+(payload.asOf||'n/a')+'\\n\\nURL deep link: /outputs/chart-cognition.html?symbol='+symbol;renderControls();render();return true}loadSymbol();renderControls();render();return false}
`;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let s = fs.readFileSync(file, 'utf8');
  if (s.includes('STATIC LIVE CANDLES /data/market-candles/')) continue;
  s = s.replace('function loadSymbol(){state.all=gen(seeds[state.symbol]||900)}', 'function loadSymbol(){state.all=gen(seeds[state.symbol]||900)}' + loader);
  s = s.replace("b.onclick=()=>{state[key]=v;if(key==='symbol')loadSymbol();renderControls();render()};", "b.onclick=async()=>{state[key]=v;if(key==='symbol'){history.replaceState(null,'','?symbol='+encodeURIComponent(v));await loadSymbolLive(v);return}renderControls();render()};");
  s = s.replace('loadSymbol();renderControls();render();tryLive();setInterval(tryLive,60000);', 'loadManifest();setInterval(()=>loadSymbolLive(state.symbol),60000);');
  fs.writeFileSync(file, s);
}
console.log('patched chart page for static live candle loading and symbol deep links');
