'use strict';
const fs   = require('fs');
const path = require('path');

const root          = path.join(__dirname, '..');
const requestedPath = process.argv[2] || 'index.html';
const indexPath     = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);
if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

// Idempotent removal — comment-marker block + old section/div variants + style
html = html.replace(/<!-- KH_HISTORY_START -->[\s\S]*?<!-- KH_HISTORY_END -->\s*/g, '');
html = html.replace(/<style id="kostolany-history-style">[\s\S]*?<\/style>\s*/g, '');
for (const tok of ['<section id="kostolany-history-section"', '<div id="kostolany-history-section"']) {
  const closing = tok.startsWith('<section') ? ['<section', '</section>'] : ['<div', '</div>'];
  let si = html.indexOf(tok);
  while (si >= 0) {
    let depth = 0, i = si;
    while (i < html.length) {
      if (html.startsWith(closing[0], i)) { depth++; i += closing[0].length; continue; }
      if (html.startsWith(closing[1], i)) { depth--; if (depth === 0) { i += closing[1].length; break; } i += closing[1].length; continue; }
      i++;
    }
    html = html.slice(0, si) + html.slice(i);
    si = html.indexOf(tok);
  }
}

// ── Style ─────────────────────────────────────────────────────────────────────
const style = `<style id="kostolany-history-style">
.kh-wrap{padding:0 clamp(12px,2vw,20px) 28px;box-sizing:border-box}
.kh-inner{max-width:1240px;margin:0 auto}
.kh-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.38);font-family:var(--mono,monospace);display:block;margin-bottom:6px}
.kh-warn{font-size:10px;color:#a05010;background:#fff8f0;border:0.5px solid #e8c88a;border-radius:6px;padding:6px 10px;margin-bottom:8px;line-height:1.5}
.kh-stat-row{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-bottom:10px}
.kh-stat{background:#f1efe8;border-radius:7px;padding:7px 8px;text-align:center}
.kh-stat-val{font-size:15px;font-weight:500}
.kh-stat-lbl{font-size:9px;color:#888;margin-top:1px;line-height:1.4}
.kh-tab-row{display:flex;gap:5px;margin-bottom:10px;flex-wrap:wrap}
.kh-tab{padding:4px 11px;border-radius:20px;border:0.5px solid #ccc;cursor:pointer;font-size:11px;color:#666;background:#fff;transition:all 0.15s}
.kh-tab.active{color:#fff;background:#2c2c2a;border-color:#2c2c2a}
.kh-ind-row{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
.kh-ind-toggle{display:inline-flex;align-items:center;gap:4px;padding:3px 9px;border-radius:12px;border:0.5px solid;cursor:pointer;font-size:11px;transition:all 0.15s;user-select:none}
.kh-ind-toggle.off{opacity:0.35}
.kh-chart-wrap{position:relative;width:100%;height:400px}
.kh-phase-strip{display:flex;width:100%;height:26px;gap:1px;margin-top:4px}
.kh-pcell{display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:500;border-radius:2px;overflow:hidden;white-space:nowrap;padding:0 3px;text-align:center;cursor:pointer}
.kh-info-box{margin-top:6px;padding:9px 13px;border-radius:8px;border:0.5px solid #ddd;background:#f9f8f5;font-size:11px;color:#5f5e5a;line-height:1.6;min-height:48px}
.kh-sources{margin-top:10px;padding:8px 12px;border-radius:6px;background:#f1efe8;font-size:10px;color:#888;line-height:1.7}
.kh-sources strong{color:#5f5e5a}
</style>`;

