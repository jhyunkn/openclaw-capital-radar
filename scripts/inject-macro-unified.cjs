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

// ── Multi-layer macro chart (5-year SPX + rate cycle + analog) ────────────────

function loadRateHistory() {
  const p = path.join(root, 'data', 'macro-history.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

function buildMacroLayerChart(spyCandles, rateSeries) {
  const W = 900;
  const H_PRICE = 210;  // price panel
  const H_RATE  = 72;   // rate panel below
  const GAP     = 24;   // gap between panels
  const H_TOTAL = H_PRICE + GAP + H_RATE + 28;
  const pL = 48, pR = 14, pT = 12, pB = 0;
  const cW = W - pL - pR;

  if (spyCandles.length < 100) {
    return `<div class="mu-chart-empty">Insufficient data</div>`;
  }

  const closes = spyCandles.map(c => c.close);
  const dates  = spyCandles.map(c => c.time);
  const n      = closes.length;

  // Price scale
  const allCloses = spyCandles.map(c => c.close);
  const ma50all   = computeMA(allCloses, 50);
  const ma200all  = computeMA(allCloses, 200);
  const ma50  = ma50all.slice(-n);
  const ma200 = ma200all.slice(-n);

  const priceVals = [...closes, ...ma50.filter(Boolean), ...ma200.filter(Boolean)];
  const priceMin  = Math.min(...priceVals) * 0.97;
  const priceMax  = Math.max(...priceVals) * 1.02;
  const priceRange = priceMax - priceMin || 1;

  const px  = i  => pL + (i / (n - 1)) * cW;
  const pyP = v  => pT + H_PRICE - ((v - priceMin) / priceRange) * H_PRICE;

  // Date → x position mapping (for rate data alignment)
  const dateIndex = {};
  dates.forEach((d, i) => { dateIndex[d] = i; });
  function dateToX(dateStr) {
    if (dateIndex[dateStr] !== undefined) return px(dateIndex[dateStr]);
    // Find nearest by scanning
    const t = new Date(dateStr).getTime();
    let best = 0, minD = Infinity;
    dates.forEach((d, i) => {
      const diff = Math.abs(new Date(d).getTime() - t);
      if (diff < minD) { minD = diff; best = i; }
    });
    return px(best);
  }

  // ── Price panel ──

  // Main price line
  const linePts = closes.map((c, i) => `${i===0?'M':'L'}${px(i).toFixed(1)},${pyP(c).toFixed(1)}`).join(' ');
  const areaPts = `${linePts} L${(pL+cW).toFixed(1)},${(pT+H_PRICE).toFixed(1)} L${pL},${(pT+H_PRICE).toFixed(1)}Z`;

  // MA paths
  const maLine = (vals, dash='') => {
    let d = '', on = false;
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) { on = false; continue; }
      d += `${on?'L':'M'}${px(i).toFixed(1)},${pyP(vals[i]).toFixed(1)} `;
      on = true;
    }
    return d.trim();
  };

  // 2022 bear market highlight band (Jan 3 - Oct 12, 2022)
  const bear22Start = dateToX('2022-01-03');
  const bear22End   = dateToX('2022-10-13');
  const bear22W     = bear22End - bear22Start;
  const bear22Band  = `<rect x="${bear22Start.toFixed(1)}" y="${pT}" width="${bear22W.toFixed(1)}" height="${H_PRICE}" fill="rgba(164,80,47,.07)" opacity=".9"/>
  <text x="${(bear22Start + bear22W/2).toFixed(1)}" y="${(pT + 14).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="rgba(164,80,47,.7)" font-family="inherit" font-weight="600">2022 Analog</text>`;

  // Horizontal grid lines (price panel)
  const priceGridVals = [priceMin + priceRange*0.25, priceMin + priceRange*0.5, priceMin + priceRange*0.75];
  const priceGrid = priceGridVals.map(v => {
    const gy = pyP(v);
    const label = v >= 1000 ? (v/1000).toFixed(1)+'k' : Math.round(v).toString();
    return `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}" stroke="rgba(201,191,173,.3)" stroke-width="0.5"/>
  <text x="${(pL-4)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" font-size="8.5" fill="rgba(26,23,20,.35)" font-family="inherit">${label}</text>`;
  }).join('');

  // Year tick marks on X axis
  const yearTicks = [];
  let lastYear = '';
  dates.forEach((d, i) => {
    const yr = d.slice(0, 4);
    if (yr !== lastYear) {
      yearTicks.push(`<line x1="${px(i).toFixed(1)}" y1="${(pT+H_PRICE)}" x2="${px(i).toFixed(1)}" y2="${(pT+H_PRICE+5)}" stroke="rgba(201,191,173,.5)" stroke-width="0.5"/>
  <text x="${px(i).toFixed(1)}" y="${(pT+H_PRICE+15).toFixed(1)}" text-anchor="middle" font-size="9" fill="rgba(26,23,20,.38)" font-family="inherit">${yr}</text>`);
      lastYear = yr;
    }
  });

  // Current price annotation
  const lastX = px(n-1), lastY = pyP(closes[n-1]);
  const p1y = perf(spyCandles, 252); // ~1 year perf
  const p1yStr = p1y != null ? `${p1y>=0?'+':''}${p1y.toFixed(1)}%` : '';
  const perfColor = p1y != null && p1y >= 0 ? '#2a6b4a' : '#A4502F';

  // ── Rate panel ──
  const rateY0 = pT + H_PRICE + GAP;  // top of rate panel
  const rateH  = H_RATE;

  // Rate data from cache
  const dffData = rateSeries?.DFF || [];
  const rateVals = dffData.filter(o => o.date >= dates[0]).map(o => o.value);
  const rateMin  = 0;
  const rateMax  = Math.max(...rateVals, 6) * 1.05;
  const rateRange = rateMax - rateMin || 1;
  const pyR = v => rateY0 + rateH - ((v - rateMin) / rateRange) * rateH;

  // Rate grid lines
  const rateGrids = [2, 4, 5.5].map(v => {
    if (v > rateMax) return '';
    const gy = pyR(v);
    return `<line x1="${pL}" y1="${gy.toFixed(1)}" x2="${(pL+cW)}" y2="${gy.toFixed(1)}" stroke="rgba(201,191,173,.3)" stroke-width="0.5" stroke-dasharray="2 2"/>
  <text x="${(pL-4)}" y="${(gy+3.5).toFixed(1)}" text-anchor="end" font-size="8.5" fill="rgba(26,23,20,.32)" font-family="inherit">${v}%</text>`;
  }).join('');

  // DFF line path
  let dffPath = '';
  if (dffData.length > 0) {
    dffPath = dffData
      .filter(o => o.date >= dates[0] && o.date <= dates[n-1])
      .map((o, i) => `${i===0?'M':'L'}${dateToX(o.date).toFixed(1)},${pyR(o.value).toFixed(1)}`)
      .join(' ');
  }

  // Rate panel label
  const dffCurrent = dffData.length ? dffData[dffData.length-1].value : null;
  const dffStr     = dffCurrent != null ? `${dffCurrent.toFixed(2)}%` : '';

  return `<svg viewBox="0 0 ${W} ${H_TOTAL}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <linearGradient id="macro5yGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(26,23,20,.10)"/>
      <stop offset="100%" stop-color="rgba(26,23,20,.01)"/>
    </linearGradient>
  </defs>

  <!-- 2022 analog band -->
  ${bear22Band}

  <!-- Price panel grid -->
  ${priceGrid}

  <!-- Area fill -->
  <path d="${areaPts}" fill="url(#macro5yGrad)"/>

  <!-- MA200 -->
  <path d="${maLine(ma200)}" fill="none" stroke="rgba(164,80,47,.55)" stroke-width="1" stroke-dasharray="4 2"/>
  <!-- MA50 -->
  <path d="${maLine(ma50)}"  fill="none" stroke="rgba(138,106,44,.55)" stroke-width="1" stroke-dasharray="2 2"/>
  <!-- Price line -->
  <path d="${linePts}" fill="none" stroke="#1A1714" stroke-width="1.8" stroke-linejoin="round"/>

  <!-- Current price dot + label -->
  <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3.5" fill="#1A1714"/>
  <text x="${(pL+cW)}" y="${(pT-2).toFixed(1)}" text-anchor="end" font-size="10" fill="rgba(26,23,20,.42)" font-family="inherit">${p1yStr ? `1Y ${p1yStr}` : ''}</text>

  <!-- Year ticks -->
  ${yearTicks.join('')}

  <!-- MA legend -->
  <line x1="${pL}" y1="${(pT+H_PRICE+18)}" x2="${pL+16}" y2="${(pT+H_PRICE+18)}" stroke="rgba(138,106,44,.65)" stroke-width="1" stroke-dasharray="2 2"/>
  <text x="${pL+19}" y="${(pT+H_PRICE+22)}" font-size="8.5" fill="rgba(138,106,44,.8)" font-family="inherit">MA50</text>
  <line x1="${pL+48}" y1="${(pT+H_PRICE+18)}" x2="${pL+64}" y2="${(pT+H_PRICE+18)}" stroke="rgba(164,80,47,.65)" stroke-width="1" stroke-dasharray="4 2"/>
  <text x="${pL+67}" y="${(pT+H_PRICE+22)}" font-size="8.5" fill="rgba(164,80,47,.8)" font-family="inherit">MA200</text>

  <!-- Rate panel separator + label -->
  <line x1="${pL}" y1="${(rateY0-6)}" x2="${(pL+cW)}" y2="${(rateY0-6)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>
  <text x="${pL}" y="${(rateY0-10)}" font-size="8.5" fill="rgba(26,23,20,.38)" letter-spacing=".1em" font-family="inherit">FED FUNDS RATE</text>
  <text x="${(pL+cW)}" y="${(rateY0-10)}" text-anchor="end" font-size="9" fill="rgba(138,106,44,.75)" font-weight="600" font-family="inherit">${esc(dffStr)} now</text>

  <!-- Rate panel grid -->
  ${rateGrids}

  <!-- Rate panel baseline -->
  <line x1="${pL}" y1="${(rateY0+rateH)}" x2="${(pL+cW)}" y2="${(rateY0+rateH)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>

  <!-- DFF line -->
  ${dffPath ? `<path d="${dffPath}" fill="none" stroke="#8a6a2c" stroke-width="1.8" stroke-linejoin="round"/>` : ''}

  <!-- Rate current dot -->
  ${dffPath ? `<circle cx="${dateToX(dffData.filter(o=>o.date>=dates[0]&&o.date<=dates[n-1]).slice(-1)[0]?.date||dates[n-1]).toFixed(1)}" cy="${pyR(dffCurrent||0).toFixed(1)}" r="3" fill="#8a6a2c"/>` : ''}
</svg>`;
}

