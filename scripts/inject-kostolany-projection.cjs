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
      <span class="kp-eyebrow">Phase C Projection · Three Models · 2026–2030</span>
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
const NOW_SP=7420,NOW_CAPE=41.6;
const EPS0=338;                        // FactSet 2026 fwd EPS consensus
const PE0=+(NOW_SP/EPS0).toFixed(1);   // ~22.0x — anchors to current price
const HIST_YEARS=[2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
const HIST_RATES=[0.13,0.40,1.00,1.83,2.16,0.36,0.08,1.68,5.02,5.14,4.16,3.62];
const HIST_SP=[2044,2239,2674,2507,3231,3756,4766,3840,4769,5882,6820,7420];
// ── monthly path generators (49 pts: m=0→2026.0 … m=48→2030.0) ───────────
// Model 1: EPS₀×(1+g)^t × PE(t).  g decelerates by year; PE drifts linearly.
function epsPath(epsRates,peTgts){
  const pe=[PE0,...peTgts];
  return Array.from({length:49},function(_,m){
    var yr=m/12,yf=Math.floor(yr),fr=yr-yf;
    var eps=EPS0;
    for(var y=0;y<yf&&y<epsRates.length;y++)eps*=(1+epsRates[y]);
    if(yf<epsRates.length)eps*=Math.pow(1+epsRates[yf],fr);
    var y0=Math.min(yf,pe.length-2);
    var pv=pe[y0]+(pe[y0+1]-pe[y0])*(yr-y0);
    return {x:2026+yr,y:Math.round(eps*pv)};
  });
}
// Model 2: CAPE mean-reversion.  Each month: price × (1+eps_mo) × (1+cape_mo).
function capePath(tgt,yrs,epsA){
  var mc=Math.pow(Math.pow(tgt/NOW_CAPE,1/yrs),1/12)-1;
  var em=Math.pow(1+epsA,1/12)-1;
  var pts=[],v=NOW_SP;
  for(var m=0;m<=48;m++){pts.push({x:2026+m/12,y:Math.round(v)});v*=(1+em)*(1+mc);}
  return pts;
}
// Model 3: constant annualised return, compounded monthly.
function returnPath(r){
  var mo=Math.pow(1+r,1/12)-1,pts=[],v=NOW_SP;
  for(var m=0;m<=48;m++){pts.push({x:2026+m/12,y:Math.round(v)});v*=(1+mo);}
  return pts;
}
// Rate path: linear interpolation between annual targets, monthly resolution.
function rateMo(path){
  return Array.from({length:49},function(_,m){
    var yr=m/12,y0=Math.min(Math.floor(yr),path.length-2);
    return {x:2026+yr,y:+(path[y0]+(path[y0+1]-path[y0])*(yr-y0)).toFixed(2)};
  });
}
// ── scenario definitions — parameters drive the math, not hardcoded prices ──
const SC={
  base:{name:'Base',color:'#1d9e75',
    // Model 1: EPS₀=$338, growth +14%/+8%/+7%/+6%, P/E 22→21→20.5→20→19.5
    m1:epsPath([0.142,0.080,0.069,0.061],[21.0,20.5,20.0,19.5]),
    // Model 2: CAPE 41.6→27.6 (20yr avg) over 10yr, 8% annual EPS
    m2:capePath(27.6,10,0.08),
    // Model 3: Institutional return range (Vanguard/RA/GMO)
    m3:returnPath(0.038),m3h:returnPath(0.050),m3l:returnPath(-0.027),
    // FOMC SEP rate path (annual targets → interpolated monthly)
    rateMo:rateMo([3.62,3.50,3.25,3.10,3.00]),
    cards:[
      {val:'$338 \xd7 22x = $7,436',lbl:'Anchored to today',sub:'EPS0 \xd7 PE0 validates start',src:'FactSet/Goldman'},
      {val:'+14% / +8% / +7% / +6%',lbl:'EPS growth (yr 1–4)',sub:'FactSet deceleration consensus',src:'FactSet Jun 2026'},
      {val:'22x → 19.5x by 2030',lbl:'P/E path',sub:'Goldman mild compression',src:'Goldman May 2026'},
      {val:'CAPE 41.6\xd7 → 27.6\xd7',lbl:'CAPE reversion (10yr)',sub:'Partial reversion to 20yr avg',src:'GuruFocus'},
    ],
    info:'<strong style="color:#1d9e75">Base — three models, three answers:</strong><br><strong>Model 1 (EPS\xd7P/E):</strong> $338 \xd7 22.0x today. EPS compounds at +14%/+8%/+7%/+6% with P/E drifting 22x→19.5x → $9,224 by 2030.<br><strong>Model 2 (CAPE reversion):</strong> 8% annual EPS offset by CAPE reverting 41.6x→27.6x over 10yr at -4%/yr → ~$8,740.<br><strong>Model 3 (Institutional):</strong> Vanguard 3.8% → $8,740, Vanguard upside 5% → $9,030, GMO -2.7% nominal → $6,580.',
    bull:['FactSet Q1 2026 actual EPS growth +27.1% YoY','AI capex $650–700bn begins monetising in 2027','Rate cuts to 3.0% by 2028 support multiple expansion','M2 +4.6% YoY provides liquidity'],
    bear:['CAPE 41.6× — Model 2 reversion headwind is structural and persistent','GMO 7yr: US Large Caps -5.4% real is most bearish credible forecast','Goldman warns momentum/breadth concentration risk','Vanguard 4–5% vs 7–10% historical = structural return shortfall'],
  },
  bull:{name:'Bull',color:'#185fa5',
    // Model 1: EPS₀=$338, AI monetises faster +21%/+12%/+10%/+8%, P/E holds 23x
    m1:epsPath([0.210,0.120,0.100,0.080],[23.0,23.0,22.5,22.0]),
    // Model 2: Structural new mean 32x over 10yr, 10% EPS
    m2:capePath(32.0,10,0.10),
    m3:returnPath(0.050),m3h:returnPath(0.080),m3l:returnPath(0.030),
    rateMo:rateMo([3.62,3.25,2.75,2.50,2.50]),
    cards:[
      {val:'$338 \xd7 22x = $7,436',lbl:'Anchored to today',sub:'Same start, higher path required',src:'FactSet'},
      {val:'+21% / +12% / +10% / +8%',lbl:'EPS growth (yr 1–4)',sub:'AI monetises — Goldman bull case',src:'Goldman bull'},
      {val:'22x → 22x by 2030',lbl:'P/E holds',sub:'Multiple sustained on AI earnings',src:'Goldman/Yardeni'},
      {val:'CAPE 41.6\xd7 → 32\xd7',lbl:'CAPE new mean (bull)',sub:'Structural AI premium assumption',src:'Bull assumption'},
    ],
    info:'<strong style="color:#185fa5">Bull — what has to be true:</strong><br><strong>Model 1:</strong> EPS compounds at +21%/+12%/+10%/+8% with P/E holding 23x → ~$11,800 by 2030. Requires AI monetisation.<br><strong>Model 2:</strong> If AI shifts structural CAPE mean to 32x over 10yr + 10% EPS → ~$10,700.<br><strong>Model 3:</strong> Vanguard upside 5%/yr → $9,030, optimistic 8% → $10,200.',
    bull:['Goldman EPS $340 tracking (+24% Q1 2026 actual)','Mag7 FCF $350bn 2025 — earnings base is real','Deeper cuts = lower discount rate = higher justified multiple','Vanguard upside: AI diffusion → 3% GDP growth'],
    bear:['CAPE 41.6× — never sustained above 40× for >18 months historically','Structural new mean 32× is assumption, not data','MIT: AI economically justified for <5% of US tasks at current cost','Goldman: narrow breadth is cautionary signal even in bull case'],
  },
  bear:{name:'Bear',color:'#e24b4a',
    // Model 1: EPS₀=$338, AI misses +8%/+4%/+3%/+3%, P/E compresses 20x→16x
    m1:epsPath([0.080,0.040,0.030,0.030],[20.0,18.0,17.0,16.0]),
    // Model 2: Full CAPE reversion to 145yr mean 17.3x over 7yr, 4% EPS
    m2:capePath(17.3,7,0.04),
    m3:returnPath(-0.027),m3h:returnPath(0.016),m3l:returnPath(-0.054),
    rateMo:rateMo([3.62,4.25,4.75,5.00,4.25]),
    cards:[
      {val:'$338 \xd7 22x = $7,436',lbl:'Anchored to today',sub:'Same start, CAPE headwind compresses path',src:'FactSet'},
      {val:'+8% / +4% / +3% / +3%',lbl:'EPS growth (yr 1–4)',sub:'AI not monetising (MIT <5% tasks)',src:'Bear/MIT'},
      {val:'22x → 16x by 2030',lbl:'P/E compression',sub:'CAPE mean-reversion to long-run avg',src:'GMO/CAPE'},
      {val:'CAPE 41.6\xd7 → 17.3\xd7',lbl:'CAPE target (7yr)',sub:'Full reversion to 145yr mean',src:'Shiller/Yale'},
    ],
    info:'<strong style="color:#e24b4a">Bear — what data-driven pessimists say:</strong><br><strong>Model 1:</strong> EPS misses at +8%/+4%/+3%/+3% with P/E compressing 22x→16x (CAPE gravity) → ~$5,760.<br><strong>Model 2:</strong> Full CAPE reversion 41.6x→17.3x over 7yr (GMO horizon) + 4% EPS → ~$5,200.<br><strong>Model 3:</strong> GMO -2.7% nominal → $6,580, CAPE implied 1.6%/yr → $7,890.',
    bull:['FactSet Q1 2026 actual +27.1% far outpacing bear EPS assumption','HY OAS 275bps — no credit stress signal','Fed still cutting — rate environment broadly supportive','GMO wrong on US equities for 10+ years'],
    bear:['GMO 7yr US Large Cap: -5.4% real (Q1 2026)','GuruFocus CAPE implied: 1.6%/yr at 41.6×','CAPE above 40× occurred twice in 145yr — both preceded major drawdowns','JPMorgan re-hike risk: PCE 2.7% end-2026 > 2% target'],
  },
};
let kpChart,kpSc='base';
const cmap={hike:'#e24b4a',cut:'#1d9e75',plateau:'#378add'};
const bgmap={hike:'#e24b4a0d',cut:'#1d9e750d',plateau:'#378add0d'};

function buildChart(sc){
  const S=SC[sc];
  // Historical: annual points 2015–2026
  const histSP=HIST_YEARS.map((y,i)=>({x:y,y:HIST_SP[i]}));
  const histRate=HIST_YEARS.map((y,i)=>({x:y,y:HIST_RATES[i]}));
  // Projections: monthly paths 2026–2030 (49 pts).
  // Each path already starts at x=2026 / y=NOW_SP so lines connect seamlessly.
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
    // Historical lines — annual, tension 0.35 for smooth look
    {label:'Rate (hist)',data:histRate,borderColor:'#24231f',backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0.35,showLine:true,yAxisID:'yRate',spanGaps:false},
    // Projection rate — monthly, dashed
    {label:'Rate (proj)',data:S.rateMo,borderColor:'#747168',backgroundColor:'transparent',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:0,showLine:true,yAxisID:'yRate',spanGaps:false},
    {label:'S&P (hist)',data:histSP,borderColor:'#405f9f',backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0.35,showLine:true,yAxisID:'ySP',spanGaps:false},
    // Projection lines — monthly derived paths, tension:0 (math already smooth)
    {label:'Inst high',data:S.m3h,borderColor:'transparent',backgroundColor:'rgba(170,166,155,0.12)',borderWidth:0,pointRadius:0,tension:0,showLine:true,fill:'+1',yAxisID:'ySP',spanGaps:false},
    {label:'Inst low',data:S.m3l,borderColor:'transparent',backgroundColor:'rgba(170,166,155,0.12)',borderWidth:0,pointRadius:0,tension:0,showLine:true,fill:false,yAxisID:'ySP',spanGaps:false},
    {label:'Model 3 (Inst.)',data:S.m3,borderColor:'#8a6a2c',backgroundColor:'transparent',borderWidth:1.5,borderDash:[2,3],pointRadius:0,tension:0,showLine:true,yAxisID:'ySP',spanGaps:false},
    {label:'Model 2 (CAPE rev.)',data:S.m2,borderColor:'#9f3f35',backgroundColor:'transparent',borderWidth:1.8,borderDash:[6,3],pointRadius:0,tension:0,showLine:true,yAxisID:'ySP',spanGaps:false},
    {label:'Model 1 (EPS\xd7P/E)',data:S.m1,borderColor:S.color,backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0,showLine:true,yAxisID:'ySP',spanGaps:false},
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
    {x1:2024,x2:2026,t:'plateau',l:'C: Verification ← NOW'},
    {x1:2026,x2:2028,t:'cut', l:'D: Expansion (proj.)'},
    sc==='bear'?{x1:2028,x2:2030,t:'hike',l:'A: re-hike (proj.)'}:{x1:2028,x2:2030,t:'plateau',l:'E: Euphoria (proj.)'},
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
  // Monthly paths: index 24 = 2028, index 36 = 2029, index 48 = 2030
  const m1_28=S.m1[24].y,m1_30=S.m1[48].y;
  const m2_28=S.m2[24].y,m2_30=S.m2[48].y;
  const m3_28=S.m3[24].y,m3h_30=S.m3h[48].y,m3l_30=S.m3l[48].y;
  const capeTarget=sc==='bear'?'17.3\xd7 (145yr mean, 7yr)':sc==='bull'?'32\xd7 (structural new mean)':'27.6\xd7 (20yr avg, 10yr)';
  const epsGrowth=sc==='bear'?'+8%/+4%/+3%/+3%':sc==='bull'?'+21%/+12%/+10%/+8%':'+14%/+8%/+7%/+6%';
  const peRange=sc==='bear'?'22\xd7→16\xd7':sc==='bull'?'22\xd7→22\xd7 (holds)':'22\xd7→19.5\xd7';
  const m1c=m1_30>NOW_SP?'kp-bull':'kp-bear', m2c=m2_30>NOW_SP?'kp-bull':'kp-bear';
  document.getElementById('kp-model-table').innerHTML=
    '<tr><th>Model</th><th>Formula</th><th>Parameters</th><th>2028</th><th>2030</th><th>Source</th></tr>'+
    '<tr><td>M1 · EPS\xd7P/E</td><td>EPS₀\xd7(1+g)ᵗ\xd7PE(t)</td><td>EPS₀=$338 · '+epsGrowth+' · PE: '+peRange+'</td><td class="kp-mid">$'+m1_28.toLocaleString()+'</td><td class="'+m1c+'">$'+m1_30.toLocaleString()+'</td><td>FactSet Jun 2026 · Goldman</td></tr>'+
    '<tr><td>M2 · CAPE rev.</td><td>P₀\xd7(1+eps)ᵗ\xd7(CAPEₜₐᵣ/CAPE₀)ᵗⁿʳˢ</td><td>CAPE 41.6\xd7→'+capeTarget+'</td><td class="kp-mid">$'+m2_28.toLocaleString()+'</td><td class="'+m2c+'">$'+m2_30.toLocaleString()+'</td><td>Shiller/Yale · GuruFocus</td></tr>'+
    '<tr><td>M3 · Institutional</td><td>P₀\xd7(1+r)ᵗ</td><td>High: Vanguard 5%. Mid: RA 3.8%. Low: GMO -2.7% nominal</td><td class="kp-mid">$'+m3_28.toLocaleString()+'</td><td>$'+m3l_30.toLocaleString()+' – $'+m3h_30.toLocaleString()+'</td><td>Vanguard · RA · GMO 2026</td></tr>'+
    '<tr style="border-top:1px solid var(--rule,#dedbd2);"><td style="font-weight:500;">Convergence</td><td colspan="2" style="color:var(--muted,#747168);">Range where M1 and M2 overlap = most defensible zone</td><td class="kp-mid">$'+Math.min(m1_28,m2_28).toLocaleString()+'–$'+Math.max(m1_28,m2_28).toLocaleString()+'</td><td class="kp-mid">$'+Math.min(m1_30,m2_30).toLocaleString()+'–$'+Math.max(m1_30,m2_30).toLocaleString()+'</td><td></td></tr>';
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
