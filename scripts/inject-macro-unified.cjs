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
const liveState   = read('data/report-state.live.json', {});
const allHoldings = Array.isArray(liveState.holdings) ? liveState.holdings : [];

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

  <!-- Rate panel separator -->
  <line x1="${pL}" y1="${(rY0-7)}" x2="${(pL+cW)}" y2="${(rY0-7)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>
  <!-- FED FUNDS RATE label moved inside rate panel to avoid year-label collision -->
  <text x="${pL}" y="${(rY0+12)}" font-size="8" fill="rgba(26,23,20,.28)" letter-spacing=".12em" font-family="inherit">FED FUNDS RATE (DFF)</text>
  ${dffNow != null ? `<text x="${(pL+cW)}" y="${(rY0+12)}" text-anchor="end" font-size="9" fill="rgba(138,106,44,.8)" font-weight="600" font-family="inherit">${dffNow.toFixed(2)}% now</text>` : ''}

  <!-- Rate panel -->
  ${rateGrid}
  <line x1="${pL}" y1="${(rY0+rH)}" x2="${(pL+cW)}" y2="${(rY0+rH)}" stroke="rgba(201,191,173,.4)" stroke-width="0.5"/>
  ${dffAreaPath ? `<path d="${dffAreaPath}" fill="url(#rateGrad)"/>` : ''}
  ${dffPath ? `<path d="${dffPath}" fill="none" stroke="#8a6a2c" stroke-width="1.8" stroke-linejoin="round"/>` : ''}
  ${dffNow != null && dffNowX != null ? `<circle cx="${dffNowX.toFixed(1)}" cy="${pyR(dffNow).toFixed(1)}" r="3" fill="#8a6a2c"/>` : ''}
</svg>
<div class="mu-chart-legend">
  <span class="mu-cl-ma50"><svg width="18" height="8" viewBox="0 0 18 8" style="vertical-align:middle;margin-right:4px"><line x1="0" y1="4" x2="18" y2="4" stroke="rgba(138,106,44,.65)" stroke-width="1.2" stroke-dasharray="2 2"/></svg>MA50</span>
  <span class="mu-cl-ma200"><svg width="18" height="8" viewBox="0 0 18 8" style="vertical-align:middle;margin-right:4px"><line x1="0" y1="4" x2="18" y2="4" stroke="rgba(164,80,47,.65)" stroke-width="1.2" stroke-dasharray="5 2"/></svg>MA200</span>
  <span class="mu-cl-add"><svg width="12" height="8" viewBox="0 0 12 8" style="vertical-align:middle;margin-right:4px"><rect x="0" y="0" width="12" height="8" fill="rgba(42,107,74,.28)"/></svg>Add zone</span>
  <span class="mu-cl-trim"><svg width="12" height="8" viewBox="0 0 12 8" style="vertical-align:middle;margin-right:4px"><rect x="0" y="0" width="12" height="8" fill="rgba(164,80,47,.22)"/></svg>Trim zone</span>
</div>`;
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

// ── Bear leg comparison: 2022 bear vs 2025 correction, normalized from peak ───

function buildBearComparisonChart(spyCandles) {
  const peak2022Date = '2022-01-03';
  const peak2025Date = '2025-02-19';

  const i2022 = spyCandles.findIndex(c => c.time >= peak2022Date);
  const i2025 = spyCandles.findIndex(c => c.time >= peak2025Date);
  if (i2022 < 0 || i2025 < 0) return '';

  const base2022 = spyCandles[i2022].close;
  const base2025 = spyCandles[i2025].close;

  const leg2022 = [];
  for (let k = i2022; k < spyCandles.length && (k - i2022) <= 345; k++) {
    leg2022.push({ day: k - i2022, ratio: spyCandles[k].close / base2022 });
  }
  const leg2025 = [];
  for (let k = i2025; k < spyCandles.length; k++) {
    leg2025.push({ day: k - i2025, ratio: spyCandles[k].close / base2025 });
  }
  if (leg2022.length < 10 || leg2025.length < 10) return '';

  // Geometry
  const W = 900, H = 236;
  const pL = 54, pR = 22, pT = 16, pB = 36;
  const cW = W - pL - pR, cH = H - pT - pB;
  const maxDays = 345;
  const minR = 0.67, maxR = 1.32;

  const px = d => pL + (d / maxDays) * cW;
  const py = r => pT + cH - ((r - minR) / (maxR - minR)) * cH;

  // Horizontal grid
  const gridVals = [0.70, 0.80, 0.90, 1.00, 1.10, 1.20, 1.30];
  const gridLines = gridVals.map(v => {
    const gy = py(v).toFixed(1);
    const pct = Math.round((v - 1) * 100);
    const lbl = pct === 0 ? '0%' : (pct > 0 ? `+${pct}%` : `${pct}%`);
    const isZero = v === 1.00;
    return `<line x1="${pL}" y1="${gy}" x2="${pL + cW}" y2="${gy}" stroke="${isZero ? 'rgba(26,23,20,.28)' : 'rgba(201,191,173,.32)'}" stroke-width="${isZero ? '0.8' : '0.5'}"${isZero ? '' : ' stroke-dasharray="3 2"'}/>
  <text x="${(pL - 5)}" y="${(py(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(26,23,20,${isZero ? '.48' : '.28'})" font-family="inherit">${lbl}</text>`;
  }).join('\n  ');

  // Day ticks (X-axis)
  const dayTicks = [0, 50, 100, 150, 200, 250, 300, 345].map(d => {
    const x = px(d).toFixed(1);
    return `<line x1="${x}" y1="${(pT + cH).toFixed(1)}" x2="${x}" y2="${(pT + cH + 4).toFixed(1)}" stroke="rgba(201,191,173,.45)" stroke-width="0.5"/>
  <text x="${x}" y="${(pT + cH + 15).toFixed(1)}" text-anchor="middle" font-size="9" fill="rgba(26,23,20,.3)" font-family="inherit">${d}</text>`;
  }).join('\n  ');

  // Paths
  const path2022 = leg2022.filter((_, i) => i % 2 === 0)
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.day).toFixed(1)},${py(p.ratio).toFixed(1)}`).join(' ');
  const path2025 = leg2025
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.day).toFixed(1)},${py(p.ratio).toFixed(1)}`).join(' ');
  const area2025 = leg2025
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${px(p.day).toFixed(1)},${py(p.ratio).toFixed(1)}`).join(' ') +
    ` L${px(leg2025[leg2025.length - 1].day).toFixed(1)},${(pT + cH).toFixed(1)} L${pL},${(pT + cH).toFixed(1)} Z`;

  // Key events
  const trough2022 = leg2022.reduce((m, p) => p.ratio < m.ratio ? p : m, leg2022[0]);
  const trough2025 = leg2025.reduce((m, p) => p.ratio < m.ratio ? p : m, leg2025[0]);
  const recover2025 = leg2025.find(p => p.day > trough2025.day && p.ratio >= 1.00);
  const now2025 = leg2025[leg2025.length - 1];

  const t22x = px(trough2022.day).toFixed(1), t22y = py(trough2022.ratio).toFixed(1);
  const t25x = px(trough2025.day).toFixed(1), t25y = py(trough2025.ratio).toFixed(1);
  const nowX = px(now2025.day).toFixed(1), nowY = py(now2025.ratio).toFixed(1);
  const t22pct = Math.round((trough2022.ratio - 1) * 100);
  const t25pct = Math.round((trough2025.ratio - 1) * 100);
  const nowPct = Math.round((now2025.ratio - 1) * 100);

  const recoverMark = recover2025 ? (() => {
    const rx = px(recover2025.day).toFixed(1);
    const ry = py(1.0).toFixed(1);
    return `<circle cx="${rx}" cy="${ry}" r="3" fill="#2a6b4a" opacity=".85"/>
  <text x="${(+rx + 5).toFixed(1)}" y="${(+ry - 5).toFixed(1)}" font-size="8.5" fill="#2a6b4a" font-family="inherit">breakeven · day ${recover2025.day}</text>`;
  })() : '';

  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  <defs>
    <linearGradient id="bear25Grad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(26,23,20,.06)"/>
      <stop offset="100%" stop-color="rgba(26,23,20,.01)"/>
    </linearGradient>
    <clipPath id="bearClip"><rect x="${pL}" y="${pT}" width="${cW}" height="${cH}"/></clipPath>
  </defs>
  ${gridLines}
  ${dayTicks}
  <path d="${area2025}" fill="url(#bear25Grad)" clip-path="url(#bearClip)"/>
  <path d="${path2022}" fill="none" stroke="rgba(164,80,47,.62)" stroke-width="2" stroke-linejoin="round" clip-path="url(#bearClip)"/>
  <path d="${path2025}" fill="none" stroke="rgba(26,23,20,.88)" stroke-width="2.2" stroke-linejoin="round" clip-path="url(#bearClip)"/>
  <!-- 2022 trough marker -->
  <circle cx="${t22x}" cy="${t22y}" r="3.5" fill="rgba(164,80,47,.7)"/>
  <text x="${(+t22x).toFixed(1)}" y="${(+t22y + 14).toFixed(1)}" text-anchor="middle" font-size="8.5" fill="rgba(164,80,47,.85)" font-family="inherit">${t22pct}%</text>
  <text x="${(+t22x).toFixed(1)}" y="${(+t22y + 24).toFixed(1)}" text-anchor="middle" font-size="8" fill="rgba(26,23,20,.32)" font-family="inherit">day ${trough2022.day}</text>
  <!-- 2025 trough marker -->
  <circle cx="${t25x}" cy="${t25y}" r="3.5" fill="rgba(26,23,20,.75)"/>
  <text x="${(+t25x + 7).toFixed(1)}" y="${(+t25y + 4).toFixed(1)}" font-size="8.5" fill="rgba(26,23,20,.72)" font-family="inherit">${t25pct}%</text>
  <text x="${(+t25x + 7).toFixed(1)}" y="${(+t25y + 14).toFixed(1)}" font-size="8" fill="rgba(26,23,20,.35)" font-family="inherit">day ${trough2025.day}</text>
  <!-- 2025 breakeven crossing -->
  ${recoverMark}
  <!-- NOW -->
  <circle cx="${nowX}" cy="${nowY}" r="4.5" fill="#2a6b4a"/>
  <text x="${(+nowX + 8).toFixed(1)}" y="${(+nowY + 1).toFixed(1)}" font-size="9" font-weight="700" fill="rgba(26,23,20,.82)" font-family="inherit">NOW</text>
  <text x="${(+nowX + 8).toFixed(1)}" y="${(+nowY + 12).toFixed(1)}" font-size="8.5" fill="#2a6b4a" font-family="inherit">${nowPct >= 0 ? '+' : ''}${nowPct}%</text>
  <!-- Legend -->
  <line x1="${pL}" y1="${H - 12}" x2="${pL + 18}" y2="${H - 12}" stroke="rgba(26,23,20,.82)" stroke-width="2.2"/>
  <text x="${pL + 22}" y="${H - 8}" font-size="9" fill="rgba(26,23,20,.52)" font-family="inherit">2025 correction</text>
  <line x1="${pL + 128}" y1="${H - 12}" x2="${pL + 146}" y2="${H - 12}" stroke="rgba(164,80,47,.62)" stroke-width="2"/>
  <text x="${pL + 150}" y="${H - 8}" font-size="9" fill="rgba(26,23,20,.52)" font-family="inherit">2022 bear</text>
  <text x="${pL + cW}" y="${H - 8}" text-anchor="end" font-size="9" fill="rgba(26,23,20,.28)" font-family="inherit">Trading days since peak</text>
