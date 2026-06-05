'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '../../..');
const CANDLE_DIR = path.join(ROOT, 'data', 'market-candles');

// ── helpers ──────────────────────────────────────────────────────────────────
const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = v => Array.isArray(v) ? v : [];
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const fmt = (v, d = 1) => num(v) === null ? '—'
  : num(v).toLocaleString(undefined, { maximumFractionDigits: d });
const usd = v => num(v) !== null && num(v) > 0 ? `$${fmt(v, 2)}` : '—';
const pct = v => num(v) === null ? '—'
  : (num(v) >= 0 ? '+' : '') + num(v).toFixed(1) + '%';

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function loadCandles(ticker) {
  const p    = path.join(CANDLE_DIR, `${ticker}.json`);
  const data = readJson(p, null);
  if (!data?.candles) return [];
  return data.candles.map(c => ({
    date:   c.time || c.date || '',
    open:   Number(c.open),
    high:   Number(c.high),
    low:    Number(c.low),
    close:  Number(c.close),
    volume: Number(c.volume || 0),
  })).filter(c => Number.isFinite(c.close) && c.close > 0);
}

// ── SVG candlestick chart ────────────────────────────────────────────────────
const W = 600, H = 200;
const ML = 50, MR = 8, MT = 10, MB = 28;
const CW = W - ML - MR;   // 542
const CH = H - MT - MB;   // 162

function buildMA(candles, period) {
  const out = new Array(candles.length).fill(null);
  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    out[i] = sum / period;
  }
  return out;
}

