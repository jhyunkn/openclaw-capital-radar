const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requestedIndexPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath = path.isAbsolute(requestedIndexPath) ? requestedIndexPath : path.join(root, requestedIndexPath);
if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const style = `<style id="relationship-intelligence-style">
.relationship-intelligence{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:#ffffff;padding:34px 0}.ri-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto;border:1px solid var(--rule);background:#ffffff;padding:28px}.ri-kicker,.ri-cell span,.ri-read span,.ri-lib span,.ri-current span,.ri-analog-card span{display:block;color:var(--muted);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.16em}.ri-head{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:24px;border-bottom:1px solid var(--rule);padding-bottom:20px}.ri-title{font-size:clamp(38px,4.8vw,64px);line-height:.94;letter-spacing:-.075em;margin:10px 0 0;font-weight:500;color:var(--ink)}.ri-copy{max-width:820px;color:rgba(36,35,31,.68);font-size:15px;line-height:1.48;margin-top:14px}.ri-current{border:1px solid var(--rule);padding:16px;background:rgba(255,255,255,.25)}.ri-current b{display:block;font-size:25px;line-height:1;letter-spacing:-.05em;margin-top:10px;font-weight:500;color:var(--ink)}.ri-mode{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;border-top:1px solid var(--rule);margin-top:16px;padding-top:12px}.ri-body{display:grid;grid-template-columns:260px minmax(0,1fr) 300px;gap:16px;margin-top:16px}.ri-lib,.ri-read,.ri-cell,.ri-chart{border:1px solid var(--rule);background:rgba(255,255,255,.20)}.ri-lib{padding:16px}.ri-row{display:grid;grid-template-columns:.9fr 1.2fr 52px 28px;gap:6px;align-items:center;border-bottom:1px solid var(--rule);padding:8px 0}.ri-row:last-child{border-bottom:0}.ri-row b{font-size:14px;font-weight:400;color:var(--ink)}.ri-row strong{font-family:var(--mono,monospace);font-size:11px;color:var(--ink);font-weight:400}.ri-chart{height:470px;background:#ffffff}.ri-svg{width:100%;height:100%;display:block}.ri-gridline{stroke:rgba(120,113,108,.42);stroke-dasharray:4 8}.ri-median{stroke:rgba(87,83,78,.36);stroke-dasharray:8 8}.ri-analog{stroke:rgba(124,45,18,.25)}.ri-line-a{fill:none;stroke:rgba(28,25,23,.98);stroke-width:2.8}.ri-line-b{fill:none;stroke:rgba(124,45,18,.9);stroke-width:2.2;stroke-dasharray:6 5}.ri-line-c{fill:none;stroke:rgba(120,113,108,.9);stroke-width:2.2;stroke-dasharray:2 5}.ri-dot-a{fill:rgba(28,25,23,.98)}.ri-dot-b{fill:rgba(124,45,18,.9)}.ri-dot-c{fill:rgba(120,113,108,.9)}.ri-svg text{font-size:10px;fill:rgba(87,83,78,.78)}.ri-under{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:10px}.ri-cell{padding:12px}.ri-cell b{display:block;font-size:16px;line-height:1;letter-spacing:-.04em;font-weight:400;margin-top:8px;color:var(--ink)}.ri-cell small{display:block;color:var(--muted);font-family:var(--mono,monospace);font-size:9px;text-transform:uppercase;letter-spacing:.1em;margin-top:8px;line-height:1.3}.ri-reads{display:grid;gap:8px;align-content:start}.ri-read{padding:16px;background:#ffffff}.ri-read b{display:block;font-size:22px;line-height:1;letter-spacing:-.05em;margin-top:8px;font-weight:400;color:var(--ink)}.ri-read p{color:rgba(87,83,78,.86);font-size:13px;line-height:1.42;margin:9px 0 0}.ri-layers{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-top:16px;border-top:1px solid var(--rule);padding-top:16px}.ri-analogs-wrap{margin-top:16px;border-top:1px solid var(--rule);padding-top:16px}.ri-analogs-head{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:12px}.ri-analogs-head h3{font-size:28px;line-height:1;letter-spacing:-.05em;font-weight:500;margin:4px 0 0;color:var(--ink)}.ri-analogs-head p{max-width:430px;text-align:right;color:var(--muted);font-size:12px;line-height:1.55;margin:0}.ri-analogs{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.ri-analog-card{border:1px solid var(--rule);background:rgba(255,255,255,.20);padding:12px}.ri-analog-card b{display:block;font-size:16px;line-height:1;letter-spacing:-.04em;font-weight:400;margin-top:8px;color:var(--ink)}.ri-analog-card p{font-size:12px;color:rgba(87,83,78,.86);line-height:1.45;margin:8px 0 0}@media(max-width:1050px){.ri-head,.ri-body{grid-template-columns:1fr}.ri-under,.ri-layers,.ri-analogs{grid-template-columns:repeat(2,1fr)}.ri-analogs-head{display:block}.ri-analogs-head p{text-align:left;margin-top:8px}}@media(max-width:620px){.ri-under,.ri-layers,.ri-analogs,.ri-mode{grid-template-columns:1fr}.ri-chart{height:330px}.ri-title{font-size:40px}.ri-wrap{padding:18px}}
</style>`;