</svg>`;
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
    color   = n > 70 ? 'red' : n >= 55 ? 'green' : n >= 40 ? 'amber' : 'red';
    label   = n > 70 ? 'Overbought' : n >= 55 ? 'Healthy' : n >= 40 ? 'Neutral' : 'Weakened';
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

const activeRateSeries  = (rateSeries && Object.keys(rateSeries).length) ? rateSeries : cacheRates;
const unifiedChart      = buildUnifiedChart(spyCandles, activeRateSeries, chart, spxToSpy, topAnalogLesson);
const bearComparisonChart = buildBearComparisonChart(spyCandles);
const dffSeries         = Array.isArray(activeRateSeries?.DFF) ? activeRateSeries.DFF : [];
const currentFedRate    = dffSeries.length > 0 ? num(dffSeries[dffSeries.length - 1].value) : null;

// ── Daily briefing data ───────────────────────────────────────────────────────

const spyPrevClose  = spyCandles.length >= 2 ? num(spyCandles[spyCandles.length - 2].close) : null;
const spyChangePct  = spyCurrent && spyPrevClose ? (spyCurrent - spyPrevClose) / spyPrevClose * 100 : null;
const vixCandles90  = loadCandles('_VIX', 90);
const vixPrevClose  = vixCandles90.length >= 2 ? num(vixCandles90[vixCandles90.length - 2].close) : null;
const vixCurRaw     = num(mvMap.vix?.value);
const vixChangePct  = vixCurRaw && vixPrevClose ? (vixCurRaw - vixPrevClose) / vixPrevClose * 100 : null;

// Worst and best holdings today
const holdingMoves = allHoldings
  .filter(h => h.dayChangePct != null)
  .sort((a, b) => (a.dayChangePct ?? 0) - (b.dayChangePct ?? 0));
const worstHolding = holdingMoves[0] || null;
const bestHolding  = holdingMoves[holdingMoves.length - 1] || null;

function buildDailyBriefing() {
  const spx      = num(mvMap.spx?.value);
  const vix      = vixCurRaw;
  const rsi      = num(mvMap.rsi14?.value);
  const credit   = num(mvMap.hy_oas?.value);
  const ma50v    = num(chart.ma50);
  const ma200v   = num(chart.ma200);
  const addLow   = Array.isArray(chart.add_zone) ? num(chart.add_zone[0]) : null;
  const defense  = num(chart.defense_below);
  const dayChg   = spyChangePct;

  // Session classification
  const isSharp    = dayChg !== null && dayChg <= -3;
  const isStress   = dayChg !== null && dayChg <= -1.5 && dayChg > -3;
  const isWeak     = dayChg !== null && dayChg <= -0.5 && dayChg > -1.5;
  const isStrong   = dayChg !== null && dayChg >= 2;
  const isRecovery = dayChg !== null && dayChg >= 0.8 && dayChg < 2;
  const isFlat     = dayChg !== null && Math.abs(dayChg) < 0.5;

  const sessionLabel = isSharp ? 'Sharp Selloff' : isStress ? 'Stress Session' : isWeak ? 'Soft Pullback' : isStrong ? 'Strong Advance' : isRecovery ? 'Recovery' : isFlat ? 'Consolidation' : 'Mixed';
  const sessionClass = (isSharp || isStress) ? 'stress' : (isStrong || isRecovery) ? 'advance' : 'neutral';

  // Technical flags
  const aboveMa50    = spx && ma50v  && spx > ma50v;
  const aboveMa200   = spx && ma200v && spx > ma200v;
  const nearAdd      = spx && addLow && spx < addLow * 1.04;
  const nearDefense  = spx && defense && spx < defense * 1.06;
  const vixWatchful  = vix !== null && vix >= 15 && vix < 20;
  const vixElevated  = vix !== null && vix >= 20 && vix < 28;
  const vixCrisis    = vix !== null && vix >= 28;
  const rsiHealthy   = rsi !== null && rsi >= 55;
  const rsiNeutral   = rsi !== null && rsi >= 40 && rsi < 55;
  const creditContained = credit !== null && credit < 3.0;
  const creditWarning   = credit !== null && credit >= 3.5;

  // Build context analysis
  const context = [];
  const strategy = [];

  if (phaseCode === 'C') {
    // Interpret today's session in Phase C context
    if (isSharp || isStress) {
      if (aboveMa50 && creditContained) {
        context.push(`A Phase C stress event, not a phase break. SPX holds above the 50D MA (${ma50v?.toLocaleString('en-US',{maximumFractionDigits:0})}) and credit spreads (HY OAS ${credit}) remain contained — the two conditions that separate a correction from a deterioration. Phase C routinely tests conviction through exactly this kind of session.`);
      } else if (!aboveMa50) {
        context.push(`SPX has broken below the 50D MA (${ma50v?.toLocaleString('en-US',{maximumFractionDigits:0})}) — a technical deterioration requiring heightened attention. ${aboveMa200 ? `The 200D MA (${ma200v?.toLocaleString('en-US',{maximumFractionDigits:0})}) remains intact as the last major floor.` : 'Both key moving averages are now broken — posture shifts to defense.'}`);
      }
      if (vixElevated || vixCrisis) {
        context.push(`VIX at ${vix?.toFixed(1)} has crossed into elevated territory. Phase C can absorb watchful VIX (15–20) as normal; sustained readings above 25 would require a defensive posture review and potential stops on Phase-exposed positions.`);
      }
      if (!rsiHealthy) {
        context.push(`RSI has fallen to ${rsi?.toFixed(1)}${rsiNeutral ? ', now in neutral territory' : ' — weakened significantly'}. The RSI gate to Phase D (needs >55) is now closed. All five transition gates are blocked, confirming the market is in Phase C verification and not approaching Phase D expansion.`);
      }
    } else if (isStrong || isRecovery) {
      context.push(`A Phase C recovery session. Quality and core names leading a bounce is characteristic of Phase C behavior — this is not Phase D yet, but it confirms the downtrend is not persistent. The framework says do not chase; use strength to audit positioning.`);
      if (!vixElevated && vix !== null && vix < 17) {
        context.push(`VIX pulling back toward 15 improves the mood signal. Sustained calm below 15 would open the VIX gate — one of five conditions for Phase D confirmation.`);
      }
    } else if (isFlat) {
      context.push(`Consolidation. No regime change signal — the market is absorbing recent volatility. Phase C allows for this kind of sideways action while macro conditions remain unresolved. The longer-term framework remains Phase C at ${conf}% confidence.`);
    }

    // Portfolio-specific context
    if (worstHolding && num(worstHolding.dayChangePct) < -5) {
      const isExposed = worstHolding.analysisChart?.profile === 'tactical_risk';
      context.push(`${worstHolding.ticker} (${(num(worstHolding.dayChangePct) >= 0 ? '+' : '') + num(worstHolding.dayChangePct).toFixed(1)}%) leads portfolio damage${isExposed ? ' — as a Phase-exposed leveraged instrument, this is expected behavior in Phase C stress' : ''}.`);
    }

    // Strategy
    if (nearDefense) {
      strategy.push(`Price approaching the defense level (${defense?.toLocaleString('en-US',{maximumFractionDigits:0})}). Prepare for potential posture shift: review stop levels and reduce Phase-exposed instruments (TSLT, CONL) if this level is breached.`);
    } else if (nearAdd && (isStress || isSharp)) {
      strategy.push(`Price entering the prepared add zone (${addLow?.toLocaleString('en-US',{maximumFractionDigits:0})}+). Phase C protocol: small adds in quality names only — confirmed by credit and VIX stability. Do not add Phase-exposed instruments here.`);
    } else if (isSharp || isStress) {
      strategy.push(`Phase C protocol: hold core, no broad adds during volatility. Let the stress run — this is when Phase C builds its base for the eventual Phase D move. Watch ${addLow?.toLocaleString('en-US',{maximumFractionDigits:0})} as the prepared entry level; defense at ${defense?.toLocaleString('en-US',{maximumFractionDigits:0})}.`);
      if (creditWarning) {
        strategy.push(`⚠ HY OAS at ${credit} is approaching the 3.5% Phase C→F warning level. Monitor closely — a close above 3.5% would shift the risk posture toward defense.`);
      }
    } else if (isStrong || isRecovery) {
      strategy.push(`Do not chase the rally. Phase C advances can be sharp but typically retrace before Phase D confirms. Adds remain valid only on pullbacks to ${addLow?.toLocaleString('en-US',{maximumFractionDigits:0})}–${(addLow ? Math.round(addLow * 1.03) : 0)?.toLocaleString('en-US',{maximumFractionDigits:0})}, not on breakouts.`);
    } else {
      const distToAdd = addLow && spx ? ((spx - addLow) / spx * 100).toFixed(1) : null;
      const gapNote = distToAdd !== null ? ` SPX is ${distToAdd}% above the add zone (${addLow?.toLocaleString('en-US',{maximumFractionDigits:0})}–${(addLow ? Math.round(addLow * 1.03) : 0)?.toLocaleString('en-US',{maximumFractionDigits:0})}) — if the pullback continues, that is the prepared entry level, not a reason to act now.` : '';
      strategy.push(`Watching, not acting.${gapNote} Triggers: add zone ${addLow?.toLocaleString('en-US',{maximumFractionDigits:0})}–${(addLow ? Math.round(addLow * 1.03) : 0)?.toLocaleString('en-US',{maximumFractionDigits:0})} · defense ${defense?.toLocaleString('en-US',{maximumFractionDigits:0})} · VIX 20 posture review · HY OAS 3.5% phase warning. No triggers hit — no action.`);
    }
  }

  // Format numbers for display strip
  const fmtChg = (v, unit = '%') => v != null ? `${v >= 0 ? '+' : ''}${v.toFixed(1)}${unit}` : '—';
  const fmtVal = (v, decimals = 0) => v != null ? v.toLocaleString('en-US', {maximumFractionDigits: decimals}) : '—';
  const chgColor = v => v == null ? 'rgba(26,23,20,.5)' : v >= 0 ? '#2a6b4a' : '#A4502F';

  // Date
  const asOf = brief.as_of || new Date().toISOString();
  const dateDisplay = new Date(asOf).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const stripItems = [
    { label: 'SPX', val: fmtVal(spx), sub: fmtChg(dayChg), subCol: chgColor(dayChg) },
    { label: 'VIX', val: fmtVal(vix, 1), sub: fmtChg(vixChangePct), subCol: chgColor(vixChangePct ? -vixChangePct : null) },
    { label: 'RSI 14', val: fmtVal(rsi, 1), sub: rsiHealthy ? 'Healthy' : rsiNeutral ? 'Neutral' : 'Weakened', subCol: rsiHealthy ? '#2a6b4a' : rsiNeutral ? '#8a6a2c' : '#A4502F' },
    { label: 'HY OAS', val: fmtVal(credit, 2), sub: creditContained ? 'Contained' : creditWarning ? '⚠ Warning' : 'Widening', subCol: creditContained ? '#2a6b4a' : '#A4502F' },
    { label: '10Y', val: fmtVal(num(mvMap.dgs10?.value), 2) + '%', sub: num(mvMap.dgs10?.value) < 4 ? 'Supportive' : 'Headwind', subCol: num(mvMap.dgs10?.value) < 4 ? '#2a6b4a' : '#8a6a2c' },
  ];

  const stripHtml = stripItems.map(s => `<div class="mu-db-metric">
    <span class="mu-db-metric-label">${esc(s.label)}</span>
    <b class="mu-db-metric-val">${esc(s.val)}</b>
    <span class="mu-db-metric-sub" style="color:${s.subCol}">${esc(s.sub)}</span>
  </div>`).join('');

  const contextHtml = context.map(c => `<p>${c}</p>`).join('');
  const stratHtml   = strategy.map(s => `<p>${s}</p>`).join('');

  return `<div class="mu-daily-briefing mu-db-${sessionClass}">
  <div class="mu-db-header">
    <div class="mu-db-title">
      <span class="mu-db-date">${dateDisplay}</span>
      <span class="mu-db-badge">${esc(sessionLabel)}</span>
    </div>
    <span class="mu-db-phase">Phase ${phaseCode} · ${conf}% confidence</span>
  </div>
  <div class="mu-db-strip">${stripHtml}</div>
  <div class="mu-db-body">
    <div class="mu-db-col">
      <div class="mu-db-col-label">Phase ${phaseCode} context</div>
      ${contextHtml || '<p>No significant signal today — framework holds.</p>'}
    </div>
    <div class="mu-db-col mu-db-strat">
      <div class="mu-db-col-label">Strategy read</div>
      ${stratHtml || '<p>No action triggers active.</p>'}
    </div>
  </div>
