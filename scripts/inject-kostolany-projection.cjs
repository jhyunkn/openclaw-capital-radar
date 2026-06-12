'use strict';
const fs   = require('fs');
const path = require('path');

const root          = path.join(__dirname, '..');
const requestedPath = process.argv[2] || 'index.html';
const indexPath     = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);
if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

// Idempotent removal
html = html.replace(/<!-- KP_PROJECTION_START -->[\s\S]*?<!-- KP_PROJECTION_END -->\s*/g, '');
html = html.replace(/<style id="kostolany-projection-style">[\s\S]*?<\/style>\s*/g, '');
for (const tok of ['<section id="kostolany-projection-section"', '<div id="kostolany-projection-section"']) {
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
const style = `<style id="kostolany-projection-style">
.kp-wrap{border-bottom:1px solid var(--rule,#dedbd2);padding:56px clamp(18px,4vw,56px);box-sizing:border-box}
.kp-inner{max-width:1240px;margin:0 auto}
.kp-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--rule,#dedbd2)}
.kp-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted,#747168);font-family:var(--mono,ui-monospace,monospace);display:block;margin-bottom:8px}
.kp-title{font-size:clamp(22px,2.8vw,38px);font-weight:500;letter-spacing:-.05em;color:var(--ink,#24231f);margin:0 0 6px;line-height:.96}
.kp-subtitle{font-size:14px;color:var(--muted,#747168);margin:0;line-height:1.45}
.kp-method{background:rgba(251,250,246,.38);border:1px solid var(--rule,#dedbd2);border-radius:0;padding:10px 14px;margin-bottom:16px;font-size:12px;color:var(--muted,#747168);line-height:1.6}
.kp-method strong{color:var(--ink,#24231f);font-weight:500}
.kp-sc-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.kp-stab{padding:6px 14px;border-radius:999px;border:1px solid var(--rule,#dedbd2);cursor:pointer;font-size:12px;color:var(--muted,#747168);background:transparent;transition:all 0.12s;font-weight:400}
.kp-stab.active{font-weight:500}
.kp-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:16px;border:1px solid var(--rule,#dedbd2);border-right:none}
.kp-stat{border-right:1px solid var(--rule,#dedbd2);border-radius:0;padding:12px 10px;text-align:center;background:rgba(251,250,246,.2)}
.kp-stat-val{font-size:15px;font-weight:500;letter-spacing:-.02em;display:block;margin-bottom:4px}
.kp-stat-lbl{font-size:10px;color:var(--muted,#747168);line-height:1.4;display:block;margin-bottom:1px}
.kp-stat-src{font-size:9px;color:var(--soft,#aaa69b);font-style:italic}
.kp-leg-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;font-size:11px;color:var(--muted,#747168);align-items:center}
.kp-leg-item{display:flex;align-items:center;gap:5px}
.kp-chart-wrap{position:relative;width:100%;height:420px;border:1px solid var(--rule,#dedbd2);background:var(--bg,#f3f2ed)}
.kp-phase-strip{display:flex;width:100%;height:22px;gap:1px;margin-top:6px}
.kp-pcell{display:flex;align-items:center;justify-content:center;font-size:8px;font-weight:500;border-radius:0;cursor:default;overflow:hidden;white-space:nowrap;padding:0 4px;text-align:center;font-family:var(--mono,ui-monospace,monospace);text-transform:uppercase;letter-spacing:.05em}
.kp-info-box{margin-top:8px;padding:10px 14px;border:1px solid var(--rule,#dedbd2);background:rgba(251,250,246,.38);font-size:12px;color:var(--muted,#747168);line-height:1.6;min-height:44px;border-radius:0}
.kp-table-head{font-size:11px;font-weight:500;color:var(--ink,#24231f);margin:16px 0 6px;letter-spacing:-.02em}
.kp-model-table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--rule,#dedbd2)}
.kp-model-table th{text-align:left;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#747168);border-bottom:1px solid var(--rule,#dedbd2);background:rgba(251,250,246,.5);font-weight:500}
.kp-model-table td{padding:7px 10px;border-bottom:1px solid var(--rule2,#ebe8df);vertical-align:top;line-height:1.5;color:var(--ink,#24231f)}
.kp-model-table tr:last-child td{border-bottom:none}
.kp-model-table td:first-child{font-weight:500;color:var(--ink,#24231f);width:160px}
.kp-bear{color:var(--red,#9f3f35)}.kp-bull{color:var(--green,#2f6f4e)}.kp-mid{color:var(--ink,#24231f)}
.kp-risk-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;margin-top:12px;border:1px solid var(--rule,#dedbd2);border-right:none}
.kp-risk-card{border-right:1px solid var(--rule,#dedbd2);border-radius:0;padding:12px 14px;font-size:12px;line-height:1.6}
.kp-risk-card h3{font-size:10px;font-weight:500;margin:0 0 6px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink,#24231f)}
.kp-risk-card ul{margin:0;padding-left:14px}
.kp-risk-card li{margin-bottom:3px;color:var(--muted,#747168)}
.kp-disclaimer{font-size:10px;color:var(--soft,#aaa69b);margin-top:14px;padding-top:12px;border-top:1px solid var(--rule,#dedbd2);line-height:1.55}
@media(max-width:700px){.kp-stat-grid{grid-template-columns:repeat(2,1fr)}.kp-risk-grid{grid-template-columns:1fr;border-right:1px solid var(--rule,#dedbd2)}.kp-risk-card{border-bottom:1px solid var(--rule,#dedbd2)}.kp-wrap{padding:36px clamp(14px,3vw,28px)}}
</style>`;

// ── Section HTML ──────────────────────────────────────────────────────────────
const section = `<!-- KP_PROJECTION_START -->
<div id="kostolany-projection-section" class="kp-wrap">
<div class="kp-inner">
  <div class="kp-head">
    <div>
      <span class="kp-eyebrow">Cycle 5 Projection · Three Models · 2026–2030</span>
      <h2 class="kp-title">S&amp;P 500 Projection</h2>
      <p class="kp-subtitle">Three independent models — EPS × P/E, CAPE reversion, and institutional — across base, bull, and bear scenarios.</p>
    </div>
  </div>
  <div class="kp-method" id="kp-method-bar">
    <strong>How this projection is built:</strong> Three independent models, not analyst price targets.
    <strong>Model 1 (EPS-driven):</strong> Price = EPS × P/E. FactSet consensus EPS + Goldman multiple assumption.
    <strong>Model 2 (CAPE mean-reversion):</strong> Projects price if CAPE reverts toward its long-run average over the window.
    <strong>Model 3 (Institutional range):</strong> Annualised return projections from Vanguard (4–5%), Research Affiliates (3.1%), GMO (−5.4% real) translated to price levels.
    Rate path = FOMC SEP median (FRED FEDTARMD, Mar 2026).
  </div>
  <div class="kp-sc-tabs" id="kp-sc-tabs">
    <div class="kp-stab active" data-kp-sc="base" style="background:#1d9e75;border-color:#1d9e75;color:#fff;">Base — EPS delivers, multiple flat</div>
    <div class="kp-stab" data-kp-sc="bull" style="border-color:#185fa5;color:#185fa5;">Bull — EPS beats, multiple expands</div>
    <div class="kp-stab" data-kp-sc="bear" style="border-color:#e24b4a;color:#e24b4a;">Bear — CAPE mean-reverts / EPS misses</div>
  </div>
  <div class="kp-stat-grid" id="kp-stat-grid"></div>
  <div class="kp-leg-row">
    <div class="kp-leg-item"><span style="width:20px;height:2.5px;background:#24231f;display:inline-block;"></span>Rate (historical)</div>
    <div class="kp-leg-item"><span style="width:20px;height:0;border-top:2.5px dashed #747168;display:inline-block;"></span>Rate (FOMC SEP)</div>
    <div class="kp-leg-item"><span style="width:20px;height:2.5px;background:#405f9f;display:inline-block;"></span>S&amp;P historical</div>
    <div class="kp-leg-item"><span style="width:20px;height:0;border-top:2.5px solid #1d9e75;display:inline-block;"></span>Model 1: EPS × P/E</div>
    <div class="kp-leg-item"><span style="width:20px;height:0;border-top:2.5px dashed #9f3f35;display:inline-block;"></span>Model 2: CAPE reversion</div>
    <div class="kp-leg-item"><span style="width:20px;height:0;border-top:2.5px dotted #8a6a2c;display:inline-block;"></span>Model 3: Institutional</div>
    <div class="kp-leg-item"><span style="width:20px;height:10px;background:#aaa69b;display:inline-block;opacity:0.3;"></span>Institutional band</div>
  </div>
  <div class="kp-chart-wrap"><canvas id="kp-proj-chart"></canvas></div>
  <div class="kp-phase-strip" id="kp-phase-strip"></div>
  <div class="kp-info-box" id="kp-info-box">Select a scenario to see the model assumptions and outputs.</div>
  <div>
    <p class="kp-table-head">Model comparison — 2030 S&amp;P 500 implied price</p>
    <table class="kp-model-table" id="kp-model-table"></table>
  </div>
  <div class="kp-risk-grid" id="kp-risk-grid"></div>
  <div class="kp-disclaimer">
    <strong>Methodology transparency:</strong> Model 1 uses FactSet/Goldman EPS consensus × P/E — a structured calculation, not an analyst price target.
    Model 2 applies CAPE mean-reversion to current CAPE 41.6× with EPS growth — mathematically grounded valuation headwind.
    Model 3 translates Vanguard VCMM Mar 2026, Research Affiliates Jan 2026, GMO Q1 2026 10-year return forecasts into price levels.
    All three models are shown simultaneously — the range represents genuine uncertainty.
  </div>
</div>
</div>
<script id="kp-init-script">
(function(){
if(typeof Chart==='undefined'||window.__kpInited)return;
window.__kpInited=true;
const NOW_SP=7430,NOW_CAPE=41.6;
const HIST_YEARS=[2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
const HIST_RATES=[0.13,0.40,1.00,1.83,2.16,0.36,0.08,1.68,5.02,5.33,4.50,4.25];
const HIST_SP=[2044,2239,2674,2507,3231,3756,4766,3840,4797,5882,7000,7430];
const PROJ_YEARS=[2026,2027,2028,2029,2030];
function priceFromReturn(r){return PROJ_YEARS.map((_,i)=>Math.round(NOW_SP*Math.pow(1+r,i+1)));}
function capeRevPath(target,yrs,eps){
  const mc=Math.pow(target/NOW_CAPE,1/yrs)-1;
  const p=[];let v=NOW_SP;
  for(let i=0;i<PROJ_YEARS.length;i++){v=v*(1+eps)*(1+mc);p.push(Math.round(v));}
  return p;
}
const EPS={
  base:{eps:[338,386,417,446,473],pe:[22.0,21.0,20.5,20.0,19.5]},
  bull:{eps:[350,410,460,506,547],pe:[23.0,23.0,22.5,22.0,21.5]},
  bear:{eps:[310,330,340,350,360],pe:[20.0,18.0,17.0,16.5,16.0]},
};
const SC={
  base:{name:'Base',color:'#1d9e75',
    spM1:PROJ_YEARS.map((_,i)=>Math.round(EPS.base.eps[i]*EPS.base.pe[i])),
    spM2:capeRevPath(27.6,10,0.08),
    spM3:priceFromReturn(0.038),spM3h:priceFromReturn(0.05),spM3l:priceFromReturn(-0.027),
    rateProj:[4.25,3.50,3.25,3.10,3.00],
    cards:[
      {val:'$338→$473',lbl:'EPS 2026→2030',sub:'FactSet consensus +22%→+6% decel',src:'FactSet/Goldman'},
      {val:'21×→19.5×',lbl:'P/E multiple',sub:'Goldman flat ~21×, mild compression',src:'Goldman May 2026'},
      {val:'27.6× (10yr)',lbl:'CAPE target',sub:'Partial reversion to 20yr avg',src:'GuruFocus'},
      {val:'~$8,900',lbl:'EPS model 2029',sub:'Model 1 output — not analyst opinion',src:'Calculated'},
    ],
    info:'<strong style="color:#1d9e75">Base — three models, three answers:</strong><br><strong>Model 1 (EPS×P/E):</strong> EPS $338→$473 with Goldman ~21× → S&P ~$9,200 by 2030.<br><strong>Model 2 (CAPE reversion):</strong> Partial reversion to 20yr avg 27.6× over 10yr + 8% EPS → S&P ~$8,800.<br><strong>Model 3 (Institutional):</strong> Vanguard 4–5%, RA 3.1% → $8,200–$9,000. GMO -2.7% nominal → $6,400.',
    bull:['FactSet Q1 2026 actual EPS growth +27.1% YoY','AI capex $650–700bn begins monetising in 2027','Rate cuts to 3.0% by 2028 support multiple','M2 +4.6% YoY provides liquidity'],
    bear:['CAPE 41.6× — Model 2 reversion headwind real and persistent','GMO 7yr: US Large Caps -5.4% real is most bearish credible forecast','Goldman warns momentum/breadth concentration risk','Vanguard 4–5% vs 7–10% historical = structural return shortfall'],
  },
  bull:{name:'Bull',color:'#185fa5',
    spM1:PROJ_YEARS.map((_,i)=>Math.round(EPS.bull.eps[i]*EPS.bull.pe[i])),
    spM2:capeRevPath(32.0,10,0.10),
    spM3:priceFromReturn(0.05),spM3h:priceFromReturn(0.08),spM3l:priceFromReturn(0.03),
    rateProj:[4.25,3.25,2.75,2.50,2.50],
    cards:[
      {val:'$350→$547',lbl:'EPS 2026→2030',sub:'AI monetises: +26%→+8% decel',src:'Goldman bull case'},
      {val:'23×→21.5×',lbl:'P/E multiple',sub:'Multiple holds on strong earnings',src:'Goldman/Yardeni'},
      {val:'32× (10yr)',lbl:'CAPE target',sub:'Structural new mean — AI premium',src:'Bull assumption'},
      {val:'~$11,700',lbl:'EPS model 2030',sub:'Requires EPS delivery',src:'Calculated'},
    ],
    info:'<strong style="color:#185fa5">Bull — what has to be true:</strong><br><strong>Model 1:</strong> AI monetises faster, EPS → $547. Multiple holds 23× → S&P ~$11,700. Requires Goldman "$340×24%" to deliver.<br><strong>Model 2:</strong> Structural new mean 32× + 10% EPS growth → S&P ~$10,200. Most contestable assumption.<br><strong>Model 3:</strong> Vanguard upside if AI diffusion exceeds expectations.',
    bull:['Goldman EPS $340 tracking (+24% Q1 2026 actual)','Mag7 FCF $350bn 2025 — earnings base is real','Deeper cuts = lower discount rate = higher justified multiple','Vanguard upside: AI diffusion → 3% GDP growth'],
    bear:['CAPE 41.6× — never sustained above 40× for >18 months historically','Structural new mean 32× is assumption, not data','MIT: AI economically justified for <5% of US tasks at current cost','Goldman: narrow breadth is cautionary signal even in bull case'],
  },
  bear:{name:'Bear',color:'#e24b4a',
    spM1:PROJ_YEARS.map((_,i)=>Math.round(EPS.bear.eps[i]*EPS.bear.pe[i])),
    spM2:capeRevPath(17.3,7,0.04),
    spM3:priceFromReturn(-0.027),spM3h:priceFromReturn(0.016),spM3l:priceFromReturn(-0.054),
    rateProj:[4.25,4.25,4.75,5.00,4.25],
    cards:[
      {val:'$310→$360',lbl:'EPS 2026→2030',sub:'Misses consensus: +12% slowing to +3%',src:'Bear/MIT'},
      {val:'20×→16×',lbl:'P/E multiple',sub:'CAPE compression to long-run mean',src:'GMO/CAPE model'},
      {val:'17.3× (7yr)',lbl:'CAPE target',sub:'Full reversion to 145yr mean',src:'Shiller/Yale'},
      {val:'~$5,760',lbl:'EPS model 2030',sub:'EPS miss + multiple collapse',src:'Calculated'},
    ],
    info:'<strong style="color:#e24b4a">Bear — what data-driven pessimists say:</strong><br><strong>Model 1:</strong> AI not monetising (MIT <5% tasks), EPS slows to +3%. Multiple 20×→16× → S&P ~$5,760.<br><strong>Model 2:</strong> Full CAPE reversion to 17.3× over 7yr (GMO horizon) + 4% EPS → S&P ~$5,400. Goldman downside target $5,400.<br><strong>Model 3:</strong> GMO Q1 2026: US Large Caps -5.4% real → ~-2.7% nominal → $6,500. CAPE implied 1.6%/yr → $7,900.',
    bull:['FactSet Q1 2026 actual +27.1% far outpacing bear EPS assumption','HY OAS 275bps — no credit stress signal','Fed still cutting — rate environment broadly supportive','GMO wrong on US equities for 10+ years'],
    bear:['GMO 7yr US Large Cap: -5.4% real (Q1 2026)','GuruFocus CAPE implied: 1.6%/yr at 41.6×','CAPE above 40× occurred twice in 145yr — both preceded major drawdowns','JPMorgan re-hike risk: PCE 2.7% end-2026 > 2% target'],
  },
};
let kpChart,kpSc='base';
const cmap={hike:'#e24b4a',cut:'#1d9e75',plateau:'#378add'};
const bgmap={hike:'#e24b4a0d',cut:'#1d9e750d',plateau:'#378add0d'};

function buildChart(sc){
  const S=SC[sc];
  const allY=[...HIST_YEARS.slice(0,-1),...PROJ_YEARS];
  const nH=HIST_YEARS.length-1;
  const rH=allY.map((_,i)=>i<nH?HIST_RATES[i]:null);
  const rP=allY.map((_,i)=>i>=nH-1?(i<nH?HIST_RATES[i]:S.rateProj[i-nH]):null);
  const sH=allY.map((_,i)=>i<nH?HIST_SP[i]:null);
  const sM1=allY.map((_,i)=>i>=nH-1?(i<nH?HIST_SP[i]:S.spM1[i-nH]):null);
  const sM2=allY.map((_,i)=>i>=nH-1?(i<nH?HIST_SP[i]:S.spM2[i-nH]):null);
  const sM3=allY.map((_,i)=>i>=nH-1?(i<nH?HIST_SP[i]:S.spM3[i-nH]):null);
  const sBH=allY.map((_,i)=>i>=nH-1?(i<nH?HIST_SP[i]:S.spM3h[i-nH]):null);
  const sBL=allY.map((_,i)=>i>=nH-1?(i<nH?HIST_SP[i]:S.spM3l[i-nH]):null);
  const ann={
    projBox:{type:'box',xMin:2026,xMax:2031,yMin:0,yMax:8,yScaleID:'yRate',backgroundColor:'rgba(240,192,64,0.05)',borderColor:'rgba(240,192,64,0.20)',borderWidth:1,label:{display:true,content:'← Projection (3 models)',position:{x:'start',y:'center'},font:{size:9},color:'rgba(160,130,20,0.55)',backgroundColor:'transparent'}},
    nowLine:{type:'line',xMin:2026,xMax:2026,yMin:0,yMax:8,yScaleID:'yRate',borderColor:'#ba7517',borderWidth:1.5,borderDash:[4,3],label:{display:true,content:'Now',position:'start',font:{size:10,weight:'bold'},color:'#ba7517',backgroundColor:'transparent'}},
    neutralLine:{type:'line',yMin:3.0,yMax:3.0,yScaleID:'yRate',borderColor:'rgba(29,158,117,0.30)',borderWidth:1,borderDash:[4,4],label:{display:true,content:'FOMC neutral 3%',position:'end',font:{size:9},color:'rgba(29,158,117,0.65)',backgroundColor:'transparent'}},
    capeWarn:{type:'label',xValue:2023.5,yValue:7.1,content:['CAPE 41.6× · 2nd highest since 1881','Implied 10yr return: 1.6%/yr'],font:{size:8.5},color:'rgba(196,97,58,0.65)',textAlign:'center',backgroundColor:'rgba(255,248,240,0.9)',borderRadius:3,padding:{top:3,bottom:3,left:6,right:6}},
  };
  const phases=[
    {x1:2015,x2:2019,t:'hike'},{x1:2019,x2:2022,t:'cut'},
    {x1:2022,x2:2024,t:'hike'},{x1:2024,x2:2026,t:'cut'},
    {x1:2026,x2:sc==='bear'?2027.5:2028,t:'cut'},
    sc==='bear'?{x1:2027.5,x2:2031,t:'hike'}:{x1:2028,x2:2031,t:'plateau'},
  ];
  phases.forEach((p,i)=>{ann['ph'+i]={type:'box',xMin:p.x1,xMax:p.x2,yMin:0,yMax:8,yScaleID:'yRate',backgroundColor:bgmap[p.t],borderColor:cmap[p.t]+'33',borderWidth:0.5};});
  const ds=[
    {label:'Rate (hist)',data:allY.map((y,i)=>({x:y,y:rH[i]})),borderColor:'#24231f',backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0.35,showLine:true,yAxisID:'yRate',spanGaps:false},
    {label:'Rate (proj)',data:allY.map((y,i)=>({x:y,y:rP[i]})),borderColor:'#747168',backgroundColor:'transparent',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:0.35,showLine:true,yAxisID:'yRate',spanGaps:false},
    {label:'S&P (hist)',data:allY.map((y,i)=>({x:y,y:sH[i]})),borderColor:'#405f9f',backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0.35,showLine:true,yAxisID:'ySP',spanGaps:false},
    {label:'Inst high',data:allY.map((y,i)=>({x:y,y:sBH[i]})),borderColor:'transparent',backgroundColor:'rgba(180,180,180,0.14)',borderWidth:0,pointRadius:0,tension:0.35,showLine:true,fill:'+1',yAxisID:'ySP',spanGaps:false},
    {label:'Inst low',data:allY.map((y,i)=>({x:y,y:sBL[i]})),borderColor:'transparent',backgroundColor:'rgba(180,180,180,0.14)',borderWidth:0,pointRadius:0,tension:0.35,showLine:true,fill:false,yAxisID:'ySP',spanGaps:false},
    {label:'Model 3',data:allY.map((y,i)=>({x:y,y:sM3[i]})),borderColor:'#8a6a2c',backgroundColor:'transparent',borderWidth:1.5,borderDash:[2,3],pointRadius:0,tension:0.35,showLine:true,yAxisID:'ySP',spanGaps:false},
    {label:'Model 2: CAPE',data:allY.map((y,i)=>({x:y,y:sM2[i]})),borderColor:'#9f3f35',backgroundColor:'transparent',borderWidth:1.8,borderDash:[6,3],pointRadius:0,tension:0.35,showLine:true,yAxisID:'ySP',spanGaps:false},
    {label:'Model 1: EPS×P/E',data:allY.map((y,i)=>({x:y,y:sM1[i]})),borderColor:S.color,backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0.35,showLine:true,yAxisID:'ySP',spanGaps:false},
  ];
  if(kpChart)kpChart.destroy();
  kpChart=new Chart(document.getElementById('kp-proj-chart'),{
    type:'scatter',data:{datasets:ds},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'index',intersect:false},
      layout:{padding:{top:6,right:8,bottom:4,left:4}},
      plugins:{
        legend:{display:false},
        annotation:{annotations:ann},
        tooltip:{callbacks:{
          title:items=>'Year: '+Math.round(items[0].parsed.x),
          label:item=>{
            const l=item.dataset.label;
            if(!l||l.includes('high')||l.includes('low'))return null;
            if(l.includes('Rate'))return l+': '+item.parsed.y?.toFixed(2)+'%';
            if(item.parsed.y==null)return null;
            return l+': $'+Math.round(item.parsed.y).toLocaleString();
          }
        }}
      },
      scales:{
        x:{type:'linear',min:2014,max:2031,ticks:{stepSize:1,autoSkip:false,callback:v=>Number.isInteger(v)&&v>=2015?String(v):'',font:{size:10},color:'#747168'},grid:{color:'rgba(36,35,31,.05)'}},
        yRate:{type:'linear',position:'left',min:0,max:8,ticks:{callback:v=>v+'%',font:{size:11},color:'#24231f'},grid:{color:'rgba(36,35,31,.05)'},title:{display:true,text:'Fed Funds Rate (FRED)',font:{size:10},color:'#747168'}},
        ySP:{type:'linear',position:'right',min:1000,max:16000,ticks:{callback:v=>[2000,4000,6000,8000,10000,12000,14000].includes(v)?'$'+v.toLocaleString():'',font:{size:11},color:'#405f9f'},grid:{drawOnChartArea:false},title:{display:true,text:'S&P 500 (year-end)',font:{size:10},color:'#405f9f'}},
      }
    }
  });
}

function buildStats(sc){
  const S=SC[sc];
  document.getElementById('kp-stat-grid').innerHTML=S.cards.map(s=>'<div class="kp-stat" style="background:'+S.color+'10;border-bottom:2px solid '+S.color+'60;"><div class="kp-stat-val" style="color:'+S.color+';">'+s.val+'</div><div class="kp-stat-lbl" style="font-weight:500;color:var(--ink,#24231f);">'+s.lbl+'</div><div class="kp-stat-lbl">'+s.sub+'</div><div class="kp-stat-src">'+s.src+'</div></div>').join('');
}

function buildInfo(sc){
  document.getElementById('kp-info-box').innerHTML=SC[sc].info;
}

function buildPhaseStrip(sc){
  const strip=document.getElementById('kp-phase-strip');
  if(!strip)return;
  strip.innerHTML='';
  const phases=[
    {x1:2015,x2:2019,t:'hike',l:'A–B: trim'},
    {x1:2019,x2:2022,t:'cut', l:'F–D: COVID'},
    {x1:2022,x2:2024,t:'hike',l:'B: cash king'},
    {x1:2024,x2:2026,t:'cut', l:'D: buy dips'},
    {x1:2026,x2:2028,t:'cut', l:'E ← now'},
    sc==='bear'?{x1:2028,x2:2030,t:'hike',l:'new A (re-hike)'}:{x1:2028,x2:2030,t:'plateau',l:'F: cycle end'},
  ];
  const MIN=2015,MAX=2030,TOT=MAX-MIN;
  phases.forEach(p=>{
    const el=document.createElement('div');
    el.className='kp-pcell';
    el.style.cssText='width:'+((p.x2-p.x1)/TOT*100).toFixed(1)+'%;background:'+cmap[p.t]+'cc;color:#fff;border:0.5px solid '+cmap[p.t]+';';
    el.textContent=p.l;
    strip.appendChild(el);
  });
}

function buildModelTable(sc){
  const S=SC[sc];
  const m1=S.spM1[S.spM1.length-1],m2=S.spM2[S.spM2.length-1];
  const m3h=S.spM3h[S.spM3h.length-1],m3l=S.spM3l[S.spM3l.length-1];
  const capeTarget=sc==='bear'?'17.3\xd7 (145yr mean, 7yr)':sc==='bull'?'32\xd7 (structural, 10yr)':'27.6\xd7 (20yr avg, 10yr)';
  const epsGr=sc==='bear'?'+4%/yr':sc==='bull'?'+10%/yr':'+8%/yr';
  const epsRange=sc==='bear'?'$310→$360':sc==='bull'?'$350→$547':'$338→$473';
  const m1c=m1>7430?'kp-bull':'kp-bear', m2c=m2>7430?'kp-bull':'kp-bear';
  document.getElementById('kp-model-table').innerHTML=
    '<tr><th>Model</th><th>Methodology</th><th>Key inputs</th><th>2028 est.</th><th>2030 est.</th><th>Source</th></tr>'+
    '<tr><td>Model 1<br>EPS\xd7P/E</td><td>Price = EPS consensus \xd7 forward P/E</td><td>EPS: FactSet '+epsRange+'. P/E: Goldman</td><td class="kp-mid">$'+Math.round(S.spM1[2]).toLocaleString()+'</td><td class="'+m1c+'">$'+m1.toLocaleString()+'</td><td>FactSet Jun 2026 · Goldman May 2026</td></tr>'+
    '<tr><td>Model 2<br>CAPE reversion</td><td>EPS growth discounted by CAPE mean-reversion</td><td>CAPE target: '+capeTarget+'. EPS: '+epsGr+'</td><td class="kp-mid">$'+Math.round(S.spM2[2]).toLocaleString()+'</td><td class="'+m2c+'">$'+m2.toLocaleString()+'</td><td>Shiller/Yale · GuruFocus</td></tr>'+
    '<tr><td>Model 3<br>Institutional</td><td>Annual return forecasts → price levels</td><td>High: Vanguard 5%. Mid: RA 3.1%. Low: GMO -2.7% nominal</td><td class="kp-mid">$'+Math.round(S.spM3[2]).toLocaleString()+'</td><td>$'+m3l.toLocaleString()+' – $'+m3h.toLocaleString()+'</td><td>Vanguard Mar 2026 · RA Jan 2026 · GMO Q1 2026</td></tr>'+
    '<tr style="background:#f9f8f5;font-weight:500;"><td>Convergence</td><td colspan="2">Where models converge = most defensible.</td><td class="kp-mid">$'+Math.min(Math.round(S.spM1[2]),Math.round(S.spM2[2])).toLocaleString()+'–$'+Math.max(Math.round(S.spM1[2]),Math.round(S.spM2[2])).toLocaleString()+'</td><td class="kp-mid">$'+Math.min(m1,m2).toLocaleString()+'–$'+Math.max(m1,m2).toLocaleString()+'</td><td>Model overlap</td></tr>';
}

function buildRiskGrid(sc){
  const S=SC[sc];
  document.getElementById('kp-risk-grid').innerHTML=
    '<div class="kp-risk-card" style="background:'+S.color+'10;border:0.5px solid '+S.color+'40;"><h3 style="color:'+S.color+';">✅ Supporting evidence</h3><ul>'+S.bull.map(b=>'<li>'+b+'</li>').join('')+'</ul></div>'+
    '<div class="kp-risk-card" style="background:#e24b4a0d;border:0.5px solid #e24b4a40;"><h3 style="color:#a32d2d;">⚠ Contradicting evidence / risks</h3><ul>'+S.bear.map(b=>'<li>'+b+'</li>').join('')+'</ul></div>';
}

function setSc(sc){
  kpSc=sc;
  document.querySelectorAll('[data-kp-sc]').forEach(el=>{
    const s=el.dataset.kpSc;
    const colors={base:'#1d9e75',bull:'#185fa5',bear:'#e24b4a'};
    if(s===sc){el.classList.add('active');el.style.background=SC[sc].color;el.style.color='#fff';el.style.borderColor='transparent';}
    else{el.classList.remove('active');el.style.background='';el.style.color=colors[s];el.style.borderColor=colors[s];}
  });
  buildChart(sc);buildStats(sc);buildInfo(sc);buildPhaseStrip(sc);buildModelTable(sc);buildRiskGrid(sc);
}

document.querySelectorAll('[data-kp-sc]').forEach(el=>{
  el.addEventListener('click',()=>setSc(el.dataset.kpSc));
});

function init(){buildChart('base');buildStats('base');buildInfo('base');buildPhaseStrip('base');buildModelTable('base');buildRiskGrid('base');}
if(window.Chart&&window.Chart.register){init();}
else{window.addEventListener('load',init);}
})();
</script>
<!-- KP_PROJECTION_END -->`;

// ── Inject CDN scripts (idempotent — history script may have already added them) ─
if (!html.includes('chart.umd.min.js')) {
  html = html.replace('</head>', `<script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" crossorigin="anonymous"></script>\n</head>`);
}
if (!html.includes('chartjs-plugin-annotation')) {
  html = html.replace('</head>', `<script src="https://cdnjs.cloudflare.com/ajax/libs/chartjs-plugin-annotation/3.0.1/chartjs-plugin-annotation.min.js" crossorigin="anonymous"></script>\n</head>`);
}

// ── Inject style ──────────────────────────────────────────────────────────────
html = html.replace('</head>', style + '\n</head>');

// ── Inject after history section (or before operational-chart-section) ────────
let insertPos = -1;
const histEnd = html.indexOf('<!-- KH_HISTORY_END -->');
if (histEnd >= 0) {
  insertPos = histEnd + '<!-- KH_HISTORY_END -->'.length;
} else {
  insertPos = html.indexOf('<section id="operational-chart-section"');
}

if (insertPos >= 0) {
  html = html.slice(0, insertPos) + '\n' + section + '\n' + html.slice(insertPos);
} else {
  html = html.replace('</main>', section + '\n</main>') || (html + '\n' + section);
}

fs.writeFileSync(indexPath, html);
console.log('kostolany-projection-section injected (3-model Chart.js)');