// ── Chart section HTML ────────────────────────────────────────────────────────
const section = `<!-- KH_HISTORY_START -->
<div id="kostolany-history-section" class="kh-wrap">
<div class="kh-inner">
  <span class="kh-eyebrow">Historical Rate Cycles · 1970 – Present</span>
  <p class="kh-warn">⚠ <strong>Transparency:</strong> M2 data starts 1959 (reliable from 1970). HY credit spread (ICE BofA OAS) starts 1997 — pre-1997 approximated from Moody's Baa spread. CAPE starts 1881 (full from 1970). Annual values smooth intra-year volatility.</p>
  <div class="kh-stat-row" id="kh-stat-row"></div>
  <div class="kh-tab-row" id="kh-tab-row">
    <div class="kh-tab active" data-kh-view="all">All indicators</div>
    <div class="kh-tab" data-kh-view="liquidity">Liquidity (Rate + M2)</div>
    <div class="kh-tab" data-kh-view="valuation">Valuation (S&amp;P + CAPE)</div>
    <div class="kh-tab" data-kh-view="credit">Credit (HY spreads)</div>
    <div class="kh-tab" data-kh-view="recession">Recession overlay</div>
  </div>
  <div class="kh-ind-row" id="kh-ind-row"></div>
  <div class="kh-chart-wrap"><canvas id="kh-main-chart" role="img" aria-label="Multi-indicator Kostolany historical chart 1970–2026"></canvas></div>
  <div class="kh-phase-strip" id="kh-phase-strip"></div>
  <div class="kh-info-box" id="kh-info-box">Click any phase strip to see Kostolany capital flow analysis. Toggle indicators above to isolate signals.</div>
  <div class="kh-sources">
    <strong>Sources:</strong>
    Fed Funds Rate: FRED FEDFUNDS · S&amp;P 500: Shiller/Yale + Yahoo Finance (2020–2026) ·
    Shiller CAPE: Robert Shiller / multpl.com · M2 Growth: Federal Reserve H.6 / FRED (M2SL) ·
    HY OAS: ICE BofA / FRED from 1997; pre-1997 Moody's Baa approx · Recessions: NBER
  </div>
</div>
</div>
<script id="kh-init-script">
(function(){
if(typeof Chart==='undefined'||window.__khInited)return;
window.__khInited=true;
const YEARS=[1970,1971,1972,1973,1974,1975,1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
const RATES=[7.17,4.67,4.44,8.74,10.51,5.82,5.05,5.54,7.94,11.20,13.35,16.38,12.24,9.09,10.23,8.10,6.80,6.66,7.57,9.21,8.10,5.69,3.52,3.02,4.21,5.84,5.30,5.46,5.35,5.07,6.24,3.88,1.67,1.13,1.35,3.22,4.97,5.02,1.92,0.24,0.18,0.10,0.14,0.11,0.09,0.13,0.40,1.00,1.83,2.16,0.36,0.08,1.68,5.02,5.33,4.50,4.25];
const SP500=[92,102,118,97,68,90,107,95,96,107,135,122,140,164,167,211,242,247,277,353,330,417,435,466,459,615,740,970,1229,1469,1320,1148,879,1112,1212,1248,1418,1468,903,1115,1258,1258,1426,1848,2059,2044,2239,2674,2507,3231,3756,4766,3840,4797,5882,7450,7450];
const CAPE=[15.1,17.3,19.2,16.0,10.9,10.1,11.0,10.3,9.3,9.3,8.9,9.3,12.2,14.2,12.5,15.5,16.9,14.1,14.0,16.0,15.0,18.0,20.0,22.0,19.0,24.0,26.5,34.3,32.8,44.2,36.3,30.5,22.9,27.5,29.7,26.0,27.2,25.5,15.2,20.4,22.5,21.8,22.3,25.4,26.5,24.2,26.0,32.0,28.4,30.0,33.0,38.3,28.0,31.0,35.0,39.0,39.8];
const M2=[6.2,13.2,12.9,5.5,4.4,12.5,10.8,8.0,7.9,8.0,7.1,9.3,8.7,12.0,8.0,8.2,9.1,3.6,5.3,4.7,4.0,2.8,1.7,1.5,0.6,3.9,4.7,5.7,8.5,6.4,6.0,10.6,6.9,8.5,5.3,4.0,5.0,6.8,9.8,3.7,3.9,9.8,6.3,6.3,5.7,5.9,6.8,5.0,3.7,6.0,25.0,12.5,-1.3,1.9,3.2,4.5,4.6];
const HY=[350,300,280,420,680,450,370,400,480,520,580,620,700,480,450,380,370,320,340,360,420,470,450,430,430,380,330,356,330,570,752,861,912,568,445,334,358,598,1725,611,571,600,537,437,488,385,333,395,344,307,533,265,443,375,319,275];
const RECESSIONS=[1,0,0,1,1,0,0,0,0,0,1,1,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,1,1,1,0,0,0,0,0,1,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0];
const inds=[
  {key:'rate', label:'Fed Funds Rate', color:'#2c2c2a', axis:'yRate', data:RATES, fmt:v=>v.toFixed(1)+'%', dash:[], w:2.5, desc:'Federal Reserve FEDFUNDS annual average. Source: FRED.'},
  {key:'sp',   label:'S&P 500',        color:'#185fa5', axis:'ySP',   data:SP500, fmt:v=>'$'+Math.round(v).toLocaleString(), dash:[6,3], w:2.5, desc:'S&P 500 annual close. Shiller dataset 1970–2019, Yahoo Finance 2020–2026.'},
  {key:'cape', label:'Shiller CAPE',   color:'#993C1D', axis:'yCAPE', data:CAPE,  fmt:v=>v.toFixed(1)+'×', dash:[3,2], w:1.8, desc:'Cyclically-adjusted P/E (10yr inflation-adj earnings). Robert Shiller / Yale. Current 39.8× — 2nd highest since 1881. Implied 10yr return: 1.6%/yr.'},
  {key:'m2',   label:'M2 Growth %',    color:'#0F6E56', axis:'yRate', data:M2,    fmt:v=>v.toFixed(1)+'%', dash:[4,2], w:1.8, desc:'M2 money supply YoY growth. Federal Reserve H.6 / FRED (M2SL). COVID peak +25%. Current +4.6%.'},
  {key:'hy',   label:'HY Spread (bps)',color:'#e24b4a', axis:'yHY',   data:HY,    fmt:v=>v+'bps', dash:[2,2], w:1.8, desc:'High yield OAS. ICE BofA / FRED from 1997; pre-1997 Moody\'s Baa approx. Current ~275bps — near historic tight. Danger: >600bps.'},
];
const phases=[
  {x1:1970,x2:1972,t:'cut', l:'D–E'},{x1:1972,x2:1981,t:'hike',l:'A–B: 70s'},
  {x1:1981,x2:1987,t:'cut', l:'D–E: Volcker'},{x1:1987,x2:1989,t:'hike',l:'A'},
  {x1:1989,x2:1993,t:'cut', l:'D–E'},{x1:1993,x2:1995,t:'hike',l:'A'},
  {x1:1995,x2:2000,t:'plat',l:'E–F: dot-com'},{x1:2000,x2:2001,t:'hike',l:'B'},
  {x1:2001,x2:2004,t:'cut', l:'C–D'},{x1:2004,x2:2007,t:'hike',l:'A–B: GFC'},
  {x1:2007,x2:2015,t:'cut', l:'D–E: QE'},{x1:2015,x2:2019,t:'hike',l:'A–B'},
  {x1:2019,x2:2022,t:'cut', l:'F–D: COVID'},{x1:2022,x2:2024,t:'hike',l:'B: fastest'},
  {x1:2024,x2:2026,t:'cut', l:'D ← NOW'},
];
const pMsgs={
  hike:"<strong style='color:#a32d2d'>Hiking (A→B):</strong> Liquidity drains. M2 slows. HY spreads widen. CAPE compresses. Kostolany: rotate out of equities and long bonds into short-duration cash.",
  cut: "<strong style='color:#085041'>Cutting (C→D→E):</strong> Liquidity expands. M2 accelerates. HY tightens. Equities expand as discount rates fall. Kostolany: accumulate equities and long bonds before the public notices.",
  plat:"<strong style='color:#0c447c'>Plateau:</strong> Watch CAPE and spreads. CAPE >30× at a plateau means the next correction will be deep. Tight spreads + growing M2 = bull continues. Spreading from tight = recession risk rising.",
};
const cmap={hike:'#e24b4a',cut:'#1d9e75',plat:'#378add'};
const bgmap={hike:'#e24b4a12',cut:'#1d9e7512',plat:'#378add12'};
const views={all:['rate','sp','cape','m2','hy'],liquidity:['rate','m2'],valuation:['sp','cape'],credit:['rate','hy'],recession:['rate','sp','hy']};
let khChart, khView='all';
const tog={rate:true,sp:true,cape:true,m2:true,hy:true};

function buildAnn(rec){
  const a={};
  phases.forEach((p,i)=>{
    a['ph'+i]={type:'box',xMin:p.x1,xMax:p.x2,yMin:0,yMax:22,yScaleID:'yRate',backgroundColor:bgmap[p.t],borderColor:cmap[p.t]+'44',borderWidth:1};
  });
  if(rec){
    let inR=false,rS=0;
    YEARS.forEach((y,i)=>{
      if(RECESSIONS[i]===1&&!inR){inR=true;rS=y;}
      if(RECESSIONS[i]===0&&inR){
        a['rec'+i]={type:'box',xMin:rS,xMax:YEARS[i-1]+1,yMin:0,yMax:22,yScaleID:'yRate',backgroundColor:'rgba(80,80,80,0.08)',borderColor:'rgba(80,80,80,0.2)',borderWidth:0.5};
        inR=false;
      }
    });
  }
  a.nowLine={type:'line',xMin:2026,xMax:2026,yMin:0,yMax:22,yScaleID:'yRate',borderColor:'#ba7517',borderWidth:2,borderDash:[4,3],label:{display:true,content:'Now',position:'start',font:{size:10,weight:'bold'},color:'#ba7517',backgroundColor:'transparent'}};
  a.hyWarn={type:'line',xMin:1997,xMax:1997,yMin:0,yMax:22,yScaleID:'yRate',borderColor:'rgba(226,75,74,0.3)',borderWidth:1,borderDash:[3,3],label:{display:true,content:'HY data →',position:'end',font:{size:9},color:'rgba(226,75,74,0.6)',backgroundColor:'transparent'}};
  return a;
}

function initChart(){
  const ctx=document.getElementById('kh-main-chart');
  if(!ctx)return;
  const ds=inds.map(ind=>({
    label:ind.label,data:YEARS.map((y,i)=>({x:y,y:ind.data[i]})),
    borderColor:ind.color,backgroundColor:'transparent',
    borderWidth:ind.w,borderDash:ind.dash,pointRadius:0,tension:0.35,
    showLine:true,yAxisID:ind.axis,hidden:!tog[ind.key],indKey:ind.key
  }));
  khChart=new Chart(ctx,{
    type:'scatter',data:{datasets:ds},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      layout:{padding:{top:8,right:8}},
      plugins:{
        legend:{display:false},
        annotation:{annotations:buildAnn(false)},
        tooltip:{callbacks:{
          title:items=>'Year: '+Math.round(items[0].parsed.x),
          label:item=>{const ind=inds.find(i=>i.label===item.dataset.label);return ind?item.dataset.label+': '+ind.fmt(item.parsed.y):null;}
        }}
      },
      scales:{
        x:{type:'linear',min:1969,max:2027,ticks:{stepSize:5,autoSkip:false,callback:v=>v%5===0?String(v):'',font:{size:10},color:'#888'},grid:{color:'rgba(136,135,128,0.08)'}},
        yRate:{type:'linear',position:'left',min:0,max:22,ticks:{callback:v=>v+'%',font:{size:10},color:'#2c2c2a'},grid:{color:'rgba(136,135,128,0.08)'},title:{display:true,text:'Rate / M2 %',font:{size:10},color:'#2c2c2a'}},
        ySP:{type:'logarithmic',position:'right',min:50,max:12000,ticks:{callback:v=>[100,500,1000,2000,5000,10000].includes(v)?'$'+v.toLocaleString():'',font:{size:10},color:'#185fa5'},grid:{drawOnChartArea:false},title:{display:true,text:'S&P 500 (log)',font:{size:10},color:'#185fa5'}},
        yCAPE:{type:'linear',position:'right',min:0,max:50,ticks:{callback:v=>v+'×',font:{size:10},color:'#993C1D'},grid:{drawOnChartArea:false},title:{display:true,text:'CAPE',font:{size:10},color:'#993C1D'}},
        yHY:{type:'linear',position:'right',min:0,max:2200,ticks:{callback:v=>v+'bp',font:{size:10},color:'#e24b4a'},grid:{drawOnChartArea:false},title:{display:true,text:'HY OAS (bps)',font:{size:10},color:'#e24b4a'}},
      }
    }
  });
}

function buildToggles(){
  const row=document.getElementById('kh-ind-row');
  if(!row)return;
  inds.forEach(ind=>{
    const btn=document.createElement('div');
    btn.className='kh-ind-toggle'+(tog[ind.key]?'':' off');
    btn.style.cssText='color:'+ind.color+';border-color:'+ind.color+';background:'+ind.color+'15;';
    btn.id='kh-tog-'+ind.key;
    btn.innerHTML='<span style="width:14px;height:2px;background:'+ind.color+';display:inline-block;border-radius:1px;"></span>'+ind.label;
    btn.onclick=()=>{
      tog[ind.key]=!tog[ind.key];
      const di=inds.findIndex(i=>i.key===ind.key);
      if(khChart){khChart.getDatasetMeta(di).hidden=!tog[ind.key];khChart.update();}
      btn.classList.toggle('off',!tog[ind.key]);
      document.getElementById('kh-info-box').innerHTML='<strong>'+ind.label+':</strong> '+ind.desc;
    };
    row.appendChild(btn);
  });
}

function buildPhaseStrip(){
  const strip=document.getElementById('kh-phase-strip');
  if(!strip)return;
  const MIN=1970,MAX=2027,TOT=MAX-MIN;
  phases.forEach(p=>{
    const el=document.createElement('div');
    el.className='kh-pcell';
    el.style.cssText='width:'+((p.x2-p.x1)/TOT*100).toFixed(1)+'%;background:'+cmap[p.t]+'bb;color:#fff;';
    el.textContent=p.l;
    el.title=p.x1+'–'+p.x2;
    el.onclick=()=>{document.getElementById('kh-info-box').innerHTML=pMsgs[p.t];};
    strip.appendChild(el);
  });
}

function buildStats(){
  const row=document.getElementById('kh-stat-row');
  if(!row)return;
  const stats=[
    {val:'4.25%',lbl:'Fed Funds Rate',sub:'Jun 2026 (FRED)',color:'#2c2c2a'},
    {val:'~$7,450',lbl:'S&P 500',sub:'Jun 2026',color:'#185fa5'},
    {val:'39.8×',lbl:'Shiller CAPE',sub:'Jun 2026 (GuruFocus)',color:'#993C1D'},
    {val:'+4.6%',lbl:'M2 Growth YoY',sub:'Mar 2026 (Fed)',color:'#0F6E56'},
    {val:'~275bp',lbl:'HY OAS',sub:'Jun 2026 (ICE BofA)',color:'#e24b4a'},
  ];
  row.innerHTML=stats.map(s=>'<div class="kh-stat" style="border:0.5px solid '+s.color+'33;"><div class="kh-stat-val" style="color:'+s.color+';">'+s.val+'</div><div class="kh-stat-lbl" style="font-weight:500;">'+s.lbl+'</div><div class="kh-stat-lbl">'+s.sub+'</div></div>').join('');
}

function setView(v){
  khView=v;
  document.querySelectorAll('.kh-tab').forEach(t=>{
    t.classList.toggle('active',t.dataset.khView===v);
  });
  const vis=views[v];
  inds.forEach(ind=>{tog[ind.key]=vis.includes(ind.key);});
  if(khChart){
    khChart.data.datasets.forEach((ds,i)=>{khChart.getDatasetMeta(i).hidden=!tog[inds[i].key];});
    khChart.options.plugins.annotation.annotations=buildAnn(v==='recession');
    khChart.update();
  }
  inds.forEach(ind=>{
    const b=document.getElementById('kh-tog-'+ind.key);
    if(b)b.classList.toggle('off',!tog[ind.key]);
  });
}

document.querySelectorAll('[data-kh-view]').forEach(el=>{
  el.addEventListener('click',()=>setView(el.dataset.khView));
});

if(window.Chart&&window.Chart.register){
  initChart();buildToggles();buildPhaseStrip();buildStats();
} else {
  window.addEventListener('load',()=>{initChart();buildToggles();buildPhaseStrip();buildStats();});
}
})();
</script>
<!-- KH_HISTORY_END -->`;

// ── Inject CDN scripts (idempotent) ───────────────────────────────────────────
if (!html.includes('chart.umd.js')) {
  html = html.replace('</head>', `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" crossorigin="anonymous"></script>\n</head>`);
}
if (!html.includes('chartjs-plugin-annotation')) {
  html = html.replace('</head>', `<script src="https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/3.0.1/chartjs-plugin-annotation.min.js" crossorigin="anonymous"></script>\n</head>`);
}

// ── Inject style ──────────────────────────────────────────────────────────────
html = html.replace('</head>', style + '\n</head>');

// ── Inject section before operational-chart-section ──────────────────────────
const op = html.indexOf('<section id="operational-chart-section"');
if (op >= 0) {
  html = html.slice(0, op) + section + '\n' + html.slice(op);
} else {
  html = html.replace('</main>', section + '\n</main>') || (html + '\n' + section);
}

fs.writeFileSync(indexPath, html);
console.log('kostolany-history-section injected (Chart.js multi-indicator)');