function buildCandleChart(h) {
  const ticker  = String(h.ticker || '').toUpperCase();
  const allCdls = loadCandles(ticker);
  const candles = allCdls.slice(-90);
  if (!candles.length) return buildFallbackChart(h);

  const ma50arr  = buildMA(candles, Math.min(50, candles.length));
  const ma200arr = buildMA(candles, Math.min(200, candles.length));

  // price range — include zone levels for sensible scale
  const zonePrices = [
    h.buy_zone?.low, h.buy_zone?.high,
    h.trim_zone?.low, h.trim_zone?.high,
    h.stop, h.trigger,
  ].filter(v => v !== null && v !== undefined && Number.isFinite(Number(v))).map(Number);

  const candlePrices = candles.flatMap(c => [c.high, c.low]);
  const allPrices    = [...candlePrices, ...zonePrices];
  const rawMin = Math.min(...allPrices);
  const rawMax = Math.max(...allPrices);
  const pad    = (rawMax - rawMin) * 0.08 || rawMax * 0.05;
  const pMin   = rawMin - pad;
  const pMax   = rawMax + pad;

  const xScale  = i  => ML + (i + 0.5) * (CW / candles.length);
  const yScale  = p  => MT + CH - ((Number(p) - pMin) / (pMax - pMin)) * CH;
  const candleW = Math.max(1, (CW / candles.length) * 0.7);

  // ── candles ────────────────────────────────────────────────────────────────
  let candleSvg = '';
  for (let i = 0; i < candles.length; i++) {
    const c       = candles[i];
    const x       = xScale(i);
    const isGreen = c.close >= c.open;
    const fill    = isGreen ? 'rgba(42,107,74,.75)'  : 'rgba(164,80,47,.7)';
    const wStroke = isGreen ? 'rgba(42,107,74,.6)'   : 'rgba(164,80,47,.5)';
    const bodyTop = yScale(Math.max(c.open, c.close));
    const bodyBot = yScale(Math.min(c.open, c.close));
    const bodyH   = Math.max(1, bodyBot - bodyTop);
    const wickTop = yScale(c.high);
    const wickBot = yScale(c.low);
    candleSvg += `<line x1="${x.toFixed(1)}" y1="${wickTop.toFixed(1)}" x2="${x.toFixed(1)}" y2="${wickBot.toFixed(1)}" stroke="${wStroke}" stroke-width="1"/>`;
    candleSvg += `<rect x="${(x - candleW / 2).toFixed(1)}" y="${bodyTop.toFixed(1)}" width="${candleW.toFixed(1)}" height="${bodyH.toFixed(1)}" fill="${fill}" rx="0.5"/>`;
  }

  // ── zone bands ─────────────────────────────────────────────────────────────
  let zoneBands = '';

  // Stop line
  if (h.stop !== null && h.stop !== undefined && Number.isFinite(h.stop)) {
    const sy = yScale(h.stop);
    if (sy >= MT - 2 && sy <= MT + CH + 2) {
      zoneBands += `<line x1="${ML}" y1="${sy.toFixed(1)}" x2="${W - MR}" y2="${sy.toFixed(1)}" stroke="rgba(164,80,47,.55)" stroke-width="1" stroke-dasharray="4 3"/>`;
      zoneBands += `<text x="${ML + 4}" y="${(sy - 3).toFixed(1)}" font-size="8" fill="rgba(164,80,47,.75)">STOP $${fmt(h.stop, 2)}</text>`;
    }
  }

  // Buy zone band (only if has_buy_zone)
  if (h.has_buy_zone && h.buy_zone) {
    const by1 = yScale(h.buy_zone.high);
    const by2 = yScale(h.buy_zone.low);
    const bh  = by2 - by1;
    if (bh > 0) {
      zoneBands += `<rect x="${ML}" y="${by1.toFixed(1)}" width="${CW}" height="${bh.toFixed(1)}" fill="rgba(42,107,74,.1)" stroke="rgba(42,107,74,.3)" stroke-width="1"/>`;
    }
  }

  // Trim zone band
  if (h.trim_zone) {
    const ty1 = yScale(h.trim_zone.high);
    const ty2 = yScale(h.trim_zone.low);
    const th  = ty2 - ty1;
    if (th > 0) {
      zoneBands += `<rect x="${ML}" y="${ty1.toFixed(1)}" width="${CW}" height="${th.toFixed(1)}" fill="rgba(138,106,44,.1)" stroke="rgba(138,106,44,.3)" stroke-width="1"/>`;
    }
  }

  // Trigger line (200D MA or key level)
  if (h.trigger !== null && h.trigger !== undefined && Number.isFinite(h.trigger)) {
    const ty = yScale(h.trigger);
    if (ty >= MT - 4 && ty <= MT + CH + 4) {
      const label = h.trigger_label ? esc(h.trigger_label.toUpperCase()) : '200D';
      zoneBands += `<line x1="${ML}" y1="${ty.toFixed(1)}" x2="${W - MR}" y2="${ty.toFixed(1)}" stroke="rgba(77,111,145,.5)" stroke-width="1.2" stroke-dasharray="6 3"/>`;
      zoneBands += `<text x="${ML + 4}" y="${(ty - 3).toFixed(1)}" font-size="8" fill="rgba(77,111,145,.85)">${label}</text>`;
    }
  }

  // Current price line
  const cy = yScale(h.current);
  zoneBands += `<line x1="${ML}" y1="${cy.toFixed(1)}" x2="${W - MR}" y2="${cy.toFixed(1)}" stroke="rgba(26,23,20,.35)" stroke-width="1" stroke-dasharray="3 3"/>`;
  zoneBands += `<text x="${(W - MR - 2).toFixed(1)}" y="${(cy - 3).toFixed(1)}" font-size="8" fill="rgba(26,23,20,.65)" text-anchor="end">$${fmt(h.current, 2)}</text>`;

  // ── MA lines ───────────────────────────────────────────────────────────────
  const maPath = (maArr, stroke, sw) => {
    let d = '';
    for (let i = 0; i < maArr.length; i++) {
      if (maArr[i] === null) continue;
      const x = xScale(i).toFixed(1);
      const y = yScale(maArr[i]).toFixed(1);
      d += d ? ` L${x},${y}` : `M${x},${y}`;
    }
    return d ? `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round"/>` : '';
  };
  const maLines50  = maPath(ma50arr,  '#8a6a2c', 1.2);
  const maLines200 = maPath(ma200arr, '#4d6f91', 1.6);

  // ── price grid ─────────────────────────────────────────────────────────────
  let grid = '';
  const gridCount = 4;
  for (let i = 0; i <= gridCount; i++) {
    const price = pMin + (pMax - pMin) * (i / gridCount);
    const gy    = yScale(price);
    if (gy < MT || gy > MT + CH) continue;
    grid += `<line x1="${ML}" y1="${gy.toFixed(1)}" x2="${W - MR}" y2="${gy.toFixed(1)}" stroke="rgba(44,42,37,.07)" stroke-width="0.8"/>`;
    grid += `<text x="${(ML - 4).toFixed(1)}" y="${(gy + 3.5).toFixed(1)}" font-size="9" fill="rgba(44,42,37,.45)" text-anchor="end">$${fmt(price, 0)}</text>`;
  }

  // ── date axis ──────────────────────────────────────────────────────────────
  let dateAxis = '';
  const dateCount = 3;
  for (let k = 0; k <= dateCount; k++) {
    const idx   = Math.round((k / dateCount) * (candles.length - 1));
    const c     = candles[idx];
    if (!c) continue;
    const x     = xScale(idx);
    const label = c.date ? String(c.date).slice(5, 10) : '';
    dateAxis += `<text x="${x.toFixed(1)}" y="${(H - 4).toFixed(1)}" font-size="8" fill="rgba(44,42,37,.45)" text-anchor="middle">${esc(label)}</text>`;
  }

  // ── legend (below chart area) ──────────────────────────────────────────────
  const legendY = H - MB + 4;
  let legend = '';
  legend += `<line x1="${ML}" y1="${legendY}" x2="${ML + 14}" y2="${legendY}" stroke="#8a6a2c" stroke-width="1.5"/>`;
  legend += `<text x="${ML + 17}" y="${legendY + 3.5}" font-size="8" fill="rgba(44,42,37,.55)">MA50</text>`;
  legend += `<line x1="${ML + 48}" y1="${legendY}" x2="${ML + 62}" y2="${legendY}" stroke="#4d6f91" stroke-width="1.8"/>`;
  legend += `<text x="${ML + 65}" y="${legendY + 3.5}" font-size="8" fill="rgba(44,42,37,.55)">MA200</text>`;
  if (h.has_buy_zone) {
    legend += `<rect x="${ML + 110}" y="${legendY - 5}" width="12" height="8" fill="rgba(42,107,74,.15)" stroke="rgba(42,107,74,.4)" stroke-width="0.8"/>`;
    legend += `<text x="${ML + 125}" y="${legendY + 3.5}" font-size="8" fill="rgba(44,42,37,.55)">Buy zone</text>`;
  }
  if (h.trim_zone) {
    const lx = h.has_buy_zone ? ML + 180 : ML + 110;
    legend += `<rect x="${lx}" y="${legendY - 5}" width="12" height="8" fill="rgba(138,106,44,.15)" stroke="rgba(138,106,44,.4)" stroke-width="0.8"/>`;
    legend += `<text x="${lx + 15}" y="${legendY + 3.5}" font-size="8" fill="rgba(44,42,37,.55)">Trim zone</text>`;
  }

  return `<svg class="mu-holding-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" aria-label="${esc(ticker)} 90-day candlestick chart">
  <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(251,250,246,.04)" rx="4"/>
  ${grid}${zoneBands}${candleSvg}${maLines50}${maLines200}${dateAxis}${legend}
</svg>`;
}