</div>`;
}

const dailyBriefingHtml = buildDailyBriefing();

// ── Cycle SVG ─────────────────────────────────────────────────────────────────

const phases = Array.isArray(egg.phases) ? egg.phases : [];
const currentCode  = egg.phase_code || 'C';
const previousCode = (phases.find(p => p.state === 'previous') || {}).code || 'B';

// Phase positions follow the arc geometry:
//   LEFT  side (rising)  → A1 A2 B C      (accumulation → verification, prices climbing)
//   PEAK  of arc         → D              (expansion, broad participation, near peak)
//   RIGHT side (falling) → E F            (euphoria at peak, then distribution/decline)
// Current phase C is PRE-PEAK on the rising left side.
// ── Cycle 5 canvas chart — Fed Funds Rate with phase nodes on actual data ────────
// Live indicator values baked in at build time for the "YOU ARE HERE" callout
const _rsiVal    = mvMap.rsi14?.value  != null ? Number(mvMap.rsi14.value).toFixed(1)       : '—';
const _creditVal = mvMap.hy_oas?.value != null ? Number(mvMap.hy_oas.value).toFixed(2)      : '—';
const _vixVal    = mvMap.vix?.value    != null ? Number(mvMap.vix.value).toFixed(1)          : '—';
const _dgs10Val  = mvMap.dgs10?.value  != null ? Number(mvMap.dgs10.value).toFixed(2) + '%' : '—';
// Live Fed Funds Rate (DFF) from liveRatesCredit — used as the "now" data point
const _dffEntry  = (liveState.liveRatesCredit || []).find(r => r.id === 'DFF');
const _dffRate   = _dffEntry?.value != null ? Number(_dffEntry.value).toFixed(2) : '3.62';

// Unique canvas ID per build — prevents stale copies of this script
// (embedded in holding-card detail views) from finding and overwriting this canvas.
const _cycleCanvasId = 'mcc_' + Date.now().toString(36);

const cycleHtml = `<div class="mu-arc-wrap">
  <div class="mu-arc-topbar">
    <span class="mu-arc-label">Fed Funds Rate — tightening cycle (Oct 2022–present)</span>
    <span class="mu-arc-meta">One of five inputs &middot; ~44 mo &middot; Next phase: Expansion</span>
  </div>
  <div class="mu-arc-canvas-box">
    <canvas id="${_cycleCanvasId}"></canvas>
  </div>