const library = [
  ['Duration','Real Yield','82','↑'],['FX','DXY','76','↑'],['Credit','HY OAS','41','→'],['Volatility','VIX','34','↓'],['Commodities','Copper','88','↑'],['Real Assets','Housing','91','→'],['Liquidity','Global M2','57','↑'],['Risk','Nasdaq','73','↑'],['Hedge','Gold','69','↑']
];
const reads = [
  ['Divergence','+0.62 spread','Real yield ↑ while Nasdaq ↑'],
  ['Non-confirmation','41 pct','Credit spread not widening'],
  ['Pressure','76 / 82','DXY + real yield both upper range'],
  ['Analog','91 / 74 / 68','2022 strongest modern match; 1969–70 and 1973–74 in long-history queue']
];
const analogs = [
  ['1907','Banking panic','Liquidity / credit seizure','partial'],
  ['1929–32','Depression break','Credit collapse / deflation','partial'],
  ['1946–51','Postwar inflation','Debt ceiling + inflation','partial'],
  ['1969–70','Tight money slowdown','Rates + equity compression','usable'],
  ['1973–74','Oil shock','Inflation + recession','usable'],
  ['1980–82','Volcker shock','Real-rate reset','usable'],
  ['1998','LTCM / dollar stress','Funding stress','good'],
  ['2000–02','Dot-com unwind','Equity leadership break','good'],
  ['2008','GFC','Collateral + credit collapse','good'],
  ['2020','COVID liquidity shock','Policy flood','good'],
  ['2022','Inflation shock','Real-yield repricing','good']
];

const row = r => `<div class="ri-row"><span>${r[0]}</span><b>${r[1]}</b><strong>${r[2]}</strong><b>${r[3]}</b></div>`;
const read = r => `<article class="ri-read"><span>${r[0]}</span><b>${r[1]}</b><p>${r[2]}</p></article>`;
const cell = r => `<article class="ri-cell"><span>${r[0]}</span><b>${r[1]}</b><small>${r[2]}</small></article>`;
const analogCard = r => `<article class="ri-analog-card"><span>${r[0]} · ${r[3]}</span><b>${r[1]}</b><p>${r[2]}</p></article>`;

