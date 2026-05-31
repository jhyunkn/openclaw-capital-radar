const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const requestedIndexPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath = path.isAbsolute(requestedIndexPath) ? requestedIndexPath : path.join(root, requestedIndexPath);
if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const style = `<style id="market-diagnosis-style">
.market-diagnosis-board{border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);background:linear-gradient(180deg,rgba(247,243,235,.76),rgba(239,234,224,.42));padding:38px 0}.mdb-wrap{width:min(1240px,calc(100% - 36px));margin:0 auto}.mdb-kicker,.mdb-card span,.mdb-axis span,.mdb-evidence span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.13em}.mdb-hero{display:grid;grid-template-columns:minmax(0,1fr) 360px;gap:22px;border-bottom:1px solid var(--rule);padding-bottom:22px}.mdb-title{font-size:clamp(42px,6vw,88px);line-height:.88;letter-spacing:-.075em;font-weight:500;margin:10px 0 0;color:var(--ink)}.mdb-sub{max-width:760px;color:rgba(36,35,31,.68);font-size:15px;line-height:1.48;margin:15px 0 0}.mdb-diagnosis{border:1px solid var(--rule);background:rgba(255,255,255,.2);padding:18px;display:flex;flex-direction:column;justify-content:space-between;min-height:230px}.mdb-diagnosis b{display:block;font-size:34px;line-height:.96;letter-spacing:-.055em;font-weight:500;margin-top:10px}.mdb-confidence{display:grid;grid-template-columns:1fr auto;gap:10px;align-items:end;border-top:1px solid var(--rule);padding-top:14px;margin-top:18px}.mdb-confidence strong{font-size:42px;line-height:.85;letter-spacing:-.06em;font-weight:500}.mdb-grid{display:grid;grid-template-columns:minmax(0,1.05fr) minmax(320px,.62fr);gap:12px;margin-top:14px}.mdb-card{border:1px solid var(--rule);background:rgba(255,255,255,.17);padding:15px}.mdb-card b{display:block;font-size:22px;line-height:1.02;letter-spacing:-.04em;font-weight:500;margin-top:9px}.mdb-card p{color:rgba(36,35,31,.68);font-size:12px;line-height:1.42;margin:9px 0 0}.mdb-narratives{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.mdb-tensions{display:grid;gap:8px}.mdb-tension{border-color:rgba(164,80,47,.38);background:rgba(164,80,47,.07)}.mdb-axis-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:12px}.mdb-axis{border:1px solid var(--rule);background:rgba(255,255,255,.15);padding:12px}.mdb-axis b{display:block;font-size:19px;line-height:.98;letter-spacing:-.04em;font-weight:500;margin-top:8px}.mdb-bar{height:3px;background:rgba(36,35,31,.13);margin-top:10px;position:relative}.mdb-bar i{position:absolute;left:0;top:0;bottom:0;background:var(--earth);display:block}.mdb-analogs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.mdb-evidence{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;border-top:1px solid var(--rule);padding-top:12px;margin-top:12px}.mdb-evidence b{display:block;font-size:14px;line-height:1.1;font-weight:500;margin-top:7px}@media(max-width:1050px){.mdb-hero,.mdb-grid{grid-template-columns:1fr}.mdb-narratives,.mdb-axis-grid,.mdb-analogs,.mdb-evidence{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.mdb-narratives,.mdb-axis-grid,.mdb-analogs,.mdb-evidence{grid-template-columns:1fr}.mdb-title{font-size:44px}.mdb-diagnosis b{font-size:28px}}
</style>`;

