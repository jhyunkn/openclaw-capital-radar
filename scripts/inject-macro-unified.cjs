'use strict';
// Macro section — everything a macro-aware investor needs in one surface.
// Real price charts (SPX/VIX from candle data), indices pulse, economy
// scorecard, cycle position, sector rotation, and action block.

const fs   = require('fs');
const path = require('path');

const root          = path.join(__dirname, '..');
const requestedPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath     = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const read = (rel, fb = {}) => {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; }
};

const egg      = read('outputs/kostolany-egg-state.json');
const brief    = read('outputs/market-decision-brief-state.json');
const config   = read('outputs/macro-configuration-state.json');
const analogs  = read('outputs/macro-historical-analog-state.json');
const portfolio= read('outputs/macro-portfolio-translation-state.json');
const cycle    = read('outputs/macro-cycle-state.json');

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };

// ── Candle data ───────────────────────────────────────────────────────────────

function loadCandles(symbol, minDays = 250) {
  const p = path.join(root, 'data', 'market-candles', `${symbol}.json`);
  try {
    const d = JSON.parse(fs.readFileSync(p, 'utf8'));
    return (d.candles || []);
  } catch { return []; }
}

function computeMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    let s = 0;
    for (let j = i - period + 1; j <= i; j++) s += closes[j];
    return s / period;
  });
}

function perf(candles, days) {
  if (candles.length < days + 1) return null;
  const from = candles[candles.length - days - 1]?.close;
  const to   = candles[candles.length - 1]?.close;
  if (!from || !to) return null;
  return (to - from) / from * 100;
}

// ── SVG chart builders ────────────────────────────────────────────────────────

function buildPriceChart(symbol, opts = {}) {
  const {
    W = 560, H = 150, days = 90,
    showMA50 = true, showMA200 = true,
    addZone = null, trimZone = null, defenseLevel = null,
    spxRatio = 1,   // convert SPX levels to chart symbol prices
  } = opts;

  const allCandles = loadCandles(symbol);
  if (allCandles.length < 60) {
    return `<svg viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="11" fill="rgba(26,23,20,.38)">No chart data</text></svg>`;
  }

  const allCloses = allCandles.map(c => c.close);
  const ma50all   = computeMA(allCloses, 50);
  const ma200all  = computeMA(allCloses, 200);

  const displayCandles = allCandles.slice(-days);
  const closes  = displayCandles.map(c => c.close);
  const n       = closes.length;
  const offset  = allCandles.length - n;
  const ma50d   = ma50all.slice(-n);
  const ma200d  = ma200all.slice(-n);

  const pL = 4, pR = 4, pT = 10, pB = 26;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  // Price range: include MA values
  const vals = [...closes, ...ma50d.filter(Boolean), ...ma200d.filter(Boolean)];
  const addLow  = addZone  ? Math.min(...addZone) * spxRatio : Infinity;
  const addHigh = addZone  ? Math.max(...addZone) * spxRatio : -Infinity;
  const trimLow = trimZone ? Math.min(...trimZone) * spxRatio : Infinity;
  const def     = defenseLevel ? defenseLevel * spxRatio : null;

  const allForRange = [...vals, addLow, addHigh, trimLow, def].filter(v => v != null && Number.isFinite(v));
  const minV = Math.min(...allForRange) * 0.998;
  const maxV = Math.max(...allForRange) * 1.002;
  const range = maxV - minV || 1;

  const px = i => pL + (i / (n - 1)) * cW;
  const py = v => pT + cH - ((v - minV) / range) * cH;

  // Price line
  const linePts = closes.map((c, i) => `${i===0?'M':'L'}${px(i).toFixed(1)},${py(c).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L${(pL+cW).toFixed(1)},${(pT+cH).toFixed(1)} L${pL},${(pT+cH).toFixed(1)}Z`;

  // MA path builder
  const maPath = (vals) => {
    let d = '', on = false;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) { on = false; continue; }
      d += `${on ? 'L' : 'M'}${px(i).toFixed(1)},${py(vals[i]).toFixed(1)} `;
      on = true;
    }
    return d.trim();
  };

  // Zones
  let zones = '';
  if (addZone && Number.isFinite(addLow) && Number.isFinite(addHigh)) {
    const y1 = py(addHigh), y2 = py(addLow);
    zones += `<rect x="${pL}" y="${y1.toFixed(1)}" width="${cW}" height="${Math.abs(y2-y1).toFixed(1)}" fill="rgba(42,107,74,.15)"/>`;
    zones += `<text x="${(pL+4)}" y="${(y1+10).toFixed(1)}" font-size="8.5" fill="rgba(42,107,74,.8)" font-family="inherit">Add zone</text>`;
  }
  if (trimZone) {
    const tLow = Math.min(...trimZone)*spxRatio, tHigh = Math.max(...trimZone)*spxRatio;
    if (Number.isFinite(tLow) && tHigh > minV) {
      const y1 = py(tHigh), y2 = py(tLow);
      zones += `<rect x="${pL}" y="${y1.toFixed(1)}" width="${cW}" height="${Math.abs(y2-y1).toFixed(1)}" fill="rgba(164,80,47,.12)"/>`;
    }
  }
  if (def && Number.isFinite(def) && def > minV && def < maxV) {
    const yd = py(def);
    zones += `<line x1="${pL}" y1="${yd.toFixed(1)}" x2="${(pL+cW)}" y2="${yd.toFixed(1)}" stroke="rgba(164,80,47,.55)" stroke-width="1" stroke-dasharray="3 2"/>`;
    zones += `<text x="${pL+4}" y="${(yd-3).toFixed(1)}" font-size="8" fill="rgba(164,80,47,.7)" font-family="inherit">Defense</text>`;
  }

  // Grid lines (subtle)
  const gridSteps = 3;
  let grid = '';
  for (let g = 1; g < gridSteps; g++) {
    const gy = pT + (cH / gridSteps) * g;
    grid += `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}" stroke="rgba(201,191,173,.3)" stroke-width="0.5"/>`;
  }

  const lastX = px(n-1), lastY = py(closes[n-1]);
  const lastPrice = closes[n-1] >= 100 ? closes[n-1].toLocaleString('en-US',{maximumFractionDigits:closes[n-1]>=1000?0:2}) : closes[n-1].toFixed(2);
  const p90 = perf(allCandles, 90);
  const p90str = p90 != null ? `${p90>=0?'+':''}${p90.toFixed(1)}%` : '';
  const perfColor = p90 != null && p90 >= 0 ? '#2a6b4a' : '#A4502F';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <linearGradient id="ag_${symbol.replace(/[^a-z0-9]/gi,'')}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(26,23,20,.10)"/>
      <stop offset="100%" stop-color="rgba(26,23,20,.01)"/>
    </linearGradient>
  </defs>
  ${grid}${zones}
  <path d="${areaPts}" fill="url(#ag_${symbol.replace(/[^a-z0-9]/gi,'')})"/>
  ${showMA200 ? `<path d="${maPath(ma200d)}" fill="none" stroke="rgba(164,80,47,.6)" stroke-width="1" stroke-dasharray="4 2" opacity=".8"/>` : ''}
  ${showMA50  ? `<path d="${maPath(ma50d)}"  fill="none" stroke="rgba(138,106,44,.6)" stroke-width="1" stroke-dasharray="2 2" opacity=".8"/>` : ''}
  <path d="${linePts}" fill="none" stroke="#1A1714" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="#1A1714"/>
  <text x="${pL}" y="${(H-6).toFixed(1)}" font-size="10" fill="rgba(26,23,20,.45)" font-family="inherit" letter-spacing=".04em">90D</text>
  <text x="${pL+28}" y="${(H-6).toFixed(1)}" font-size="10" fill="${perfColor}" font-weight="600" font-family="inherit">${esc(p90str)}</text>
  <text x="${(pL+cW)}" y="${(H-6).toFixed(1)}" text-anchor="end" font-size="11" fill="#1A1714" font-weight="600" font-family="inherit">${esc(lastPrice)}</text>
  ${showMA50  ? `<line x1="${pL+80}" y1="${(H-10)}" x2="${pL+98}" y2="${(H-10)}" stroke="rgba(138,106,44,.7)" stroke-width="1" stroke-dasharray="2 2"/><text x="${pL+101}" y="${(H-6)}" font-size="9" fill="rgba(138,106,44,.8)" font-family="inherit">MA50</text>` : ''}
  ${showMA200 ? `<line x1="${pL+130}" y1="${(H-10)}" x2="${pL+148}" y2="${(H-10)}" stroke="rgba(164,80,47,.7)" stroke-width="1" stroke-dasharray="4 2"/><text x="${pL+151}" y="${(H-6)}" font-size="9" fill="rgba(164,80,47,.8)" font-family="inherit">MA200</text>` : ''}