function buildFallbackChart(h) {
  return `<svg class="mu-holding-chart" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <rect x="0" y="0" width="${W}" height="${H}" fill="rgba(251,250,246,.06)" rx="4"/>
  <text x="${W / 2}" y="${H / 2 - 8}" font-size="13" fill="rgba(44,42,37,.4)" text-anchor="middle">No candle data</text>
  <text x="${W / 2}" y="${H / 2 + 12}" font-size="20" fill="rgba(44,42,37,.55)" text-anchor="middle" font-weight="600">$${fmt(h.current, 2)}</text>
</svg>`;
}

// ── verdict ──────────────────────────────────────────────────────────────────
function deriveVerdict(h) {
  if (h.exit_only) {
    return { text: 'Leveraged decay instrument — manage by thesis, not by price zone', cls: 'warn' };
  }
  const c = num(h.current);
  if (h.has_buy_zone && h.buy_zone && c !== null) {
    if (c <= h.buy_zone.high && c >= h.buy_zone.low) {
      return { text: 'Price is inside buy zone — watch for confirming tape action before adding', cls: 'good' };
    }
    if (c < h.buy_zone.low) {
      return { text: `Below buy zone — ${h.zone_rationale || 'monitor for support'}`, cls: 'warn' };
    }
  }
  if (h.trim_zone && c !== null) {
    if (c >= h.trim_zone.low && c <= h.trim_zone.high) {
      return { text: 'Price is in trim zone — consider reducing on strength', cls: 'warn' };
    }
    if (c > h.trim_zone.high) {
      return { text: 'Above trim zone — extended; hold with discipline or trim into strength', cls: 'warn' };
    }
  }
  if (h.trigger !== null && c !== null && !h.above_ma200) {
    const dist = (((h.trigger - c) / c) * 100).toFixed(1);
    return { text: `${h.trigger_label || 'Key level'} at $${fmt(h.trigger, 2)} — ${dist}% above. Hold position, wait for 200D reclaim.`, cls: '' };
  }
  if (h.above_ma200) {
    return { text: 'Above 200D MA — healthy trend posture. Buy zone is near 200D support.', cls: 'good' };
  }
  return { text: 'Outside all defined zones — hold current position, monitor thesis', cls: '' };
}