function buildAnalogChart(spyCandles) {
  // Compares 2022 full-year (normalized to 100) vs current 12 months (normalized to 100)
  const W = 900, H = 160;
  const pL = 12, pR = 12, pT = 28, pB = 24;
  const cW = W - pL - pR;
  const cH = H - pT - pB;

  // Extract 2022 annual window
  const analog22 = spyCandles
    .filter(c => c.time >= '2022-01-03' && c.time <= '2022-12-31')
    .map(c => c.close);

  // Extract current 12-month window (last 252 trading days)
  const currentWin = spyCandles.slice(-252).map(c => c.close);
  const currentDates = spyCandles.slice(-252).map(c => c.time);

  if (analog22.length < 20 || currentWin.length < 20) return '';

  // Normalize both to 100 at start
  const norm = (arr) => arr.map(v => (v / arr[0]) * 100);
  const n22  = norm(analog22);
  const nCur = norm(currentWin);

  // Use the same x scale (by index, equalized)
  const maxLen = Math.max(n22.length, nCur.length);
  const px22  = i => pL + (i / (n22.length  - 1)) * cW;
  const pxCur = i => pL + (i / (nCur.length - 1)) * cW;

  // Combined range
  const allVals = [...n22, ...nCur];
  const minV = Math.min(...allVals) * 0.99;
  const maxV = Math.max(...allVals) * 1.01;
  const range = maxV - minV || 1;
  const py = v => pT + cH - ((v - minV) / range) * cH;

  // Paths
  const path22  = n22.map( (v,i) => `${i===0?'M':'L'}${px22(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const pathCur = nCur.map((v,i) => `${i===0?'M':'L'}${pxCur(i).toFixed(1)},${py(v).toFixed(1)}`).join(' ');
  const areaCur = `${pathCur} L${(pL+cW).toFixed(1)},${(pT+cH).toFixed(1)} L${pL},${(pT+cH).toFixed(1)}Z`;

  // End labels
  const end22  = n22[n22.length-1];
  const endCur = nCur[nCur.length-1];
  const diff22 = end22  - 100;
  const diffCur = endCur - 100;
  const col22  = diff22  >= 0 ? '#2a6b4a' : '#A4502F';
  const colCur = diffCur >= 0 ? '#2a6b4a' : '#A4502F';

  // 100 baseline
  const y100 = py(100);
  const startDate  = currentDates[0] ? currentDates[0].slice(0,7) : '';
  const endDate    = currentDates[currentDates.length-1] ? currentDates[currentDates.length-1].slice(0,7) : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <!-- Baseline at 100 -->
  <line x1="${pL}" y1="${y100.toFixed(1)}" x2="${(pL+cW)}" y2="${y100.toFixed(1)}" stroke="rgba(201,191,173,.6)" stroke-width="0.5" stroke-dasharray="3 2"/>
  <text x="${(pL-4)}" y="${(y100+3.5).toFixed(1)}" text-anchor="end" font-size="8" fill="rgba(26,23,20,.35)" font-family="inherit">100</text>

  <!-- Current period area fill -->
  <path d="${areaCur}" fill="rgba(26,23,20,.06)"/>

  <!-- 2022 analog line (amber/rust) -->
  <path d="${path22}" fill="none" stroke="rgba(164,80,47,.65)" stroke-width="1.5" stroke-dasharray="5 3" stroke-linejoin="round"/>

  <!-- Current period line (dark) -->
  <path d="${pathCur}" fill="none" stroke="#1A1714" stroke-width="2" stroke-linejoin="round"/>

  <!-- End value labels -->
  <text x="${(pL+cW+4)}" y="${(py(end22)+4).toFixed(1)}" font-size="9.5" fill="rgba(164,80,47,.8)" font-weight="600" font-family="inherit">${diff22>=0?'+':''}${diff22.toFixed(1)}%</text>
  <text x="${(pL+cW+4)}" y="${(py(endCur)+4).toFixed(1)}" font-size="9.5" fill="#1A1714" font-weight="600" font-family="inherit">${diffCur>=0?'+':''}${diffCur.toFixed(1)}%</text>

  <!-- Legend -->
  <line x1="${pL}" y1="15" x2="${pL+20}" y2="15" stroke="rgba(164,80,47,.7)" stroke-width="1.5" stroke-dasharray="5 3"/>
  <text x="${pL+24}" y="19" font-size="9.5" fill="rgba(164,80,47,.85)" font-family="inherit">2022 — Inflation shock / rate repricing (91% analog)</text>
  <line x1="${pL+290}" y1="15" x2="${pL+310}" y2="15" stroke="#1A1714" stroke-width="2"/>
  <text x="${pL+314}" y="19" font-size="9.5" fill="#1A1714" font-weight="500" font-family="inherit">Current — ${startDate} → ${endDate}</text>

  <!-- Quarterly x-axis labels -->
  <text x="${pL}" y="${(H-6)}" font-size="8.5" fill="rgba(26,23,20,.35)" font-family="inherit">Start (=100)</text>
  <text x="${pL + cW*0.25}" y="${(H-6)}" text-anchor="middle" font-size="8.5" fill="rgba(26,23,20,.3)" font-family="inherit">Q2</text>
  <text x="${pL + cW*0.5}"  y="${(H-6)}" text-anchor="middle" font-size="8.5" fill="rgba(26,23,20,.3)" font-family="inherit">Q3</text>
  <text x="${pL + cW*0.75}" y="${(H-6)}" text-anchor="middle" font-size="8.5" fill="rgba(26,23,20,.3)" font-family="inherit">Q4</text>
  <text x="${pL + cW}"      y="${(H-6)}" text-anchor="end"    font-size="8.5" fill="rgba(26,23,20,.35)" font-family="inherit">12M</text>
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

// 5-year multi-layer chart (SPX + rate cycle)
const rateHistory   = loadRateHistory();
const rateSeries    = rateHistory?.series || null;
const macroChart    = buildMacroLayerChart(spyCandles, rateSeries);
const analogChart   = buildAnalogChart(spyCandles);

// 90-day tactical charts (keep for zoomed-in view)
const spxChart = buildPriceChart('SPY', {
  W: 620, H: 170, days: 90,
  showMA50: true, showMA200: true,
  addZone:    chart.add_zone,
  trimZone:   chart.trim_zone,
  defenseLevel: chart.defense_below,
  spxRatio: spxToSpy,
});

const vixChart = buildVixChart(90);
const indicesPulse = buildIndicesPulse();

// ── Cycle SVG ─────────────────────────────────────────────────────────────────

const phases = Array.isArray(egg.phases) ? egg.phases : [];
const currentCode  = egg.phase_code || 'C';
const previousCode = (phases.find(p => p.state === 'previous') || {}).code || 'B';

const PHASE_POS = [
  { code: 'A1', x: 38,  y: 148, side: 'below', note: 'Panic · Bonds · Gold' },
  { code: 'A2', x: 112, y: 108, side: 'below', note: 'Policy pivot · Prepare' },
  { code: 'B',  x: 222, y: 50,  side: 'above', note: 'Tech · Discretionary' },
  { code: 'C',  x: 348, y: 35,  side: 'above', note: 'Quality · Healthcare' },
  { code: 'D',  x: 460, y: 52,  side: 'above', note: 'Cyclicals · Energy' },
  { code: 'E',  x: 558, y: 98,  side: 'below', note: 'Trim beta · Raise cash' },
  { code: 'F',  x: 636, y: 142, side: 'below', note: 'Defensives · Bonds' },
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
  m += `<text x="${pp.x}" y="${labelY}" text-anchor="middle" font-size="${isCurrent?10.5:9}" font-weight="${isCurrent?'600':'500'}" fill="${isCurrent?'#A4502F':'rgba(26,23,20,.55)'}" font-family="inherit">${label}</text>`;
  if (isCurrent) {
    m += `<text x="${pp.x}" y="${noteY}" text-anchor="middle" font-size="8.5" fill="rgba(164,80,47,.75)" font-family="inherit">${esc(pp.note)}</text>`;
    m += `<text x="${pp.x}" y="${pp.y - r - 42}" text-anchor="middle" font-size="8" font-weight="700" fill="#A4502F" letter-spacing=".1em" font-family="inherit">YOU ARE HERE</text>`;
  }
  return m;
}).join('');

const cycleSvg = `<svg viewBox="0 0 700 198" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <defs>
    <marker id="cyArr" markerWidth="7" markerHeight="7" refX="5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5Z" fill="rgba(164,80,47,.5)"/>
    </marker>
  </defs>
  <!-- Full cycle base path -->
  <path d="M18,155 C52,155 72,115 112,108 S174,50 222,50 S310,35 348,35 S428,52 460,52 S530,98 558,98 S618,142 652,148 L690,155"
        fill="none" stroke="rgba(201,191,173,.45)" stroke-width="2"/>
  <!-- Traveled path: B → C (where we've been) -->
  <path d="M222,50 S310,35 348,35"
        fill="none" stroke="rgba(164,80,47,.7)" stroke-width="2.5"/>
  <!-- Next path: C → D (dotted, what's coming) -->
  <path d="M348,35 S428,52 460,52"
        fill="none" stroke="rgba(164,80,47,.3)" stroke-width="1.5" stroke-dasharray="5 3"/>
  <!-- Axis labels -->
  <text x="350" y="192" text-anchor="middle" font-size="8.5" fill="rgba(26,23,20,.35)" letter-spacing=".1em" font-family="inherit">ECONOMIC CYCLE · KOSTOLANY FRAMEWORK</text>
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

/* ── Big-picture chart blocks ── */
.mu-macro-chart-block{padding:24px 0 20px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-analog-chart-block{padding:20px 0;border-bottom:1px solid rgba(201,191,173,.45)}
/* ── Charts row ── */
.mu-charts-row{display:grid;grid-template-columns:1fr 320px;gap:0;border-bottom:1px solid rgba(201,191,173,.45);padding:24px 0 20px}
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
      <p class="mu-narrative">${esc(narrative) || esc(brief.brief || '')}</p>
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

  <!-- Big picture: 5-year SPX + rate cycle -->
  <div class="mu-macro-chart-block">
    <div class="mu-chart-head">
      <h3>S&amp;P 500 — 5-year journey · rate cycle overlay</h3>
      <span>MA50 · MA200 · Fed Funds Rate · 2022 analog highlighted</span>
    </div>
    ${macroChart}
  </div>

  <!-- Analog comparison: 2022 vs current -->
  ${analogChart ? `<div class="mu-analog-chart-block">
    <div class="mu-chart-head">
      <h3>Historical analog comparison — 2022 vs current (both indexed to 100 at start)</h3>
      <span>How the current 12-month pattern compares to the 2022 inflation shock analog</span>
    </div>
    ${analogChart}
  </div>` : ''}

  <!-- Tactical view: 90-day + VIX -->
  <div class="mu-charts-row">
    <div class="mu-chart-block">
      <div class="mu-chart-head">
        <h3>S&amp;P 500 — 90-day tactical view</h3>
        <span>Add ${addZoneStr} · Defense ${defStr}</span>
      </div>
      ${spxChart}
    </div>
    <div class="mu-vix-block">
      <div class="mu-chart-head">
        <h3>VIX — fear gauge</h3>
        <span>Calm &lt;15 · Watch 15–25</span>
      </div>
      ${vixChart}
    </div>
  </div>

  <!-- Indices pulse -->
  <div class="mu-pulse-section">
    <p class="mu-pulse-head">Where is the money? — 90-day relative performance</p>
    ${indicesPulse}
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
      <p class="mu-zone-label">Where are we in the cycle?</p>
      ${cycleSvg}
    </div>
    <div>
      <p class="mu-zone-label">What to own — Phase ${phaseCode} rotation</p>
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