</svg>`;
}

function buildVixChart(days = 90) {
  const W = 280, H = 150;
  const allCandles = loadCandles('_VIX');
  if (allCandles.length < 20) {
    return `<svg viewBox="0 0 ${W} ${H}"><text x="${W/2}" y="${H/2}" text-anchor="middle" font-size="11" fill="rgba(26,23,20,.38)">No data</text></svg>`;
  }
  const candles = allCandles.slice(-days);
  const closes  = candles.map(c => c.close);
  const n = closes.length;

  const pL = 4, pR = 4, pT = 10, pB = 26;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  const minV = Math.max(0, Math.min(...closes) * 0.95);
  const maxV = Math.max(...closes, 30) * 1.05;
  const range = maxV - minV || 1;

  const px = i => pL + (i / (n - 1)) * cW;
  const py = v => pT + cH - ((v - minV) / range) * cH;

  const linePts = closes.map((c, i) => `${i===0?'M':'L'}${px(i).toFixed(1)},${py(c).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L${(pL+cW).toFixed(1)},${(pT+cH).toFixed(1)} L${pL},${(pT+cH).toFixed(1)}Z`;

  // Threshold zones
  let zones = '';
  const thresholds = [{ v: 15, color: 'rgba(42,107,74,.1)', label: 'Calm' }, { v: 25, color: 'rgba(164,80,47,.1)', label: 'Elevated' }];
  for (const t of thresholds) {
    if (t.v > minV && t.v < maxV) {
      const yt = py(t.v);
      zones += `<line x1="${pL}" y1="${yt.toFixed(1)}" x2="${(pL+cW)}" y2="${yt.toFixed(1)}" stroke="rgba(201,191,173,.6)" stroke-width="0.5" stroke-dasharray="3 2"/>`;
      zones += `<text x="${(pL+cW-2)}" y="${(yt-3).toFixed(1)}" text-anchor="end" font-size="8" fill="rgba(26,23,20,.38)" font-family="inherit">${t.v}</text>`;
    }
  }

  // Color the area by VIX level
  const current = closes[n-1];
  const areaColor = current < 15 ? 'rgba(42,107,74,.15)' : current < 25 ? 'rgba(138,106,44,.15)' : 'rgba(164,80,47,.18)';
  const lineColor = current < 15 ? '#2a6b4a' : current < 25 ? '#8a6a2c' : '#A4502F';
  const label = current < 15 ? 'Calm' : current < 25 ? 'Watchful' : 'Elevated';
  const labelColor = lineColor;

  const lastX = px(n-1), lastY = py(closes[n-1]);
  const p90 = perf(allCandles, 90);
  const p90str = p90 != null ? `${p90>=0?'+':''}${p90.toFixed(1)}%` : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  ${zones}
  <path d="${areaPts}" fill="${areaColor}"/>
  <path d="${linePts}" fill="none" stroke="${lineColor}" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${lineColor}"/>
  <text x="${pL}" y="${(H-6).toFixed(1)}" font-size="10" fill="rgba(26,23,20,.45)" font-family="inherit" letter-spacing=".04em">90D</text>
  <text x="${pL+28}" y="${(H-6).toFixed(1)}" font-size="10" fill="rgba(26,23,20,.45)" font-family="inherit">${esc(p90str)}</text>
  <text x="${(pL+cW)}" y="${(H-6).toFixed(1)}" text-anchor="end" font-size="11" fill="${lineColor}" font-weight="600" font-family="inherit">${closes[n-1].toFixed(1)}</text>
  <text x="${lastX.toFixed(1)}" y="${(lastY-8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${labelColor}" font-weight="600" font-family="inherit">${esc(label)}</text>
</svg>`;
}

// ── Unified macro chart ───────────────────────────────────────────────────────
// One chart. 5-year SPX journey + rate cycle sub-panel + tactical zones.
// The 90-day "tactical" view IS the right tail of this chart — no split needed.
// Add/defense zones drawn as horizontal bands so you see their historical context.
// Analog lesson shown as a plain-English callout, not a second confusing chart.