</div>
<script>
(function(){
  var CURRENT = "${currentCode}";
  var RSI="${_rsiVal}", HY="${_creditVal}", VIX="${_vixVal}", DGS10="${_dgs10Val}";
  var PHASES=[
    {id:"A1",label:"Capitulation", date:"Jan '22",color:"#c46050"},
    {id:"A2",label:"Accumulation", date:"Sep '22",color:"#c47a50"},
    {id:"B", label:"Recovery",     date:"Mar '23",color:"#c4a050"},
    {id:"C", label:"Verification", date:"Oct '23",color:"#b85c38"},
    {id:"D", label:"Expansion",    date:"~Dec '25",color:"#7a9e82"},
    {id:"E", label:"Euphoria",     date:"—", color:"#6a8eb0"},
    {id:"F", label:"Distribution", date:"—", color:"#8a7aa0"},
  ];
  // Historical data: actual FEDFUNDS from hike cycle start (Jan '22) through Jun '26 (DFF=${_dffRate}%).
  // Sep '25–Mar '26 are estimated. current:true = solid/dashed boundary = today.
  var RATE_DATA=[
    {d:"Jan '22",r:0.08,phase:"A1"},          // 0  ← near-zero baseline, pre-hike
    {d:"Mar '22",r:0.33,phase:"A1"},          // 1  ← first hike off zero (+25bp)
    {d:"Jun '22",r:1.58,phase:"A1"},          // 2  ← aggressive hiking
    {d:"Sep '22",r:3.08,phase:"A2"},          // 3  ← mid-cycle, SPX bottomed Oct '22
    {d:"Dec '22",r:4.33,phase:"A2"},          // 4  ← nearing peak
    {d:"Mar '23",r:4.65,phase:"B"},           // 5  ← hike pace slowing
    {d:"Jun '23",r:5.08,phase:"B"},           // 6  ← final approach to peak
    {d:"Aug '23",r:5.33,phase:"B"},           // 7  ← plateau begins
    {d:"Oct '23",r:5.33,phase:"C"},           // 8  ← rate peak confirmed, Phase C begins
    {d:"Dec '23",r:5.33,phase:"C"},           // 9
    {d:"Mar '24",r:5.33,phase:"C"},           // 10
    {d:"Jun '24",r:5.33,phase:"C"},           // 11
    {d:"Sep '24",r:4.83,phase:"C"},           // 12 ← first cut (-50bp)
    {d:"Nov '24",r:4.58,phase:"C"},           // 13 ← cut (-25bp)
    {d:"Dec '24",r:4.33,phase:"C"},           // 14 ← cut (-25bp)
    {d:"Mar '25",r:4.33,phase:"C"},           // 15 ← held (tariff pause)
    {d:"Jun '25",r:4.25,phase:"C"},           // 16
    {d:"Sep '25",r:4.00,phase:"C"},           // 17 ← estimated
    {d:"Dec '25",r:3.75,phase:"C"},           // 18 ← estimated
    {d:"Mar '26",r:3.62,phase:"C"},           // 19 ← estimated
    {d:"Jun '26",r:${_dffRate},phase:"C",current:true}, // 20 ← LIVE DFF
    {d:"Dec '26",r:3.25,phase:"D",projected:true},      // 21 ← Phase D projected start
    {d:"Jun '27",r:3.10,phase:"D",projected:true},      // 22
    {d:"Dec '27",r:3.00,phase:"E",projected:true},      // 23
    {d:"2028+",  r:3.00,phase:"E",projected:true},      // 24
  ];
  // Node di values reference the RATE_DATA index where each phase was identified.
  var NODES=[
    {id:"A1",di:0},  // Jan '22: near-zero, hike cycle about to begin
    {id:"A2",di:3},  // Sep '22: mid-hike, SPX hit cycle low Oct '22
    {id:"B", di:5},  // Mar '23: hike pace slowing, peak in sight
    {id:"C", di:8},  // Oct '23: rate peak confirmed, Phase C (Verification)
    {id:"D", di:21}, // ~Dec '26: Phase D projected (monetary conditions ease enough)
    {id:"E", di:23}, // ~Dec '27: Phase E projected
  ];
  // Time-proportional X: parse "Jan '22" → months from Jan 2022 (month 0)
  var MO_NAMES=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  function parseMo(s){if(!s||s.indexOf("'")<0)return null;var p=s.split(" ");return(parseInt("20"+p[1].replace("'",""),10)-2022)*12+MO_NAMES.indexOf(p[0]);}
  RATE_DATA.forEach(function(d,i){var m=parseMo(d.d);d.mo=(m!==null)?m:(i>0?RATE_DATA[i-1].mo+6:60);});
  var TOTAL_MO=RATE_DATA[RATE_DATA.length-1].mo;
  var RATE_MIN=0, RATE_MAX=6.5;
  var canvas=document.getElementById("${_cycleCanvasId}");
  if(!canvas)return;
  var c=canvas.getContext("2d");
  var anim=0, raf;

  function rr(cx,x,y,w,h,r){
    cx.beginPath();cx.moveTo(x+r,y);cx.lineTo(x+w-r,y);cx.quadraticCurveTo(x+w,y,x+w,y+r);
    cx.lineTo(x+w,y+h-r);cx.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
    cx.lineTo(x+r,y+h);cx.quadraticCurveTo(x,y+h,x,y+h-r);
    cx.lineTo(x,y+r);cx.quadraticCurveTo(x,y,x+r,y);cx.closePath();
  }

  function draw(W,H){
    c.clearRect(0,0,W,H);
    // pB=80: date axis row + phase ID row (larger fonts need more room)
    var pL=44,pR=26,pT=32,pB=80;
    var cW=W-pL-pR, cH=H-pT-pB;
    var curIdx=RATE_DATA.findIndex(function(d){return d.current;});
    function xOf(i){return pL+(RATE_DATA[i].mo/TOTAL_MO)*cW;}
    function xOfMo(mo){return pL+(mo/TOTAL_MO)*cW;}
    function yOf(r){return pT+(1-(r-RATE_MIN)/(RATE_MAX-RATE_MIN))*cH;}

    // Y grid + labels
    [0,1,2,3,4,5,6].forEach(function(t){
      var y=yOf(t);
      c.beginPath();c.moveTo(pL,y);c.lineTo(pL+cW,y);
      c.strokeStyle=t===0?"rgba(42,37,32,0.10)":"rgba(42,37,32,0.04)";
      c.lineWidth=0.5;c.stroke();
      c.font="9px IBM Plex Mono,monospace";
      c.fillStyle="rgba(42,37,32,0.30)";
      c.textAlign="right";c.textBaseline="middle";
      c.fillText(t+"%",pL-7,y);
    });

    // Y axis line
    c.beginPath();c.moveTo(pL,pT);c.lineTo(pL,pT+cH);
    c.strokeStyle="rgba(42,37,32,0.10)";c.lineWidth=0.5;c.stroke();

    // "High for longer" shaded band: Aug '23 (di=7) → Sep '24 (di=12), rate held 5.33%
    var hlX0=xOf(7),hlX1=xOf(12);
    c.save();
    c.fillStyle="rgba(184,92,56,0.10)";
    c.fillRect(hlX0,pT,hlX1-hlX0,cH);
    c.restore();
    // Bordered annotation label above the plateau
    var hlMid=(hlX0+hlX1)/2, hlLabelY=yOf(5.33)-24;
    var hlText="held 13 mo at 5.33%", hlBW=140, hlBH=18;
    c.save();
    rr(c,hlMid-hlBW/2,hlLabelY,hlBW,hlBH,3);
    c.fillStyle="rgba(251,250,246,0.96)";c.fill();
    c.strokeStyle="rgba(184,92,56,0.35)";c.lineWidth=0.75;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(184,92,56,0.85)";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText(hlText,hlMid,hlLabelY+9);
    c.restore();

    // Under-curve fill (historical)
    var histData=RATE_DATA.filter(function(_,i){return i<=curIdx;});
    c.save();c.beginPath();
    histData.forEach(function(d,i){var x=xOf(i),y=yOf(d.r);i===0?c.moveTo(x,y):c.lineTo(x,y);});
    c.lineTo(xOf(curIdx),pT+cH);c.lineTo(pL,pT+cH);c.closePath();
    var fg=c.createLinearGradient(0,pT,0,pT+cH);
    fg.addColorStop(0,"rgba(184,92,56,0.11)");fg.addColorStop(1,"rgba(184,92,56,0.01)");
    c.fillStyle=fg;c.fill();c.restore();

    // Historical line — gradient terracotta
    c.save();
    var hg=c.createLinearGradient(pL,0,xOf(curIdx),0);
    hg.addColorStop(0,"#c46050");hg.addColorStop(0.5,"#c4a050");hg.addColorStop(1,"#b85c38");
    c.beginPath();
    histData.forEach(function(d,i){var x=xOf(i),y=yOf(d.r);i===0?c.moveTo(x,y):c.lineTo(x,y);});
    c.strokeStyle=hg;c.lineWidth=2;c.lineJoin="round";c.stroke();c.restore();

    // Projected dashed line
    var projData=RATE_DATA.filter(function(_,i){return i>=curIdx;});
    c.save();c.setLineDash([4,5]);c.beginPath();
    projData.forEach(function(d,i){var x=xOf(curIdx+i),y=yOf(d.r);i===0?c.moveTo(x,y):c.lineTo(x,y);});
    c.strokeStyle="rgba(42,37,32,0.16)";c.lineWidth=1;c.stroke();
    c.setLineDash([]);c.restore();

    // Neutral ~3% reference line (projected side only)
    var neutralY=yOf(3.0);
    c.save();c.setLineDash([3,5]);c.beginPath();
    c.moveTo(xOf(curIdx),neutralY);c.lineTo(pL+cW,neutralY);
    c.strokeStyle="rgba(122,158,130,0.36)";c.lineWidth=0.75;c.stroke();
    c.setLineDash([]);
    c.font="8px IBM Plex Mono,monospace";
    c.fillStyle="rgba(122,158,130,0.55)";
    c.textAlign="right";c.textBaseline="middle";
    c.fillText("neutral ~3%",pL+cW-3,neutralY-7);c.restore();

    // Divider at current + "← projected" label
    // Divider at today (solid/dashed boundary)
    c.save();
    c.beginPath();c.moveTo(xOf(curIdx),pT);c.lineTo(xOf(curIdx),pT+cH);
    c.strokeStyle="rgba(184,92,56,0.22)";c.lineWidth=0.75;c.setLineDash([3,4]);c.stroke();c.setLineDash([]);
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(42,37,32,0.50)";
    c.textAlign="left";c.textBaseline="top";
    c.fillText("projected →",xOf(curIdx)+6,pT+5);
    c.restore();

    // X axis line
    c.beginPath();c.moveTo(pL,pT+cH);c.lineTo(pL+cW,pT+cH);
    c.strokeStyle="rgba(42,37,32,0.10)";c.lineWidth=0.5;c.stroke();

    // ── KEY EVENT CALLOUTS ───────────────────────────────────────────────────
    // "Near-zero baseline · Jan '22" at di=0 (bottom of the cycle)
    c.save();
    var hcX=xOf(0)+5, hcY=yOf(RATE_DATA[0].r);
    var hcW=162,hcH=17;
    rr(c,hcX,hcY-hcH-4,hcW,hcH,3);
    c.fillStyle="rgba(251,250,246,0.96)";c.fill();
    c.strokeStyle="rgba(42,37,32,0.18)";c.lineWidth=0.5;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(42,37,32,0.75)";
    c.textAlign="left";c.textBaseline="middle";
    c.fillText("Near-zero baseline \xb7 Jan '22",hcX+6,hcY-hcH/2-4);
    c.restore();

    // "First hike · Mar '22" at di=1
    c.save();
    var fhX=xOf(1), fhY=yOf(RATE_DATA[1].r);
    var fhW=138,fhH=17;
    rr(c,fhX-fhW/2,fhY+6,fhW,fhH,3);
    c.fillStyle="rgba(251,250,246,0.96)";c.fill();
    c.strokeStyle="rgba(42,37,32,0.18)";c.lineWidth=0.5;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(42,37,32,0.75)";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText("First hike \xb7 Mar '22 \xb7 +25bp",fhX,fhY+14.5);
    c.restore();

    // "First cut · Sep '24 · −50bp" badge below rate line at di=12
    c.save();
    var fcX=xOf(12), fcY=yOf(RATE_DATA[12].r);
    var fcW=152,fcH=18;
    rr(c,fcX-fcW/2,fcY+10,fcW,fcH,3);
    c.fillStyle="rgba(251,250,246,0.96)";c.fill();
    c.strokeStyle="rgba(90,140,110,0.40)";c.lineWidth=0.75;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(60,120,90,0.88)";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText("First cut \xb7 Sep '24 \xb7 −50bp",fcX,fcY+19);
    c.restore();

    // "Phase D projected · ~Dec '26" badge in the dashed section
    c.save();
    var pdX=xOf(21), pdY=yOf(RATE_DATA[21].r);
    var pdW=164,pdH=17;
    rr(c,pdX-pdW/2,pdY-pdH-8,pdW,pdH,3);
    c.fillStyle="rgba(251,250,246,0.96)";c.fill();
    c.strokeStyle="rgba(90,140,110,0.35)";c.lineWidth=0.5;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(60,120,90,0.82)";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText("Phase D projected \xb7 ~Dec '26",pdX,pdY-pdH/2-8);
    c.restore();

    // ── PHASE IDENTIFICATION NODES (static markers — where each phase started) ─
    NODES.forEach(function(nd){
      var ph=PHASES.find(function(p){return p.id===nd.id;});
      if(!ph||!RATE_DATA[nd.di])return;
      var x=xOf(nd.di), y=yOf(RATE_DATA[nd.di].r);
      var col=ph.color, isPast=nd.di<=curIdx, r=4;
      c.beginPath();c.arc(x,y,r,0,2*Math.PI);
      c.fillStyle=isPast?col:"rgba(244,239,230,0.85)";c.fill();
      if(!isPast){c.strokeStyle=col;c.lineWidth=0.75;c.stroke();}
      c.beginPath();c.arc(x,y,1.5,0,2*Math.PI);
      c.fillStyle=isPast?"rgba(244,239,230,0.80)":col;c.fill();
    });

    // "Rate peaked · 5.33% · Phase C begins" callout above the C node (di=8)
    c.save();
    var csX=xOf(8), csY=yOf(5.33);
    var csW=214,csH=18;
    rr(c,csX-csW/2,csY-csH-6,csW,csH,3);
    c.fillStyle="rgba(251,250,246,0.97)";c.fill();
    c.strokeStyle="rgba(184,92,56,0.40)";c.lineWidth=0.75;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(184,92,56,0.90)";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText("Rate peaked \xb7 5.33% \xb7 Phase C begins",csX,csY-csH/2-6);
    c.restore();

    // ── TODAY — animated pulse ON the rate line at actual Jun '26 rate ────────
    var todayX=xOf(curIdx), todayY=yOf(RATE_DATA[curIdx].r);
    var todayCol="#b85c38";
    // Animated glow
    var gr=14+3*Math.sin(anim*0.04);
    var grd=c.createRadialGradient(todayX,todayY,0,todayX,todayY,gr);
    grd.addColorStop(0,todayCol+"28");grd.addColorStop(1,todayCol+"00");
    c.beginPath();c.arc(todayX,todayY,gr,0,2*Math.PI);c.fillStyle=grd;c.fill();
    c.beginPath();c.arc(todayX,todayY,10,0,2*Math.PI);
    c.strokeStyle=todayCol+"28";c.lineWidth=0.75;c.stroke();
    // Main dot
    c.beginPath();c.arc(todayX,todayY,6.5,0,2*Math.PI);
    c.fillStyle=todayCol;c.shadowColor=todayCol;c.shadowBlur=8;c.fill();c.shadowBlur=0;
    // Inner white
    c.beginPath();c.arc(todayX,todayY,2,0,2*Math.PI);
    c.fillStyle="rgba(244,239,230,0.90)";c.fill();
    // Drop line to x-axis
    c.save();c.beginPath();c.moveTo(todayX,todayY+7);c.lineTo(todayX,pT+cH);
    c.strokeStyle=todayCol+"25";c.lineWidth=0.5;c.setLineDash([3,4]);c.stroke();c.setLineDash([]);c.restore();

    // "YOU ARE HERE" badge anchored above the TODAY dot
    c.save();
    var bw=188,bh=34;
    var badgeY=Math.max(pT+2,todayY-50);
    rr(c,todayX-bw/2,badgeY,bw,bh,4);
    c.fillStyle="rgba(251,250,246,0.97)";c.fill();
    c.strokeStyle=todayCol+"70";c.lineWidth=1;c.stroke();
    c.font="600 10px IBM Plex Mono,monospace";
    c.fillStyle=todayCol;c.textAlign="center";c.textBaseline="middle";
    c.fillText("YOU ARE HERE \xb7 Jun '26",todayX,badgeY+11);
    c.font="8.5px IBM Plex Mono,monospace";
    c.fillStyle="rgba(42,37,32,0.72)";
    c.fillText("Phase C \xb7 ${_dffRate}% \xb7 32 mo into cycle",todayX,badgeY+25);
    // Connector from badge to dot
    if(badgeY+bh<todayY-8){
      c.beginPath();c.moveTo(todayX,badgeY+bh);c.lineTo(todayX,todayY-8);
      c.strokeStyle=todayCol+"40";c.lineWidth=0.75;c.stroke();
    }
    c.restore();

    // Live metrics just below the TODAY dot
    c.save();
    c.font="8px IBM Plex Mono,monospace";
    c.fillStyle="rgba(138,106,44,0.78)";
    c.textAlign="center";c.textBaseline="top";
    c.fillText("RSI "+RSI+" \xb7 HY "+HY+" \xb7 VIX "+VIX+" \xb7 10Y "+DGS10,todayX,todayY+12);
    c.restore();

    // ── PHASE ID ROW — colored labels at node positions ──────────────────────
    var phaseY=pT+cH+9;
    NODES.forEach(function(nd){
      var ph=PHASES.find(function(p){return p.id===nd.id;});
      if(!ph)return;
      var x=xOf(nd.di);
      var isPast=nd.di<=curIdx;
      c.beginPath();c.moveTo(x,pT+cH);c.lineTo(x,pT+cH+5);
      c.strokeStyle=isPast?ph.color+"80":"rgba(42,37,32,0.14)";
      c.lineWidth=1.5;c.stroke();
      c.font="600 10px IBM Plex Mono,monospace";
      c.fillStyle=isPast?ph.color:"rgba(42,37,32,0.25)";
      c.textAlign="center";c.textBaseline="top";
      c.fillText(nd.id,x,phaseY);
    });

    // ── DATE AXIS — calendar milestones ──────────────────────────────────────
    var dateY=pT+cH+28;
    [
      {mo:0,  label:"Jan '22"},
      {mo:2,  label:"Mar '22 ↑"},
      {mo:21, label:"Oct '23"},
      {mo:32, label:"Sep '24"},
      {mo:53, label:"Jun '26 ▸"},
    ].forEach(function(tick){
      var tx=xOfMo(tick.mo);
      c.beginPath();c.moveTo(tx,pT+cH+1);c.lineTo(tx,pT+cH+6);
      c.strokeStyle="rgba(42,37,32,0.18)";c.lineWidth=0.75;c.stroke();
      c.font="8.5px IBM Plex Mono,monospace";
      c.fillStyle="rgba(42,37,32,0.72)";
      c.textAlign="center";c.textBaseline="top";
      c.fillText(tick.label,tx,dateY);
    });

    // ── PHASE C DURATION SPAN — shows how long this phase has lasted ──────────
    var annX=(xOf(8)+xOf(curIdx))/2;
    c.save();
    c.beginPath();c.moveTo(xOf(8),yOf(2.8));c.lineTo(xOf(curIdx),yOf(2.8));
    c.strokeStyle="rgba(184,92,56,0.30)";c.lineWidth=0.75;c.setLineDash([3,4]);c.stroke();c.setLineDash([]);
    // End caps
    [xOf(8),xOf(curIdx)].forEach(function(cx){
      c.beginPath();c.moveTo(cx,yOf(2.8)-4);c.lineTo(cx,yOf(2.8)+4);
      c.strokeStyle="rgba(184,92,56,0.40)";c.lineWidth=0.75;c.stroke();
    });
    var durW=196,durH=18;
    rr(c,annX-durW/2,yOf(2.8)-durH-4,durW,durH,3);
    c.fillStyle="rgba(251,250,246,0.96)";c.fill();
    c.strokeStyle="rgba(184,92,56,0.28)";c.lineWidth=0.5;c.stroke();
    c.font="9px IBM Plex Mono,monospace";
    c.fillStyle="rgba(184,92,56,0.85)";
    c.textAlign="center";c.textBaseline="middle";
    c.fillText("Phase C \xb7 Oct '23 → Jun '26 \xb7 32 months",annX,yOf(2.8)-durH/2-4);
    c.restore();
  }

  function resize(){
    var wrap=canvas.parentElement;
    var rect=wrap.getBoundingClientRect();
    if(!rect.width||!rect.height)return;
    var dpr=window.devicePixelRatio||1;
    canvas.width=rect.width*dpr;
    canvas.height=rect.height*dpr;
    canvas.style.width=rect.width+"px";
    canvas.style.height=rect.height+"px";
    c.setTransform(dpr,0,0,dpr,0,0);
  }

  function loop(){
    anim++;
    var wrap=canvas.parentElement;
    var rect=wrap.getBoundingClientRect();
    if(rect.width&&rect.height)draw(rect.width,rect.height);
    raf=requestAnimationFrame(loop);
  }

  window.addEventListener("resize",function(){
    cancelAnimationFrame(raf);resize();raf=requestAnimationFrame(loop);
  });
  setTimeout(function(){resize();loop();},60);
})();
<\/script>`;

// ── Macro Regime Engine ───────────────────────────────────────────────────────

function computeRegime(mvMap) {
  const vix   = num(mvMap.vix?.value);
  const oas   = num(mvMap.hy_oas?.value);
  const rsi   = num(mvMap.rsi14?.value);
  const dgs10 = num(mvMap.dgs10?.value);

  // Growth axis: +1 supportive, 0 neutral, -1 headwind
  const gInputs = [];
  let gScore = 0;
  if (vix !== null) {
    const d = vix < 18 ? '↑' : vix >= 25 ? '↓' : '→';
    const s = vix < 18 ? 1 : vix >= 25 ? -1 : 0;
    gScore += s; gInputs.push({ label: 'VIX', val: vix.toFixed(1), dir: d, s });
  }
  if (oas !== null) {
    const d = oas < 3.2 ? '↑' : oas >= 4.5 ? '↓' : '→';
    const s = oas < 3.2 ? 1 : oas >= 4.5 ? -1 : 0;
    gScore += s; gInputs.push({ label: 'HY OAS', val: oas.toFixed(2), dir: d, s });
  }
  if (rsi !== null) {
    const d = rsi > 55 ? '↑' : rsi < 45 ? '↓' : '→';
    const s = rsi > 55 ? 1 : rsi < 45 ? -1 : 0;
    gScore += s; gInputs.push({ label: 'RSI', val: rsi.toFixed(1), dir: d, s });
  }

  // Inflation axis: +1 pressure rising, 0 neutral, -1 easing
  const iInputs = [];
  let iScore = 0;
  if (dgs10 !== null) {
    const d = dgs10 > 4.5 ? '↑' : dgs10 < 3.5 ? '↓' : '→';
    const s = dgs10 > 4.5 ? 1 : dgs10 < 3.5 ? -1 : 0;
    iScore += s; iInputs.push({ label: '10Y Yield', val: dgs10.toFixed(2) + '%', dir: d, s });
  }
  if (oas !== null) {
    const d = oas < 2.8 ? '↑' : oas >= 5.0 ? '↓' : '→';
    const s = oas < 2.8 ? 1 : oas >= 5.0 ? -1 : 0;
    iScore += s; iInputs.push({ label: 'Credit (HY)', val: oas.toFixed(2), dir: d, s });
  }

  const gRising = gScore >= 0;
  const iRising = iScore > 0;

  let name, sub, favor, avoid, watch;
  if  (gRising && !iRising) {
    name = 'GOLDILOCKS';   sub = 'Growth solid · inflation contained';
    favor = 'Tech · Healthcare · Quality compounders';
    avoid = 'Commodities · EM · Leveraged beta';
    watch = 'HY OAS > 3.5 or 10Y > 5% → shift to Reflation';
  } else if (gRising && iRising) {
    name = 'REFLATION';    sub = 'Growth rising · inflation climbing';
    favor = 'Cyclicals · Energy · Real assets · EM';
    avoid = 'Long-duration growth · Bonds';
    watch = 'Credit widening or PMI rollover → regime peak';
  } else if (!gRising && iRising) {
    name = 'STAGFLATION';  sub = 'Growth stalling · inflation sticky';
    favor = 'Cash · Real assets · Short-duration';
    avoid = 'Equities broadly · Duration';
    watch = 'Fed pivot signal → path back to Goldilocks';
  } else {
    name = 'DEFLATION';    sub = 'Growth slowing · inflation easing';
    favor = 'Bonds · Defensives · Quality';
    avoid = 'Cyclicals · Commodities · EM';
    watch = 'Stimulus or credit stabilisation → recovery';
  }

  return { name, sub, favor, avoid, watch, gScore, iScore, gRising, iRising, gInputs, iInputs };
}

const regime = computeRegime(mvMap);

function dirColor(dir) {
  return dir === '↑' ? '#2a6b4a' : dir === '↓' ? '#A4502F' : 'rgba(26,23,20,.40)';
}

function regimeInputRow(inp) {
  return `<div class="mu-rg-inp-row">
    <span class="mu-rg-inp-label">${esc(inp.label)}</span>
    <b class="mu-rg-inp-val">${esc(inp.val)}</b>
    <em class="mu-rg-inp-dir" style="color:${dirColor(inp.dir)}">${inp.dir}</em>
  </div>`;
}

const regimeCol = `<div class="mu-regime-col">
  <span class="mu-rg-eyebrow">Macro Regime Engine</span>
  <b class="mu-rg-name">${esc(regime.name)}</b>
  <p class="mu-rg-sub">${esc(regime.sub)}</p>

  <div class="mu-rg-quad-wrap">
    <div class="mu-rg-axis-y">Growth ↑</div>
    <div class="mu-rg-grid">
      <div class="mu-rg-cell ${regime.name === 'GOLDILOCKS'   ? 'mu-rg-on' : ''}"><b>Goldilocks</b><small>Tech · Quality</small></div>
      <div class="mu-rg-cell ${regime.name === 'REFLATION'    ? 'mu-rg-on' : ''}"><b>Reflation</b><small>Cyclicals · Energy</small></div>
      <div class="mu-rg-cell ${regime.name === 'DEFLATION'    ? 'mu-rg-on' : ''}"><b>Deflation</b><small>Bonds · Defensives</small></div>
      <div class="mu-rg-cell ${regime.name === 'STAGFLATION'  ? 'mu-rg-on' : ''}"><b>Stagflation</b><small>Cash · Real assets</small></div>
    </div>
    <div class="mu-rg-axis-x">Inflation →</div>
  </div>

  <div class="mu-rg-inputs">
    <div class="mu-rg-inp-col">
      <span class="mu-rg-inp-head">Growth</span>
      ${regime.gInputs.map(regimeInputRow).join('')}
    </div>
    <div class="mu-rg-inp-col">
      <span class="mu-rg-inp-head">Inflation</span>
      ${regime.iInputs.map(regimeInputRow).join('')}
    </div>
  </div>

  <div class="mu-rg-impl">
    <div><span>Kostolany</span>Phase ${phaseCode} · consistent with ${esc(regime.name)}</div>
    <div><span>Favor</span>${esc(regime.favor)}</div>
    <div><span>Avoid</span>${esc(regime.avoid)}</div>
    <div><span>Watch</span>${esc(regime.watch)}</div>
  </div>
