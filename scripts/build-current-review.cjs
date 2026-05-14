const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const live = JSON.parse(fs.readFileSync(path.join(root, 'data/report-state.live.json'), 'utf8'));
const mdPath = path.join(root, '..', '..', 'runs', 'capital-radar', '2026-05-14', 'premarket.md');
const md = fs.existsSync(mdPath) ? fs.readFileSync(mdPath, 'utf8') : '';
const e = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function section(name){
  const re = new RegExp(`## ${name.replace(/[.*+?^${}()|[\\]\\]/g,'\\$&')}\\n([\\s\\S]*?)(?=\\n## |$)`);
  return (md.match(re)?.[1] || '').trim();
}
function bullets(text){
  return text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x.startsWith('- ')).map(x=>x.slice(2));
}
const holdings = live.holdings || [];
const total = holdings.reduce((sum,h)=>sum + ((+h.shares||0)*(+h.livePrice||0)),0);
const rows = holdings.map(h=>{
  const value=(+h.shares||0)*(+h.livePrice||0); const weight=total? value/total*100:0;
  return {...h,value,weight};
}).sort((a,b)=>b.weight-a.weight);
const holdingPressure = bullets(section('Holdings review and pressure'));
const opportunityText = section('Opportunity scout / candidates');
const opportunityBullets = bullets(opportunityText);
const rebalanceBullets = bullets(section('Rebalance / action watch'));
const caveats = section('Caveats / confidence');
const brokeragePolicy = [
  ['No full login', 'Do not give reusable Robinhood credentials or unattended account access.'],
  ['Use read-only inputs', 'Screenshots/CSV/manual fields are enough for better judgment.'],
  ['Needed fields', 'Ticker, shares, average cost, current value, unrealized P/L, weight, optional buying power.'],
  ['Allowed output', 'Signals, sizing notes, rebalance ideas, tactical trackers. No execution.'],
  ['If supervised', 'You stay present, log in yourself, and only portfolio pages are reviewed.']
];
const conlPolicy = [
  ['Frame', 'Tactical swing instrument — not a loss-recovery button.'],
  ['Entry watch', '8.20–8.60 only with COIN/BTC/risk-tone confirmation.'],
  ['Take-profit review', '9.40–10.00 unless a real breakout catalyst appears.'],
  ['Invalidation', 'Close below 8.00 = warning; 7.70–7.80 break = hard review.'],
  ['Time stop', 'Review after 2–5 trading days because 2x daily products decay/path-depend.']
];
function signalClass(signal=''){
  if(/EXIT|TRIM|High risk|Fragile/i.test(signal)) return 'danger';
  if(/INVESTIGATE|WATCH/i.test(signal)) return 'warn';
  if(/ADD|HOLD/i.test(signal)) return 'good';
  return '';
}
function cardList(items, limit=6){
  return items.slice(0,limit).map(x=>`<li>${e(x)}</li>`).join('');
}
const topActions = [
  {k:'Read first', v:'Concentration: SPY + AMZN + BMNR + META ≈ 86.7%', c:'warn'},
  {k:'CONL mode', v:'Tactical tracker only; do not average blindly', c:'danger'},
  {k:'Add watch', v:'NVDA · VST · GOOGL', c:'good'},
  {k:'Need data', v:'Cost basis + unrealized P/L from Robinhood export/screenshot', c:'warn'}
];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Capital Radar — Scan Dashboard</title><style>
:root{--bg:#080806;--panel:#14120d;--panel2:#1b170f;--ink:#f7edd8;--muted:#a99d86;--rule:#352d1f;--gold:#d8a84a;--green:#62d795;--red:#ff756c;--blue:#85bdff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 10% 0,#2b2414,#080806 42%,#030302);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif}.shell{max-width:1360px;margin:auto;padding:22px clamp(14px,3vw,42px) 70px}.top{position:sticky;top:0;z-index:20;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:12px 0;background:rgba(8,8,6,.86);backdrop-filter:blur(16px);border-bottom:1px solid rgba(216,168,74,.22)}.brand{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:var(--gold);font-weight:900}.nav{display:flex;gap:8px;flex-wrap:wrap}.nav a{color:var(--muted);text-decoration:none;border:1px solid var(--rule);border-radius:999px;padding:7px 10px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}.hero{display:grid;grid-template-columns:1.2fr .8fr;gap:18px;align-items:end;padding:38px 0 20px}h1{font:500 clamp(46px,7vw,96px)/.88 Georgia,serif;letter-spacing:-.075em;margin:0 0 12px}.lede{font-size:18px;max-width:760px;color:#dfd3bd;line-height:1.55}h2{font:500 clamp(24px,3vw,40px)/1 Georgia,serif;letter-spacing:-.04em;margin:0 0 14px}h3{font-size:12px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 8px}.grid{display:grid;gap:14px}.priority{grid-template-columns:repeat(4,minmax(0,1fr));margin-bottom:16px}.tile,.panel,.holding,.mini{border:1px solid var(--rule);background:linear-gradient(180deg,rgba(255,255,255,.06),rgba(255,255,255,.022));border-radius:20px;padding:17px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.tile span,.label{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.tile strong{display:block;font-size:20px;line-height:1.2;margin-top:8px}.good{color:var(--green)!important}.warn{color:var(--gold)!important}.danger{color:var(--red)!important}.blue{color:var(--blue)!important}.layout{display:grid;grid-template-columns:360px 1fr;gap:16px}.sticky{position:sticky;top:62px;align-self:start}.panel{margin-bottom:16px}.toc{display:grid;gap:8px}.toc a{text-decoration:none;color:var(--ink);border:1px solid var(--rule);background:rgba(255,255,255,.03);border-radius:14px;padding:12px;display:flex;justify-content:space-between;gap:10px}.toc small{color:var(--muted)}.holdings{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.holding{padding:15px}.ticker{display:flex;justify-content:space-between;gap:10px;align-items:start}.ticker b{font-size:26px}.badge{font-size:10px;text-transform:uppercase;letter-spacing:.08em;border:1px solid var(--rule);border-radius:999px;padding:6px 8px;color:var(--gold);font-weight:900;white-space:nowrap}.rows{margin-top:10px}.row{display:flex;justify-content:space-between;gap:12px;border-top:1px solid #2c261b;padding-top:7px;margin-top:7px;color:#dfd3bd;font-size:13px}.bar{height:8px;border-radius:999px;background:#272116;overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--blue));border-radius:999px}.focus-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.mini strong{display:block;font-size:18px;margin-bottom:6px}.mini p,.holding p{color:#dcd0bb;line-height:1.45;margin:9px 0 0;font-size:13px}ul{margin:0;padding-left:18px}li{color:#dfd3bd;line-height:1.45;margin-bottom:8px}.decision{display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:start;border-top:1px solid var(--rule);padding-top:12px;margin-top:12px}.decision b{color:var(--gold)}details{border:1px solid var(--rule);border-radius:16px;padding:13px;margin-top:10px;background:rgba(255,255,255,.025)}summary{cursor:pointer;color:var(--gold);font-weight:900;font-size:12px;text-transform:uppercase;letter-spacing:.1em}p{color:#dfd3bd;line-height:1.55}a{color:var(--gold)}@media(max-width:1050px){.hero,.layout{grid-template-columns:1fr}.sticky{position:static}.priority,.focus-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.priority,.focus-grid{grid-template-columns:1fr}.nav{display:none}.shell{padding-inline:12px}}
</style></head><body><main class="shell"><div class="top"><div class="brand">OpenClaw Capital Radar</div><nav class="nav"><a href="#read-first">Read first</a><a href="#holdings">Holdings</a><a href="#conl">CONL</a><a href="#ideas">Ideas</a><a href="#brokerage">Brokerage</a></nav></div><header class="hero"><div><h1>Capital Radar</h1><p class="lede">Scan-first investment dashboard. Read the cards you care about; expand details only when you need the reasoning. Research only — no automatic trades.</p></div><div class="tile"><span>Last update</span><strong>${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET</strong><span style="margin-top:10px">Current run: premarket review</span></div></header><section id="read-first" class="grid priority">${topActions.map(x=>`<article class="tile"><span>${e(x.k)}</span><strong class="${x.c}">${e(x.v)}</strong></article>`).join('')}</section><div class="layout"><aside class="sticky"><section class="panel"><h2>Only read what you need</h2><div class="toc"><a href="#holdings"><span>Holdings</span><small>positions/weights</small></a><a href="#conl"><span>CONL</span><small>tactical range</small></a><a href="#ideas"><span>New tickers</span><small>watch candidates</small></a><a href="#brokerage"><span>Robinhood data</span><small>safe inputs</small></a><a href="#detail"><span>Why</span><small>expanded notes</small></a></div></section><section class="panel"><h2>Snapshot</h2><div class="decision"><b>Portfolio</b><span>$${Math.round(total).toLocaleString()} est. · ${holdings.length} holdings</span></div><div class="decision"><b>Largest</b><span>${e(rows[0]?.ticker)} ${rows[0]?.weight.toFixed(1)}%</span></div><div class="decision"><b>Risk</b><span>Concentration + leveraged products</span></div></section></aside><section><section id="holdings" class="panel"><h2>Holdings / ticker cards</h2><div class="grid holdings">${rows.map(h=>`<article class="holding"><div class="ticker"><b>${e(h.ticker)}</b><span class="badge ${signalClass(h.signal)}">${e(h.signal)}</span></div><div class="rows"><div class="row"><span>Shares</span><strong>${e(h.shares)}</strong></div><div class="row"><span>Price</span><strong>$${(+h.livePrice||0).toFixed(2)}</strong></div><div class="row"><span>Value</span><strong>$${Math.round(h.value).toLocaleString()}</strong></div><div class="row"><span>Weight</span><strong>${h.weight.toFixed(1)}%</strong></div></div><div class="bar"><i style="width:${Math.min(100,h.weight*1.8).toFixed(1)}%"></i></div><p>${e(h.health)} · ${e(h.actionRationale || h.thesis || '')}</p></article>`).join('')}</div></section><section id="conl" class="panel"><h2>CONL tactical tracker</h2><div class="grid focus-grid">${conlPolicy.map(([k,v],i)=>`<article class="mini"><span class="label">${i+1}</span><strong class="${i===0||i===3?'danger':i===1||i===2?'warn':'blue'}">${e(k)}</strong><p>${e(v)}</p></article>`).join('')}</div></section><section id="ideas" class="panel"><h2>New ticker watchlist</h2><div class="grid focus-grid"><article class="mini"><strong class="good">NVDA</strong><p>AI infrastructure bellwether; watch China/export-policy catalyst and crowded expectations.</p></article><article class="mini"><strong class="good">VST</strong><p>Power/data-center demand thesis; avoid duplicating too much CEG/AI-power factor.</p></article><article class="mini"><strong class="good">GOOGL</strong><p>Quality AI/platform exposure not directly held outside SPY; antitrust/capex risk.</p></article></div><details><summary>More candidate notes</summary><ul>${cardList(opportunityBullets,9)}</ul></details></section><section id="brokerage" class="panel"><h2>Robinhood / brokerage data policy</h2><div class="grid focus-grid">${brokeragePolicy.map(([k,v],i)=>`<article class="mini"><strong class="${i===0||i===4?'danger':i===1||i===2?'warn':'good'}">${e(k)}</strong><p>${e(v)}</p></article>`).join('')}</div></section><section id="detail" class="panel"><h2>Expanded detail — optional</h2><details open><summary>Holdings pressure</summary><ul>${cardList(holdingPressure,12)}</ul></details><details><summary>Rebalance/action watch</summary><ul>${cardList(rebalanceBullets,8)}</ul></details><details><summary>Caveats/confidence</summary><p>${e(caveats)}</p></details></section><p class="label">Full dashboard: <a href="/">root dashboard</a> · Markdown report: <a href="/outputs/live-capital-radar.md">live-capital-radar.md</a></p></section></div></main></body></html>`;
for (const rel of ['outputs/capital-radar-current.html','public/outputs/capital-radar-current.html']) {
  const out = path.join(root, rel); fs.mkdirSync(path.dirname(out), {recursive:true}); fs.writeFileSync(out, html);
}
console.log('built scan-first current review');
