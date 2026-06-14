const fs = require('fs');
const path = require('path');
const root = path.join('projects','financial-report');
const pages = path.join(root,'pages');
fs.mkdirSync(pages,{recursive:true});

const holdings = [
  ['MSFT',3,'Core AI/cloud compounder','HOLD','Core Hold','AI infrastructure + enterprise software durability','Valuation compression, capex intensity, antitrust'],
  ['AMZN',33.31,'Cloud + consumer operating leverage','HOLD','Core Hold','AWS acceleration, retail margin discipline, ad growth','Consumer slowdown, AWS competition, fulfillment cost'],
  ['CEG',3,'Power / AI grid infrastructure','HOLD / WATCH','Watch Closely','Data-center electricity demand, nuclear scarcity, power contracts','Crowded AI-power narrative, regulation, valuation stretch'],
  ['META',8.33,'Ads + AI distribution platform','HOLD','Core Hold','Ad engine resilience, AI engagement, operating leverage','AI capex, regulatory pressure, metaverse spend creep'],
  ['TSLT',15,'Levered TSLA-linked income/speculation','TRIM WATCH','Rebalance Watch','Tactical volatility income only','Decay, path dependency, TSLA volatility, misunderstood yield'],
  ['CONL',40,'Levered crypto beta','EXIT REVIEW','Exit Review','Crypto liquidity upside via Coinbase beta','Leverage decay, crypto drawdowns, correlated risk'],
  ['SPY',43.23,'Core market beta baseline','HOLD','Anchor Hold','Default benchmark and opportunity-cost anchor','Index concentration, market regime drawdown'],
  ['MA',4.01,'Quality payments compounder','HOLD','Core Hold','Secular payments, pricing power, high margin network','Consumer stress, regulation, valuation'],
  ['BMNR',340,'Speculative / needs thesis verification','INVESTIGATE','Investigate','Potential asymmetry if thesis is real','Information quality, liquidity, thesis uncertainty'],
  ['TSNF',40,'Speculative / needs thesis verification','INVESTIGATE','Investigate','Potential asymmetry if thesis is real','Information quality, liquidity, thesis uncertainty'],
  ['NFLX',25,'Media subscription compounder','HOLD / WATCH','Watch Closely','Pricing power, ad tier, content scale','Expectation reset, competition, consumer fatigue']
];