</div>`;

// ── Phase → portfolio bridge ──────────────────────────────────────────────────

function phaseAlignment(h) {
  const p = h?.analysisChart?.profile || '';
  if (p === 'tactical_risk')            return 'exposed';
  if (p === 'speculative_verification') return 'building';
  return 'aligned';
}

function pbSignalColor(sig) {
  const s = (sig || '').toLowerCase();
  if (s.includes('exit'))        return '#A4502F';
  if (s.includes('trim'))        return '#A4502F';
  if (s.includes('investigate')) return '#8a6a2c';
  if (s.includes('hold'))        return '#2a6b4a';
  return 'rgba(26,23,20,.5)';
}

function pbHoldingRow(h) {
  const sig     = esc(h.computedSignal || h.signal || '—');
  const perf    = h.perf3mPct;
  const perfStr = perf != null ? (perf >= 0 ? `+${perf.toFixed(1)}%` : `${perf.toFixed(1)}%`) : '—';
  const perfCol = perf != null ? (perf >= 0 ? '#2a6b4a' : '#A4502F') : 'rgba(26,23,20,.4)';
  const sigCol  = pbSignalColor(h.computedSignal || h.signal);
  return `<div class="mu-pb-row">
    <b class="mu-pb-ticker">${esc(h.ticker)}</b>
    <span class="mu-pb-sig" style="color:${sigCol}">${sig}</span>
    <span class="mu-pb-perf" style="color:${perfCol}">${perfStr}</span>
  </div>`;
}

const pbGroups = {
  aligned:  allHoldings.filter(h => phaseAlignment(h) === 'aligned'),
  exposed:  allHoldings.filter(h => phaseAlignment(h) === 'exposed'),
  building: allHoldings.filter(h => phaseAlignment(h) === 'building'),
};

const phaseBridge = allHoldings.length > 0 ? `<div class="mu-phase-bridge">
  <div class="mu-pb-label">Phase ${phaseCode} → portfolio alignment · ${allHoldings.length} positions</div>
  <div class="mu-pb-grid">
    <div class="mu-pb-col mu-pb-aligned">
      <div class="mu-pb-head">
        <span class="mu-pb-count">${pbGroups.aligned.length}</span>
        <div><b>Aligned</b><small>Core · quality · index</small></div>
      </div>
      ${pbGroups.aligned.map(pbHoldingRow).join('')}
    </div>
    <div class="mu-pb-col mu-pb-exposed">
      <div class="mu-pb-head">
        <span class="mu-pb-count">${pbGroups.exposed.length}</span>
        <div><b>Phase-exposed</b><small>Levered · needs Phase D/E</small></div>
      </div>
      ${pbGroups.exposed.map(pbHoldingRow).join('')}
    </div>
    <div class="mu-pb-col mu-pb-building">
      <div class="mu-pb-head">
        <span class="mu-pb-count">${pbGroups.building.length}</span>
        <div><b>Verification</b><small>Thesis gates still open</small></div>
      </div>
      ${pbGroups.building.map(pbHoldingRow).join('')}
    </div>
  </div>