function signalCls(signal) {
  const s = String(signal || '').toUpperCase();
  if (/BUY|ADD/.test(s)) return 'good';
  if (/SELL|EXIT|STOP/.test(s)) return 'bad';
  if (/WATCH|TRIM|REVIEW/.test(s)) return 'warn';
  return '';
}

// ── card ─────────────────────────────────────────────────────────────────────
function renderHoldingCard(h) {
  const ticker   = String(h.ticker || '').toUpperCase();
  const signal   = String(h.signal || 'HOLD').toUpperCase();
  const sigCls   = signalCls(signal);
  const dayV     = num(h.dayChangePct);
  const daySign  = dayV !== null && dayV >= 0 ? '+' : '';
  const dayColor = dayV !== null && dayV >= 0 ? 'var(--green)' : 'var(--red)';
  const perf3m   = pct(h.perf3mPct);
  const perf3mColor = num(h.perf3mPct) !== null && num(h.perf3mPct) >= 0 ? 'var(--green)' : 'var(--red)';
  const role     = esc(h.role || '');
  const score    = h.healthScore !== null && h.healthScore !== undefined ? h.healthScore : null;
  const scoreCls = score !== null ? (score >= 65 ? 'good' : score >= 45 ? 'warn' : 'bad') : '';

  const svgChart = buildCandleChart(h);

  // Levels strip
  let levelsHtml = '';
  if (h.exit_only) {
    const distLabel = h.distance_from_200d !== null && h.distance_from_200d !== undefined
      ? `${h.distance_from_200d > 0 ? '+' : ''}${h.distance_from_200d}% from 200D`
      : '—';
    levelsHtml = `<div class="mu-levels-strip">
      <div class="mu-level-cell">
        <span>NOW</span>
        <b>${usd(h.current)}</b>
        <small style="color:${dayColor}">${daySign}${fmt(dayV, 2)}%</small>
      </div>
      <div class="mu-level-cell">
        <span>MA200 (distant)</span>
        <b>${usd(h.ma200)}</b>
        <small>${esc(distLabel)}</small>
      </div>
      <div class="mu-level-cell">
        <span>90D LOW</span>
        <b>${usd(h.low90)}</b>
      </div>
      <div class="mu-level-cell mu-level-exit">
        <span>EXIT TRIGGER</span>
        <b>Phase shift</b>
        <small>Leveraged decay</small>
      </div>
    </div>`;
  } else {
    levelsHtml = `<div class="mu-levels-strip">
      <div class="mu-level-cell">
        <span>NOW</span>
        <b>${usd(h.current)}</b>
        <small style="color:${dayColor}">${daySign}${fmt(dayV, 2)}%</small>
      </div>
      <div class="mu-level-cell ${h.has_buy_zone ? 'mu-level-buy' : ''}">
        <span>BUY ZONE</span>
        <b>${h.buy_zone ? `${usd(h.buy_zone.low)}–${usd(h.buy_zone.high)}` : '—'}</b>
        <small>${h.zone_rationale ? esc(h.zone_rationale.split('—')[0].trim()) : ''}</small>
      </div>
      <div class="mu-level-cell mu-level-trim">
        <span>TRIM</span>
        <b>${h.trim_zone ? `${usd(h.trim_zone.low)}–${usd(h.trim_zone.high)}` : '—'}</b>
      </div>
      <div class="mu-level-cell mu-level-stop">
        <span>STOP</span>
        <b>${usd(h.stop)}</b>
      </div>
    </div>`;
  }

  const verdict    = deriveVerdict(h);
  const verdictHtml = `<div class="mu-posture-row ${esc(verdict.cls)}"><b>${esc(verdict.text)}</b></div>`;

  const thesisHtml = h.thesis
    ? `<div class="mu-thesis-row"><span>Thesis</span><p>${esc(h.thesis)}</p></div>`
    : '';
  const watchHtml  = h.watch
    ? `<div class="mu-thesis-row mu-invalidation"><span>Watch</span><p>${esc(h.watch)}</p></div>`
    : '';

  const ma50chk  = `<span class="mu-ma-check ${h.above_ma50  ? 'pass' : 'fail'}">${h.above_ma50  ? '✓' : '✗'} MA50</span>`;
  const ma200chk = `<span class="mu-ma-check ${h.above_ma200 ? 'pass' : 'fail'}">${h.above_ma200 ? '✓' : '✗'} MA200</span>`;
  const rationale = h.zone_rationale
    ? `<span class="mu-zone-rationale">${esc(h.zone_rationale)}</span>`
    : '';
  const techRow = `<div class="mu-tech-row">${ma50chk}${ma200chk}${rationale}</div>`;

  return `<article class="mu-holding-card" data-ticker="${esc(ticker)}" data-profile="${esc(h.profile)}">
  <div class="mu-card-header">
    <div class="mu-header-left">
      <div class="mu-ticker-row">
        <h3 class="mu-ticker">${esc(ticker)}</h3>
        <span class="mu-signal-badge ${sigCls}">${esc(signal)}</span>
        ${score !== null ? `<span class="mu-health-badge ${scoreCls}">${score}/100</span>` : ''}
      </div>
      <div class="mu-sub-row">
        ${role ? `<span class="mu-role">${role}</span>` : ''}
        <span class="mu-perf3m" style="color:${perf3mColor}">3M ${perf3m}</span>
      </div>
    </div>
    <div class="mu-header-right">
      <div class="mu-price">${usd(h.current)}</div>
      <div class="mu-day-chg" style="color:${dayColor}">${daySign}${fmt(dayV, 2)}%</div>
    </div>
  </div>
  <div class="mu-chart-wrap">${svgChart}</div>
  ${levelsHtml}
  ${verdictHtml}
  ${thesisHtml}
  ${watchHtml}
  ${techRow}
</article>`;
}

