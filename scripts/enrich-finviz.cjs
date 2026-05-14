const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const statePath = path.join(root, 'data/report-state.live.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const chartDir = path.join(root, 'assets', 'charts');
fs.mkdirSync(chartDir, { recursive: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const headers = { 'user-agent':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36', 'accept':'text/html,image/avif,image/webp,*/*' };
function strip(html='') { return html.replace(/<script[\s\S]*?<\/script>/g,'').replace(/<style[\s\S]*?<\/style>/g,'').replace(/<[^>]+>/g,'').replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').trim(); }
function parseMetrics(html){
  const out = {};
  const re = /<div class="snapshot-td-label">([\s\S]*?)<\/div><\/td><td[\s\S]*?<div class="snapshot-td-content">([\s\S]*?)<\/div><\/td>/g;
  let m;
  while ((m = re.exec(html))) {
    const key = strip(m[1]);
    const val = strip(m[2]);
    if (key) out[key] = val;
  }
  return out;
}
function num(v){
  if (v == null) return null;
  const s=String(v).replace(/,/g,'').replace(/%/g,'').trim();
  if (!s || s==='-' || s==='N/A') return null;
  const mult = /T$/i.test(s) ? 1e12 : /B$/i.test(s) ? 1e9 : /M$/i.test(s) ? 1e6 : /K$/i.test(s) ? 1e3 : 1;
  const n = parseFloat(s.replace(/[TBMK]$/i,''));
  return Number.isFinite(n) ? n*mult : null;
}
function implication(h, m){
  const relVol = num(m['Rel Volume']);
  const price = Number(h.livePrice || num(m.Price) || 0);
  const sma20 = num(m.SMA20), sma50 = num(m.SMA50), sma200 = num(m.SMA200);
  const perfDay = num(m['Perf Day']);
  const instOwn = num(m['Inst Own']);
  const shortFloat = num(m['Short Float']);
  const trendScore = [sma20,sma50,sma200].filter(Boolean).reduce((s,x)=>s+(price>x?1:-1),0);
  let flow = 'Neutral / inconclusive';
  if (relVol >= 1.5 && perfDay > 0.75) flow = 'Bullish accumulation / high-volume advance';
  else if (relVol >= 1.5 && perfDay < -0.75) flow = 'Bearish distribution / high-volume sell pressure';
  else if (relVol < 0.75) flow = 'Low-conviction tape / wait for confirmation';
  else if (perfDay > 0 && trendScore > 0) flow = 'Constructive but not urgent';
  else if (perfDay < 0 && trendScore < 0) flow = 'Weak tape / avoid adding until repair';
  const trend = trendScore >= 2 ? 'Bull trend: above key moving averages' : trendScore <= -2 ? 'Bear trend: below key moving averages' : 'Mixed trend: moving averages conflicted';
  const inst = instOwn == null ? 'Institutional ownership unavailable' : instOwn >= 70 ? 'Institutional sponsorship high' : instOwn >= 40 ? 'Institutional sponsorship moderate' : 'Institutional sponsorship light';
  const short = shortFloat == null ? 'Short-interest unavailable' : shortFloat >= 10 ? 'High short-float: squeeze/air-pocket risk' : shortFloat >= 5 ? 'Moderate short-float' : 'Low short-float';
  return { flow, trend, institutional: inst, shortInterest: short };
}
function finvizTicker(ticker){
  ticker=String(ticker||'').toUpperCase();
  if (ticker === 'DOGE') return null;
  if (ticker === 'VOYG-35C-2027') return 'VOYG';
  return ticker.replace(/[^A-Z.]/g,'');
}
async function fetchText(url, referer){ const r=await fetch(url,{headers:{...headers, referer:referer||'https://finviz.com/'}}); if(!r.ok) throw new Error(`${r.status} ${url}`); return r.text(); }
async function fetchBuf(url, referer){ const r=await fetch(url,{headers:{...headers, referer:referer||'https://finviz.com/'}}); if(!r.ok) throw new Error(`${r.status} ${url}`); return Buffer.from(await r.arrayBuffer()); }
(async()=>{
  for (const h of state.holdings || []) {
    const ft = finvizTicker(h.ticker);
    if (!ft) { h.chart = { provider:'none', note:'Finviz does not cover this crypto asset directly.' }; continue; }
    try {
      const quoteUrl = `https://finviz.com/quote.ashx?t=${encodeURIComponent(ft)}`;
      const html = await fetchText(quoteUrl);
      const metrics = parseMetrics(html);
      const imgUrl = `https://finviz.com/chart.ashx?t=${encodeURIComponent(ft)}&ty=c&ta=1&p=d&s=l`;
      const img = await fetchBuf(imgUrl, quoteUrl);
      const file = `${String(h.ticker).toLowerCase().replace(/[^a-z0-9]+/g,'-')}-finviz-daily.png`;
      fs.writeFileSync(path.join(chartDir, file), img);
      h.finviz = { ticker: ft, asOf: new Date().toISOString(), quoteUrl, chartUrl: imgUrl, metrics, parsed: { relVolume:num(metrics['Rel Volume']), volume:num(metrics.Volume), avgVolume:num(metrics['Avg Volume']), atr:num(metrics['ATR (14)']), rsi:num(metrics['RSI (14)']), sma20:num(metrics.SMA20), sma50:num(metrics.SMA50), sma200:num(metrics.SMA200), instOwn:num(metrics['Inst Own']), instTrans:num(metrics['Inst Trans']), shortFloat:num(metrics['Short Float']), perfDay:num(metrics.Change), perfWeek:num(metrics['Perf Week']), perfMonth:num(metrics['Perf Month']), targetPrice:num(metrics['Target Price']) }, implication: implication(h, metrics) };
      h.chart = { provider:'Finviz', path:`assets/charts/${file}`, quoteUrl, note: ft === h.ticker ? 'Finviz daily technical chart' : `Finviz underlying chart for ${ft}` };
      console.log(`finviz ${h.ticker} -> ${ft}`);
    } catch (err) {
      console.error(`finviz failed ${h.ticker}: ${err.message}`);
      h.chart = { provider:'Finviz', error: err.message };
    }
    await sleep(800);
  }
  state.meta.finvizSource = 'Finviz quote pages and daily technical chart images fetched with rate-limited requests; used as visual/technical reference, not a brokerage feed.';
  state.meta.generatedAt = new Date().toISOString();
  fs.writeFileSync(statePath, JSON.stringify(state, null, 2));
})();