function loadRateHistory() {
  const p = path.join(root, 'data', 'macro-history.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function buildUnifiedChart(spyCandles, rateSeries, chartRef, spxRatio, analogLesson) {
  // Single chart: full 5-year SPY journey + tactical zones + rate cycle sub-panel
  const W = 900, H_PRICE = 240, H_RATE = 80, GAP = 24, H_TOTAL = H_PRICE + GAP + H_RATE + 26;
  const pL = 52, pR = 16, pT = 14, cW = W - pL - pR;

  if (spyCandles.length < 100) return `<div class="mu-chart-empty">No data</div>`;

  const closes = spyCandles.map(c => c.close);
  const dates  = spyCandles.map(c => c.time);
  const n      = closes.length;

  // MAs (computed over full history for accuracy)
  const ma50all  = computeMA(closes, 50);
  const ma200all = computeMA(closes, 200);

  // Tactical zone levels (SPX → SPY conversion)
  const addLo  = chartRef?.add_zone?.[0]  != null ? chartRef.add_zone[0]  * spxRatio : null;
  const addHi  = chartRef?.add_zone?.[1]  != null ? chartRef.add_zone[1]  * spxRatio : null;
  const trimLo = chartRef?.trim_zone?.[0] != null ? chartRef.trim_zone[0] * spxRatio : null;
  const trimHi = chartRef?.trim_zone?.[1] != null ? chartRef.trim_zone[1] * spxRatio : null;
  const def    = chartRef?.defense_below  != null ? chartRef.defense_below * spxRatio : null;

  // Price range: include zones so they're never clipped
  const zoneVals = [addLo, addHi, trimLo, trimHi, def].filter(v => v != null);
  const priceVals = [...closes, ...ma50all.filter(Boolean), ...ma200all.filter(Boolean), ...zoneVals];
  const priceMin  = Math.min(...priceVals) * 0.975;
  const priceMax  = Math.max(...priceVals) * 1.015;
  const priceRange = priceMax - priceMin || 1;

  const px  = i => pL + (i / (n - 1)) * cW;
  const pyP = v => pT + H_PRICE - ((v - priceMin) / priceRange) * H_PRICE;

  // Date → x mapping
  const dateIdx = {};
  dates.forEach((d, i) => { dateIdx[d] = i; });
  function dToX(ds) {
    if (dateIdx[ds] !== undefined) return px(dateIdx[ds]);
    const t = new Date(ds).getTime();
    let best = 0, minD = Infinity;
    dates.forEach((d, i) => { const df = Math.abs(new Date(d).getTime()-t); if(df<minD){minD=df;best=i;} });
    return px(best);
  }

  // ── Price panel ──────────────────────────────────────────────────────────────

  const linePts = closes.map((c,i) => `${i===0?'M':'L'}${px(i).toFixed(1)},${pyP(c).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L${(pL+cW).toFixed(1)},${(pT+H_PRICE).toFixed(1)} L${pL},${(pT+H_PRICE).toFixed(1)}Z`;

  const maPath = (vals) => {
    let d = '', on = false;
    vals.forEach((v,i) => { if(!v){on=false;return;} d+=`${on?'L':'M'}${px(i).toFixed(1)},${pyP(v).toFixed(1)} `;on=true; });
    return d.trim();
  };

  // 2022 bear band (Jan–Oct 2022)
  const b22x1 = dToX('2022-01-03'), b22x2 = dToX('2022-10-13');
  const bear22 = `<rect x="${b22x1.toFixed(1)}" y="${pT}" width="${(b22x2-b22x1).toFixed(1)}" height="${H_PRICE}" fill="rgba(164,80,47,.07)"/>
  <text x="${((b22x1+b22x2)/2).toFixed(1)}" y="${(pT+13)}" text-anchor="middle" font-size="8.5" fill="rgba(164,80,47,.62)" font-weight="600" font-family="inherit" letter-spacing=".04em">2022 ANALOG</text>`;

  // Last-90-days highlight (subtle right panel)
  const idx90 = Math.max(0, n - 91);
  const x90 = px(idx90);
  const last90 = `<rect x="${x90.toFixed(1)}" y="${pT}" width="${(pL+cW-x90).toFixed(1)}" height="${H_PRICE}" fill="rgba(26,23,20,.03)"/>
  <line x1="${x90.toFixed(1)}" y1="${pT}" x2="${x90.toFixed(1)}" y2="${(pT+H_PRICE)}" stroke="rgba(201,191,173,.55)" stroke-width="0.5" stroke-dasharray="3 2"/>
  <text x="${(x90+4)}" y="${(pT+13)}" font-size="8" fill="rgba(26,23,20,.32)" font-family="inherit">90D</text>`;

  // Zone bands
  let zones = '';
  if (addLo != null && addHi != null) {
    const y1=pyP(addHi), y2=pyP(addLo);
    zones += `<rect x="${pL}" y="${y1.toFixed(1)}" width="${cW}" height="${Math.abs(y2-y1).toFixed(1)}" fill="rgba(42,107,74,.13)"/>`;
    zones += `<text x="${(pL+6)}" y="${(y1+11).toFixed(1)}" font-size="8.5" fill="rgba(42,107,74,.8)" font-family="inherit">Add ${addLo.toFixed(0)}–${addHi.toFixed(0)}</text>`;
  }
  if (trimLo != null && trimHi != null) {
    const y1=pyP(trimHi), y2=pyP(trimLo);
    zones += `<rect x="${pL}" y="${y1.toFixed(1)}" width="${cW}" height="${Math.abs(y2-y1).toFixed(1)}" fill="rgba(164,80,47,.09)"/>`;
    zones += `<text x="${(pL+6)}" y="${(y1+11).toFixed(1)}" font-size="8.5" fill="rgba(164,80,47,.72)" font-family="inherit">Trim ${trimLo.toFixed(0)}–${trimHi.toFixed(0)}</text>`;
  }
  if (def != null) {
    const yd = pyP(def);
    zones += `<line x1="${pL}" y1="${yd.toFixed(1)}" x2="${(pL+cW)}" y2="${yd.toFixed(1)}" stroke="rgba(164,80,47,.5)" stroke-width="1" stroke-dasharray="4 2"/>`;
    zones += `<text x="${(pL+cW-4)}" y="${(yd-4).toFixed(1)}" text-anchor="end" font-size="8.5" fill="rgba(164,80,47,.65)" font-family="inherit">Defense ${def.toFixed(0)}</text>`;
  }

  // Grid lines
  const grid = [.25,.5,.75].map(f => {
    const v = priceMin + priceRange*f, gy = pyP(v);
    const lbl = v >= 1000 ? (v/1000).toFixed(1)+'k' : Math.round(v).toString();
    return `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}" stroke="rgba(201,191,173,.28)" stroke-width="0.5"/>
  <text x="${(pL-4)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" font-size="8.5" fill="rgba(26,23,20,.32)" font-family="inherit">${lbl}</text>`;
  }).join('');

  // Year ticks
  let lastYr = '', yearTicks = '';
  dates.forEach((d,i) => {
    const yr = d.slice(0,4);
    if (yr !== lastYr) {
      yearTicks += `<line x1="${px(i).toFixed(1)}" y1="${(pT+H_PRICE)}" x2="${px(i).toFixed(1)}" y2="${(pT+H_PRICE+4)}" stroke="rgba(201,191,173,.45)" stroke-width="0.5"/>
  <text x="${px(i).toFixed(1)}" y="${(pT+H_PRICE+14).toFixed(1)}" text-anchor="middle" font-size="9" fill="rgba(26,23,20,.35)" font-family="inherit">${yr}</text>`;
      lastYr = yr;
    }
  });

  const lastX = px(n-1), lastY = pyP(closes[n-1]);
  const p1y = perf(spyCandles, 252);
  const p1yStr = p1y != null ? `${p1y>=0?'+':''}${p1y.toFixed(1)}%` : '';
  const p1yColor = p1y != null && p1y >= 0 ? '#2a6b4a' : '#A4502F';

  // ── Rate panel ───────────────────────────────────────────────────────────────
  const rY0 = pT + H_PRICE + GAP, rH = H_RATE;
  const dffObs = (rateSeries?.DFF || []).filter(o => o.date >= dates[0] && o.date <= dates[n-1]);
  const rateMax = Math.max(...dffObs.map(o=>o.value), 6) * 1.06;
  const pyR = v => rY0 + rH - (v / rateMax) * rH;

  const rateGrid = [2, 4, 5.5].map(v => {
    const gy = pyR(v);
    return `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}" stroke="rgba(201,191,173,.28)" stroke-width="0.5" stroke-dasharray="2 2"/>
  <text x="${(pL-4)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" font-size="8.5" fill="rgba(26,23,20,.3)" font-family="inherit">${v}%</text>`;
  }).join('');

  const dffPath = dffObs.length > 1
    ? dffObs.map((o,i) => `${i===0?'M':'L'}${dToX(o.date).toFixed(1)},${pyR(o.value).toFixed(1)}`).join(' ')
    : '';
  const dffAreaPath = dffPath
    ? `${dffPath} L${dToX(dffObs[dffObs.length-1].date).toFixed(1)},${(rY0+rH)} L${dToX(dffObs[0].date).toFixed(1)},${(rY0+rH)}Z`
    : '';

  const dffNow = dffObs.length ? dffObs[dffObs.length-1].value : null;
  const dffNowX = dffNow != null ? dToX(dffObs[dffObs.length-1].date) : null;

  // ── Assemble SVG ─────────────────────────────────────────────────────────────
  return `<svg viewBox="0 0 ${W} ${H_TOTAL}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <linearGradient id="ucGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(26,23,20,.09)"/><stop offset="100%" stop-color="rgba(26,23,20,.01)"/>
    </linearGradient>
    <linearGradient id="rateGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(138,106,44,.2)"/><stop offset="100%" stop-color="rgba(138,106,44,.02)"/>
    </linearGradient>
  </defs>

  <!-- 2022 analog band + last-90-days highlight -->
  ${bear22}${last90}

  <!-- Grid + zones -->
  ${grid}${zones}

  <!-- Area fill -->
  <path d="${areaPts}" fill="url(#ucGrad)"/>

  <!-- MA200 -->
  <path d="${maPath(ma200all)}" fill="none" stroke="rgba(164,80,47,.55)" stroke-width="1.1" stroke-dasharray="5 2"/>
  <!-- MA50 -->
  <path d="${maPath(ma50all)}"  fill="none" stroke="rgba(138,106,44,.55)" stroke-width="1.1" stroke-dasharray="2 2"/>
  <!-- Price line -->
  <path d="${linePts}" fill="none" stroke="#1A1714" stroke-width="1.8" stroke-linejoin="round"/>
  <!-- Current dot + price label -->
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.5" fill="#1A1714"/>
  <text x="${(pL+cW)}" y="${(pT-1)}" text-anchor="end" font-size="10" fill="${p1yColor}" font-weight="600" font-family="inherit">${p1yStr ? `1Y ${p1yStr}` : ''}</text>

  <!-- Year ticks -->
  ${yearTicks}

  <!-- Legend -->
  <line x1="${pL}" y1="${(pT+H_PRICE+18)}" x2="${pL+18}" y2="${(pT+H_PRICE+18)}" stroke="rgba(138,106,44,.65)" stroke-width="1" stroke-dasharray="2 2"/>
  <text x="${pL+21}" y="${(pT+H_PRICE+22)}" font-size="8.5" fill="rgba(138,106,44,.8)" font-family="inherit">MA50</text>
  <line x1="${pL+50}" y1="${(pT+H_PRICE+18)}" x2="${pL+68}" y2="${(pT+H_PRICE+18)}" stroke="rgba(164,80,47,.65)" stroke-width="1" stroke-dasharray="5 2"/>
  <text x="${pL+71}" y="${(pT+H_PRICE+22)}" font-size="8.5" fill="rgba(164,80,47,.8)" font-family="inherit">MA200</text>
  <rect x="${pL+108}" y="${(pT+H_PRICE+11)}" width="12" height="8" fill="rgba(42,107,74,.25)"/>
  <text x="${pL+123}" y="${(pT+H_PRICE+22)}" font-size="8.5" fill="rgba(42,107,74,.85)" font-family="inherit">Add zone</text>
  <rect x="${pL+172}" y="${(pT+H_PRICE+11)}" width="12" height="8" fill="rgba(164,80,47,.2)"/>
  <text x="${pL+187}" y="${(pT+H_PRICE+22)}" font-size="8.5" fill="rgba(164,80,47,.8)" font-family="inherit">Trim zone</text>

  <!-- Rate panel separator -->
  <line x1="${pL}" y1="${(rY0-7)}" x2="${(pL+cW)}" y2="${(rY0-7)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>
  <text x="${pL}" y="${(rY0-11)}" font-size="8" fill="rgba(26,23,20,.35)" letter-spacing=".12em" font-family="inherit">FED FUNDS RATE (DFF)</text>
  ${dffNow != null ? `<text x="${(pL+cW)}" y="${(rY0-11)}" text-anchor="end" font-size="9" fill="rgba(138,106,44,.8)" font-weight="600" font-family="inherit">${dffNow.toFixed(2)}% now</text>` : ''}

  <!-- Rate panel -->
  ${rateGrid}
  <line x1="${pL}" y1="${(rY0+rH)}" x2="${(pL+cW)}" y2="${(rY0+rH)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>
  ${dffAreaPath ? `<path d="${dffAreaPath}" fill="url(#rateGrad)"/>` : ''}
  ${dffPath ? `<path d="${dffPath}" fill="none" stroke="#8a6a2c" stroke-width="1.8" stroke-linejoin="round"/>` : ''}
  ${dffNow != null && dffNowX != null ? `<circle cx="${dffNowX.toFixed(1)}" cy="${pyR(dffNow).toFixed(1)}" r="3" fill="#8a6a2c"/>` : ''}
</svg>`;
}

function buildIndicesPulse() {
  // Horizontal bar chart: 90-day performance comparison
  const symbols = [
    { sym: 'SPY',     label: 'S&P 500',   sub: 'broad market' },
    { sym: 'QQQ',     label: 'Nasdaq',    sub: 'tech / growth' },
    { sym: 'IWM',     label: 'Small Caps',sub: 'risk breadth' },
    { sym: 'BTC-USD', label: 'Bitcoin',   sub: 'risk appetite' },
  ];

  const results = symbols.map(s => {
    const candles = loadCandles(s.sym);
    const p = perf(candles, 90);
    return { ...s, perf: p };
  }).filter(r => r.perf != null);

  if (results.length === 0) return '';

  const maxAbs = Math.max(...results.map(r => Math.abs(r.perf)), 1);

  const rows = results.map(r => {
    const pct = r.perf;
    const barW = Math.abs(pct) / maxAbs * 100;
    const color = pct >= 0 ? '#2a6b4a' : '#A4502F';
    const bgColor = pct >= 0 ? 'rgba(42,107,74,.12)' : 'rgba(164,80,47,.12)';
    const sign = pct >= 0 ? '+' : '';
    return `<div class="mu-pulse-row">
      <div class="mu-pulse-label">
        <b>${esc(r.label)}</b>
        <span>${esc(r.sub)}</span>
      </div>
      <div class="mu-pulse-bar-wrap">
        <div class="mu-pulse-bar" style="width:${barW.toFixed(1)}%;background:${bgColor};border-right:2px solid ${color}"></div>
      </div>
      <div class="mu-pulse-val" style="color:${color}">${sign}${pct.toFixed(1)}%</div>
    </div>`;
  }).join('');

  return `<div class="mu-pulse">${rows}</div>`;
}

// ── Cycle analysis: normalized anchor chart + 4-column argument ───────────────

function buildCycleAnalysis(spyCandles, rateSeries, signals, cycleState, analogsData) {
  // Anchor: 2022-03-17 — first Fed rate hike of this cycle
  // X-axis: calendar time (anchor → 2027-06)
  // Y-axis: % change from anchor close
  // Shows: full current cycle journey, key events annotated, Phase D projection

  const ANCHOR_DATE = '2022-03-17';
  const anchorCandle = spyCandles.find(c => c.time >= ANCHOR_DATE);
  if (!anchorCandle || spyCandles.length < 100) return '';

  const anchorClose = anchorCandle.close;
  const anchorIdx   = spyCandles.indexOf(anchorCandle);
  const chartCandles = spyCandles.slice(anchorIdx);
  const normVals   = chartCandles.map(c => (c.close - anchorClose) / anchorClose * 100);
  const chartDates = chartCandles.map(c => c.time);
  const n = normVals.length;

  // SVG geometry
  const W = 900, H_PRICE = 200, H_RATE = 62, GAP = 20, H_TOTAL = H_PRICE + GAP + H_RATE + 22;
  const pL = 52, pR = 90, pT = 16, cW = W - pL - pR;

  // Time-based x mapping: anchor → 2027-01-01
  const anchorMs = new Date(ANCHOR_DATE).getTime();
  const endMs    = new Date('2027-01-01').getTime();
  const totalMs  = endMs - anchorMs;
  const pxT = ms => pL + ((ms - anchorMs) / totalMs) * cW;
  const pxD = dateStr => pxT(new Date(dateStr).getTime());

  // Price scale — leave headroom above for projection, -30% floor
  const curNorm = normVals[n - 1];
  const priceMin = Math.min(...normVals, -30) * 1.06;
  const priceMax = Math.max(...normVals, curNorm + 20) * 1.18;
  const priceRange = priceMax - priceMin || 1;
  const pyP = v => pT + H_PRICE - ((v - priceMin) / priceRange) * H_PRICE;

  // Zero line
  const y0 = pyP(0);

  // Price line path (time-based x)
  const linePts = chartCandles.map((c, i) =>
    `${i===0?'M':'L'}${pxD(c.time).toFixed(1)},${pyP(normVals[i]).toFixed(1)}`
  ).join(' ');
  const lastX = pxD(chartDates[n-1]), lastY = pyP(curNorm);

  // Phase D projection (dotted) — 3 scenarios from TODAY
  const todayMs = new Date(chartDates[n-1]).getTime();
  const proj6Ms = todayMs + 180 * 86400000;  // +6 months
  const proj6X  = pxT(proj6Ms);

  const baseProj  = curNorm + 14;   // Base: +14% (Phase D expansion)
  const bearProj  = curNorm - 10;   // Bear: -10% (stall/correction)

  const baseY   = pyP(baseProj);
  const bearY   = pyP(bearProj);
  const cone = `M${lastX.toFixed(1)},${lastY.toFixed(1)} L${proj6X.toFixed(1)},${baseY.toFixed(1)} L${proj6X.toFixed(1)},${bearY.toFixed(1)} Z`;

  // Horizontal grid lines
  const gridVals = [-20, 0, 20, 40, 60, 80];
  const gridLines = gridVals.map(v => {
    if (v < priceMin || v > priceMax) return '';
    const gy = pyP(v);
    const isZero = v === 0;
    return `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}"
      stroke="${isZero ? 'rgba(26,23,20,.25)' : 'rgba(201,191,173,.28)'}"
      stroke-width="${isZero ? 0.8 : 0.5}" ${isZero ? '' : 'stroke-dasharray="3 2"'}/>
  <text x="${(pL-4)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" font-size="8.5"
    fill="rgba(26,23,20,.${isZero?'45':'28'})" font-family="inherit">${v > 0 ? '+' : ''}${v}%</text>`;
  }).join('');

  // Key event annotations
  const KEY_EVENTS = [
    { date: '2022-03-17', label: 'First Hike',    sub: '0→0.5%',      side: 'above', phase: null },
    { date: '2022-10-13', label: 'Bear Low',       sub: '−17%',        side: 'below', phase: 'A1' },
    { date: '2023-07-26', label: 'Rate Peak',      sub: '5.33%',       side: 'above', phase: 'B'  },
    { date: '2024-09-18', label: 'First Cut',      sub: '5.33→5%',     side: 'below', phase: 'C'  },
  ];

  const eventMarkup = KEY_EVENTS.map(ev => {
    if (!chartDates.some(d => d <= ev.date)) return '';
    const ex = pxD(ev.date);
    const evIdx = chartCandles.findIndex(c => c.time >= ev.date);
    if (evIdx < 0) return '';
    const ey = pyP(normVals[evIdx] ?? 0);
    const labelY = ev.side === 'above' ? ey - 22 : ey + 22;
    const subY   = ev.side === 'above' ? ey - 10 : ey + 34;
    return `<line x1="${ex.toFixed(1)}" y1="${pT}" x2="${ex.toFixed(1)}" y2="${(pT+H_PRICE)}"
      stroke="rgba(201,191,173,.45)" stroke-width="0.5" stroke-dasharray="3 2"/>
  <circle cx="${ex.toFixed(1)}" cy="${ey.toFixed(1)}" r="3.5" fill="rgba(201,191,173,.8)" stroke="rgba(26,23,20,.3)" stroke-width="0.5"/>
  <text x="${ex.toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="9" font-weight="600"
    fill="rgba(26,23,20,.55)" font-family="inherit">${esc(ev.label)}</text>
  <text x="${ex.toFixed(1)}" y="${subY}" text-anchor="middle" font-size="8"
    fill="rgba(26,23,20,.38)" font-family="inherit">${esc(ev.sub)}</text>`;
  }).join('');

  // TODAY line
  const todayX = lastX;
  const todayLine = `<line x1="${todayX.toFixed(1)}" y1="${pT}" x2="${todayX.toFixed(1)}" y2="${(pT+H_PRICE)}"
    stroke="rgba(26,23,20,.5)" stroke-width="1.2" stroke-dasharray="4 2"/>
  <text x="${(todayX+4).toFixed(1)}" y="${(pT+13)}" font-size="8.5" font-weight="700"
    fill="rgba(26,23,20,.6)" letter-spacing=".06em" font-family="inherit">TODAY</text>
  <text x="${(todayX+4).toFixed(1)}" y="${(pT+25)}" font-size="8.5"
    fill="#2a6b4a" font-weight="600" font-family="inherit">+${curNorm.toFixed(0)}%</text>`;

  // Phase D projection labels at the right edge
  const projLabels = `
  <text x="${(proj6X+4).toFixed(1)}" y="${(baseY+4).toFixed(1)}" font-size="9" fill="rgba(42,107,74,.8)"
    font-weight="600" font-family="inherit">+${baseProj.toFixed(0)}%</text>
  <text x="${(proj6X+4).toFixed(1)}" y="${(baseY+15).toFixed(1)}" font-size="8" fill="rgba(42,107,74,.65)"
    font-family="inherit">Base</text>
  <text x="${(proj6X+4).toFixed(1)}" y="${(bearY+4).toFixed(1)}" font-size="9" fill="rgba(164,80,47,.8)"
    font-weight="600" font-family="inherit">+${bearProj.toFixed(0)}%</text>
  <text x="${(proj6X+4).toFixed(1)}" y="${(bearY+15).toFixed(1)}" font-size="8" fill="rgba(164,80,47,.65)"
    font-family="inherit">Bear</text>`;

  // Year labels on x-axis
  let lastYr = '', xTicks = '';
  const years = ['2022','2023','2024','2025','2026','2027'];
  years.forEach(yr => {
    const yx = pxD(`${yr}-01-01`);
    if (yx < pL || yx > pL + cW) return;
    xTicks += `<line x1="${yx.toFixed(1)}" y1="${(pT+H_PRICE)}" x2="${yx.toFixed(1)}" y2="${(pT+H_PRICE+4)}"
      stroke="rgba(201,191,173,.5)" stroke-width="0.5"/>
  <text x="${yx.toFixed(1)}" y="${(pT+H_PRICE+14).toFixed(1)}" text-anchor="middle"
    font-size="9" fill="rgba(26,23,20,.35)" font-family="inherit">${yr}</text>`;
  });

  // ── Rate panel ──────────────────────────────────────────────────────────────
  const rY0 = pT + H_PRICE + GAP, rH = H_RATE;
  const dffObs = (rateSeries?.DFF || []).filter(o => o.date >= ANCHOR_DATE);
  const rateMax = 6.5;
  const pyR = v => rY0 + rH - (Math.min(v, rateMax) / rateMax) * rH;

  const rateGrid = [2, 4, 5.5].map(v => {
    const gy = pyR(v);
    return `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}"
      stroke="rgba(201,191,173,.28)" stroke-width="0.5" stroke-dasharray="2 2"/>
    <text x="${(pL-4)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" font-size="8.5"
      fill="rgba(26,23,20,.28)" font-family="inherit">${v}%</text>`;
  }).join('');

  const dffPath = dffObs.length > 1
    ? dffObs.map((o,i) => `${i===0?'M':'L'}${pxD(o.date).toFixed(1)},${pyR(o.value).toFixed(1)}`).join(' ')
    : '';
  const dffAreaPath = dffPath
    ? `${dffPath} L${pxD(dffObs[dffObs.length-1].date).toFixed(1)},${(rY0+rH)} L${pxD(dffObs[0].date).toFixed(1)},${(rY0+rH)}Z`
    : '';
  const dffNow = dffObs.length ? dffObs[dffObs.length-1].value : null;

  // ── Phase Kostolany markers on rate panel ───────────────────────────────────
  // Show which Kostolany phase corresponds to each rate period
  const phaseMarkers = [
    { from: '2022-03-17', to: '2022-10-13', label: 'A1', color: 'rgba(164,80,47,.18)' },
    { from: '2022-10-13', to: '2023-07-26', label: 'B', color: 'rgba(42,107,74,.12)' },
    { from: '2023-07-26', to: '2024-09-18', label: 'C', color: 'rgba(138,106,44,.12)' },
    { from: '2024-09-18', to: chartDates[n-1], label: 'C→', color: 'rgba(138,106,44,.18)' },
  ];

  const phaseBar = phaseMarkers.map(pm => {
    const x1 = Math.max(pL, pxD(pm.from)), x2 = Math.min(pL+cW, pxD(pm.to));
    if (x2 <= x1) return '';
    const midX = (x1 + x2) / 2;
    return `<rect x="${x1.toFixed(1)}" y="${(rY0+rH+3)}" width="${(x2-x1).toFixed(1)}" height="10" fill="${pm.color}"/>
  <text x="${midX.toFixed(1)}" y="${(rY0+rH+11)}" text-anchor="middle" font-size="7.5"
    fill="rgba(26,23,20,.45)" font-weight="600" font-family="inherit">${pm.label}</text>`;
  }).join('');

  // ── SVG assembly ─────────────────────────────────────────────────────────────
  const svg = `<svg viewBox="0 0 ${W} ${H_TOTAL + 16}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <linearGradient id="cycleGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(26,23,20,.08)"/><stop offset="100%" stop-color="rgba(26,23,20,.01)"/>
    </linearGradient>
    <linearGradient id="rateGrad2" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(138,106,44,.22)"/><stop offset="100%" stop-color="rgba(138,106,44,.02)"/>
    </linearGradient>
  </defs>

  <!-- Grid -->
  ${gridLines}

  <!-- Projection cone (past TODAY) -->
  <polygon points="${cone}" fill="rgba(26,23,20,.05)" stroke="none"/>
  <line x1="${todayX.toFixed(1)}" y1="${lastY.toFixed(1)}" x2="${proj6X.toFixed(1)}" y2="${baseY.toFixed(1)}"
    stroke="rgba(42,107,74,.4)" stroke-width="1.2" stroke-dasharray="6 3"/>
  <line x1="${todayX.toFixed(1)}" y1="${lastY.toFixed(1)}" x2="${proj6X.toFixed(1)}" y2="${bearY.toFixed(1)}"
    stroke="rgba(164,80,47,.4)" stroke-width="1.2" stroke-dasharray="4 3"/>
  ${projLabels}

  <!-- Price area -->
  <path d="${linePts} L${lastX.toFixed(1)},${(pT+H_PRICE)} L${pxD(ANCHOR_DATE).toFixed(1)},${(pT+H_PRICE)}Z"
    fill="url(#cycleGrad)"/>
  <!-- Price line -->
  <path d="${linePts}" fill="none" stroke="#1A1714" stroke-width="1.8" stroke-linejoin="round"/>
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="4" fill="#1A1714"/>

  <!-- Key events -->
  ${eventMarkup}

  <!-- TODAY line -->
  ${todayLine}

  <!-- X-axis year ticks -->
  ${xTicks}

  <!-- Rate panel separator -->
  <line x1="${pL}" y1="${(rY0-6)}" x2="${(pL+cW)}" y2="${(rY0-6)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>
  <text x="${pL}" y="${(rY0-10)}" font-size="8" fill="rgba(26,23,20,.32)" letter-spacing=".1em" font-family="inherit">FED FUNDS RATE</text>
  ${dffNow != null ? `<text x="${(pL+cW)}" y="${(rY0-10)}" text-anchor="end" font-size="9" fill="rgba(138,106,44,.8)" font-weight="600" font-family="inherit">${dffNow.toFixed(2)}% now</text>` : ''}

  <!-- Rate panel -->
  ${rateGrid}
  <line x1="${pL}" y1="${(rY0+rH)}" x2="${(pL+cW)}" y2="${(rY0+rH)}" stroke="rgba(201,191,173,.38)" stroke-width="0.5"/>
  ${dffAreaPath ? `<path d="${dffAreaPath}" fill="url(#rateGrad2)"/>` : ''}
  ${dffPath ? `<path d="${dffPath}" fill="none" stroke="#8a6a2c" stroke-width="1.8" stroke-linejoin="round"/>` : ''}
  ${dffNow != null ? `<circle cx="${pxD(dffObs[dffObs.length-1].date).toFixed(1)}" cy="${pyR(dffNow).toFixed(1)}" r="3" fill="#8a6a2c"/>` : ''}

  <!-- Kostolany phase bar (below rate panel) -->
  ${phaseBar}
  <text x="${pL}" y="${(rY0+rH+22)}" font-size="7.5" fill="rgba(26,23,20,.32)" letter-spacing=".08em" font-family="inherit">KOSTOLANY PHASE</text>
</svg>`;

  // ── 4-column analysis panel ───────────────────────────────────────────────────

  const confirming = signals.filter(s => s.color === 'green');
  const watching   = signals.filter(s => s.color === 'amber');
  const contradicting = signals.filter(s => s.color === 'red');

  const topAnalog = (analogsData?.analogs || [])[0] || {};
  const phaseCode = cycleState?.phase_code || 'C';
  const nextPhase = cycleState?.cycle_diagram?.next_watch || 'Expansion or distribution';

  const panel = `<div class="mu-cycle-analysis-grid">
    <div class="mu-ca-col">
      <div class="mu-ca-head">Signal Check</div>
      <p class="mu-ca-desc">Confirming vs contradicting Phase D</p>
      <div class="mu-ca-signals">
        ${confirming.slice(0,3).map(s => `<div class="mu-ca-sig mu-ca-sig-g">✓ ${esc(s.name)} — ${esc(s.label)}.</div>`).join('')}
        ${watching.slice(0,2).map(s => `<div class="mu-ca-sig mu-ca-sig-a">~ ${esc(s.name)} — ${esc(s.label)}.</div>`).join('')}
        ${contradicting.slice(0,3).map(s => `<div class="mu-ca-sig mu-ca-sig-r">✗ ${esc(s.name)} — ${esc(s.label)}.</div>`).join('')}
      </div>
    </div>
    <div class="mu-ca-col">
      <div class="mu-ca-head">Projection</div>
      <p class="mu-ca-desc">Where the cycle points next</p>
      <div class="mu-ca-proj">
        <div class="mu-ca-proj-base">
          <span>Base case (65%)</span>
          <b>Phase C → D: Expansion</b>
          <p class="mu-ca-proj-read">Path: ${esc(nextPhase)}</p>
          <small class="mu-ca-proj-rule">Rule: add on pullbacks 7,216–7,440.</small>
        </div>
        <div class="mu-ca-proj-bear">
          <span>Bear case (35%)</span>
          <b>Stall / Phase F risk</b>
          <p class="mu-ca-proj-read">Trigger: credit widens + VIX above 20.</p>
          <small class="mu-ca-proj-rule">Warning line: HY OAS above 3.5%.</small>
        </div>
      </div>
    </div>
  </div>`;

  return `<div class="mu-cycle-analysis">${svg}${panel}</div>`;
}

// ── Traffic light logic ───────────────────────────────────────────────────────

function axisSignal(axis) {
  if (!axis) return { color: 'amber', label: '—', display: '—', trend: '→' };
  const id    = String(axis.id || '').toLowerCase();
  const score = num(axis.score) ?? 50;
  const dir   = String(axis.direction || '').toLowerCase();
  const trend = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';

  let color;
  if (id === 'money' || id === 'funding') {
    color = score >= 75 ? 'red' : score >= 55 ? 'amber' : 'green';
  } else if (id === 'physical' || id === 'physical_constraint') {
    color = score >= 80 ? 'red' : score >= 60 ? 'amber' : 'green';
  } else if (id === 'credit') {
    color = score >= 60 ? 'red' : score >= 45 ? 'amber' : 'green';
  } else if (id === 'liquidity') {
    color = score >= 60 ? 'green' : score >= 40 ? 'amber' : 'red';
  } else if (id === 'risk' || id === 'risk_appetite') {
    color = score > 75 ? 'amber' : score >= 35 ? 'green' : 'red';
  } else {
    color = score >= 65 ? 'green' : score >= 45 ? 'amber' : 'red';
  }

  return {
    color, trend,
    label: esc(axis.state || '—'),
    display: esc(axis.state || '—'),
  };
}

function mktSignal(key, value, chart) {
  const n = num(value);
  let color, label, display, trend = '→';

  if (key === 'spx') {
    const ma50 = num(chart?.ma50), ma200 = num(chart?.ma200);
    const aboveBoth = ma50 && ma200 && n > ma50 && n > ma200;
    const aboveOne  = (ma50 && n > ma50) || (ma200 && n > ma200);
    color   = aboveBoth ? 'green' : aboveOne ? 'amber' : 'red';
    label   = aboveBoth ? 'Above 50D & 200D' : aboveOne ? 'Mixed MAs' : 'Below MAs';
    display = n ? n.toLocaleString('en-US',{maximumFractionDigits:0}) : '—';
    trend   = aboveBoth ? '↑' : '→';
  } else if (key === 'vix') {
    color   = n < 15 ? 'green' : n < 22 ? 'amber' : 'red';
    label   = n < 15 ? 'Calm' : n < 22 ? 'Watchful' : 'Elevated';
    display = n ? n.toFixed(1) : '—';
    trend   = n < 18 ? '→' : '↑';
  } else if (key === 'dgs10') {
    color   = n < 3.5 ? 'green' : n < 4.5 ? 'amber' : 'red';
    label   = n < 3.5 ? 'Supportive' : n < 4.5 ? 'Watch' : 'Headwind';
    display = n ? n.toFixed(2) + '%' : '—';
    trend   = n > 4.5 ? '↑' : '→';
  } else if (key === 'hy_oas') {
    color   = n < 3.2 ? 'green' : n < 4.5 ? 'amber' : 'red';
    label   = n < 3.2 ? 'Tight' : n < 4.5 ? 'Widening' : 'Stressed';
    display = n ? n.toFixed(2) : '—';
    trend   = n > 3.5 ? '↑' : '↓';
  } else if (key === 'confirmation') {
    color   = n >= 75 ? 'green' : n >= 55 ? 'amber' : 'red';
    label   = n >= 75 ? 'Confirmed' : n >= 55 ? 'Mixed' : 'Failing';
    display = n ? Math.round(n) + '/100' : '—';
    trend   = n >= 75 ? '↑' : '→';
  } else if (key === 'rsi14') {
    color   = n > 75 ? 'red' : n > 65 ? 'amber' : n >= 35 ? 'green' : 'red';
    label   = n > 75 ? 'Overbought' : n > 65 ? 'Extended' : n >= 35 ? 'Healthy' : 'Oversold';
    display = n ? n.toFixed(1) : '—';
    trend   = n > 65 ? '↑' : '→';
  } else {
    color = 'amber'; label = '—'; display = '—';
  }
  return { color, label, display, trend };
}

// ── Data assembly ─────────────────────────────────────────────────────────────

const mvMap = Object.fromEntries((brief.macro_values || []).map(m => [m.key, m]));
const axMap = Object.fromEntries((config.axes || []).map(a => [a.id, a]));
const chart = brief.chart_reference || {};

// SPX / SPY ratio for converting SPX zone levels to SPY chart prices
const spxCurrent = num(mvMap.spx?.value) || 7554;
const spyCandles = loadCandles('SPY');
const spyCurrent = spyCandles.length > 0 ? spyCandles[spyCandles.length-1].close : 755;
const spxToSpy = spyCurrent / spxCurrent;

// Regime / phase
const phaseCode  = esc(egg.phase_code || 'C');
const phaseName  = esc(egg.phase_label || egg.macro_phase || 'Verification');
const conf       = num(egg.phase_confidence) ?? 83;
const action     = esc(egg.center_action || '—');
const stressType = esc(egg.stress_type || '—');
const diagLabel  = esc(config.diagnosis?.label || '—');
const changeRule = esc(brief.change_rule || '—');
const riskRule   = esc(brief.risk_rule || '—');

// Compose plain-English narrative
const marketRead = brief.market_read || '';
const macroRead  = brief.macro_read  || '';
const topAnalog  = (analogs.analogs || [])[0] || {};
const analogNote = topAnalog.period ? `Current regime most closely matches ${topAnalog.period} (${topAnalog.similarity}% similarity) — ${topAnalog.portfolioLesson}` : '';
const narrative  = [marketRead, macroRead, analogNote].filter(Boolean).join(' ');

// Key signals for compact scorecard row
const signals = [
  { name: 'Trend',        ...mktSignal('spx',         mvMap.spx?.value,         chart) },
  { name: 'Confirm',      ...mktSignal('confirmation', mvMap.confirmation?.value, chart) },
  { name: 'RSI',          ...mktSignal('rsi14',        mvMap.rsi14?.value,        chart) },
  { name: 'VIX',          ...mktSignal('vix',          mvMap.vix?.value,          chart) },
  { name: 'Fed / Money',  ...axisSignal({ ...axMap.money, id: 'money' }) },
  { name: '10Y',          ...mktSignal('dgs10',        mvMap.dgs10?.value,        chart) },
  { name: 'Credit',       ...mktSignal('hy_oas',       mvMap.hy_oas?.value,       chart) },
  { name: 'Liquidity',    ...axisSignal({ ...axMap.liquidity,   id: 'liquidity' }) },
  { name: 'Risk Appetite',...axisSignal({ ...axMap.risk_appetite || axMap.risk, id: 'risk_appetite' }) },
  { name: 'Physical',     ...axisSignal({ ...(axMap.physical_constraint || axMap.physical), id: 'physical' }) },
];

const greens = signals.filter(s => s.color === 'green').length;
const ambers = signals.filter(s => s.color === 'amber').length;
const reds   = signals.filter(s => s.color === 'red').length;

// ── Chart SVGs ────────────────────────────────────────────────────────────────

// Unified macro chart — one chart, 5-year journey + tactical zones + rate cycle
const rateHistory  = loadRateHistory();
const rateSeries   = rateHistory?.series || null;
const topAnalogLesson = esc((analogs.analogs||[])[0]?.portfolioLesson || '');

// Fallback rate series from FRED cache if no macro-history.json
const cacheRates = (() => {
  try {
    const c = JSON.parse(fs.readFileSync(path.join(root,'data','cache','money-cash-series.json'),'utf8'));
    const dff = (c.series?.DFF || []).map(o => ({ date: o.date.slice(0,10), value: o.value }));
    return dff.length ? { DFF: dff } : null;
  } catch { return null; }
})();

const activeRateSeries = (rateSeries && Object.keys(rateSeries).length) ? rateSeries : cacheRates;
const unifiedChart = buildUnifiedChart(spyCandles, activeRateSeries, chart, spxToSpy, topAnalogLesson);

// VIX and indices pulse kept for supporting context
const vixChart     = buildVixChart(90);
const indicesPulse = buildIndicesPulse();

// Cycle analysis: JUTOPIA-style anchor chart + 4-column structured argument
const cycleAnalysisHtml = buildCycleAnalysis(spyCandles, activeRateSeries, signals, cycle, analogs);

// ── Cycle SVG ─────────────────────────────────────────────────────────────────

const phases = Array.isArray(egg.phases) ? egg.phases : [];
const currentCode  = egg.phase_code || 'C';
const previousCode = (phases.find(p => p.state === 'previous') || {}).code || 'B';

const PHASE_POS = [
  { code: 'A1', x: 38,  y: 148, side: 'below', note: 'Panic · Bonds · Gold',     behavior: "panic · forced exits · Oct '22" },
  { code: 'A2', x: 112, y: 108, side: 'below', note: 'Policy pivot · Prepare',   behavior: 'smart money buys · press silent' },
  { code: 'B',  x: 222, y: 50,  side: 'above', note: 'Tech · Discretionary',     behavior: 'first green · skeptics sell rallies' },
  { code: 'C',  x: 348, y: 35,  side: 'above', note: 'Quality · Healthcare',     behavior: 'Quality leads · No FOMO yet' },
  { code: 'D',  x: 460, y: 52,  side: 'above', note: 'Cyclicals · Energy',       behavior: 'FOMO begins · breadth expands' },
  { code: 'E',  x: 558, y: 98,  side: 'below', note: 'Trim beta · Raise cash',   behavior: 'everyone in · PE at peak' },
  { code: 'F',  x: 636, y: 142, side: 'below', note: 'Defensives · Bonds',       behavior: 'smart exits · late buyers arrive' },
];

const cycleNodes = PHASE_POS.map(pp => {
  const isCurrent  = pp.code === currentCode;
  const isPrevious = pp.code === previousCode;
  const r = isCurrent ? 18 : 11;
  const fill   = isCurrent ? '#A4502F' : isPrevious ? 'rgba(164,80,47,.28)' : 'rgba(201,191,173,.45)';
  const stroke = isCurrent ? '#A4502F' : 'rgba(201,191,173,.4)';
  const textFill = isCurrent ? '#fff' : 'rgba(26,23,20,.55)';
  const labelY = pp.side === 'above' ? pp.y - r - 26 : pp.y + r + 13;
  const noteY  = pp.side === 'above' ? pp.y - r - 10 : pp.y + r + 27;
  const phase  = phases.find(p => p.code === pp.code);
  const label  = phase ? esc(phase.label || pp.code) : pp.code;

  let m = `<circle cx="${pp.x}" cy="${pp.y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${isCurrent?2:1}"/>`;
  m += `<text x="${pp.x}" y="${pp.y+4}" text-anchor="middle" font-size="${isCurrent?9:8}" font-weight="600" fill="${textFill}" font-family="inherit">${pp.code}</text>`;
  if (isCurrent) {
    const rsiVal    = mvMap.rsi14?.value   != null ? Number(mvMap.rsi14.value).toFixed(1)  : '—';
    const creditVal = mvMap.hy_oas?.value  != null ? Number(mvMap.hy_oas.value).toFixed(2) : '—';
    const vixVal    = mvMap.vix?.value     != null ? Number(mvMap.vix.value).toFixed(1)    : '—';
    const dgs10Val  = mvMap.dgs10?.value   != null ? Number(mvMap.dgs10.value).toFixed(2) + '%' : '—';
    m += `<text x="${pp.x}" y="${pp.y - r - 44}" text-anchor="middle" font-size="7.5" font-weight="700" fill="#A4502F" letter-spacing=".12em" font-family="inherit">YOU ARE HERE</text>`;
    m += `<text x="${pp.x}" y="${pp.y - r - 31}" text-anchor="middle" font-size="10.5" font-weight="600" fill="#A4502F" font-family="inherit">${label}</text>`;
    m += `<text x="${pp.x}" y="${pp.y - r - 18}" text-anchor="middle" font-size="8.5" fill="rgba(164,80,47,.75)" font-family="inherit">${esc(pp.note)}</text>`;
    m += `<text x="${pp.x}" y="${pp.y - r - 7}" text-anchor="middle" font-size="8" fill="rgba(138,106,44,.72)" font-family="inherit">RSI ${rsiVal} · Credit ${creditVal} · VIX ${vixVal} · 10Y ${dgs10Val}</text>`;
    m += `<text x="${pp.x}" y="${pp.y - r + 5}" text-anchor="middle" font-size="7.5" fill="rgba(26,23,20,.42)" font-family="inherit">Fed 3.65% cutting · D not yet confirmed</text>`;
  } else {
    m += `<text x="${pp.x}" y="${labelY}" text-anchor="middle" font-size="9" font-weight="500" fill="${isPrevious?'rgba(26,23,20,.55)':'rgba(26,23,20,.5)'}" font-family="inherit">${label}</text>`;
    if (pp.behavior) {
      m += `<text x="${pp.x}" y="${noteY}" text-anchor="middle" font-size="7.5" fill="rgba(26,23,20,.38)" font-family="inherit">${esc(pp.behavior)}</text>`;
    }
  }
  return m;
}).join('');

const cycleSvg = `<svg viewBox="0 -48 700 240" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <marker id="cyArr" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5Z" fill="rgba(42,107,74,.55)"/>
    </marker>
  </defs>
  <!-- Full cycle base path -->
  <path d="M18,155 C52,155 72,115 112,108 S174,50 222,50 S310,35 348,35 S428,52 460,52 S530,98 558,98 S618,142 652,148 L690,155"
        fill="none" stroke="rgba(201,191,173,.45)" stroke-width="2"/>
  <!-- Traveled path: A2 → B → C (full journey) -->
  <path d="M112,108 S174,50 222,50 S310,35 348,35"
        fill="none" stroke="rgba(164,80,47,.65)" stroke-width="2.5"/>
  <!-- Next path: C → D (dotted green, what's coming) -->
  <path d="M348,35 S428,52 460,52"
        fill="none" stroke="rgba(42,107,74,.45)" stroke-width="1.5" stroke-dasharray="5 3" marker-end="url(#cyArr)"/>
  <!-- Footer -->
  <text x="350" y="185" text-anchor="middle" font-size="7.5" fill="rgba(26,23,20,.28)" letter-spacing=".12em" font-family="inherit">ECONOMIC CYCLE · KOSTOLANY FRAMEWORK · 2022–PRESENT</text>
  ${cycleNodes}
</svg>`;

// ── Sector heat map ───────────────────────────────────────────────────────────

function sectorColor(posture, tilt) {
  const p = String(posture || '').toLowerCase();
  const t = String(tilt || '').toLowerCase();
  if (/avoid|underweight/.test(t) || /avoid add/.test(p)) return 'red';
  if (/wait/.test(p) && /underweight/.test(t)) return 'red';
  if (/overweight|favor/.test(t) || /add quality/.test(p) || /accumulate/.test(p)) return 'green';
  return 'amber';
}

const SECTORS = [
  { bucket: 'Healthcare',        icon: '⚕', short: 'Healthcare' },
  { bucket: 'Defensive sectors', icon: '🛡', short: 'Defensive' },
  { bucket: 'Dividend / income', icon: '$',  short: 'Dividend' },
  { bucket: 'Utilities',         icon: '⚡', short: 'Utilities' },
  { bucket: 'Quality growth',    icon: '↑',  short: 'Quality Growth' },
  { bucket: 'AI / semis',        icon: '⬡',  short: 'AI / Semis' },
  { bucket: 'Financials',        icon: '≡',  short: 'Financials' },
  { bucket: 'Energy equities',   icon: '◈',  short: 'Energy' },
  { bucket: 'Value',             icon: '⊖',  short: 'Value' },
  { bucket: 'Cyclicals',         icon: '↻',  short: 'Cyclicals' },
  { bucket: 'Small caps',        icon: '↓',  short: 'Small Caps' },
  { bucket: 'Speculative growth',icon: '⚠',  short: 'Speculative' },
];

const equityPosture = Array.isArray(cycle.equity_posture) ? cycle.equity_posture : [];

const sectorGrid = SECTORS.map(s => {
  const ep    = equityPosture.find(p => p.bucket === s.bucket);
  const color = ep ? sectorColor(ep.posture, ep.tilt) : 'amber';
  const sig   = color === 'green' ? 'Favor' : color === 'red' ? 'Reduce' : 'Watch';
  const cond  = ep?.condition ? esc(ep.condition.split('.')[0]) : '';
  return `<div class="mu-sector mu-${color}" title="${cond}">
    <span class="mu-sector-icon">${esc(s.icon)}</span>
    <span class="mu-sector-name">${esc(s.short)}</span>
    <span class="mu-sector-sig">${sig}</span>
  </div>`;
}).join('');

// ── Tier 2 extraction ─────────────────────────────────────────────────────────

let html = fs.readFileSync(indexPath, 'utf8');

function extractSection(html, id) {
  let s = 0;
  while (s < html.length) {
    const i = html.indexOf('<section', s);
    if (i < 0) return '';
    const j = html.indexOf('>', i);
    if (html.slice(i, j+1).includes(`id="${id}"`)) {
      let end = html.length, search = j + 1;
      while (search < html.length) {
        const ni = html.indexOf('<section', search);
        if (ni < 0) break;
        const nj = html.indexOf('>', ni);
        if (html.slice(ni, nj+1).includes('id=') && ni !== i) { end = ni; break; }
        search = ni + 1;
      }
      const mc = html.lastIndexOf('</main>');
      if (mc > i && mc < end) end = mc;
      return html.slice(i, end);
    }
    s = i + 1;
  }
  return '';
}

function archiveId(h) {
  return h.replace(/(<section[^>]*)\sid="([^"]*)"/, '$1 data-macro-archived="$2"');
}

const dbHtml  = archiveId(extractSection(html, 'decision-brief-section'));
const cmsHtml = archiveId(extractSection(html, 'current-market-state'));
const remainingAnalogs = (analogs.analogs || []).slice(1, 4).map(a => `
  <div class="mu-analog-extra">
    <div class="mu-ae-head">
      <div><b>${esc(a.period)}</b><span>${esc(a.label)}</span></div>
      <em style="color:${(num(a.similarity)||0)>=85?'#A4502F':'rgba(26,23,20,.45)'}">${esc(a.similarity)}%</em>
    </div>
    <p>${esc(a.portfolioLesson)}</p>
  </div>`).join('');

// ── CSS ───────────────────────────────────────────────────────────────────────

const style = `<style id="macro-unified-style">
.macro-unified{border-bottom:1px solid var(--macro-rule,rgba(201,191,173,.55));background:#F7F3EB}
.mu-wrap{width:min(1280px,calc(100% - 48px));margin:0 auto}

/* Color semantics */
.mu-green{--c:#2a6b4a;--bg:rgba(42,107,74,.09);--bd:rgba(42,107,74,.28)}
.mu-amber{--c:#8a6a2c;--bg:rgba(138,106,44,.09);--bd:rgba(138,106,44,.28)}
.mu-red  {--c:#A4502F;--bg:rgba(164,80,47,.09); --bd:rgba(164,80,47,.28)}
.mu-good {color:#2a6b4a}
.mu-warn {color:#8a6a2c}
.mu-bad  {color:#A4502F}

/* ── Regime header ── */
.mu-regime{display:grid;grid-template-columns:1fr auto;gap:28px;align-items:start;padding:32px 0 24px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-phase-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:rgba(26,23,20,.38);margin:0 0 8px;font-family:var(--mono,monospace)}
.mu-phase-title{font-size:clamp(40px,5vw,76px);line-height:.88;letter-spacing:-.075em;font-weight:500;margin:0 0 12px;color:#1A1714}
.mu-narrative{font-size:clamp(13px,1.2vw,15px);line-height:1.55;color:rgba(26,23,20,.68);max-width:820px;margin:0 0 18px}
.mu-action{border-left:2.5px solid #A4502F;padding:8px 0 8px 14px}
.mu-action span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.4);margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-action b{display:block;font-size:14px;font-weight:500;color:#1A1714;line-height:1.3}
.mu-action small{display:block;font-size:11.5px;color:rgba(26,23,20,.52);margin-top:4px}
.mu-regime-meta{display:flex;flex-direction:column;align-items:flex-end;gap:12px}
.mu-conf{text-align:right}
.mu-conf span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.38);margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-conf b{display:block;font-size:56px;line-height:.88;letter-spacing:-.07em;font-weight:500;color:#A4502F}
.mu-conf small{font-size:11px;color:rgba(26,23,20,.42);display:block;text-align:right}
.mu-stress-badge{display:inline-block;padding:4px 10px;border:1px solid rgba(164,80,47,.35);background:rgba(164,80,47,.07);font-size:10px;color:#A4502F;letter-spacing:.06em}

/* ── Cycle analysis ── */
.mu-cycle-analysis{padding:24px 0 0;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-cycle-analysis-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0;margin-top:16px;border:1px solid rgba(201,191,173,.45)}
.mu-ca-col{padding:16px 16px 18px;border-right:1px solid rgba(201,191,173,.38)}
.mu-ca-col:last-child{border-right:none}
.mu-ca-head{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.4);font-weight:600;margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-ca-desc{font-size:10px;color:rgba(26,23,20,.45);margin:0 0 10px;line-height:1.4}
.mu-ca-list{margin:0;padding:0 0 0 14px;list-style:disc}
.mu-ca-list li{font-size:11px;color:rgba(26,23,20,.7);line-height:1.5;margin-bottom:3px}
.mu-ca-compare{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.mu-ca-then,.mu-ca-now{font-size:10.5px;line-height:1.55;color:rgba(26,23,20,.65)}
.mu-ca-then span,.mu-ca-now span{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:5px;font-family:var(--mono,monospace)}
.mu-ca-then span{color:rgba(164,80,47,.7)}
.mu-ca-now span{color:rgba(42,107,74,.7)}
.mu-ca-then div,.mu-ca-now div{border-bottom:1px solid rgba(201,191,173,.3);padding:3px 0}
.mu-ca-signals{display:flex;flex-direction:column;gap:4px}
.mu-ca-sig{font-size:10.5px;padding:4px 8px;line-height:1.3}
.mu-ca-sig-g{background:rgba(42,107,74,.08);color:#2a6b4a;border-left:2px solid #2a6b4a}
.mu-ca-sig-a{background:rgba(138,106,44,.08);color:#8a6a2c;border-left:2px solid #8a6a2c}
.mu-ca-sig-r{background:rgba(164,80,47,.08);color:#A4502F;border-left:2px solid #A4502F}
.mu-ca-proj{display:flex;flex-direction:column;gap:8px}
.mu-ca-proj-base,.mu-ca-proj-bear{padding:10px 12px}
.mu-ca-proj-base{background:rgba(42,107,74,.07);border:1px solid rgba(42,107,74,.2)}
.mu-ca-proj-bear{background:rgba(164,80,47,.06);border:1px solid rgba(164,80,47,.18)}
.mu-ca-proj span{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:rgba(26,23,20,.4);margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-ca-proj b{display:block;font-size:12.5px;font-weight:600;margin-bottom:4px;line-height:1.2}
.mu-ca-proj-base b{color:#2a6b4a}
.mu-ca-proj-bear b{color:#A4502F}
.mu-ca-proj p{font-size:10.5px;color:rgba(26,23,20,.65);margin:0 0 4px;line-height:1.35}
.mu-ca-proj .mu-ca-proj-read{display:block;margin:6px 0 5px;line-height:1.45}
.mu-ca-proj small{display:block;font-size:9.5px;color:rgba(26,23,20,.45);line-height:1.4}
@media(max-width:900px){.mu-cycle-analysis-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.mu-cycle-analysis-grid{grid-template-columns:1fr}}

/* ── Unified chart block ── */
.mu-unified-chart-block{padding:24px 0 16px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-analog-callout{display:flex;align-items:baseline;gap:10px;margin-top:10px;padding:10px 14px;border-left:2.5px solid rgba(164,80,47,.5);background:rgba(164,80,47,.05)}
.mu-analog-callout span{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(164,80,47,.7);white-space:nowrap;font-family:var(--mono,monospace)}
.mu-analog-callout b{font-size:12.5px;color:rgba(26,23,20,.72);line-height:1.4;font-weight:400}
/* ── Charts row ── */
.mu-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid rgba(201,191,173,.45);padding:24px 0 20px}
.mu-chart-block{padding-right:20px;border-right:1px solid rgba(201,191,173,.38)}
.mu-vix-block{padding-left:20px}
.mu-chart-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.mu-chart-head h3{font-size:10px;text-transform:uppercase;letter-spacing:.13em;color:rgba(26,23,20,.45);font-weight:500;margin:0;font-family:var(--mono,monospace)}
.mu-chart-head span{font-size:11px;color:rgba(26,23,20,.5)}
.mu-chart-legend{display:flex;gap:14px;margin-top:6px;font-size:9px;color:rgba(26,23,20,.45)}
.mu-chart-legend span{display:flex;align-items:center;gap:5px}

/* ── Indices pulse ── */
.mu-pulse-row{display:grid;grid-template-columns:140px 1fr 52px;gap:0;align-items:center;padding:7px 0;border-bottom:1px solid rgba(201,191,173,.25)}
.mu-pulse-row:last-child{border-bottom:none}
.mu-pulse-label b{display:block;font-size:12px;font-weight:500;color:#1A1714}
.mu-pulse-label span{font-size:10px;color:rgba(26,23,20,.45)}
.mu-pulse-bar-wrap{height:18px;background:rgba(201,191,173,.2);position:relative}
.mu-pulse-bar{height:100%;min-width:2px;transition:width .3s}
.mu-pulse-val{font-size:12px;font-weight:600;text-align:right;padding-left:8px}
.mu-pulse-section{padding:20px 0 16px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-pulse-head{font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:rgba(26,23,20,.38);margin:0 0 12px;font-family:var(--mono,monospace)}

/* ── Scorecard strip ── */
.mu-scorecard{padding:18px 0 16px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-sc-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.mu-sc-head h3{font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:rgba(26,23,20,.38);font-weight:500;margin:0;font-family:var(--mono,monospace)}
.mu-sc-summary{font-size:11px;color:rgba(26,23,20,.55)}
.mu-sc-strip{display:grid;grid-template-columns:repeat(10,minmax(0,1fr));gap:6px}
.mu-sig{background:var(--bg);border:1px solid var(--bd);border-top:2.5px solid var(--c);padding:9px 10px 8px}
.mu-sig-name{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.09em;color:rgba(26,23,20,.45);margin-bottom:5px}
.mu-sig-val{display:block;font-size:16px;letter-spacing:-.04em;font-weight:500;color:var(--c);line-height:1}
.mu-sig-sub{display:block;font-size:9px;color:rgba(26,23,20,.45);margin-top:3px;white-space:nowrap;overflow:hidden}

/* ── Cycle + Sectors ── */
.mu-cycle-row{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;padding:24px 0;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-zone-label{font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:rgba(26,23,20,.38);margin:0 0 14px;font-family:var(--mono,monospace)}
.mu-sector-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.mu-sector{border:1px solid var(--bd);background:var(--bg);border-left:2.5px solid var(--c);padding:8px 9px 7px;display:flex;flex-direction:column;gap:2px}
.mu-sector-icon{font-size:13px;line-height:1;color:var(--c);font-style:normal}
.mu-sector-name{font-size:10.5px;font-weight:500;color:#1A1714;line-height:1.2}
.mu-sector-sig{font-size:8.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--c);font-weight:600}
.mu-sector-legend{display:flex;gap:14px;margin-top:8px;font-size:10px;color:rgba(26,23,20,.45)}
.mu-sector-legend span{display:flex;align-items:center;gap:5px}
.mu-sector-legend i{width:7px;height:7px;display:inline-block}

/* ── Action block ── */
.mu-action-row{padding:20px 0 24px;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px}
.mu-action-card{border:1px solid rgba(201,191,173,.55);background:rgba(255,255,255,.28);padding:14px 16px}
.mu-action-card span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.4);margin-bottom:7px;font-family:var(--mono,monospace)}
.mu-action-card b{display:block;font-size:14px;font-weight:500;color:#1A1714;line-height:1.3}
.mu-action-card.mu-action-green{border-color:rgba(42,107,74,.35);background:rgba(42,107,74,.06)}
.mu-action-card.mu-action-green span{color:rgba(42,107,74,.7)}
.mu-action-card.mu-action-green b{color:#2a6b4a}
.mu-action-card.mu-action-red{border-color:rgba(164,80,47,.35);background:rgba(164,80,47,.06)}
.mu-action-card.mu-action-red span{color:rgba(164,80,47,.7)}
.mu-action-card.mu-action-red b{color:#A4502F}

/* ── Tier 2 collapse ── */
.mu-details summary{display:flex;align-items:center;gap:8px;cursor:pointer;padding:14px 0;font-size:11px;color:rgba(26,23,20,.42);letter-spacing:.04em;list-style:none;border-top:1px solid rgba(201,191,173,.35)}
.mu-details summary::-webkit-details-marker{display:none}
.mu-details summary:before{content:'↓';font-size:10px}
details[open].mu-details summary:before{content:'↑'}
.mu-details-body{padding-top:20px}
.mu-detail-group{margin-bottom:24px}
.mu-detail-group h4{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.38);margin:0 0 10px;padding-bottom:8px;border-bottom:1px solid rgba(201,191,173,.35)}
.mu-analog-extra{border:1px solid rgba(201,191,173,.5);padding:12px 14px;background:rgba(255,255,255,.14);margin-bottom:6px}
.mu-ae-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
.mu-ae-head b{display:block;font-size:22px;letter-spacing:-.05em;font-weight:500;line-height:.95}
.mu-ae-head span{display:block;font-size:11px;color:rgba(26,23,20,.55);margin-top:4px}
.mu-ae-head em{font-size:26px;letter-spacing:-.05em;font-weight:500;line-height:.9;font-style:normal}
.mu-analog-extra p{font-size:12px;line-height:1.4;margin:0;color:rgba(26,23,20,.62)}

/* ── Responsive ── */
@media(max-width:1100px){.mu-regime{grid-template-columns:1fr}.mu-regime-meta{flex-direction:row;align-items:center;flex-wrap:wrap}.mu-conf{text-align:left}}
@media(max-width:960px){.mu-charts-row{grid-template-columns:1fr}.mu-chart-block{padding-right:0;border-right:none;border-bottom:1px solid rgba(201,191,173,.38);padding-bottom:20px}.mu-vix-block{padding-left:0;padding-top:20px}.mu-sc-strip{grid-template-columns:repeat(5,1fr)}.mu-cycle-row{grid-template-columns:1fr}.mu-action-row{grid-template-columns:1fr}}
@media(max-width:640px){.mu-sc-strip{grid-template-columns:repeat(3,1fr)}.mu-sector-grid{grid-template-columns:repeat(2,1fr)}}
</style>`;

// ── Scorecard strip HTML ──────────────────────────────────────────────────────

const scStrip = signals.map(s => `<div class="mu-sig mu-${s.color}">
  <span class="mu-sig-name">${esc(s.name)}</span>
  <span class="mu-sig-val">${s.display}</span>
  <span class="mu-sig-sub">${s.label} ${s.trend}</span>
</div>`).join('');

const scSummary = `${greens} green · ${ambers} amber · ${reds} red`;

// ── Action cards ──────────────────────────────────────────────────────────────

const addZoneStr  = Array.isArray(chart.add_zone)  ? chart.add_zone.map(v => v.toLocaleString('en-US',{maximumFractionDigits:0})).join('–') : '—';
const trimZoneStr = Array.isArray(chart.trim_zone) ? chart.trim_zone.map(v => v.toLocaleString('en-US',{maximumFractionDigits:0})).join('–') : '—';
const defStr      = chart.defense_below ? chart.defense_below.toLocaleString('en-US',{maximumFractionDigits:0}) : '—';

// ── Assemble section ──────────────────────────────────────────────────────────

const section = `<section id="macro-unified-section" class="macro-unified">
${style}
<div class="mu-wrap">

  <!-- Regime header -->
  <div class="mu-regime">
    <div>
      <p class="mu-phase-eyebrow">Macro intelligence · Phase ${phaseCode} · ${diagLabel}</p>
      <h2 class="mu-phase-title">${phaseName}</h2>
      <div class="mu-action">
        <span>What to do</span>
        <b>${action}</b>
        <small>${changeRule}</small>
      </div>
    </div>
    <div class="mu-regime-meta">
      <div class="mu-conf">
        <span>Cycle confidence</span>
        <b>${conf}%</b>
        <small>of being in ${phaseName}</small>
      </div>
      <div class="mu-stress-badge">${stressType}</div>
    </div>
  </div>

  <!-- Unified SPX chart: 5-year journey + tactical zones + rate cycle -->
  <div class="mu-unified-chart-block">
    <div class="mu-chart-head">
      <h3>S&amp;P 500 — full journey · add/trim/defense zones · rate cycle</h3>
      <span>The 90-day tactical view is the highlighted right tail of this chart — same frame, full context</span>
    </div>
    ${unifiedChart}
    ${topAnalogLesson ? `<div class="mu-analog-callout">
      <span>2022 Analog (91% match)</span>
      <b>${topAnalogLesson}</b>
    </div>` : ''}
  </div>

  <!-- Cycle analysis: anchored chart + 4-column argument -->
  ${cycleAnalysisHtml}

  <!-- VIX + Indices pulse row -->
  <div class="mu-charts-row">
    <div class="mu-chart-block" style="flex:1">
      <div class="mu-chart-head">
        <h3>VIX — fear gauge (90 days)</h3>
        <span>Calm &lt;15 · Watchful 15–25 · Elevated &gt;25</span>
      </div>
      ${vixChart}
    </div>
    <div class="mu-vix-block" style="flex:1">
      <div class="mu-chart-head">
        <h3>Where is the money? — 90-day performance</h3>
        <span>SPY · QQQ · IWM · BTC</span>
      </div>
      ${indicesPulse}
    </div>
  </div>


  <!-- Scorecard strip -->
  <div class="mu-scorecard">
    <div class="mu-sc-head">
      <h3>Economy scorecard — 10 signals</h3>
      <span class="mu-sc-summary">${scSummary}</span>
    </div>
    <div class="mu-sc-strip">${scStrip}</div>
  </div>

  <!-- Cycle + sector rotation -->
  <div class="mu-cycle-row">
    <div>
      ${cycleSvg}
    </div>
    <div>
      <div class="mu-sector-grid">${sectorGrid}</div>
      <div class="mu-sector-legend">
        <span><i style="background:#2a6b4a"></i>Favor</span>
        <span><i style="background:#8a6a2c"></i>Watch</span>
        <span><i style="background:#A4502F"></i>Reduce</span>
      </div>
    </div>
  </div>

  <!-- Action block -->
  <div class="mu-action-row">
    <div class="mu-action-card mu-action-green">
      <span>Add zone (S&amp;P 500)</span>
      <b>${addZoneStr}</b>
    </div>
    <div class="mu-action-card mu-action-red">
      <span>Trim zone</span>
      <b>${trimZoneStr}</b>
    </div>
    <div class="mu-action-card">
      <span>Defense — exit below</span>
      <b>${defStr} · ${esc(riskRule.split('.')[0])}</b>
    </div>
  </div>

  <!-- Tier 2: Full analysis -->
  <details class="mu-details">
    <summary>Full macro analysis — historical analogs, decision brief, market tape</summary>
    <div class="mu-details-body">
      ${remainingAnalogs ? `<div class="mu-detail-group"><h4>Historical analogs</h4>${remainingAnalogs}</div>` : ''}
      ${cmsHtml ? `<div class="mu-detail-group">${cmsHtml}</div>` : ''}
      ${dbHtml  ? `<div class="mu-detail-group">${dbHtml}</div>`  : ''}
    </div>
  </details>

</div>
</section>`;

// ── Injection ─────────────────────────────────────────────────────────────────

const REMOVE_IDS = ['macro-cycle-panel','decision-brief-section','current-market-state','macro-intelligence-panel','macro-unified-section'];

['macro-unified-style','macro-cycle-panel-style','macro-intelligence-panel-style','current-market-state-style'].forEach(id => {
  html = html.replace(new RegExp(`<style id="${id}">[\\s\\S]*?<\\/style>`, 'g'), '');
});
html = html.replace('</head>', style + '</head>');

function findPos(html, id) {
  let s = 0;
  while (s < html.length) {
    const i = html.indexOf('<section', s);
    if (i < 0) return -1;
    const j = html.indexOf('>', i);
    if (html.slice(i, j+1).includes(`id="${id}"`)) return i;
    s = i + 1;
  }
  return -1;
}

function secEnd(html, start) {
  let s = start + 1, end = html.length;
  while (s < html.length) {
    const ni = html.indexOf('<section', s);
    if (ni < 0) break;
    const nj = html.indexOf('>', ni);
    if (html.slice(ni, nj+1).includes('id=') && ni !== start) { end = ni; break; }
    s = ni + 1;
  }
  const mc = html.lastIndexOf('</main>');
  if (mc > start && mc < end) end = mc;
  return end;
}

const removals = REMOVE_IDS
  .map(id => { const p = findPos(html, id); return p >= 0 ? { start: p, end: secEnd(html, p) } : null; })
  .filter(Boolean)
  .sort((a, b) => b.start - a.start);

for (const { start, end } of removals) html = html.slice(0, start) + html.slice(end);

const insertPos = findPos(html, 'operational-chart-section');
html = insertPos >= 0
  ? html.slice(0, insertPos) + section + html.slice(insertPos)
  : html.slice(0, html.lastIndexOf('</main>')) + section + html.slice(html.lastIndexOf('</main>'));

fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-unified-section"')) throw new Error('injection failed');
console.log(`injected macro section (charts + scorecard + cycle + sectors) into ${path.relative(root, indexPath)}`);