const css = `
:root{--ink:#14120e;--muted:#6f665b;--paper:#f5efe3;--card:#fffaf1;--rule:#d5c8b5;--night:#11100d;--amber:#a06f25;--green:#217a50;--red:#a64739;--blue:#285e8f;--soft:#ece1cf;--sans:Inter,Arial,sans-serif;--serif:Georgia,'Times New Roman',serif}*{box-sizing:border-box}body{margin:0;background:var(--paper);color:var(--ink);font-family:var(--sans)}a{color:inherit}.page{max-width:1320px;margin:0 auto;padding:28px clamp(18px,4vw,56px) 56px}.top{display:flex;justify-content:space-between;gap:18px;flex-wrap:wrap;border-bottom:1px solid var(--rule);padding-bottom:12px;font:900 11px/1.4 var(--sans);letter-spacing:.14em;text-transform:uppercase;color:var(--muted)}.mast{display:grid;grid-template-columns:minmax(0,1.2fr) 360px;gap:36px;align-items:end;padding:42px 0 32px;border-bottom:1px solid var(--rule)}h1{font:500 clamp(46px,7vw,92px)/.9 var(--serif);letter-spacing:-.065em;margin:0}h2{font:500 clamp(28px,3vw,42px)/1.04 var(--serif);letter-spacing:-.04em;margin:0 0 14px}h3{font:900 13px/1.35 var(--sans);letter-spacing:.09em;text-transform:uppercase;margin:0 0 8px}p{font:15px/1.7 var(--sans);margin:0;color:#342f29}.dek{font-size:18px;max-width:780px;margin-top:18px}.stamp,.dark{background:var(--night);color:white}.stamp{padding:22px}.stamp strong{font:500 44px/1 var(--serif);display:block}.stamp span{display:block;margin-top:10px;color:#cfc4b4;font:800 11px/1.55 var(--sans);letter-spacing:.13em;text-transform:uppercase}.nav{display:flex;gap:16px;flex-wrap:wrap;padding:15px 0 30px}.nav a{font:900 11px/1 var(--sans);letter-spacing:.12em;text-transform:uppercase;text-decoration:none;border-bottom:1px solid var(--ink)}.panel{background:var(--card);border:1px solid var(--rule);padding:clamp(20px,2.8vw,30px);margin-bottom:24px}.dark{border-color:var(--night)}.dark p{color:#d8cfc2}.kicker{font:900 10px/1.4 var(--sans);letter-spacing:.16em;text-transform:uppercase;color:var(--amber);margin-bottom:11px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:24px}.thirds{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}.card{background:#ffffff;border:1px solid var(--rule);padding:16px}.card a{text-decoration:none}.ticker{display:flex;justify-content:space-between;gap:8px}.ticker strong{font:900 20px/1 var(--sans)}.ticker span{font:800 11px/1;color:var(--muted)}.action{font:900 20px/1.1 var(--sans);letter-spacing:-.02em;margin:14px 0 8px;text-transform:uppercase}.row{display:flex;justify-content:space-between;gap:10px;border-top:1px solid #e5dac9;margin-top:10px;padding-top:8px;font-size:12px}.pill{display:inline-block;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;font:900 10px/1 var(--sans);letter-spacing:.08em;text-transform:uppercase;background:#fff}.hold{color:var(--green)}.watch{color:var(--amber)}.risk{color:var(--red)}.map{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:18px}.node{min-height:118px;border:1px solid rgba(255,255,255,.25);padding:13px;background:rgba(255,255,255,.06)}.node strong{display:block;font:900 12px/1.3 var(--sans);text-transform:uppercase;letter-spacing:.1em}.node em{font-style:normal;display:block;font:500 28px/1 var(--serif);margin:10px 0}.node p{font-size:12px;color:#d8cfc2}.strategy{border-left:5px solid var(--amber);padding-left:16px}.big{font:500 30px/1.1 var(--serif);letter-spacing:-.03em}.table{display:grid;gap:10px}.line{display:grid;grid-template-columns:130px 1fr 120px;gap:14px;border-top:1px solid var(--rule);padding-top:12px}.summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:18px}.summary .box{background:#ffffff;border:1px solid var(--rule);padding:14px}.summary strong{display:block;font:500 28px/1 var(--serif)}.summary span{font:900 10px/1.4 var(--sans);letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.footer{border-top:1px solid var(--rule);margin-top:34px;padding-top:14px;font:12px/1.6 var(--sans);color:var(--muted)}@media(max-width:960px){.mast,.grid,.thirds{grid-template-columns:1fr}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.map{grid-template-columns:repeat(2,minmax(0,1fr))}.summary{grid-template-columns:repeat(2,minmax(0,1fr))}.line{grid-template-columns:1fr}}@media(max-width:560px){.cards,.map,.summary{grid-template-columns:1fr}}
`;