// ── section ──────────────────────────────────────────────────────────────────
function renderHoldingsSection({ zoneState, translation, decision, decisionZones }) {
  // Anchored zone path (new system)
  if (decisionZones && Array.isArray(decisionZones.holdings) && decisionZones.holdings.length) {
    const cards = decisionZones.holdings.map(h => renderHoldingCard(h)).join('');
    const asOf  = decisionZones.as_of
      ? new Date(decisionZones.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : '';
    return `<section id="holdings-section" class="panel mu-holdings-section">
  <div class="section-head">
    <div>
      <p class="eyebrow">Holdings</p>
      <h2>Decision chart — position radar</h2>
      <p class="mu-section-desc">Zones anchored to 200D MA &amp; 90D swing levels — not % bands from current price. Each card shows 90-day candles with buy zone, trim zone, and stop.${asOf ? ` Updated ${esc(asOf)}.` : ''}</p>
    </div>
    <a class="button" href="outputs/holding-decision-zones.json">Open artifact</a>
  </div>
  <div class="mu-holdings-stack">${cards}</div>
</section>`;
  }

  // Legacy fallback if decisionZones not provided
  const translationByTicker = buildLookup(translation?.holdings || []);
  const decisionByTicker    = buildLookup(decision || []);
  const zones = arr(zoneState?.zones || []);
  const cards = zones.map(zone => renderZoneCardLegacy(zone, translationByTicker, decisionByTicker)).join('');
  return `<section id="holdings-section" class="panel">
  <div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Price-zone radar</h2></div><a class="button" href="outputs/holding-zone-state.json">Open artifact</a></div>
  <div class="zone-grid">${cards}</div>
</section>`;
}

// ── legacy helpers (kept for fallback) ───────────────────────────────────────
function buildLookup(rows, key = 'ticker') {
  return Object.fromEntries(arr(rows).map(item => [String(item[key] || '').toUpperCase(), item]));
}

function renderZoneCardLegacy(zone, translationByTicker, decisionByTicker) {
  const ticker = String(zone.ticker || '').toUpperCase();
  return `<article class="zone-card"><div class="zone-head"><h3>${esc(ticker)}</h3></div></article>`;
}

// ── style ─────────────────────────────────────────────────────────────────────
function renderHoldingsStyle() {
  return `<style id="holdings-compact-style">
.mu-holdings-section .section-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
.mu-section-desc{max-width:720px;color:var(--muted);font-size:13px;line-height:1.45;margin:5px 0 0}
.mu-holdings-stack{display:flex;flex-direction:column;gap:20px;max-width:960px;margin:18px auto 0}
.mu-holding-card{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.16);padding:18px 18px 14px;overflow:hidden}
.mu-holding-card[data-profile="tactical_risk"]{border-color:rgba(164,80,47,.28);background:rgba(164,80,47,.04)}
.mu-holding-card[data-profile="speculative_verification"]{border-color:rgba(138,106,44,.28);background:rgba(138,106,44,.04)}
.mu-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
.mu-header-left{flex:1;min-width:0}
.mu-header-right{text-align:right;flex-shrink:0}
.mu-ticker-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.mu-ticker{font-size:26px;font-weight:700;margin:0;line-height:1}
.mu-signal-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;padding:3px 7px;border-radius:999px;border:1px solid var(--rule);background:rgba(251,250,246,.12);color:var(--muted)}
.mu-signal-badge.good{border-color:rgba(47,111,78,.4);color:var(--green);background:rgba(47,111,78,.08)}
.mu-signal-badge.bad{border-color:rgba(164,80,47,.4);color:var(--red);background:rgba(164,80,47,.07)}
.mu-signal-badge.warn{border-color:rgba(138,106,44,.4);color:var(--warn);background:rgba(138,106,44,.07)}
.mu-health-badge{display:inline-block;font-size:10px;font-weight:600;padding:3px 7px;border-radius:999px;border:1px solid var(--rule);color:var(--muted)}
.mu-health-badge.good{border-color:rgba(47,111,78,.35);color:var(--green)}
.mu-health-badge.warn{border-color:rgba(138,106,44,.35);color:var(--warn)}
.mu-health-badge.bad{border-color:rgba(164,80,47,.35);color:var(--red)}
.mu-sub-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:5px}
.mu-role{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:320px}
.mu-perf3m{font-size:12px;font-weight:600}
.mu-price{font-size:22px;font-weight:700;line-height:1}
.mu-day-chg{font-size:13px;font-weight:600;margin-top:3px}
.mu-chart-wrap{margin:8px 0 10px;border:1px solid var(--rule);border-radius:10px;overflow:hidden;background:rgba(251,250,246,.06)}
.mu-holding-chart{display:block;width:100%;height:auto;max-height:200px}
.mu-levels-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin:8px 0}
.mu-level-cell{padding:10px 12px;border-right:1px solid var(--rule)}
.mu-level-cell:last-child{border-right:none}
.mu-level-cell>span{display:block;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
.mu-level-cell>b{display:block;font-size:13px;line-height:1.2;overflow-wrap:anywhere}
.mu-level-cell>small{display:block;font-size:10px;color:var(--muted);margin-top:3px;line-height:1.2}
.mu-level-buy{background:rgba(42,107,74,.06)}
.mu-level-buy>b{color:var(--green)}
.mu-level-trim{background:rgba(138,106,44,.05)}
.mu-level-trim>b{color:var(--warn)}
.mu-level-stop{background:rgba(164,80,47,.05)}
.mu-level-stop>b{color:var(--red)}
.mu-level-exit{background:rgba(164,80,47,.06)}
.mu-level-exit>b{color:var(--red)}
.mu-posture-row{border-radius:10px;padding:9px 12px;background:rgba(251,250,246,.10);border:1px solid var(--rule);margin:8px 0}
.mu-posture-row b{font-size:13px;line-height:1.35;font-weight:500}
.mu-posture-row.good{border-color:rgba(47,111,78,.3);background:rgba(47,111,78,.06)}
.mu-posture-row.good b{color:var(--green)}
.mu-posture-row.bad{border-color:rgba(164,80,47,.3);background:rgba(164,80,47,.06)}
.mu-posture-row.bad b{color:var(--red)}
.mu-posture-row.warn{border-color:rgba(138,106,44,.3);background:rgba(138,106,44,.05)}
.mu-posture-row.warn b{color:var(--warn)}
.mu-thesis-row{margin:6px 0;display:flex;gap:10px;align-items:baseline}
.mu-thesis-row>span{flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);min-width:80px}
.mu-thesis-row>p{margin:0;font-size:12px;line-height:1.45;color:var(--muted)}
.mu-invalidation>span{color:rgba(164,80,47,.7)}
.mu-tech-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
.mu-ma-check{font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;border:1px solid var(--rule)}
.mu-ma-check.pass{color:var(--green);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.07)}
.mu-ma-check.fail{color:var(--red);border-color:rgba(164,80,47,.35);background:rgba(164,80,47,.06)}
.mu-zone-rationale{font-size:10px;color:var(--muted);letter-spacing:.02em}
@media(max-width:640px){
  .mu-levels-strip{grid-template-columns:repeat(2,1fr)}
  .mu-level-cell:nth-child(2n){border-right:none}
  .mu-level-cell:nth-child(n+3){border-top:1px solid var(--rule)}
  .mu-ticker{font-size:22px}
  .mu-price{font-size:18px}
}
</style>`;
}

module.exports = { renderHoldingsSection, renderHoldingsStyle };
