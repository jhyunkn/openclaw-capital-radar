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
const currentHoldings = section('Holdings review and pressure');
const opportunity = section('Opportunity scout / candidates');
const rebalance = section('Rebalance / action watch');
const caveats = section('Caveats / confidence');
const holdings = live.holdings || [];
const total = holdings.reduce((sum,h)=>sum + ((+h.shares||0)*(+h.livePrice||0)),0);
const rows = holdings.map(h=>{
  const value=(+h.shares||0)*(+h.livePrice||0); const weight=total? value/total*100:0;
  return {...h,value,weight};
}).sort((a,b)=>b.weight-a.weight);
function mdLines(text){
  return text.split(/\r?\n/).filter(Boolean).map(line=>{
    if(line.startsWith('- ')) return `<li>${e(line.slice(2))}</li>`;
    return `<p>${e(line).replace(/\*\*(.*?)\*\*/g,'<strong>$1</strong>')}</p>`;
  }).join('\n');
}
const brokeragePolicy = [
  'Direct Robinhood login access is not recommended because brokerage sessions can expose balances, bank links, tax documents, transfer controls, trade buttons, settings, and 2FA/session cookies.',
  'Capital Radar should operate from read-only data supplied by Jun: screenshots, CSV/export, or manually copied position fields.',
  'Required fields for better advice: ticker, shares, average cost, current value/price, unrealized gain/loss, portfolio weight, and optional buying power / cash reserve.',
  'Permitted output: HOLD, HOLD / WATCH, ADD WATCH, ADD CANDIDATE, TRIM WATCH, TRIM CANDIDATE, EXIT REVIEW, INVESTIGATE, plus sizing/risk notes.',
  'Not permitted: placing trades, moving money, saving brokerage credentials, navigating transfer/security settings, or unattended brokerage access.',
  'If a supervised browser review is ever necessary, Jun stays present, logs in himself, and the review is limited to read-only portfolio pages.'
];
const conlPolicy = [
  'CONL is a tactical instrument, not a loss-recovery button. It is 2x daily COIN exposure and should not be treated as a long-term passive holding.',
  'Current planning frame: use a small risk bucket only; avoid averaging down blindly below the range.',
  'Range thesis to monitor: possible lower entry zone around 8.20–8.60 only if COIN/BTC/risk tone are stable; scale-out review around 9.40–10.00 unless there is a confirmed breakout catalyst.',
  'Invalidation: daily close below ~8.00 is a warning; break below ~7.70–7.80 with COIN/BTC weakness requires hard review rather than more averaging.',
  'Time stop: reassess after 2–5 trading days because daily leveraged products decay/path-depend when the bounce does not arrive.'
];
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>Capital Radar — Holdings & Current State</title><style>
:root{--bg:#080806;--panel:#14120d;--ink:#f5ead4;--muted:#a99d86;--rule:#352d1f;--gold:#d8a84a;--green:#66d995;--red:#ff756c;--blue:#85bdff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#2a2414,#080806 45%,#030302);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif}.shell{max-width:1280px;margin:auto;padding:28px clamp(14px,4vw,50px) 70px}.top{position:sticky;top:0;z-index:10;background:rgba(8,8,6,.86);backdrop-filter:blur(16px);border-bottom:1px solid rgba(216,168,74,.22);padding:12px 0;display:flex;justify-content:space-between;gap:14px}.brand{font-size:12px;text-transform:uppercase;letter-spacing:.16em;color:var(--gold);font-weight:900}.meta{font-size:12px;color:var(--muted);text-align:right}h1{font:500 clamp(42px,7vw,92px)/.88 Georgia,serif;letter-spacing:-.07em;margin:48px 0 14px}h2{font:500 clamp(25px,3vw,42px)/1 Georgia,serif;letter-spacing:-.04em;margin:0 0 14px}.lede{font-size:18px;max-width:900px;color:#dfd3bd;line-height:1.6}.grid{display:grid;gap:13px}.metrics{grid-template-columns:repeat(4,minmax(0,1fr));margin:24px 0}.metric,.panel,.holding{border:1px solid var(--rule);background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border-radius:20px;padding:18px;box-shadow:0 18px 50px rgba(0,0,0,.22)}.metric span,.label{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:900}.metric strong{display:block;font-size:24px;margin-top:8px}.holdings{grid-template-columns:repeat(auto-fit,minmax(245px,1fr));margin-top:14px}.ticker{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.ticker b{font-size:28px}.signal{display:inline-block;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;color:var(--gold);font-size:11px;font-weight:900;text-transform:uppercase;letter-spacing:.08em}.rows{margin-top:12px}.row{display:flex;justify-content:space-between;border-top:1px solid #2c261b;padding-top:7px;margin-top:7px;color:#dfd3bd;font-size:13px}.bar{height:8px;border-radius:999px;background:#272116;overflow:hidden;margin-top:10px}.bar i{display:block;height:100%;background:linear-gradient(90deg,var(--gold),var(--blue));border-radius:999px}.panel{margin:18px 0}p,li{color:#dfd3bd;line-height:1.58}li{margin-bottom:7px}.warn{color:var(--gold)}.danger{color:var(--red)}a{color:var(--gold)}@media(max-width:850px){.metrics{grid-template-columns:1fr 1fr}.top{display:block}.meta{text-align:left;margin-top:6px}}@media(max-width:540px){.metrics{grid-template-columns:1fr}.shell{padding-inline:12px}}
</style></head><body><main class="shell"><div class="top"><div class="brand">OpenClaw Capital Radar</div><div class="meta">Holdings-first review · generated ${new Date().toLocaleString('en-US',{timeZone:'America/New_York'})} ET</div></div><h1>Capital Radar</h1><p class="lede">Your holdings and ticker information are still here. This page puts them first, then shows the current pre-market interpretation, candidate tickers, brokerage data policy, and rebalance pressure. Research only — no brokerage action.</p><div class="grid metrics"><div class="metric"><span>Portfolio estimate</span><strong>$${Math.round(total).toLocaleString()}</strong></div><div class="metric"><span>Holdings tracked</span><strong>${holdings.length}</strong></div><div class="metric"><span>Largest weight</span><strong>${e(rows[0]?.ticker)} ${rows[0]?.weight.toFixed(1)}%</strong></div><div class="metric"><span>Main pressure</span><strong>Concentration</strong></div></div><section class="panel"><h2>Current holdings / ticker state</h2><div class="grid holdings">${rows.map(h=>`<article class="holding"><div class="ticker"><b>${e(h.ticker)}</b><span class="signal">${e(h.signal)}</span></div><div class="rows"><div class="row"><span>Shares</span><strong>${e(h.shares)}</strong></div><div class="row"><span>Price</span><strong>$${(+h.livePrice||0).toFixed(2)}</strong></div><div class="row"><span>Est. value</span><strong>$${Math.round(h.value).toLocaleString()}</strong></div><div class="row"><span>Weight</span><strong>${h.weight.toFixed(1)}%</strong></div><div class="row"><span>Health</span><strong>${e(h.health)}</strong></div></div><div class="bar"><i style="width:${Math.min(100,h.weight*1.8).toFixed(1)}%"></i></div><p>${e(h.actionRationale || h.thesis || '')}</p></article>`).join('')}</div></section><section class="panel"><h2>Brokerage access / Robinhood data policy</h2><p>Capital Radar should capture the information needed for better judgment without taking unsafe account access.</p><ul>${brokeragePolicy.map(x=>`<li>${e(x)}</li>`).join('')}</ul></section><section class="panel"><h2>CONL tactical tracker</h2><p>This is a current tactical framework to monitor, not an instruction to trade.</p><ul>${conlPolicy.map(x=>`<li>${e(x)}</li>`).join('')}</ul></section><section class="panel"><h2>Today’s holdings pressure</h2>${mdLines(currentHoldings)}</section><section class="panel"><h2>Opportunity scout / new tickers</h2>${mdLines(opportunity)}</section><section class="panel"><h2>Rebalance / action watch</h2>${mdLines(rebalance)}</section><section class="panel"><h2>Caveats / confidence</h2>${mdLines(caveats)}</section><p class="label">Full dashboard: <a href="/">root dashboard</a> · Markdown report: <a href="/outputs/live-capital-radar.md">live-capital-radar.md</a></p></main></body></html>`;
for (const rel of ['outputs/capital-radar-current.html','public/outputs/capital-radar-current.html']) {
  const out = path.join(root, rel); fs.mkdirSync(path.dirname(out), {recursive:true}); fs.writeFileSync(out, html);
}
console.log('built holdings-first current review');