</div>` : '';

// ── Signal micro-dots (regime header) ────────────────────────────────────────

const signalDotsHtml = signals.map(s => {
  const bg = s.color === 'green' ? '#2a6b4a' : s.color === 'red' ? '#A4502F' : '#8a6a2c';
  return `<span class="mu-sdot" style="background:${bg}" title="${esc(s.name)}: ${esc(s.display)} ${esc(s.label)}"></span>`;
}).join('');

const signalBarHtml = `<div class="mu-sigbar">
  <div class="mu-sigbar-dots">${signalDotsHtml}</div>
  <span class="mu-sigbar-label">${greens} confirm · ${ambers} watch · ${reds} block</span>
</div>`;

// ── Phase C tension + transition gates ────────────────────────────────────────

function gateStatus(current, target, direction) {
  if (current == null) return { icon: '—', col: 'rgba(26,23,20,.35)' };
  const cleared = direction === 'below' ? current < target : current > target;
  const near    = direction === 'below' ? current < target * 1.1 : current > target * 0.9;
  if (cleared) return { icon: '✓', col: '#2a6b4a' };
  if (near)    return { icon: '~', col: '#8a6a2c' };
  return { icon: '✗', col: '#A4502F' };
}

const vixCur    = num(mvMap.vix?.value);
const creditCur = num(mvMap.hy_oas?.value);
const dgs10Cur  = num(mvMap.dgs10?.value);
const rsiCur    = num(mvMap.rsi14?.value);

const phaseGates = [
  { label: '10Y Treasury', current: dgs10Cur,     target: 4.0,  unit: '%', direction: 'below', note: 'rate headwind clears'  },
  { label: 'Fed Funds',    current: currentFedRate,target: 3.0,  unit: '%', direction: 'below', note: 'money loosening'       },
  { label: 'VIX',          current: vixCur,        target: 15.0, unit: '',  direction: 'below', note: 'sustained calm'        },
  { label: 'HY OAS',       current: creditCur,     target: 2.5,  unit: '',  direction: 'below', note: 'credit stress clear'   },
  { label: 'RSI 14',       current: rsiCur,        target: 55.0, unit: '',  direction: 'above', note: 'trend sustained'       },
];

const gateRows = phaseGates.map(g => {
  const gs      = gateStatus(g.current, g.target, g.direction);
  const curStr  = g.current != null
    ? (g.unit === '%' ? g.current.toFixed(2) + '%' : g.current.toFixed(1))
    : '—';
  const tgtStr  = g.direction === 'below' ? `&lt;${g.target}${g.unit}` : `&gt;${g.target}${g.unit}`;
  return `<div class="mu-gate-row">
    <span class="mu-gate-name">${esc(g.label)}</span>
    <span class="mu-gate-cur">${curStr}</span>
    <span class="mu-gate-tgt">${tgtStr}</span>
    <span class="mu-gate-icon" style="color:${gs.col}">${gs.icon}</span>
    <span class="mu-gate-note">${esc(g.note)}</span>
  </div>`;
}).join('');

const confirmSignals = signals.filter(s => s.color === 'green');
const blockSignals   = signals.filter(s => s.color === 'red');

const confirmRows = confirmSignals.map(s =>
  `<div class="mu-tension-row">
    <span class="mu-tension-name">${esc(s.name)}</span>
    <span class="mu-tension-val">${s.display}</span>
    <span class="mu-tension-sub mu-good">${esc(s.label)}</span>
  </div>`).join('');

const blockRows = blockSignals.map(s =>
  `<div class="mu-tension-row">
    <span class="mu-tension-name">${esc(s.name)}</span>
    <span class="mu-tension-val">${s.display}</span>
    <span class="mu-tension-sub mu-bad">${esc(s.label)}</span>
  </div>`).join('');

const tensionGatesHtml = `<div class="mu-tension-block">
  <div class="mu-tension-col">
    <div class="mu-tension-head mu-good">Confirming C <small>why this isn't Phase B anymore</small></div>
    ${confirmRows}
  </div>
  <div class="mu-tension-col">
    <div class="mu-tension-head mu-bad">Holding back D <small>what's still blocking expansion</small></div>
    ${blockRows}
  </div>
  <div class="mu-tension-col mu-gates-col">
    <div class="mu-tension-head">Gate to Phase D <small>measurable conditions</small></div>
    ${gateRows}
  </div>