function shell(title, body){return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title><style>${css}</style></head><body><main class="page">${body}</main></body></html>`}
function cls(signal){return signal.includes('EXIT')||signal.includes('TRIM')?'risk':signal.includes('WATCH')||signal.includes('INVEST')?'watch':'hold'}

const holdingsDashboard = `
<section id="dashboard" class="panel">
  <div class="kicker">Front page · Jun's current holdings dashboard</div>
  <h2>Portfolio action buckets first. Market movement comes underneath as context.</h2>
  <p>The front page should immediately answer: what do I own, what action bucket is each position in, and which positions deserve attention today?</p>
  <div class="summary"><div class="box"><span>Core positions</span><strong>Hold</strong></div><div class="box"><span>Speculative risk</span><strong>Review</strong></div><div class="box"><span>Portfolio action</span><strong>Rebalance</strong></div><div class="box"><span>Highest review</span><strong>CONL</strong></div></div>
  <div class="cards" style="margin-top:18px">${holdings.map(h=>`<div class="card"><a href="pages/${h[0].toLowerCase()}.html"><div class="ticker"><strong>${h[0]}</strong><span>${h[1]} sh</span></div><div class="action ${cls(h[3])}">${h[4]}</div><div class="row"><span>Role</span><b>${h[2]}</b></div><div class="row"><span>Signal</span><b class="${cls(h[3])}">${h[3]}</b></div><div class="row"><span>Open page</span><b>→</b></div></a></div>`).join('')}</div>
</section>`;

const marketMap = `
<section id="map" class="panel dark">
  <div class="kicker">Below dashboard · AI Market Movement Map</div>
  <h2>Market movement is shown as a force field underneath the holdings dashboard.</h2>
  <p>This map should be generated each morning from live price action plus macro/news interpretation. It supports find/risk management by showing which forces help or threaten the holdings above.</p>
  <div class="map">
    <div class="node"><strong>Liquidity</strong><em>Neutral</em><p>Fed path, dollar, Bitcoin liquidity, credit spreads.</p></div>
    <div class="node"><strong>Rates</strong><em>Pressure</em><p>10Y movement affects tech duration, housing, REITs, speculative growth.</p></div>
    <div class="node"><strong>AI Infrastructure</strong><em>Hot</em><p>Power, cloud, semis, data centers. Watch crowding.</p></div>
    <div class="node"><strong>Energy / Oil</strong><em>Volatile</em><p>Inflation input and geopolitical risk proxy.</p></div>
    <div class="node"><strong>Credit</strong><em>Watch</em><p>Private credit, regional banks, spreads, default warnings.</p></div>
    <div class="node"><strong>Crypto Beta</strong><em>Fragile</em><p>High upside but liquidity-sensitive and correlated with risk-on.</p></div>
    <div class="node"><strong>Consumer</strong><em>Mixed</em><p>Payments, retail, streaming, discretionary pressure.</p></div>
    <div class="node"><strong>Defensive Quality</strong><em>Underbid</em><p>Potential rotation zone if risk appetite weakens.</p></div>
  </div>
</section>`;

const index = shell('OpenClaw Capital Radar · Multi-page Prototype', `
<div class="top"><div>OpenClaw Capital Radar</div><div>Financial Report · 8:30 AM ET · Separate from Morning Brief</div></div>
<header class="mast"><div><h1>Capital Radar</h1><p class="dek">A multi-page financial synthesis system. Front page starts with Jun’s current holdings and ratings, then shows market movement below as the landscape that explains opportunity and risk.</p></div><aside class="stamp"><strong>8:30 AM</strong><span>Trading days<br>America/New_York<br>market-open synthesis</span></aside></header>
<nav class="nav"><a href="#dashboard">Holdings Dashboard</a><a href="#map">Market Map</a><a href="#strategy">Strategy</a><a href="#scout">Opportunity Scout</a><a href="#risk">Risk Committee</a></nav>
${holdingsDashboard}
${marketMap}
<section id="strategy" class="panel"><div class="kicker">Strategy layer</div><h2>Strategy reads from the dashboard + market map together.</h2><div class="thirds"><div class="strategy"><h3>Preserve</h3><p>Use when weak holdings overlap with fragile market forces. Reduce levered decay and protect core.</p></div><div class="strategy"><h3>Compound</h3><p>Use when high-rated holdings align with constructive market forces and improving expectations.</p></div><div class="strategy"><h3>Exploit</h3><p>Use when market map reveals dislocation or underpriced asymmetry; still risk-officer checked.</p></div></div></section>
<section id="scout" class="panel"><div class="kicker">Opportunity Scout</div><h2>Finds come from the market map, not random stock lists.</h2><p>The scout should identify 10 candidates from the day’s active force fields: overlooked compounders, revision inflections, valuation resets, cyclical troughs, regulatory winners, insider accumulation, special situations, and picks-and-shovels exposure.</p></section>
<section id="risk" class="panel"><div class="kicker">Risk Committee</div><h2>Every rating needs a bear case.</h2><p>For each holding page and each candidate: what is priced in, what breaks thesis, is this edge or crowded narrative, is it better than SPY, and does it increase hidden correlation?</p></section>
<footer class="footer">Multi-page prototype · holdings dashboard first · market map below · sample values only · Financial Report at 8:30 AM ET · Morning Brief remains 6:00 AM ET.</footer>
`);
fs.writeFileSync(path.join(root,'index.html'), index);

for (const h of holdings) {
  const [ticker, shares, role, signal, status, thesis, risk] = h;
  const c = cls(signal);
  const body = `<div class="top"><div><a href="../index.html">← Capital Radar</a></div><div>${ticker} · dedicated holding analysis</div></div>
<header class="mast"><div><h1>${ticker}</h1><p class="dek">${role}. Dedicated page for thesis, strategy, valuation, material news, cycle sensitivity, risk triggers, and decision record.</p></div><aside class="stamp"><strong>${status}</strong><span>${shares} shares<br>Signal: ${signal}</span></aside></header>
<nav class="nav"><a href="#strategy">Strategy</a><a href="#thesis">Thesis</a><a href="#news">News</a><a href="#valuation">Valuation</a><a href="#risk">Risk</a><a href="#decision">Decision</a></nav>
<section id="strategy" class="panel"><div class="kicker">Position Strategy</div><h2 class="${c}">${signal}</h2><p class="big">${thesis}</p><p style="margin-top:14px">Strategy should explain whether this is core compounder, tactical exposure, risk hedge, speculative asymmetry, income/volatility product, or exit-review candidate.</p></section>
<section id="thesis" class="panel"><div class="kicker">Thesis Health</div><div class="grid"><div><h2>Base case</h2><p>${thesis}. Live version states what evidence supports this today and whether expectations improved, weakened, or stayed stable.</p></div><div><h2>Break case</h2><p>${risk}. This section states what would make the holding no longer worth its portfolio slot.</p></div></div></section>
<section id="news" class="panel"><div class="kicker">Materiality-ranked news</div><h2>Only thesis-changing information belongs here.</h2><div class="table"><div class="line"><b>Materiality 0–5</b><p>News / filing / earnings / analyst / regulatory / sector event.</p><span class="pill">Impact</span></div><div class="line"><b>Sample 3</b><p>Relevant but not thesis-changing placeholder. Live report cites source and explains expectation shift.</p><span class="pill">Watch</span></div><div class="line"><b>Sample 5</b><p>Thesis-changing placeholder. Live report escalates only when justified.</p><span class="pill">Escalate</span></div></div></section>
<section id="valuation" class="panel"><div class="kicker">Valuation + expectation analysis</div><h2>Not PE-only.</h2><p>Live fields: trailing PE, forward PE, PEG, EV/EBITDA, FCF yield, revenue growth, margin trend, earnings revision trend, guidance change, and market-implied expectation.</p></section>
<section id="risk" class="panel"><div class="kicker">Risk Officer</div><h2>Bear case before action.</h2><p>What is already priced in? What breaks thesis? Is this crowded? Is it cheap for a reason? Is upside worth downside? Is this better than SPY? Is it too correlated?</p></section>
<section id="decision" class="panel"><div class="kicker">Decision record</div><h2>Current signal: <span class="${c}">${signal}</span></h2><p>Next live version includes confidence, what changed today, what would change tomorrow, and whether this affects rebalance pressure.</p></section>
<footer class="footer">${ticker} analysis page · sample values only · generated for Capital Radar prototype.</footer>`;
  fs.writeFileSync(path.join(pages, `${ticker.toLowerCase()}.html`), shell(`${ticker} · Capital Radar`, body));
}

fs.writeFileSync(path.join(root,'site-map.json'), JSON.stringify({name:'OpenClaw Capital Radar',type:'multi-page prototype',frontPageOrder:['current holdings dashboard with action buckets','AI market movement map','strategy layer','opportunity scout','risk committee'],overview:'index.html',pages:holdings.map(h=>`pages/${h[0].toLowerCase()}.html`),boundary:'Separate from Morning Brief; Morning Brief remains 6:00 AM ET'}, null, 2));
console.log('regenerated dashboard-first prototype with', holdings.length, 'holding pages');
