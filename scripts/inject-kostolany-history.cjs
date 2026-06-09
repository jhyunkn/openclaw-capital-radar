// Kostolany historical rate-cycle chart — inline SVG, no external deps.
// Smooth Catmull-Rom curves, labels positioned on rate-axis scale (0–21%).
const fs   = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

// ── Idempotent removal ────────────────────────────────────────────────────────
const TOKEN = '<section id="kostolany-history-section"';
let si = html.indexOf(TOKEN);
while (si >= 0) {
  let depth = 0, i = si;
  while (i < html.length) {
    if (html.startsWith('<section', i))  { depth++; i += 8; continue; }
    if (html.startsWith('</section>', i)) { depth--; if (depth === 0) { i += 10; break; } i += 10; continue; }
    i++;
  }
  html = html.slice(0, si) + html.slice(i);
  si = html.indexOf(TOKEN);
}
html = html.replace(/<style id="kostolany-history-style">[\s\S]*?<\/style>\s*/g, '');

// ── Data ──────────────────────────────────────────────────────────────────────
const years = [1970,1971,1972,1973,1974,1975,1976,1977,1978,1979,1980,1981,1982,1983,1984,1985,1986,1987,1988,1989,1990,1991,1992,1993,1994,1995,1996,1997,1998,1999,2000,2001,2002,2003,2004,2005,2006,2007,2008,2009,2010,2011,2012,2013,2014,2015,2016,2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
const rates  = [5.5,3.5,4.5,8.5,10.5,5.5,4.8,6.5,9.5,13.0,18.0,19.0,12.0,9.0,10.5,7.5,6.0,6.5,7.5,9.0,8.0,5.5,3.0,3.0,5.5,5.5,5.25,5.5,4.75,5.5,6.5,1.75,1.25,1.0,2.25,4.25,5.25,4.25,0.25,0.25,0.25,0.25,0.25,0.25,0.25,0.5,0.75,1.5,2.5,1.75,0.25,0.25,4.5,5.33,4.75,4.5,4.25];
const sp500  = [90.3,93.5,103,118,96.1,72.6,96.9,103,90.3,99.7,110,133,117,144,166,172,208,264,251,285,340,325,416,435,473,465,614,766,963,1249,1426,1336,1140,896,1133,1181,1278,1424,1379,866,1124,1283,1301,1480,1822,2028,1919,2275,2790,2607,3278,3794,4574,3961,4804,5980,7450];

// Phases: code = phase letter(s), desc = annotation, yRate = label y in rate units (0–21)
// yRate positions labels near where the rate line actually is for that period —
// natural placement that avoids overlap between adjacent cut/hike zones.
const phases = [
  {x1:1970,x2:1972,type:'cut',    code:'D–E', desc:'Buy stocks',      yRate:3.0},
  {x1:1972,x2:1981,type:'hike',   code:'A–B', desc:'Sell equities',   yRate:17.0},
  {x1:1981,x2:1987,type:'cut',    code:'D–E', desc:'Stocks +200%',    yRate:8.0},
  {x1:1987,x2:1989,type:'hike',   code:'A',   desc:'Black Monday',    yRate:10.5},
  {x1:1989,x2:1993,type:'cut',    code:'D–E', desc:'Equities rally',  yRate:3.5},
  {x1:1993,x2:1995,type:'hike',   code:'A',   desc:'Bond massacre',   yRate:6.0},
  {x1:1995,x2:1999,type:'plateau',code:'E–F', desc:'Dot-com mania',   yRate:5.8},
  {x1:1999,x2:2001,type:'hike',   code:'B',   desc:'Dot-com peak',    yRate:7.0},
  {x1:2001,x2:2004,type:'cut',    code:'C–D', desc:'Buy dip',         yRate:1.5},
  {x1:2004,x2:2007,type:'hike',   code:'A',   desc:'RE bubble',       yRate:5.5},
  {x1:2007,x2:2015,type:'cut',    code:'D–E', desc:'QE bull run',     yRate:1.2},
  {x1:2015,x2:2019,type:'hike',   code:'A',   desc:'Trim equities',   yRate:3.0},
  {x1:2019,x2:2022,type:'cut',    code:'F–D', desc:'COVID · buy all', yRate:1.0},
  {x1:2022,x2:2024,type:'hike',   code:'B',   desc:'Cash king',       yRate:5.8},
  {x1:2024,x2:2026,type:'cut',    code:'D',   desc:'Buy dips',        yRate:2.0},
];

// ── SVG geometry ──────────────────────────────────────────────────────────────
const W = 900, H = 380;
const ML = 48, MR = 62, MT = 22, MB = 36;
const CW = W - ML - MR, CH = H - MT - MB; // chart area: 790 × 322

const YEAR_MIN = 1970, YEAR_MAX = 2027;
const RATE_MAX = 21;
const SP_MIN = 60, SP_MAX = 12000;

function xY(year)  { return ML + (year - YEAR_MIN) / (YEAR_MAX - YEAR_MIN) * CW; }
function yR(v)     { return MT + CH * (1 - v / RATE_MAX); }                    // rate → SVG y
function yS(v)     { return MT + CH * (1 - Math.log(v/SP_MIN) / Math.log(SP_MAX/SP_MIN)); } // log-scale SP500

// ── Catmull-Rom → cubic Bézier smoothing (tension 1/6) ────────────────────────
function smoothPath(pts) {
  if (pts.length < 2) return '';
  const f = ([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`;
  let d = `M ${f(pts[0])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const t = 1 / 6;
    const c1 = [p1[0] + t*(p2[0]-p0[0]), p1[1] + t*(p2[1]-p0[1])];
    const c2 = [p2[0] - t*(p3[0]-p1[0]), p2[1] - t*(p3[1]-p1[1])];
    d += ` C ${f(c1)} ${f(c2)} ${f(p2)}`;
  }
  return d;
}

const ratePts = years.map((y, i) => [xY(y), yR(rates[i])]);
const spPts   = years.map((y, i) => [xY(y), yS(sp500[i])]);

// ── Color maps ────────────────────────────────────────────────────────────────
const colMap = { hike:'#b83535', cut:'#1a8f68', plateau:'#3a72aa' };
const bgMap  = { hike:'rgba(184,53,53,.07)', cut:'rgba(26,143,104,.07)', plateau:'rgba(58,114,170,.09)' };

// ── ClipPaths (one per zone, prevents labels spilling into neighbours) ─────────
const clipDefs = phases.map((p, i) => {
  const x1 = xY(p.x1).toFixed(1), w = (xY(p.x2) - xY(p.x1)).toFixed(1);
  return `<clipPath id="khc${i}"><rect x="${x1}" y="${MT}" width="${w}" height="${CH}"/></clipPath>`;
}).join('\n  ');

// ── Phase zone rects + labels ─────────────────────────────────────────────────
const phaseElems = phases.map((p, i) => {
  const x1  = xY(p.x1), x2 = xY(p.x2);
  const lx  = ((x1 + x2) / 2).toFixed(1);
  const ly  = yR(p.yRate);
  const col = colMap[p.type], bg = bgMap[p.type];
  const zW  = x2 - x1;               // pixel width of this zone
  const showDesc = zW > 28;           // ~2 years threshold at current scale

  return `<rect x="${x1.toFixed(1)}" y="${MT}" width="${(x2-x1).toFixed(1)}" height="${CH}"
    fill="${bg}" stroke="${col}" stroke-opacity="0.20" stroke-width="0.5"/>
  <g clip-path="url(#khc${i})" style="cursor:pointer"
     onclick="document.getElementById('khInfoBox').innerHTML=window.khMsgs['${p.type}']">
    <text x="${lx}" y="${ly.toFixed(1)}" text-anchor="middle"
      font-size="9.5" font-weight="700" letter-spacing="0.02em"
      fill="${col}" font-family="inherit">${p.code}</text>
    ${showDesc
      ? `<text x="${lx}" y="${(ly + 12).toFixed(1)}" text-anchor="middle"
          font-size="7.5" fill="${col}" opacity="0.65" font-family="inherit">${p.desc}</text>`
      : ''}
  </g>`;
}).join('\n  ');

// ── Axes ──────────────────────────────────────────────────────────────────────
// Horizontal rate grid lines
const rateGrid = [0,5,10,15,20].map(v => {
  const y = yR(v).toFixed(1);
  return `<line x1="${ML}" y1="${y}" x2="${W-MR}" y2="${y}"
    stroke="rgba(201,191,173,.22)" stroke-width="0.5" stroke-dasharray="3 7"/>
  <text x="${(ML-5).toFixed(1)}" y="${(+y + 3.5).toFixed(1)}" text-anchor="end"
    font-size="9.5" fill="rgba(44,42,37,.45)" font-family="inherit">${v}%</text>`;
}).join('\n  ');

// SP500 log-axis tick labels (right side)
const spTicks = [100,200,500,1000,2000,5000,10000].map(v => {
  const y = yS(v).toFixed(1);
  const label = v >= 1000 ? `$${v/1000}k` : `$${v}`;
  return `<text x="${(W-MR+6).toFixed(1)}" y="${(+y + 3.5).toFixed(1)}" text-anchor="start"
    font-size="9" fill="rgba(24,95,165,.65)" font-family="inherit">${label}</text>`;
}).join('\n  ');

// X-axis year ticks
const xTicks = years.filter(y => y % 5 === 0).map(y => {
  const x = xY(y).toFixed(1);
  const yBot = (MT + CH).toFixed(1);
  return `<line x1="${x}" y1="${yBot}" x2="${x}" y2="${(+yBot+3).toFixed(1)}"
    stroke="rgba(44,42,37,.18)" stroke-width="1"/>
  <text x="${x}" y="${(MT + CH + 14).toFixed(1)}" text-anchor="middle"
    font-size="9.5" fill="rgba(44,42,37,.38)" font-family="inherit">${y}</text>`;
}).join('\n  ');

// Chart border
const border = `<rect x="${ML}" y="${MT}" width="${CW}" height="${CH}"
  fill="none" stroke="rgba(201,191,173,.35)" stroke-width="1"/>`;

// "Now" line
const nowX = xY(2026).toFixed(1);
const nowLine = `<line x1="${nowX}" y1="${MT}" x2="${nowX}" y2="${MT+CH}"
  stroke="rgba(186,117,23,.70)" stroke-width="1.5" stroke-dasharray="4 3"/>
<text x="${(+nowX + 3).toFixed(1)}" y="${(MT + 11).toFixed(1)}"
  font-size="9" font-weight="600" fill="rgba(186,117,23,.85)" font-family="inherit">Now</text>`;

// Axis labels (rotated)
const axisLabels = `
  <text transform="rotate(-90,${(ML/2-4).toFixed(1)},${(MT+CH/2).toFixed(1)})"
    x="${(ML/2-4).toFixed(1)}" y="${(MT+CH/2).toFixed(1)}"
    text-anchor="middle" font-size="9.5" fill="rgba(44,42,37,.40)" font-family="inherit">Fed Funds Rate</text>
  <text transform="rotate(90,${(W-MR/2+10).toFixed(1)},${(MT+CH/2).toFixed(1)})"
    x="${(W-MR/2+10).toFixed(1)}" y="${(MT+CH/2).toFixed(1)}"
    text-anchor="middle" font-size="9.5" fill="rgba(24,95,165,.50)" font-family="inherit">S&amp;P 500 (log)</text>
  <text x="${(ML+CW/2).toFixed(1)}" y="${(H-2).toFixed(1)}"
    text-anchor="middle" font-size="9.5" fill="rgba(44,42,37,.30)" font-family="inherit">Year</text>`;

// ── Assemble SVG ──────────────────────────────────────────────────────────────
const chartSvg = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg"
  style="width:100%;height:auto;display:block" role="img"
  aria-label="Fed Funds Rate vs S&P 500 1970–2026 with Kostolany phase annotations">
  <defs>
  ${clipDefs}
  </defs>

  <!-- Phase zone backgrounds -->
  ${phaseElems}

  <!-- Grid -->
  ${rateGrid}
  ${spTicks}
  ${xTicks}
  ${border}

  <!-- S&P 500 — blue dashed, log scale, behind rate line -->
  <path d="${smoothPath(spPts)}"
    fill="none" stroke="#185fa5" stroke-width="2" stroke-dasharray="5 3"
    stroke-linejoin="round" stroke-linecap="round" opacity="0.85"/>

  <!-- Fed Funds Rate — dark solid, on top -->
  <path d="${smoothPath(ratePts)}"
    fill="none" stroke="#1e1d1a" stroke-width="2.5"
    stroke-linejoin="round" stroke-linecap="round"/>

  <!-- Now marker -->
  ${nowLine}

  <!-- Axis labels -->
  ${axisLabels}
</svg>`;

// ── Styles ────────────────────────────────────────────────────────────────────
const style = `<style id="kostolany-history-style">
.kh-section{padding:0 clamp(12px,2vw,20px) 28px;box-sizing:border-box}
.kh-wrap{max-width:1240px;margin:0 auto}
.kh-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.38);font-family:var(--mono,monospace);display:block;margin-bottom:8px}
.kh-insight{font-size:13px;color:rgba(26,23,20,.55);margin:0 0 10px;line-height:1.5}
.kh-insight strong{color:rgba(26,23,20,.82);font-weight:500}
.kh-legend{display:flex;flex-wrap:wrap;gap:12px;margin-bottom:12px;font-size:11px;color:rgba(26,23,20,.50);align-items:center}
.kh-legend span{display:flex;align-items:center;gap:5px}
.kh-info{margin-top:10px;padding:10px 14px;border-radius:14px;
  border:1px solid rgba(201,191,173,.45);background:rgba(251,250,246,.34);
  font-size:12.5px;color:rgba(26,23,20,.55);min-height:44px;line-height:1.5}
</style>`;

// ── Section ───────────────────────────────────────────────────────────────────
const section = `<section id="kostolany-history-section" class="kh-section">
<div class="kh-wrap">
  <span class="kh-eyebrow">Historical Rate Cycles · 1970 – Present</span>
  <p class="kh-insight">The key insight from Kostolany: <strong>markets often bottom when rates peak, and top when rates bottom.</strong> Watch the inversions. <em style="opacity:.55">Click any phase label for Kostolany's view.</em></p>
  <div class="kh-legend">
    <span><span style="display:inline-block;width:22px;height:2.5px;background:#1e1d1a;border-radius:2px"></span>Fed Funds Rate</span>
    <span><span style="display:inline-block;width:22px;height:0;border-top:2.5px dashed #185fa5"></span>S&amp;P 500 (log scale)</span>
    <span><span style="width:9px;height:9px;border-radius:2px;background:rgba(184,53,53,.14);border:1px solid rgba(184,53,53,.55);display:inline-block"></span>Hiking — sell</span>
    <span><span style="width:9px;height:9px;border-radius:2px;background:rgba(26,143,104,.14);border:1px solid rgba(26,143,104,.55);display:inline-block"></span>Cutting — buy</span>
    <span><span style="width:9px;height:9px;border-radius:2px;background:rgba(58,114,170,.14);border:1px solid rgba(58,114,170,.55);display:inline-block"></span>Plateau</span>
  </div>
  ${chartSvg}
  <div id="khInfoBox" class="kh-info">
    <strong style="color:rgba(26,23,20,.82)">How to read:</strong>
    Black line = Fed Funds Rate (left axis). Blue dashed = S&amp;P 500 log scale (right axis).
    Every cutting cycle (green) eventually lifted stocks. Hike cycles (red) caused turbulence or bear markets. Click any phase label above.
  </div>
</div>
<script>
window.khMsgs = {
  hike:    "<strong style='color:#b83535'>Hiking phase (A→B)</strong> — Kostolany: Rates rising, bond prices fall, equities become turbulent. Smart money rotates into cash and short-term deposits. Real estate peaks. Public still euphoric. Time to trim risk.",
  cut:     "<strong style='color:#1a8f68'>Cutting phase (C→D→E)</strong> — Kostolany: Rates falling, bonds rally first, then equities. Liquidity floods back into risk assets. Smart money accumulates before the public notices. This is where fortunes are made — patience pays off.",
  plateau: "<strong style='color:#3a72aa'>Plateau phase (B or F)</strong> — Kostolany: Rates hold at peak or bottom. The transition zone. At peak: cash and bonds are attractive, wait for first cut. At bottom: equity bull market in full swing, watch for late-cycle signs."
};
</script>
</section>`;

// ── Inject ────────────────────────────────────────────────────────────────────
html = html.replace('</head>', style + '</head>');

function findSectionEnd(h, id) {
  const idx = h.indexOf(`id="${id}"`);
  if (idx < 0) return -1;
  const sec = h.lastIndexOf('<section', idx);
  let depth = 0, i = sec;
  while (i < h.length) {
    if (h.startsWith('<section', i))  { depth++; i += 8; continue; }
    if (h.startsWith('</section>', i)) { depth--; if (depth === 0) return i + 10; i += 10; continue; }
    i++;
  }
  return -1;
}

const afterMacro = findSectionEnd(html, 'macro-unified-section');
if (afterMacro >= 0) {
  html = html.slice(0, afterMacro) + '\n' + section + '\n' + html.slice(afterMacro);
} else {
  const op = html.indexOf('<section id="operational-chart-section"');
  html = op >= 0 ? html.slice(0, op) + section + '\n' + html.slice(op) : html + '\n' + section;
}

fs.writeFileSync(indexPath, html);
console.log('kostolany-history-section injected (smooth SVG)');