</div>`;

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

/* Decision command center */
.mu-command-center{display:grid;grid-template-columns:minmax(0,.84fr) minmax(420px,1.16fr);gap:12px;padding:22px 0 18px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-command-copy{border:1px solid rgba(164,80,47,.30);background:linear-gradient(180deg,rgba(255,255,255,.42),rgba(164,80,47,.06));padding:20px 22px}
.mu-command-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:rgba(164,80,47,.72);margin:0 0 10px;font-family:var(--mono,monospace)}
.mu-command-copy h2{font-size:clamp(36px,5.4vw,72px);line-height:.92;letter-spacing:-.078em;font-weight:500;margin:0 0 14px;color:#1A1714}
.mu-command-copy p:last-child{font-size:14px;line-height:1.45;color:rgba(26,23,20,.68);max-width:680px;margin:0}
.mu-command-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
.mu-command-card{border:1px solid rgba(201,191,173,.55);background:rgba(255,255,255,.24);padding:14px 13px;min-width:0}
.mu-command-card span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.42);margin-bottom:10px;font-family:var(--mono,monospace)}
.mu-command-card b{display:block;font-size:clamp(18px,2.1vw,30px);line-height:1;letter-spacing:-.05em;font-weight:500;color:#1A1714;overflow-wrap:anywhere}
.mu-command-card small{display:block;font-size:10.5px;line-height:1.32;color:rgba(26,23,20,.50);margin-top:10px}
.mu-command-primary{border-color:rgba(164,80,47,.42);background:rgba(164,80,47,.075)}
.mu-command-add{border-color:rgba(42,107,74,.38);background:rgba(42,107,74,.055)}
.mu-command-add b{color:#2a6b4a}
.mu-command-trim,.mu-command-defense{border-color:rgba(164,80,47,.34);background:rgba(164,80,47,.045)}
.mu-command-trim b,.mu-command-defense b{color:#A4502F}
@media(max-width:980px){.mu-command-center{grid-template-columns:1fr}.mu-command-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:560px){.mu-command-grid{grid-template-columns:1fr}.mu-command-copy{padding:18px 16px}.mu-command-copy h2{font-size:40px}}

/* ── Regime header ── */
.mu-regime{display:grid;grid-template-columns:minmax(0,1fr) minmax(210px,.28fr);gap:18px;align-items:stretch;padding:22px 0 20px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-regime>div:first-child{border:1px solid rgba(164,80,47,.26);background:linear-gradient(180deg,rgba(255,255,255,.34),rgba(164,80,47,.055));padding:18px 20px 20px;min-width:0}
.mu-phase-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:rgba(26,23,20,.38);margin:0 0 8px;font-family:var(--mono,monospace)}
.mu-phase-title{font-size:clamp(40px,4.8vw,68px);line-height:.88;letter-spacing:-.075em;font-weight:560;margin:0 0 14px;color:#1A1714}
.mu-narrative{font-size:clamp(13px,1.2vw,15px);line-height:1.55;color:rgba(26,23,20,.68);max-width:820px;margin:0 0 18px}
.mu-action{border-left:3px solid #A4502F;padding:10px 0 10px 14px;background:rgba(251,250,246,.32)}
.mu-action span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.4);margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-action b{display:block;font-size:clamp(18px,2vw,26px);font-weight:650;color:#1A1714;line-height:1.12;letter-spacing:-.035em}
.mu-action small{display:block;font-size:12.5px;color:rgba(26,23,20,.58);margin-top:8px;line-height:1.42;max-width:740px}
.mu-regime-meta{display:flex;flex-direction:column;align-items:stretch;gap:10px}
.mu-conf{text-align:left;border:1px solid rgba(201,191,173,.56);background:rgba(255,255,255,.22);padding:16px;min-height:100%}
.mu-conf span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.38);margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-conf b{display:block;font-size:clamp(42px,4.2vw,60px);line-height:.88;letter-spacing:-.07em;font-weight:560;color:#A4502F;margin-top:12px}
.mu-conf small{font-size:11px;color:rgba(26,23,20,.48);display:block;text-align:left;margin-top:7px;line-height:1.35}
.mu-stress-badge{display:inline-block;align-self:flex-start;padding:3px 9px;border:0.5px solid rgba(164,80,47,.35);background:rgba(164,80,47,.06);font-size:9px;color:#A4502F;letter-spacing:.10em;text-transform:uppercase;border-radius:2px}

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
@media(max-width:900px){.mu-regime{grid-template-columns:1fr}.mu-cycle-analysis-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.mu-wrap{width:min(100% - 28px,1280px)}.mu-regime{padding-top:18px}.mu-regime>div:first-child{padding:16px}.mu-cycle-analysis-grid{grid-template-columns:1fr}}

/* ── Unified chart block ── */
.mu-unified-chart-block{padding:24px 0 16px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-comparison-block{padding:20px 0 16px;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-analog-callout{display:flex;align-items:baseline;gap:10px;margin-top:10px;padding:10px 14px;border-left:2.5px solid rgba(164,80,47,.5);background:rgba(164,80,47,.05)}
.mu-analog-callout span{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(164,80,47,.7);white-space:nowrap;font-family:var(--mono,monospace)}
.mu-analog-callout b{font-size:12.5px;color:rgba(26,23,20,.72);line-height:1.4;font-weight:400}
/* ── Charts row ── */
.mu-charts-row{display:grid;grid-template-columns:1fr 1fr;gap:0;border-bottom:1px solid rgba(201,191,173,.45);padding:24px 0 20px}
.mu-chart-block{padding-right:20px;border-right:1px solid rgba(201,191,173,.38)}
.mu-vix-block{padding-left:20px}
.mu-chart-head{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:10px}
.mu-chart-legend{display:flex;gap:16px;margin-top:8px;padding-top:6px;border-top:1px solid rgba(201,191,173,.28)}
.mu-chart-legend span{font-size:10px;color:rgba(26,23,20,.5);display:flex;align-items:center;font-family:var(--mono,monospace)}
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

/* ── Cycle + Regime two-column ── */
.mu-regime-row{padding:22px 0;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-cycle-arc-det{grid-column:1/-1;border-bottom:none;padding:0}.mu-cycle-arc-det>.mu-arc-sum{font-size:10px;font-family:var(--mono,monospace);text-transform:uppercase;letter-spacing:.1em;color:rgba(44,42,37,.45);cursor:pointer;padding:8px 0;display:block;border-bottom:0.5px solid rgba(201,191,173,.3);margin-bottom:0;list-style:none}.mu-cycle-arc-det[open]>.mu-arc-sum{padding-bottom:14px}.mu-cycle-arc-det>.mu-arc-sum::-webkit-details-marker{display:none}.mu-cycle-arc-det>.mu-arc-sum::before{content:"▸ ";font-size:9px;color:rgba(44,42,37,.3)}.mu-cycle-arc-det[open]>.mu-arc-sum::before{content:"▾ "}.mu-cycle-arc-col{min-width:0}
.mu-pb-det{padding:22px 0;border-bottom:1px solid rgba(201,191,173,.45)}.mu-pb-sum{font-size:10px;font-family:var(--mono,monospace);text-transform:uppercase;letter-spacing:.1em;color:rgba(44,42,37,.45);cursor:pointer;display:block;list-style:none;margin-bottom:0}.mu-pb-det[open]>.mu-pb-sum{margin-bottom:16px}.mu-pb-sum::-webkit-details-marker{display:none}.mu-pb-sum::before{content:"▸ ";font-size:9px;color:rgba(44,42,37,.3)}.mu-pb-det[open]>.mu-pb-sum::before{content:"▾ "}
.mu-arc-wrap{display:flex;flex-direction:column;gap:0;min-width:0}
.mu-arc-topbar{display:flex;align-items:center;justify-content:space-between;padding:0 0 9px;border-bottom:0.5px solid rgba(201,191,173,.28);margin-bottom:10px}
.mu-arc-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(44,42,37,.36);font-family:var(--mono,monospace)}
.mu-arc-meta{font-size:9px;color:rgba(44,42,37,.32);font-family:var(--mono,monospace)}
.mu-arc-canvas-box{position:relative;width:100%;height:380px}
.mu-arc-canvas-box canvas{width:100%;height:100%;display:block}
.mu-cycle-row{display:grid;grid-template-columns:1.15fr .85fr;gap:28px;padding:24px 0;border-bottom:1px solid rgba(201,191,173,.45)}
/* Regime column */
.mu-regime-col{border:1px solid rgba(201,191,173,.45);border-radius:18px;padding:16px 15px;background:rgba(251,250,246,.28);display:flex;flex-direction:column;gap:0}
.mu-rg-eyebrow{font-size:8.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);display:block}
.mu-rg-name{display:block;font-size:20px;font-weight:500;letter-spacing:-.04em;margin:3px 0 1px;color:rgba(26,23,20,.88)}
.mu-rg-sub{font-size:10.5px;color:var(--muted);margin:0 0 13px;line-height:1.4}
/* Quadrant grid */
.mu-rg-quad-wrap{margin-bottom:12px}
.mu-rg-axis-y{font-size:7.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);opacity:.55;margin-bottom:3px}
.mu-rg-axis-x{font-size:7.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);opacity:.55;margin-top:3px;text-align:right}
.mu-rg-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid rgba(201,191,173,.38);border-radius:10px;overflow:hidden}
.mu-rg-cell{padding:9px 11px;border:1px solid rgba(201,191,173,.22);box-sizing:border-box}
.mu-rg-cell b{display:block;font-size:9.5px;font-weight:600;color:rgba(26,23,20,.35);line-height:1.2}
.mu-rg-cell small{font-size:8px;color:rgba(26,23,20,.28)}
.mu-rg-on{background:rgba(47,111,78,.07)}
.mu-rg-on b{color:rgba(47,111,78,.80)}
.mu-rg-on small{color:rgba(47,111,78,.50)}
/* Inputs */
.mu-rg-inputs{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:11px}
.mu-rg-inp-head{display:block;font-size:8px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px}
.mu-rg-inp-row{display:flex;align-items:baseline;gap:4px;padding:2px 0;border-bottom:1px solid rgba(201,191,173,.18);font-size:9.5px}
.mu-rg-inp-label{flex:1;color:rgba(26,23,20,.45)}
.mu-rg-inp-val{font-weight:500;color:rgba(26,23,20,.68)}
.mu-rg-inp-dir{font-style:normal;font-size:10px}
/* Implications */
.mu-rg-impl{border-top:1px solid rgba(201,191,173,.35);padding-top:10px;display:flex;flex-direction:column;gap:4px}
.mu-rg-impl>div{font-size:9.5px;color:rgba(26,23,20,.62);line-height:1.4}
.mu-rg-impl span{display:inline-block;font-size:7.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);min-width:50px;margin-right:4px}
@media(max-width:860px){.mu-regime-row{grid-template-columns:1fr}.mu-regime-col{margin-top:0}}
.mu-zone-label{font-size:9px;text-transform:uppercase;letter-spacing:.13em;color:rgba(26,23,20,.38);margin:0 0 14px;font-family:var(--mono,monospace)}
.mu-sector-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
.mu-sector{border:1px solid var(--bd);background:var(--bg);border-left:2.5px solid var(--c);padding:8px 9px 7px;display:flex;flex-direction:column;gap:2px}
.mu-sector-icon{font-size:13px;line-height:1;color:var(--c);font-style:normal}
.mu-sector-name{font-size:10.5px;font-weight:500;color:#1A1714;line-height:1.2}
.mu-sector-sig{font-size:8.5px;text-transform:uppercase;letter-spacing:.09em;color:var(--c);font-weight:600}
.mu-sector-legend{display:flex;gap:14px;margin-top:8px;font-size:10px;color:rgba(26,23,20,.45)}
.mu-sector-legend span{display:flex;align-items:center;gap:5px}
.mu-sector-legend i{width:7px;height:7px;display:inline-block}

/* ── Daily briefing ── */
.mu-daily-briefing{padding:24px 0 20px;border-bottom:2px solid rgba(201,191,173,.55)}
.mu-db-stress{border-bottom-color:rgba(164,80,47,.45)}
.mu-db-advance{border-bottom-color:rgba(42,107,74,.35)}
.mu-db-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:8px}
.mu-db-title{display:flex;align-items:center;gap:10px}
.mu-db-date{font-size:11px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.45);font-family:var(--mono,monospace)}
.mu-db-badge{font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:3px 8px;background:rgba(26,23,20,.07);color:rgba(26,23,20,.55)}
.mu-db-stress .mu-db-badge{background:rgba(164,80,47,.1);color:#A4502F}
.mu-db-advance .mu-db-badge{background:rgba(42,107,74,.1);color:#2a6b4a}
.mu-db-phase{font-size:9.5px;color:rgba(26,23,20,.38);font-family:var(--mono,monospace)}
.mu-db-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;border:1px solid rgba(201,191,173,.45);margin-bottom:18px}
.mu-db-metric{padding:10px 14px;border-right:1px solid rgba(201,191,173,.38)}
.mu-db-metric:last-child{border-right:none}
.mu-db-metric-label{display:block;font-size:8.5px;text-transform:uppercase;letter-spacing:.1em;color:rgba(26,23,20,.38);margin-bottom:4px;font-family:var(--mono,monospace)}
b.mu-db-metric-val{display:block;font-size:20px;font-weight:500;letter-spacing:-.03em;line-height:1;margin-bottom:3px;color:#1A1714}
.mu-db-metric-sub{font-size:10px;letter-spacing:.04em}
.mu-db-body{display:grid;grid-template-columns:1.1fr .9fr;gap:24px}
.mu-db-col-label{font-size:8.5px;text-transform:uppercase;letter-spacing:.13em;font-weight:600;color:rgba(26,23,20,.4);margin-bottom:8px;font-family:var(--mono,monospace)}
.mu-db-col p{font-size:13.5px;line-height:1.6;color:rgba(26,23,20,.72);margin:0 0 8px}
.mu-db-col p:last-child{margin-bottom:0}
.mu-db-strat p{font-size:13px;line-height:1.58;color:rgba(26,23,20,.68)}
@media(max-width:900px){.mu-db-strip{grid-template-columns:repeat(3,1fr)}.mu-db-body{grid-template-columns:1fr}}
@media(max-width:560px){.mu-db-strip{grid-template-columns:1fr 1fr}}
/* ── Signal bar (regime header) ── */
.mu-sigbar{display:flex;align-items:center;gap:12px;margin-top:14px}
.mu-sigbar-dots{display:flex;gap:5px;align-items:center}
.mu-sdot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.mu-sigbar-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(26,23,20,.38);font-family:var(--mono,monospace)}
/* ── Tension + gates block ── */
.mu-tension-block{display:grid;grid-template-columns:1fr 1fr 1.1fr;gap:0;border-bottom:1px solid rgba(201,191,173,.45);padding:20px 0}
.mu-tension-col{padding-right:20px;border-right:1px solid rgba(201,191,173,.38);margin-right:0}
.mu-tension-col:last-child{border-right:none;padding-right:0;padding-left:20px}
.mu-gates-col{padding-left:20px!important;padding-right:0}
.mu-tension-head{font-size:9px;text-transform:uppercase;letter-spacing:.13em;font-weight:600;margin-bottom:12px;font-family:var(--mono,monospace)}
.mu-tension-head.mu-good{color:#2a6b4a}
.mu-tension-head.mu-bad{color:#A4502F}
.mu-tension-head{color:rgba(26,23,20,.45)}
.mu-tension-head small{display:block;font-size:9px;font-weight:400;margin-top:2px;color:rgba(26,23,20,.38);text-transform:none;letter-spacing:0}
.mu-tension-row{display:grid;grid-template-columns:90px minmax(72px,auto) 1fr;gap:6px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(201,191,173,.18)}
.mu-tension-row:last-child{border-bottom:none}
.mu-tension-name{font-size:11px;font-weight:500;color:rgba(26,23,20,.7)}
.mu-tension-val{font-size:12px;font-weight:600;font-family:var(--mono,monospace);color:rgba(26,23,20,.8)}
.mu-tension-sub{font-size:10px;letter-spacing:.04em}
.mu-gate-row{display:grid;grid-template-columns:90px 52px 52px 16px 1fr;gap:5px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(201,191,173,.18)}
.mu-gate-row:last-child{border-bottom:none}
.mu-gate-name{font-size:11px;font-weight:500;color:rgba(26,23,20,.7)}
.mu-gate-cur{font-size:12px;font-weight:600;font-family:var(--mono,monospace);color:rgba(26,23,20,.8)}
.mu-gate-tgt{font-size:10px;color:rgba(26,23,20,.4)}
.mu-gate-icon{font-size:12px;font-weight:700;text-align:center}
.mu-gate-note{font-size:10px;color:rgba(26,23,20,.4)}
@media(max-width:960px){.mu-tension-block{grid-template-columns:1fr 1fr}.mu-gates-col{grid-column:1/-1;border-top:1px solid rgba(201,191,173,.38);padding-top:14px;margin-top:10px;padding-left:0!important;border-right:none}}
@media(max-width:640px){.mu-tension-block{grid-template-columns:1fr}}
/* ── Phase bridge ── */
.mu-phase-bridge{padding:20px 0;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-pb-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.35);margin-bottom:10px;font-family:var(--mono,monospace)}
.mu-pb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:0;border:1px solid rgba(201,191,173,.45)}
.mu-pb-col{padding:14px 16px;border-right:1px solid rgba(201,191,173,.38)}
.mu-pb-col:last-child{border-right:none}
.mu-pb-aligned{background:rgba(42,107,74,.03)}
.mu-pb-exposed{background:rgba(164,80,47,.04)}
.mu-pb-building{background:rgba(138,106,44,.03)}
.mu-pb-head{display:flex;align-items:center;gap:12px;margin-bottom:10px;padding-bottom:10px;border-bottom:1px solid rgba(201,191,173,.35)}
.mu-pb-count{font-size:32px;font-weight:500;letter-spacing:-.05em;line-height:1;color:rgba(26,23,20,.28)}
.mu-pb-head b{display:block;font-size:12px;font-weight:600;margin-bottom:2px}
.mu-pb-head small{display:block;color:rgba(26,23,20,.42);font-size:10px}
.mu-pb-aligned .mu-pb-head b{color:#2a6b4a}
.mu-pb-exposed .mu-pb-head b{color:#A4502F}
.mu-pb-building .mu-pb-head b{color:#8a6a2c}
.mu-pb-row{display:grid;grid-template-columns:44px 1fr auto;gap:6px;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(201,191,173,.18)}
.mu-pb-row:last-child{border-bottom:none}
.mu-pb-ticker{font-size:13px;font-weight:600;letter-spacing:.01em}
.mu-pb-sig{font-size:9.5px;text-transform:uppercase;letter-spacing:.06em}
.mu-pb-perf{font-size:11px;font-weight:500;font-family:var(--mono,monospace);white-space:nowrap}
@media(max-width:680px){.mu-pb-grid{grid-template-columns:1fr}}
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
/* ── Axis evidence (Why Phase C) ── */
.mu-axis-block{padding:20px 0;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-axis-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:16px}
.mu-axis-title{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.4);font-weight:600;font-family:var(--mono,monospace)}
.mu-axis-note-head{font-size:10.5px;color:rgba(164,80,47,.7)}
.mu-axis-list{display:flex;flex-direction:column;gap:9px}
.mu-axis-row{display:grid;grid-template-columns:130px 1fr 34px 1fr;gap:8px;align-items:center}
.mu-axis-label{font-size:11px;font-weight:500;color:rgba(26,23,20,.7)}
.mu-axis-bar-track{height:5px;background:rgba(201,191,173,.25)}
.mu-axis-bar-fill{height:100%}
.mu-axis-score-num{font-size:11px;font-weight:600;font-family:var(--mono,monospace);text-align:right}
.mu-axis-read{font-size:10.5px;color:rgba(26,23,20,.5);line-height:1.3}
.mu-axis-tension{font-size:12.5px;color:rgba(26,23,20,.65);margin:14px 0 0;padding:10px 14px;border-left:2.5px solid rgba(164,80,47,.45);background:rgba(164,80,47,.04);line-height:1.5}
@media(max-width:700px){.mu-axis-row{grid-template-columns:90px 1fr 28px}.mu-axis-read{display:none}}
/* ── Phase C history ── */
.mu-phase-history{padding:20px 0;border-bottom:1px solid rgba(201,191,173,.45)}
.mu-ph-head{display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.mu-ph-title{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.4);font-weight:600;font-family:var(--mono,monospace)}
.mu-ph-sub{font-size:10.5px;color:rgba(26,23,20,.42)}
.mu-ph-grid{display:grid;grid-template-columns:1fr 1fr;gap:0;border:1px solid rgba(201,191,173,.45)}
.mu-ph-item{padding:16px 18px;border-right:1px solid rgba(201,191,173,.38)}
.mu-ph-item:last-child{border-right:none}
.mu-ph-period{font-size:16px;font-weight:600;letter-spacing:-.03em;color:#1A1714;margin-bottom:8px}
.mu-ph-dur{font-size:11px;font-weight:400;color:rgba(26,23,20,.42);margin-left:6px;letter-spacing:0}
.mu-ph-item p{font-size:12px;color:rgba(26,23,20,.6);margin:0 0 5px;line-height:1.5}
.mu-ph-item p b{color:rgba(26,23,20,.75)}
.mu-ph-today{color:#2a6b4a!important}
@media(max-width:700px){.mu-ph-grid{grid-template-columns:1fr}.mu-ph-item{border-right:none;border-bottom:1px solid rgba(201,191,173,.38)}.mu-ph-item:last-child{border-bottom:none}}
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

// ── Axis evidence: Why Phase C ────────────────────────────────────────────────
const AXIS_DEFS = [
  { key: 'monetary_axis',         blocking: true  },
  { key: 'liquidity_axis',        blocking: true  },
  { key: 'psychology_axis',       blocking: false },
  { key: 'market_structure_axis', blocking: false },
  { key: 'valuation_axis',        blocking: false },
];
const eggAxis = egg.axis || {};
const axisList = AXIS_DEFS.map(d => ({ ...eggAxis[d.key], blocking: d.blocking })).filter(a => a && a.label);

function axisColor(score, blocking) {
  if (blocking) return score < 40 ? '#A4502F' : score < 60 ? '#8a6a2c' : '#2a6b4a';
  return score >= 65 ? '#2a6b4a' : score >= 45 ? '#8a6a2c' : '#A4502F';
}

const blockingFail = axisList.filter(a => a.blocking && (num(a.score) ?? 50) < 60).length;

const axisEvidenceHtml = axisList.length > 0 ? `<div class="mu-axis-block">
  <div class="mu-axis-head">
    <span class="mu-axis-title">Why Phase ${phaseCode} — the evidence</span>
    <span class="mu-axis-note-head">${blockingFail} of 2 monetary axes below Phase D threshold</span>
  </div>
  <div class="mu-axis-list">
    ${axisList.map(ax => {
      const score = num(ax.score) ?? 50;
      const color = axisColor(score, ax.blocking);
      const blockNote = ax.blocking && score < 60 ? ' · blocking Phase D' : '';
      return `<div class="mu-axis-row">
        <div class="mu-axis-label">${esc(ax.label)}</div>
        <div class="mu-axis-bar-track"><div class="mu-axis-bar-fill" style="width:${score}%;background:${color}"></div></div>
        <div class="mu-axis-score-num" style="color:${color}">${score}</div>
        <div class="mu-axis-read">${esc(ax.read || '')}${esc(blockNote)}</div>
      </div>`;
    }).join('')}
  </div>
  <p class="mu-axis-tension">The tension: Market Structure (${num(eggAxis.market_structure_axis?.score) ?? '—'}/100) has moved toward Phase D — price held above the 200D. Monetary (${num(eggAxis.monetary_axis?.score) ?? '—'}/100) and Liquidity (${num(eggAxis.liquidity_axis?.score) ?? '—'}/100) have not. That gap is Phase C.</p>
