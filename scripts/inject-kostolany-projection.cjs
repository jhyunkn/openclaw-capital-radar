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
.kp-sc-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.kp-stab{padding:6px 14px;border-radius:999px;border:1px solid var(--rule,#dedbd2);cursor:pointer;font-size:12px;color:var(--muted,#747168);background:transparent;transition:all 0.12s;font-weight:400}
.kp-stab.active{font-weight:500}
.kp-stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-bottom:16px;border:1px solid var(--rule,#dedbd2);border-right:none}
.kp-stat{border-right:1px solid var(--rule,#dedbd2);border-radius:0;padding:12px 10px;text-align:center;background:#ffffff}
.kp-stat-val{font-size:15px;font-weight:500;letter-spacing:-.02em;display:block;margin-bottom:4px}
.kp-stat-lbl{font-size:10px;color:var(--muted,#747168);line-height:1.4;display:block;margin-bottom:1px}
.kp-stat-src{font-size:9px;color:var(--soft,#aaa69b);font-style:italic}
.kp-leg-row{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:10px;font-size:11px;color:var(--muted,#747168);align-items:center}
.kp-leg-item{display:flex;align-items:center;gap:5px}
.kp-chart-wrap{position:relative;width:100%;height:420px;border:1px solid var(--rule,#dedbd2);background:var(--bg,#ffffff)}
.kp-rate-wrap{position:relative;width:100%;height:150px;border:1px solid var(--rule,#dedbd2);background:var(--bg,#ffffff);margin-top:10px}
.kp-rate-title{font-size:11px;color:var(--muted,#747168);margin:14px 0 6px}
.kp-model-tabs{display:flex;gap:6px;margin-bottom:14px;flex-wrap:wrap}
.kp-read{background:#ffffff;border:1px solid var(--rule,#dedbd2);padding:12px 16px;margin-bottom:12px;font-size:12px;color:var(--ink,#24231f);line-height:1.6}
.kp-read b{font-weight:600}
.kp-method-row{display:flex;gap:10px;align-items:baseline;margin-top:8px}
.kp-method-chip{flex:0 0 auto;font-size:10px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;border:1px solid var(--rule,#dedbd2);padding:2px 8px;border-radius:999px;color:var(--ink,#24231f);background:#fff}
.kp-method-row p{margin:0;font-size:12px;color:var(--muted,#747168);line-height:1.55}
.kp-method-row p strong{color:var(--ink,#24231f);font-weight:500}
.kp-leg-note{font-size:11px;color:var(--muted,#747168);margin:2px 0 10px;line-height:1.5}
.kp-position{font-size:12px;color:var(--muted,#747168);margin:0 0 12px;line-height:1.55}
.kp-info-box{margin-top:8px;padding:10px 14px;border:1px solid var(--rule,#dedbd2);background:#ffffff;font-size:12px;color:var(--muted,#747168);line-height:1.6;min-height:44px;border-radius:0}
.kp-table-head{font-size:11px;font-weight:500;color:var(--ink,#24231f);margin:16px 0 6px;letter-spacing:-.02em}
.kp-model-table{width:100%;border-collapse:collapse;font-size:12px;border:1px solid var(--rule,#dedbd2)}
.kp-model-table th{text-align:left;padding:7px 10px;font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted,#747168);border-bottom:1px solid var(--rule,#dedbd2);background:rgba(0,0,0,.025);font-weight:500}
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

// ── Anchor price: the current close from LIVE data, not a hardcoded constant ──
// Primary source: outputs/episode-state.json spx.close — the settled close
// regenerated by every lane run. Fallback: the decision-brief market state
// (chart_reference.current). Last resort: the last-known constant (stale by
// construction — the position line below always dates the anchor, so a stale
// anchor is visible, never silent).
let nowSp = 7420;
let anchorDate = null;
try {
  const ep = JSON.parse(fs.readFileSync(path.join(root, 'outputs', 'episode-state.json'), 'utf8'));
  const cur = Number(ep?.spx?.close);
  if (Number.isFinite(cur) && cur > 0) {
    nowSp = Math.round(cur);
    anchorDate = String(ep?.spx?.date || ep?.dataThrough || '');
  }
} catch { /* fall through to the brief state */ }
if (anchorDate == null) {
  try {
    const brief = JSON.parse(fs.readFileSync(path.join(root, 'outputs', 'market-decision-brief-state.json'), 'utf8'));
    const cur = Number(brief?.chart_reference?.current);
    if (Number.isFinite(cur) && cur > 0) nowSp = Math.round(cur);
  } catch { /* keep fallback */ }
}

// ── Where today sits: drawdown + distance vs the 200-day, from the same live
// episode state as the anchor, so the fan's origin is dated and placed. The
// current price IS the fan's origin (every model path starts at the anchor) —
// the line says so plainly instead of pretending today sits inside a range.
let posLine = '';
try {
  const ep = JSON.parse(fs.readFileSync(path.join(root, 'outputs', 'episode-state.json'), 'utf8'));
  const s = ep?.spx || {};
  const close = Number(s.close), hi = Number(s.trailingHigh120), ma = Number(s.sma200);
  if ([close, hi, ma].every(Number.isFinite) && close > 0 && hi > 0 && ma > 0) {
    const dd = Number.isFinite(Number(s.drawdownFromHighPct)) ? Number(s.drawdownFromHighPct) : (close / hi - 1) * 100;
    const vs200 = Number.isFinite(Number(s.pctVsSma200)) ? Number(s.pctVsSma200) : (close / ma - 1) * 100;
    const fmt = v => '$' + Math.round(v).toLocaleString('en-US');
    const asOf = String(s.date || ep?.dataThrough || '');
    posLine = `<p class="kp-position">Where today sits: S&amp;P 500 ${fmt(close)} at the ${asOf} close — ${Math.abs(dd).toFixed(2)}% ${dd <= 0 ? 'below' : 'above'} its 120-day high (${fmt(hi)}) and ${Math.abs(vs200).toFixed(2)}% ${vs200 >= 0 ? 'above' : 'below'} its 200-day (${fmt(ma)}). The fan starts here: every model path begins at today's level, so the current price is the fan's origin — the fan answers where the level goes from here, not where it sits inside a range.</p>`;
  }
} catch { /* no position line when live state is unavailable */ }

// ── CAPE anchor: single dated source (data/valuation-cape.json), same
// pattern as nowSp above. The 41.6 hardcoded here before was a stale
// late-Sep print; the 2026-10-16 close is 40.54 (Shiller CAPE, multpl).
// Fallback = last sourced value; validate-coherence fails if any CAPE
// print on the page disagrees with another.
let capeNow = 40.54;
let capeSrc = 'Shiller CAPE (multpl)';
try {
  const cape = JSON.parse(fs.readFileSync(path.join(root, 'data', 'valuation-cape.json'), 'utf8'));
  if (Number.isFinite(Number(cape?.value))) capeNow = Number(cape.value);
  if (cape?.source) capeSrc = String(cape.source);
} catch { /* keep fallback */ }
const CAPE_TXT = String(capeNow);

// ── Section HTML ──────────────────────────────────────────────────────────────
const section = `<!-- KP_PROJECTION_START -->
<div id="kostolany-projection-section" class="kp-wrap">
<div class="kp-inner">
  <div class="kp-head">
    <div>
      <span class="kp-eyebrow">Long-Horizon Valuation · Three Models · 2026–2030</span>
      <h2 class="kp-title">S&amp;P 500 — Long-Horizon Valuation Fans (2026–2030)</h2>
      <p class="kp-subtitle">Three independent models — EPS × P/E, CAPE reversion, and institutional — each drawn as a band from its bear to its bull scenario. The band is the honest part: one line to the moon would be a lie.</p>
      <p class="kp-subtitle"><strong>Context only:</strong> these fans frame long-horizon (2026–2030) valuation scenarios. They are not a near-term forecast and not a trading signal.</p>
      ${posLine}
    </div>
  </div>
  <div class="kp-read">
    <b>How to read this chart:</b> one model at a time — pick a model above. Its <b>bottom edge = bear scenario</b>, its <b>top edge = bull scenario</b>, its <b>center line = the scenario selected below</b>. The table underneath compares all three models at 2030, so you can see where they agree and where they don't.
    <div class="kp-method-row"><span class="kp-method-chip">Model 1 · EPS × P/E</span><p><strong>Uses:</strong> FactSet EPS trajectory × Goldman P/E path. <strong>Gives:</strong> year-end S&P 500 price.</p></div>
    <div class="kp-method-row"><span class="kp-method-chip">Model 2 · CAPE reversion</span><p><strong>Uses:</strong> current CAPE ${CAPE_TXT}× pulled toward its long-run average at a chosen speed + EPS growth. <strong>Gives:</strong> implied price level.</p></div>
    <div class="kp-method-row"><span class="kp-method-chip">Model 3 · Institutional</span><p><strong>Uses:</strong> Vanguard / Research Affiliates / GMO annualized return forecasts. <strong>Gives:</strong> price range from compounding today's level.</p></div>
    <div class="kp-method-row"><span class="kp-method-chip">Rate path</span><p>FOMC SEP median, Mar 2026 — shown on the small rate chart below; context only, not a return driver.</p></div>
  </div>
  <div class="kp-model-tabs" id="kp-model-tabs">
    <div class="kp-stab active" data-kp-model="m1" style="background:#2563a8;border-color:#2563a8;color:#fff;">EPS × P/E</div>
    <div class="kp-stab" data-kp-model="m2" style="border-color:#b45f06;color:#b45f06;">CAPE reversion</div>
    <div class="kp-stab" data-kp-model="m3" style="border-color:#6d28d9;color:#6d28d9;">Institutional</div>
  </div>
  <div class="kp-sc-tabs" id="kp-sc-tabs">
    <div class="kp-stab active" data-kp-sc="base" style="background:#1d9e75;border-color:#1d9e75;color:#fff;">Base — EPS delivers, multiple flat</div>
    <div class="kp-stab" data-kp-sc="bull" style="border-color:#185fa5;color:#185fa5;">Bull — EPS beats, multiple expands</div>
    <div class="kp-stab" data-kp-sc="bear" style="border-color:#e24b4a;color:#e24b4a;">Bear — CAPE mean-reverts / EPS misses</div>
  </div>
  <div class="kp-stat-grid" id="kp-stat-grid"></div>
  <div class="kp-leg-row" id="kp-leg-row">
    <div class="kp-leg-item"><span style="width:20px;height:2.5px;background:#405f9f;display:inline-block;"></span>S&amp;P 500 (history)</div>
    <div class="kp-leg-item"><span style="width:20px;height:10px;display:inline-block;background:#2563a822;border-top:2.5px solid #2563a8;"></span>EPS × P/E fan</div>
    <div class="kp-leg-item"><span style="width:20px;height:0;border-top:2px dashed #ba7517;display:inline-block;"></span>Now</div>
  </div>
  <p class="kp-leg-note">Fan bottom edge = bear scenario, fan top edge = bull scenario, center line = the scenario tab you selected. Every fan starts at the same anchor — today's S&amp;P 500 level; the 2026 point is the current level, not a 2026 year-end forecast.</p>
  <div class="kp-chart-wrap"><canvas id="kp-proj-chart"></canvas></div>
  <p class="kp-rate-title">Fed funds rate — history and FOMC SEP projection (context only, not a return driver)</p>
  <div class="kp-rate-wrap"><canvas id="kp-rate-chart"></canvas></div>
  <div class="kp-info-box" id="kp-info-box">Select a scenario to see the model assumptions and outputs.</div>
  <div>
    <p class="kp-table-head">Model comparison — 2030 S&amp;P 500 implied price</p>
    <table class="kp-model-table" id="kp-model-table"></table>
  </div>
  <div class="kp-risk-grid" id="kp-risk-grid"></div>
  <div class="kp-disclaimer">
    <strong>Methodology transparency:</strong> Model 1 uses FactSet/Goldman EPS consensus × P/E — a structured calculation, not an analyst price target.
    Model 2 applies CAPE mean-reversion to current CAPE ${CAPE_TXT}× with EPS growth — mathematically grounded valuation headwind.
    Model 3 translates Vanguard VCMM Mar 2026, Research Affiliates Jan 2026, GMO Q1 2026 10-year return forecasts into price levels.
    Each model is drawn as a band across its bear/base/bull scenarios — the spread between the edges is genuine uncertainty, not decoration. Rate path is context only.
  </div>
</div>
</div>
<script id="kp-init-script">
(function(){
if(typeof Chart==='undefined'||window.__kpInited)return;
window.__kpInited=true;
const NOW_SP=${nowSp},NOW_CAPE=${capeNow},ANCHOR_DATE='${anchorDate || ''}';   // build-time anchors: SP from live episode state, CAPE from data/valuation-cape.json
const EPS0=338;                        // FactSet 2026 fwd EPS consensus
const PE0=NOW_SP/EPS0;                 // exact implied P/E at the anchor (22.66x): EPS0 × PE0 = NOW_SP by construction. Do NOT pre-round — rounding to 22.7x made Model 1's fan start at 7,673 while Models 2/3 start at NOW_SP.
const PE0_TXT=PE0.toFixed(1);          // display form (22.7x)
const HIST_YEARS=[2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
const HIST_RATES=[0.13,0.40,1.00,1.83,2.16,0.36,0.08,1.68,5.02,5.14,4.22,3.62];
const HIST_SP=[2044,2239,2674,2507,3231,3756,4766,3840,4769,5882,6350,${nowSp}];
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
// ── Model 3 rate sets — single source for the M3 paths AND the model
// table's Parameters cell, so the printed parameters are the rates actually
// compounded per scenario (the cell was a static base-case string before —
// Batch 2 A8). note = basis qualifier where the source forecast has one.
const M3_RATES={
  base:{mid:{r:0.038,src:'RA'},high:{r:0.050,src:'Vanguard'},low:{r:-0.027,src:'GMO',note:'nominal'}},
  bull:{mid:{r:0.050,src:'Vanguard'},high:{r:0.080,src:'Optimistic'},low:{r:0.030,src:'Vanguard'}},
  bear:{mid:{r:-0.027,src:'GMO',note:'nominal'},high:{r:0.016,src:'CAPE implied'},low:{r:-0.054,src:'GMO',note:'real'}},
};
// ── scenario paths — computed ONCE here. The chart, the model table and
// the narrative prose all read these same arrays, so a figure in the text
// can never drift from the figure in the table. ──
const PATHS={
  base:{ // M1: EPS +14%/+8%/+7%/+6%, P/E 21/20.5/20/19.5 · M2: CAPE to 27.6 (20yr avg) over 10yr, 8% EPS · M3: 3.8% mid / 5% high / -2.7% low (GMO)
    m1:epsPath([0.142,0.080,0.069,0.061],[21.0,20.5,20.0,19.5]),
    m2:capePath(27.6,10,0.08),
    m3:returnPath(M3_RATES.base.mid.r),m3h:returnPath(M3_RATES.base.high.r),m3l:returnPath(M3_RATES.base.low.r)},
  bull:{ // M1: EPS +21%/+12%/+10%/+8%, P/E holds ~23 · M2: CAPE to 32 (structural new mean) over 10yr, 10% EPS · M3: 5% mid / 8% high / 3% low
    m1:epsPath([0.210,0.120,0.100,0.080],[23.0,23.0,22.5,22.0]),
    m2:capePath(32.0,10,0.10),
    m3:returnPath(M3_RATES.bull.mid.r),m3h:returnPath(M3_RATES.bull.high.r),m3l:returnPath(M3_RATES.bull.low.r)},
  bear:{ // M1: EPS +8%/+4%/+3%/+3%, P/E 20/18/17/16 · M2: CAPE to 17.3 (145yr mean) over 7yr, 4% EPS · M3: -2.7% mid (GMO) / +1.6% high / -5.4% low
    m1:epsPath([0.080,0.040,0.030,0.030],[20.0,18.0,17.0,16.0]),
    m2:capePath(17.3,7,0.04),
    m3:returnPath(M3_RATES.bear.mid.r),m3h:returnPath(M3_RATES.bear.high.r),m3l:returnPath(M3_RATES.bear.low.r)},
};
// Narrative endpoint formatter — the 2030 value (path index 48) rounded to
// the nearest $10, the prose convention (~$X,XXX). This is the ONLY way an
// S&P level may enter the narrative strings below: no hand-typed endpoints
// (validate-coherence check (g) enforces this on the built page).
const D2030=function(p){return '$'+(Math.round(p[48].y/10)*10).toLocaleString('en-US');};
// Anchor card value, built from the anchor identity itself: EPS0 × PE0 = NOW_SP.
const ANCHOR_TXT='$'+EPS0+' \xd7 '+PE0.toFixed(2)+'\xd7 = $'+NOW_SP.toLocaleString('en-US');
// Rate formatter for Model 3 cards (mid/high/low are {r, src, note?}).
// Returns a percent string like "3.8%" or "-2.7% nominal" — no $ level.
const PCT3=function(x){return (x.r*100).toFixed(1).replace(/\.0$/,'')+'%'+(x.note?' '+x.note:'');};
// ── scenario definitions — parameters drive the math, not hardcoded prices ──
const SC={
  base:{name:'Base',color:'#1d9e75',
    m1:PATHS.base.m1,
    m2:PATHS.base.m2,
    m3:PATHS.base.m3,m3h:PATHS.base.m3h,m3l:PATHS.base.m3l,
    // FOMC SEP rate path (annual targets → interpolated monthly)
    rateMo:rateMo([3.88,4.10,4.10,3.65,3.20]), // Sep 2026 SEP: 4.1% end-26/27, 3.2% LR; start = post-hike midpoint
    cards:[
      {val:ANCHOR_TXT,lbl:'Anchored to today',sub:'EPS0 \xd7 implied PE0 — the anchor, by construction',src:'FactSet/Goldman'},
      {val:'+14% / +8% / +7% / +6%',lbl:'EPS growth (yr 1–4)',sub:'FactSet deceleration consensus',src:'FactSet Jun 2026'},
      {val:PE0_TXT+'x → 19.5x by 2030',lbl:'P/E path',sub:'Goldman mild compression',src:'Goldman May 2026'},
      {val:D2030(PATHS.base.m1),lbl:'2030 implied price',sub:'EPS × P/E path',src:'Model 1'},
    ],
    info:'<strong style="color:#1d9e75">Base — three models, three answers:</strong><br><strong>Model 1 (EPS\xd7P/E):</strong> $'+EPS0+' \xd7 '+PE0_TXT+'x today. EPS compounds at +14%/+8%/+7%/+6% with P/E drifting '+PE0_TXT+'x→19.5x → '+D2030(PATHS.base.m1)+' by 2030.<br><strong>Model 2 (CAPE reversion):</strong> 8% annual EPS offset by CAPE reverting ${CAPE_TXT}x→27.6x over 10yr at -4%/yr → ~'+D2030(PATHS.base.m2)+'.<br><strong>Model 3 (Institutional):</strong> Vanguard 3.8% → '+D2030(PATHS.base.m3)+', Vanguard upside 5% → '+D2030(PATHS.base.m3h)+', GMO -2.7% nominal → '+D2030(PATHS.base.m3l)+'.',
    bull:['FactSet Q1 2026 actual EPS growth +27.1% YoY','AI capex $650–700bn begins monetising in 2027','Rate cuts to 3.0% by 2028 support multiple expansion','M2 +4.6% YoY provides liquidity'],
    bear:['CAPE ${CAPE_TXT}× — Model 2 reversion headwind is structural and persistent','GMO 7yr: US Large Caps -5.4% real is most bearish credible forecast','Goldman warns momentum/breadth concentration risk','Vanguard 4–5% vs 7–10% historical = structural return shortfall'],
  },
  bull:{name:'Bull',color:'#185fa5',
    m1:PATHS.bull.m1,
    m2:PATHS.bull.m2,
    m3:PATHS.bull.m3,m3h:PATHS.bull.m3h,m3l:PATHS.bull.m3l,
    rateMo:rateMo([3.88,3.50,3.00,2.75,2.75]),
    cards:[
      {val:ANCHOR_TXT,lbl:'Anchored to today',sub:'Same start, higher path required',src:'FactSet'},
      {val:'+21% / +12% / +10% / +8%',lbl:'EPS growth (yr 1–4)',sub:'AI monetises — Goldman bull case',src:'Goldman bull'},
      {val:PE0_TXT+'x → 22x by 2030',lbl:'P/E holds',sub:'Multiple sustained on AI earnings',src:'Goldman/Yardeni'},
      {val:D2030(PATHS.bull.m1),lbl:'2030 implied price',sub:'EPS × P/E path',src:'Model 1'},
    ],
    info:'<strong style="color:#185fa5">Bull — what has to be true:</strong><br><strong>Model 1:</strong> EPS compounds at +21%/+12%/+10%/+8% with P/E holding 23x → ~'+D2030(PATHS.bull.m1)+' by 2030. Requires AI monetisation.<br><strong>Model 2:</strong> If AI shifts structural CAPE mean to 32x over 10yr + 10% EPS → ~'+D2030(PATHS.bull.m2)+'.<br><strong>Model 3:</strong> Vanguard upside 5%/yr → '+D2030(PATHS.bull.m3)+', optimistic 8% → '+D2030(PATHS.bull.m3h)+'.',
    bull:['Goldman EPS $340 tracking (+24% Q1 2026 actual)','Mag7 FCF $350bn 2025 — earnings base is real','Deeper cuts = lower discount rate = higher justified multiple','Vanguard upside: AI diffusion → 3% GDP growth'],
    bear:['CAPE ${CAPE_TXT}× — never sustained above 40× for >18 months historically','Structural new mean 32× is assumption, not data','MIT: AI economically justified for <5% of US tasks at current cost','Goldman: narrow breadth is cautionary signal even in bull case'],
  },
  bear:{name:'Bear',color:'#e24b4a',
    m1:PATHS.bear.m1,
    m2:PATHS.bear.m2,
    m3:PATHS.bear.m3,m3h:PATHS.bear.m3h,m3l:PATHS.bear.m3l,
    rateMo:rateMo([3.88,4.25,4.75,5.00,4.25]),
    cards:[
      {val:ANCHOR_TXT,lbl:'Anchored to today',sub:'Same start, CAPE headwind compresses path',src:'FactSet'},
      {val:'+8% / +4% / +3% / +3%',lbl:'EPS growth (yr 1–4)',sub:'AI not monetising (MIT <5% tasks)',src:'Bear/MIT'},
      {val:PE0_TXT+'x → 16x by 2030',lbl:'P/E compression',sub:'CAPE mean-reversion to long-run avg',src:'GMO/CAPE'},
      {val:D2030(PATHS.bear.m1),lbl:'2030 implied price',sub:'EPS × P/E path',src:'Model 1'},
    ],
    info:'<strong style="color:#e24b4a">Bear — what data-driven pessimists say:</strong><br><strong>Model 1:</strong> EPS misses at +8%/+4%/+3%/+3% with P/E compressing '+PE0_TXT+'x→16x (CAPE gravity) → ~'+D2030(PATHS.bear.m1)+'.<br><strong>Model 2:</strong> Full CAPE reversion ${CAPE_TXT}x→17.3x over 7yr (GMO horizon) + 4% EPS → ~'+D2030(PATHS.bear.m2)+'.<br><strong>Model 3:</strong> GMO -2.7% nominal → '+D2030(PATHS.bear.m3)+', CAPE implied 1.6%/yr → '+D2030(PATHS.bear.m3h)+'.',
    bull:['FactSet Q1 2026 actual +27.1% far outpacing bear EPS assumption','HY OAS 275bps — no credit stress signal','Fed still cutting — rate environment broadly supportive','GMO wrong on US equities for 10+ years'],
    bear:['GMO 7yr US Large Cap: -5.4% real (Q1 2026)','GuruFocus CAPE implied: 1.6%/yr at ${CAPE_TXT}×','CAPE above 40× occurred twice in 145yr — both preceded major drawdowns','JPMorgan re-hike risk: PCE 2.7% end-2026 > 2% target'],
  },
};
let kpChart,kpRateChart,kpSc='base',kpModel='m1';
const cmap={hike:'#e24b4a',cut:'#1d9e75',plateau:'#378add'};
const bgmap={hike:'#e24b4a0d',cut:'#1d9e750d',plateau:'#378add0d'};
// One model at a time on the main chart (readability fix): the three fans
// used to overlap into one blob. The model tabs pick which one is drawn.
const MODELS={
  m1:{name:'EPS × P/E',color:'#2563a8',dash:[],width:2.6,legStyle:'solid'},
  m2:{name:'CAPE reversion',color:'#b45f06',dash:[7,4],width:2.2,legStyle:'dashed'},
  m3:{name:'Institutional',color:'#6d28d9',dash:[2,3],width:2.0,legStyle:'dotted'},
};

function buildChart(sc,model){
  const S=SC[sc];
  const M=MODELS[model]||MODELS.m1;
  // Historical: annual points 2015–2026
  const histSP=HIST_YEARS.map((y,i)=>({x:y,y:HIST_SP[i]}));
  // Projections: monthly paths 2026–2030 (49 pts).
  // Each path already starts at x=2026 / y=NOW_SP so lines connect seamlessly.
  const M1C='#2563a8',M2C='#b45f06',M3C='#6d28d9';
  // Annotations are few and large on purpose: the old chart crowded six
  // phase boxes plus a projection box plus a neutral line plus a small CAPE
  // warning around the 2026 anchor. Only the Now line and the CAPE warning
  // stay on the main chart; the rate path and phase boxes live on the small
  // rate chart below it.
  const ann={
    nowLine:{type:'line',xMin:2026,xMax:2026,yMin:1000,yMax:16000,yScaleID:'ySP',borderColor:'#ba7517',borderWidth:1.5,borderDash:[4,3],label:{display:true,content:'Now — $'+NOW_SP.toLocaleString('en-US')+(ANCHOR_DATE?' ('+ANCHOR_DATE+')':''),position:'start',font:{size:11,weight:'bold'},color:'#ba7517',backgroundColor:'transparent'}},
    capeWarn:{type:'label',xValue:2021.5,yValue:14500,content:['CAPE ${CAPE_TXT}× · 2nd highest since 1881','Implied 10yr return: 1.6%/yr'],font:{size:11},color:'rgba(196,97,58,0.9)',textAlign:'center',backgroundColor:'rgba(255,248,240,0.95)',borderRadius:3,padding:{top:4,bottom:4,left:8,right:8}},
  };
  // ── Honest fan: each model is a band. Bottom edge = bear-scenario path,
  // top edge = bull-scenario path, center line = the selected scenario. ──
  function fan(lowPath,highPath,centerPath,color,dash,width,label){
    return [
      {label:'band:'+label+'-bear',data:lowPath,borderColor:'transparent',backgroundColor:'transparent',borderWidth:0,pointRadius:0,tension:0,showLine:true,fill:false,yAxisID:'ySP',spanGaps:false},
      {label:'band:'+label+'-bull',data:highPath,borderColor:'transparent',backgroundColor:color+'22',borderWidth:0,pointRadius:0,tension:0,showLine:true,fill:'-1',yAxisID:'ySP',spanGaps:false},
      {label:label+' · '+SC[sc].name+' case',data:centerPath,borderColor:color,backgroundColor:'transparent',borderWidth:width,borderDash:dash,pointRadius:0,tension:0,showLine:true,fill:false,yAxisID:'ySP',spanGaps:false},
    ];
  }
  const ds=[
    // Historical lines — annual, tension 0.35 for smooth look
    {label:'S&P 500 (history)',data:histSP,borderColor:'#405f9f',backgroundColor:'transparent',borderWidth:2.5,pointRadius:0,tension:0,showLine:true,yAxisID:'ySP',spanGaps:false},
    // Fan band — ONLY the selected model. Monthly derived paths, tension:0
    // (math already smooth). The other two models are one tab away.
    ...(model==='m2' ? fan(SC.bear.m2,SC.bull.m2,S.m2,M2C,[7,4],2.2,'Model 2 · CAPE reversion')
      : model==='m3' ? fan(SC.bear.m3l,SC.bull.m3h,S.m3,M3C,[2,3],2.0,'Model 3 · Institutional')
      : fan(SC.bear.m1,SC.bull.m1,S.m1,M1C,[],2.6,'Model 1 · EPS×P/E')),
  ];
  if(kpChart)kpChart.destroy();
  kpChart=new Chart(document.getElementById('kp-proj-chart'),{
    type:'scatter',data:{datasets:ds},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'nearest',axis:'x',intersect:false},
      layout:{padding:{top:6,right:8,bottom:4,left:4}},
      plugins:{
        legend:{display:false},
        annotation:{annotations:ann},
        tooltip:{callbacks:{
          title:items=>'Year: '+Math.round(items[0].parsed.x),
          label:item=>{
            const l=item.dataset.label;
            if(!l||l.indexOf('band:')===0)return null;
            if(item.parsed.y==null)return null;
            return l+': $'+Math.round(item.parsed.y).toLocaleString();
          }
        }}
      },
      scales:{
        x:{type:'linear',min:2014,max:2031,ticks:{stepSize:1,autoSkip:false,callback:v=>Number.isInteger(v)&&v>=2015?String(v):'',font:{size:10},color:'#747168'},grid:{color:'rgba(36,35,31,.05)'}},
        // Single axis — S&P 500 only. The Fed funds rate used to share this
        // chart on a second axis (0–6% left, 0–12,000 right); it now has its
        // own small chart below (buildRateChart).
        ySP:{type:'linear',position:'left',min:1000,max:16000,ticks:{callback:v=>[2000,4000,6000,8000,10000,12000,14000].includes(v)?'$'+v.toLocaleString():'',font:{size:11},color:'#405f9f'},grid:{color:'rgba(36,35,31,.05)'},title:{display:true,text:'S&P 500 (year-end)',font:{size:10},color:'#405f9f'}},
      }
    }
  });
}

// Small rate chart below the main chart: Fed funds history + FOMC SEP
// projection, with the Kostolany phase bands and the neutral rate. Same
// data as before, just no longer sharing an axis with the S&P 500.
function buildRateChart(sc){
  const S=SC[sc];
  const histRate=HIST_YEARS.map((y,i)=>({x:y,y:HIST_RATES[i]}));
  const ann={
    // The label floats just above the dashed line on a white chip: anchored
    // at the line's right end with a transparent background it sat ON the
    // line and ran hard against the edge. yAdjust lifts it clear; the chip
    // keeps the line from showing through.
    neutralLine:{type:'line',yMin:3.0,yMax:3.0,yScaleID:'y',borderColor:'rgba(29,158,117,0.30)',borderWidth:1,borderDash:[4,4],label:{display:true,content:'FOMC neutral 3%',position:'end',textAlign:'right',font:{size:9},color:'rgba(29,158,117,0.65)',backgroundColor:'rgba(255,255,255,0.92)',borderRadius:3,padding:3,yAdjust:-12}},
    nowLine:{type:'line',xMin:2026,xMax:2026,yMin:0,yMax:8,yScaleID:'y',borderColor:'#ba7517',borderWidth:1.5,borderDash:[4,3]},
  };
  // Phase labels are drawn by Chart.js at the bottom of each phase column,
  // so they always align with the x-axis years they describe (no separate strip).
  // Phase names are plain and chronological: the Kostolany letters (A–B,
  // F–D, B, C, D, E) ran backwards and repeated, so they read as a puzzle
  // instead of a timeline. The rate regime (hike/cut/plateau) still colors
  // each column; the name now says what happened in that stretch.
  const phases=[
    {x1:2015,x2:2019,t:'hike',l:'Hiking cycle'},
    {x1:2019,x2:2022,t:'cut', l:'COVID cuts'},
    {x1:2022,x2:2024,t:'hike',l:'Hikes · cash king'},
    {x1:2024,x2:2026,t:'cut', l:'Verification · now'},
    {x1:2026,x2:sc==='bear'?2027.5:2028,t:'cut', l:'Expansion'},
    sc==='bear'?{x1:2027.5,x2:2031,t:'hike',l:'Re-hike'}:{x1:2028,x2:2031,t:'plateau',l:'Euphoria'},
  ];
  phases.forEach((p,i)=>{ann['ph'+i]={type:'box',xMin:p.x1,xMax:p.x2,yMin:0,yMax:8,yScaleID:'y',backgroundColor:bgmap[p.t],borderColor:cmap[p.t]+'33',borderWidth:0.5,label:{display:true,content:p.l,position:{x:'center',y:'end'},font:{size:9,weight:'600'},color:'#5b574e',backgroundColor:'rgba(255,255,255,0.85)',borderRadius:3,padding:{top:2,bottom:2,left:5,right:5}}};});
  if(kpRateChart)kpRateChart.destroy();
  kpRateChart=new Chart(document.getElementById('kp-rate-chart'),{
    type:'scatter',
    data:{datasets:[
      {label:'Fed funds (history)',data:histRate,borderColor:'#24231f',backgroundColor:'transparent',borderWidth:2,pointRadius:0,tension:0.35,showLine:true,yAxisID:'y',spanGaps:false},
      {label:'Fed funds (FOMC SEP)',data:S.rateMo,borderColor:'#747168',backgroundColor:'transparent',borderWidth:1.5,borderDash:[5,4],pointRadius:0,tension:0,showLine:true,yAxisID:'y',spanGaps:false},
    ]},
    options:{
      responsive:true,maintainAspectRatio:false,
      interaction:{mode:'nearest',axis:'x',intersect:false},
      // Extra right padding so the "FOMC neutral 3%" label (anchored at the
      // line's right end) has breathing room and cannot clip at the edge.
      layout:{padding:{top:6,right:24,bottom:4,left:4}},
      plugins:{
        legend:{display:false},
        annotation:{annotations:ann},
        tooltip:{callbacks:{
          title:items=>'Year: '+Math.round(items[0].parsed.x),
          label:item=>item.dataset.label+': '+item.parsed.y?.toFixed(2)+'%'
        }}
      },
      scales:{
        x:{type:'linear',min:2014,max:2031,ticks:{stepSize:1,autoSkip:false,callback:v=>Number.isInteger(v)&&v>=2015?String(v):'',font:{size:10},color:'#747168'},grid:{color:'rgba(36,35,31,.05)'}},
        y:{type:'linear',position:'left',min:0,max:8,ticks:{callback:v=>v+'%',font:{size:10},color:'#24231f'},grid:{color:'rgba(36,35,31,.05)'},title:{display:true,text:'Fed Funds Rate',font:{size:10},color:'#747168'}},
      }
    }
  });
}

// The legend follows the visible model: S&P history + the selected fan + Now.
function buildLegend(model){
  const M=MODELS[model]||MODELS.m1;
  document.getElementById('kp-leg-row').innerHTML=
    '<div class="kp-leg-item"><span style="width:20px;height:2.5px;background:#405f9f;display:inline-block;"></span>S&P 500 (history)</div>'+
    '<div class="kp-leg-item"><span style="width:20px;height:10px;display:inline-block;background:'+M.color+'22;border-top:2.5px '+M.legStyle+' '+M.color+';"></span>'+M.name+' fan</div>'+
    '<div class="kp-leg-item"><span style="width:20px;height:0;border-top:2px dashed #ba7517;display:inline-block;"></span>Now</div>';
}

// Stat tiles follow the selected model tab: they used to describe Model 1
// (EPS × P/E) on every tab. Each model's tiles are computed from that
// model's own data — D2030() formats computed endpoints, ANCHOR_TXT is
// computed from the anchor identity; no hand-typed $X,XXX (check (g)).
// ${CAPE_TXT} / ${capeSrc} below are build-time interpolations (the same
// pattern the scenario cards already use), not runtime variables.
function modelCards(sc, model){
  const S=SC[sc];
  if(model==='m2'){
    const tgt = sc==='bear' ? {v:'17.3', yrs:'7yr'} : sc==='bull' ? {v:'32', yrs:'10yr'} : {v:'27.6', yrs:'10yr'};
    const eps = sc==='bear' ? '4%' : sc==='bull' ? '10%' : '8%';
    return [
      {val:ANCHOR_TXT,lbl:'Anchored to today',sub:'Same start — CAPE gravity shapes the path',src:'FactSet/Goldman'},
      {val:'CAPE ${CAPE_TXT}× → '+tgt.v+'×',lbl:'CAPE target ('+tgt.yrs+')',sub:'Reversion toward the long-run mean',src:'${capeSrc}'},
      {val:eps+' / yr',lbl:'EPS growth assumed',sub:'Offsets part of the reversion drag',src:'Shiller/Yale'},
      {val:D2030(S.m2),lbl:'2030 implied price',sub:'CAPE reversion path',src:'Model 2'},
    ];
  }
  if(model==='m3'){
    const R=M3_RATES[sc];
    return [
      {val:ANCHOR_TXT,lbl:'Anchored to today',sub:'Same start — compounded at forecast returns',src:'FactSet/Goldman'},
      {val:PCT3(R.mid)+' / yr',lbl:'Mid forecast ('+R.mid.src+')',sub:'The central house forecast',src:R.mid.src},
      {val:PCT3(R.low)+' – '+PCT3(R.high),lbl:'Forecast range',sub:'Low – high across the three houses',src:'Vanguard · RA · GMO'},
      {val:D2030(S.m3l)+' – '+D2030(S.m3h),lbl:'2030 price range',sub:'Compounding the current level',src:'Model 3'},
    ];
  }
  return S.cards;
}

function buildStats(sc, model){
  const S=SC[sc];
  const cards = modelCards(sc, model || 'm1');
  document.getElementById('kp-stat-grid').innerHTML=cards.map(s=>'<div class="kp-stat" style="background:'+S.color+'10;border-bottom:2px solid '+S.color+'60;"><div class="kp-stat-val" style="color:'+S.color+';">'+s.val+'</div><div class="kp-stat-lbl" style="font-weight:500;color:var(--ink,#24231f);">'+s.lbl+'</div><div class="kp-stat-lbl">'+s.sub+'</div><div class="kp-stat-src">'+s.src+'</div></div>').join('');
}

function buildInfo(sc){
  document.getElementById('kp-info-box').innerHTML=SC[sc].info;
}

function buildModelTable(sc){
  const S=SC[sc];
  // Monthly paths: index 24 = 2028, index 36 = 2029, index 48 = 2030
  const m1_28=S.m1[24].y,m1_30=S.m1[48].y;
  const m2_28=S.m2[24].y,m2_30=S.m2[48].y;
  const m3_28=S.m3[24].y,m3h_30=S.m3h[48].y,m3l_30=S.m3l[48].y;
  const capeTarget=sc==='bear'?'17.3\xd7 (145yr mean, 7yr)':sc==='bull'?'32\xd7 (structural new mean)':'27.6\xd7 (20yr avg, 10yr)';
  const epsGrowth=sc==='bear'?'+8%/+4%/+3%/+3%':sc==='bull'?'+21%/+12%/+10%/+8%':'+14%/+8%/+7%/+6%';
  const peRange=sc==='bear'?PE0_TXT+'\xd7→16\xd7':sc==='bull'?PE0_TXT+'\xd7→22\xd7 (holds)':PE0_TXT+'\xd7→19.5\xd7';
  const m1c=m1_30>NOW_SP?'kp-bull':'kp-bear', m2c=m2_30>NOW_SP?'kp-bull':'kp-bear';
  // M3 Parameters cell generated from this scenario's own rate set (M3_RATES
  // also drives the paths, so the print cannot drift from the math).
  const R3=M3_RATES[sc];const pct3=function(x){return (x.r*100).toFixed(1).replace(/\.0$/,'')+'%'+(x.note?' '+x.note:'');};
  const m3Params='High: '+R3.high.src+' '+pct3(R3.high)+'. Mid: '+R3.mid.src+' '+pct3(R3.mid)+'. Low: '+R3.low.src+' '+pct3(R3.low);
  document.getElementById('kp-model-table').innerHTML=
    '<tr><th>Model</th><th>Formula</th><th>Parameters</th><th>2028</th><th>2030</th><th>Source</th></tr>'+
    '<tr><td>M1 · EPS\xd7P/E</td><td>EPS₀\xd7(1+g)ᵗ\xd7PE(t)</td><td>EPS₀=$338 · '+epsGrowth+' · PE: '+peRange+'</td><td class="kp-mid">$'+m1_28.toLocaleString()+'</td><td class="'+m1c+'">$'+m1_30.toLocaleString()+'</td><td>FactSet Jun 2026 · Goldman</td></tr>'+
    '<tr><td>M2 · CAPE rev.</td><td>P₀\xd7(1+eps)ᵗ\xd7(CAPEₜₐᵣ/CAPE₀)ᵗⁿʳˢ</td><td>CAPE ${CAPE_TXT}\xd7→'+capeTarget+'</td><td class="kp-mid">$'+m2_28.toLocaleString()+'</td><td class="'+m2c+'">$'+m2_30.toLocaleString()+'</td><td>Shiller/Yale · GuruFocus</td></tr>'+
    '<tr><td>M3 · Institutional</td><td>P₀\xd7(1+r)ᵗ</td><td>'+m3Params+'</td><td class="kp-mid">$'+m3_28.toLocaleString()+'</td><td>$'+m3l_30.toLocaleString()+' – $'+m3h_30.toLocaleString()+'</td><td>Vanguard · RA · GMO 2026</td></tr>'+
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
  buildChart(sc,kpModel);buildRateChart(sc);buildStats(sc,kpModel);buildInfo(sc);buildModelTable(sc);buildRiskGrid(sc);
}

function setModel(m){
  kpModel=m;
  document.querySelectorAll('[data-kp-model]').forEach(el=>{
    const mm=el.dataset.kpModel;
    if(mm===m){el.classList.add('active');el.style.background=MODELS[m].color;el.style.color='#fff';el.style.borderColor='transparent';}
    else{el.classList.remove('active');el.style.background='';el.style.color=MODELS[mm].color;el.style.borderColor=MODELS[mm].color;}
  });
  buildChart(kpSc,m);buildLegend(m);buildStats(kpSc,m);
}

document.querySelectorAll('[data-kp-sc]').forEach(el=>{
  el.addEventListener('click',()=>setSc(el.dataset.kpSc));
});

document.querySelectorAll('[data-kp-model]').forEach(el=>{
  el.addEventListener('click',()=>setModel(el.dataset.kpModel));
});

function init(){buildChart('base','m1');buildRateChart('base');buildLegend('m1');buildStats('base','m1');buildInfo('base');buildModelTable('base');buildRiskGrid('base');}
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