const chart = `<div class="ri-chart"><svg class="ri-svg" viewBox="0 0 590 232" preserveAspectRatio="none"><line x1="24" x2="560" y1="54" y2="54" class="ri-gridline"/><line x1="24" x2="560" y1="104" y2="104" class="ri-gridline"/><line x1="24" x2="560" y1="154" y2="154" class="ri-gridline"/><line x1="66" x2="66" y1="22" y2="202" class="ri-analog"/><text x="71" y="36">1929</text><line x1="128" x2="128" y1="22" y2="202" class="ri-analog"/><text x="133" y="36">1974</text><line x1="226" x2="226" y1="22" y2="202" class="ri-analog"/><text x="231" y="36">1982</text><line x1="318" x2="318" y1="22" y2="202" class="ri-analog"/><text x="323" y="36">2008</text><line x1="402" x2="402" y1="22" y2="202" class="ri-analog"/><text x="407" y="36">2020</text><line x1="484" x2="484" y1="22" y2="202" class="ri-analog"/><text x="489" y="36">2022</text><line x1="24" x2="560" y1="118" y2="118" class="ri-median"/><text x="28" y="112">normalized median</text><polyline points="22,148.5 65.2,135 108.4,157.5 157,121.5 205.6,117 254.2,99 302.8,114.75 351.4,94.5 400,103.5 448.6,87.75 497.2,94.5 562,78.75" class="ri-line-a"/><polyline points="22,162 65.2,153 108.4,139.5 157,166.5 205.6,148.5 254.2,173.25 302.8,155.25 351.4,180 400,171 448.6,189 497.2,182.25 562,198" class="ri-line-b"/><polyline points="22,119.25 65.2,126 108.4,130.5 157,108 205.6,112.5 254.2,105.75 302.8,117 351.4,114.75 400,123.75 448.6,119.25 497.2,121.5 562,126" class="ri-line-c"/><circle cx="562" cy="78.75" r="5" class="ri-dot-a"/><circle cx="562" cy="198" r="4" class="ri-dot-b"/><circle cx="562" cy="126" r="4" class="ri-dot-c"/><text x="390" y="62" class="ri-label-a">Real yield: 82 pct ↑</text><text x="390" y="190" class="ri-label-b">Nasdaq: 73 pct ↑</text><text x="390" y="132" class="ri-label-c">Credit stress: 41 pct →</text><text x="28" y="220">Mode: percentile-normalized overlay · same timeline · annotations generated from divergence / convergence</text></svg></div>`;

const section = `<section class="relationship-intelligence" id="relationship-intelligence"><div class="ri-wrap"><div class="ri-head"><div><p class="ri-kicker">Relational overlay workspace</p><h2 class="ri-title">Any asset class can be tested against any other asset class.</h2><p class="ri-copy">The power of a larger data universe is not more boxes. It is more possible relationships across a longer memory. The workspace normalizes selected series onto one timeline, marks historical regimes from the 1900s through today, and detects divergence, convergence, non-confirmation, and regime similarity.</p></div><aside class="ri-current"><span>Current comparison</span><b>Real Yield vs Nasdaq vs Credit Stress</b><div class="ri-mode"><span>Percentile</span><span>Indexed</span><span>Same timeline</span></div></aside></div><div class="ri-body"><aside class="ri-lib"><span>Asset-class library</span>${library.map(row).join('')}</aside><main>${chart}<div class="ri-under">${[['Primary','Real Yield','82 pct ↑'],['Overlay A','Nasdaq','73 pct ↑'],['Overlay B','Credit Stress','41 pct →'],['Closest marker','2022','visual analog']].map(cell).join('')}</div></main><aside class="ri-reads">${reads.map(read).join('')}</aside></div><div class="ri-layers">${[['Layer 1','Asset classes','Ground truth'],['Layer 2','Relationship overlay','Comparison'],['Layer 3','Configuration','Synthesis'],['Layer 4','Historical analog','Memory'],['Layer 5','Portfolio translation','Action']].map(cell).join('')}</div><div class="ri-analogs-wrap"><div class="ri-analogs-head"><div><p class="ri-kicker">Historical analog library</p><h3>Long memory, evidence quality disclosed.</h3></div><p>Pre-1960 periods are useful but must be labeled partial because some modern series did not exist. The analog engine compares available proxies rather than pretending the evidence is identical.</p></div><div class="ri-analogs">${analogs.map(analogCard).join('')}</div></div></div></section>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="relationship-intelligence-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="relationship-intelligence" id="relationship-intelligence">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
const evidence = html.indexOf('id="evidence-annotation-layer"');
if (evidence >= 0) {
  const end = html.indexOf('</section>', evidence);
  html = html.slice(0, end + 10) + section + html.slice(end + 10);
} else {
  const heroEnd = html.indexOf('</section>');
  html = html.slice(0, heroEnd + 10) + section + html.slice(heroEnd + 10);
}
fs.writeFileSync(indexPath, html);
if (!html.includes('id="relationship-intelligence"')) throw new Error('Relationship intelligence injection verification failed');
console.log(`injected relational overlay workspace into ${path.relative(root, indexPath)}`);