</div>` : '';

// ── Historical Phase C reference ──────────────────────────────────────────────
const PHASE_C_PERIODS = [
  {
    period: '2019 Q1–Q2',
    duration: '4 months',
    context: 'Post-2018 Q4 selloff. Fed had hiked 9 times and then signaled a pause.',
    resolved: 'Phase D unlocked when Fed pivoted — first rate cut signal in July 2019 broke the stall.',
    pattern: 'SPX consolidated above 200D for months, then broke higher once cut narrative solidified.',
    today: 'Same rate pressure dynamic: Fed has begun cutting but 10Y remains elevated above 4.2%.',
  },
  {
    period: '2023 H2',
    duration: '3 months',
    context: 'Post-regional bank stress. Inflation moderating but Fed still restrictive at 5.25%.',
    resolved: 'Phase D unlocked when market priced in 2024 cuts — 10Y peaked at ~5% in October 2023.',
    pattern: 'SPX tested 200D twice and held both times. Rally began when rate expectations turned.',
    today: 'Same resolution mechanism: watch for 10Y sustained move below 4.0% and VIX below 15.',
  },
];

const historicalPhaseCHtml = `<div class="mu-phase-history">
  <div class="mu-ph-head">
    <span class="mu-ph-title">When we were here before — Phase C reference periods</span>
    <span class="mu-ph-sub">Both resolved into Phase D when monetary conditions eased</span>
  </div>
  <div class="mu-ph-grid">
    ${PHASE_C_PERIODS.map(h => `<div class="mu-ph-item">
      <div class="mu-ph-period">${esc(h.period)} <span class="mu-ph-dur">${esc(h.duration)}</span></div>
      <p>${esc(h.context)}</p>
      <p><b>Resolved:</b> ${esc(h.resolved)}</p>
      <p><b>Pattern:</b> ${esc(h.pattern)}</p>
      <p class="mu-ph-today"><b>Today:</b> ${esc(h.today)}</p>
    </div>`).join('')}
  </div>
</div>`;

// ── Assemble section ──────────────────────────────────────────────────────────

const section = `<section id="decision-brief-section" class="macro-unified">
<div class="mu-wrap">

  <!-- 0. Decision command: answer first, framework second -->
  <div class="mu-command-center">
    <div class="mu-command-copy">
      <p class="mu-command-eyebrow">Today&apos;s action state - decision first</p>
      <h2>Wait for confirmation</h2>
      <p>${changeRule}</p>
    </div>
    <div class="mu-command-grid">
      <article class="mu-command-card mu-command-primary">
        <span>Posture</span>
        <b>${action}</b>
        <small>${stressType}</small>
      </article>
      <article class="mu-command-card mu-command-add">
        <span>Add review</span>
        <b>${addZoneStr}</b>
        <small>S&amp;P 500 pullback zone</small>
      </article>
      <article class="mu-command-card mu-command-trim">
        <span>No-chase / trim</span>
        <b>${trimZoneStr}</b>
        <small>Rebalance risk here</small>
      </article>
      <article class="mu-command-card mu-command-defense">
        <span>Defend below</span>
        <b>${defStr}</b>
        <small>${esc(riskRule.split('.')[0])}</small>
      </article>
    </div>
  </div>

  <!-- 1. Regime header: diagnosis anchor -->
  <div class="mu-regime">
    <div>
      <p class="mu-phase-eyebrow">Market permission - Phase ${phaseCode} - ${diagLabel}</p>
      <h2 class="mu-phase-title">Why this is not a broad add signal</h2>
      ${signalBarHtml}
      <div class="mu-action">
        <span>Capital action</span>
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

  <!-- 2. Regime framework -->
  <div class="mu-regime-row">${regimeCol}</div>
  <!-- 2b. Rate cycle (open by default) -->
  <details class="mu-cycle-arc-det" open><summary class="mu-arc-sum">Cycle position · Phase C · Verification</summary><div class="mu-cycle-arc-col">${cycleHtml}</div></details>

  <!-- 3. Why Phase C: axis evidence -->
  ${axisEvidenceHtml}

  <!-- 4. What unlocks Phase D: forward triggers -->
  ${tensionGatesHtml}

  <!-- 5. When we were here before: historical Phase C reference -->
  ${historicalPhaseCHtml}

  <!-- 6. SPX chart: price confirmation -->
  <div class="mu-unified-chart-block">
    <div class="mu-chart-head">
      <h3>S&amp;P 500 — price confirmation · add/trim/defense zones</h3>
      <span>Above 200D · consolidating · consistent with Phase C thesis</span>
    </div>
    ${unifiedChart}
  </div>

  <!-- 7. Holdings alignment with phase -->
  <details class="mu-pb-det"><summary class="mu-pb-sum">Portfolio alignment · ${allHoldings.length} positions</summary>${phaseBridge}</details>

  <!-- 8. Today's session read -->
  ${dailyBriefingHtml}

  <!-- 9. Capital action zones -->
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

  <!-- 10. Deep research: collapsed -->
  <details class="mu-details">
    <summary>Full analysis — 2022 vs 2025 comparison, historical analogs, decision brief</summary>
    <div class="mu-details-body">
      ${bearComparisonChart ? `<div class="mu-detail-group">
        <h4>2022 bear vs 2025 correction — normalized from peak</h4>
        <p style="font-size:12px;color:rgba(26,23,20,.55);margin:0 0 12px;line-height:1.5">Both anchored at their respective peaks, normalized to 0. Shows trajectory depth relative to 2022. <em>Note: different causal regimes</em> — 2022 was Fed-driven structural tightening; 2025 was tariff/sentiment shock with a different resolution mechanism. Illustrative, not predictive.</p>
        ${bearComparisonChart}
      </div>` : ''}
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

// macro-unified is always first — find the earliest existing section after <header>
const headerEnd = html.indexOf('</header>');
const firstSectionAfterHeader = html.indexOf('<section', headerEnd >= 0 ? headerEnd : 0);
const insertPos = firstSectionAfterHeader >= 0 ? firstSectionAfterHeader : (findPos(html, 'operational-chart-section') || -1);
html = insertPos >= 0
  ? html.slice(0, insertPos) + section + html.slice(insertPos)
  : html.slice(0, html.lastIndexOf('</main>')) + section + html.slice(html.lastIndexOf('</main>'));

fs.writeFileSync(indexPath, html);
if (!html.includes('id="decision-brief-section"')) throw new Error('injection failed');
console.log(`injected canonical macro section (decision command + charts + scorecard + cycle) into ${path.relative(root, indexPath)}`);