const narratives = [
  ['Dominant narrative','AI infrastructure expansion','Capital is still rewarding power, compute, semiconductors, and enabling infrastructure.'],
  ['Macro condition','Restrictive money, healthy credit','Rates remain a valuation constraint, but credit has not confirmed broad stress.'],
  ['Liquidity offset','Fiscal / liquidity support','Policy and fiscal channels appear to be cushioning the tightening impulse.']
];
const tensions = [
  ['Tension 1','Real yields high, growth strong','A classic valuation headwind is not yet breaking leadership.'],
  ['Tension 2','Dollar firm, risk contained','Funding is not loose, but volatility has not confirmed panic.'],
  ['Tension 3','Physical economy tightening','Power, copper, housing, and energy constraints matter for the next cycle.']
];
const axes = [
  ['Money','Restrictive','82'],['Liquidity','Neutral+','57'],['Funding','Firm','76'],['Credit','Contained','41'],['Risk','Selective','73'],['Physical','Tightening','88']
];
const analogs = [
  ['2022','91','Inflation / real-yield repricing'],['1998','78','Funding stress without immediate collapse'],['1969–70','74','Tight money slowdown'],['1973–74','68','Physical shock candidate']
];
const evidence = [
  ['Evidence','Asset classes'],['Comparison','Relationship overlays'],['Memory','Historical analogs'],['Synthesis','Configuration'],['Action','Portfolio implication']
];

const card = item => `<article class="mdb-card"><span>${item[0]}</span><b>${item[1]}</b><p>${item[2]}</p></article>`;
const axis = item => `<article class="mdb-axis"><span>${item[0]}</span><b>${item[1]}</b><div class="mdb-bar"><i style="width:${item[2]}%"></i></div><p>${item[2]} score</p></article>`;
const analog = item => `<article class="mdb-card"><span>${item[0]} · ${item[1]}%</span><b>${item[0]}</b><p>${item[2]}</p></article>`;
const evidenceCell = item => `<article class="mdb-evidence"><span>${item[0]}</span><b>${item[1]}</b></article>`;

const section = `<section class="market-diagnosis-board" id="market-diagnosis-board"><div class="mdb-wrap"><div class="mdb-hero"><div><p class="mdb-kicker">Market diagnosis board</p><h2 class="mdb-title">What is happening in markets right now?</h2><p class="mdb-sub">This board is the product hierarchy test: compress the evidence universe into one diagnosis, then expose narratives, tensions, historical memory, and evidence trail below it.</p></div><aside class="mdb-diagnosis"><div><span>Current diagnosis</span><b>Restrictive money, resilient risk, tightening physical economy.</b></div><div class="mdb-confidence"><span>Evidence confidence</span><strong>73%</strong></div></aside></div><div class="mdb-grid"><main><div class="mdb-narratives">${narratives.map(card).join('')}</div><div class="mdb-axis-grid">${axes.map(axis).join('')}</div><div class="mdb-analogs">${analogs.map(analog).join('')}</div></main><aside class="mdb-tensions">${tensions.map(item => card([item[0], item[1], item[2]]).replace('mdb-card','mdb-card mdb-tension')).join('')}</aside></div><div class="mdb-evidence">${evidence.map(evidenceCell).join('')}</div></div></section>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="market-diagnosis-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="market-diagnosis-board" id="market-diagnosis-board">[\s\S]*?<\/section>/g, '');
html = html.replace('</head>', style + '</head>');
const relationship = html.indexOf('id="relationship-intelligence"');
const evidenceLayer = html.indexOf('id="evidence-annotation-layer"');
const anchor = evidenceLayer >= 0 ? evidenceLayer : relationship;
if (anchor >= 0) {
  const beforeSection = html.lastIndexOf('<section', anchor);
  html = html.slice(0, beforeSection) + section + html.slice(beforeSection);
} else {
  const heroEnd = html.indexOf('</section>');
  html = html.slice(0, heroEnd + 10) + section + html.slice(heroEnd + 10);
}
fs.writeFileSync(indexPath, html);
if (!html.includes('id="market-diagnosis-board"')) throw new Error('Market diagnosis board injection verification failed');
console.log(`injected market diagnosis board into ${path.relative(root, indexPath)}`);
