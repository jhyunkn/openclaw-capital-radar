'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '../../..');
const CANDLE_DIR = path.join(ROOT, 'data', 'market-candles');

const _fundPath = path.join(ROOT, 'data', 'fundamentals.manual.json');
const _fundMetrics = (() => {
  try { return JSON.parse(fs.readFileSync(_fundPath, 'utf8')).metrics || {}; }
  catch { return {}; }
})();

function computeSubstanceFloor(ticker, livePrice) {
  const f = _fundMetrics[String(ticker).toUpperCase()] || {};
  if (f.notApplicable || !f.forwardPE || !livePrice) return null;
  const eps      = livePrice / f.forwardPE;
  const floor15  = Math.round(eps * 15 * 100) / 100;
  const balloonPct = Math.round(((livePrice - floor15) / floor15) * 1000) / 10;
  const substancePct = Math.round((floor15 / livePrice) * 1000) / 10;
  let cycleRead;
  if (balloonPct < 30)       cycleRead = 'Phase B–C · near floor';
  else if (balloonPct < 70)  cycleRead = 'Phase C · moderate premium';
  else if (balloonPct < 130) cycleRead = 'Phase C–D · expectations priced in';
  else if (balloonPct < 220) cycleRead = 'Phase D · strong growth priced in';
  else                        cycleRead = 'Phase D–E · high hope premium';
  return { floor15, balloonPct, substancePct, cycleRead };
}

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

function loadCandles(ticker, n = 200) {
  const p    = path.join(CANDLE_DIR, `${ticker}.json`);
  const data = readJson(p, null);
  if (!data?.candles) return [];
  return data.candles
    .map(c => ({
      time:   c.time || (c.date ? Math.floor(new Date(c.date).getTime() / 1000) : null),
      open:   Number(c.open),
      high:   Number(c.high),
      low:    Number(c.low),
      close:  Number(c.close),
    }))
    .filter(c => c.time && Number.isFinite(c.close) && c.close > 0)
    .slice(-n);
}

// Compute rolling MA values aligned to candle array
function computeMAValues(candles, period) {
  return candles.map((c, i) => {
    if (i < period - 1) return null;
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
    return { time: c.time, value: sum / period };
  }).filter(Boolean);
}

// Derive zone status for tinting
function deriveZoneStatus(h) {
  if (h.exit_only) return 'exit_only';
  const c = num(h.current);
  if (c === null) return '';
  if (h.has_buy_zone && h.buy_zone) {
    if (c >= h.buy_zone.low && c <= h.buy_zone.high) return 'in_buy_zone';
    if (c < h.buy_zone.low) return 'below_support';
  }
  if (h.trim_zone && c >= h.trim_zone.low) return 'in_trim_zone';
  return 'above_buy_zone';
}

function deriveVerdict(h) {
  const status = deriveZoneStatus(h);
  const c = num(h.current);
  if (h.exit_only) return { text: 'Leveraged decay instrument — no add zone by design. Manage by thesis and phase signal.', cls: 'warn' };
  switch (status) {
    case 'in_buy_zone':
      return { text: `Inside buy zone ${h.buy_zone ? `($${fmt(h.buy_zone.low,2)}–$${fmt(h.buy_zone.high,2)})` : ''} — watch for confirming tape action before adding. ${h.zone_rationale || ''}`, cls: 'good' };
    case 'below_support':
      return { text: `Price has broken below buy zone support ($${fmt(h.buy_zone?.low,2)}) — support is breached. Review thesis before any action.`, cls: 'bad' };
    case 'in_trim_zone':
      return { text: `In trim zone ${h.trim_zone ? `($${fmt(h.trim_zone.low,2)}–$${fmt(h.trim_zone.high,2)})` : ''} — consider reducing into strength.`, cls: 'warn' };
    default:
      if (h.trigger && c) {
        const dist = (((h.trigger - c) / c) * 100).toFixed(1);
        const dir = dist > 0 ? 'above' : 'below';
        return { text: `${h.trigger_label || 'Key level'} $${fmt(h.trigger,2)} is ${Math.abs(dist)}% ${dir}. ${h.zone_rationale || ''}`, cls: '' };
      }
      return { text: `Outside all zones — hold position, monitor thesis.`, cls: '' };
  }
}

function signalCls(signal) {
  const s = String(signal || '').toUpperCase();
  if (/BUY|ADD/.test(s)) return 'good';
  if (/SELL|EXIT|STOP/.test(s)) return 'bad';
  if (/WATCH|TRIM|REVIEW/.test(s)) return 'warn';
  return '';
}

function permissionTone(permission, capitalAllowed, lossMinimizationRequired) {
  const p = String(permission || '').toUpperCase();
  if (capitalAllowed === true || /ADD REVIEW ALLOWED/.test(p)) return 'good';
  if (lossMinimizationRequired === true || /EXIT|TRIM|DEFEND/.test(p)) return 'bad';
  if (/VERIFY|NO ADD|HOLD|WAIT|BLOCK/.test(p)) return 'warn';
  return '';
}

function renderPermissionRow(route = {}) {
  const permission = route.execution_permission || route.route_permission || 'HOLD / VERIFY';
  const tone = permissionTone(permission, route.capital_allowed, route.loss_minimization_required);
  const capitalText = route.capital_allowed === true
    ? 'capital allowed only after add-review gates'
    : 'new capital blocked';
  const blocker = route.permission_blocker || route.route_overlay || route.route_action || 'Require confirmation before changing exposure.';
  return `<div class="mu-permission-row ${tone}">
    <div><span>Zone signal</span><b>${esc(route.zone_status || 'price zone check')}</b></div>
    <div><span>Execution permission</span><b>${esc(permission)}</b></div>
    <div><span>Capital use</span><b>${esc(capitalText)}</b><small>${esc(blocker)}</small></div>
  </div>`;
}

// Zone position bar — SVG showing price context between stop → buy → trim
function buildZoneBar(h) {
  if (h.exit_only) return '';
  const c    = num(h.current);
  const stop = num(h.stop);
  const bl   = num(h.buy_zone?.low);
  const bh   = num(h.buy_zone?.high);
  const tl   = num(h.trim_zone?.low);
  const th   = num(h.trim_zone?.high);
  if (c === null) return '';

  // Determine scale range — from well below stop to well above trim
  const floorRef  = stop ?? (bl ? bl * 0.92 : c * 0.85);
  const ceilRef   = th  ?? (tl ? tl * 1.05 : c * 1.15);
  const lo = Math.min(floorRef * 0.97, c * 0.97);
  const hi = Math.max(ceilRef  * 1.03, c * 1.03);
  const span = hi - lo;
  if (span <= 0) return '';

  const BAR_W = 540, BAR_H = 22, ML = 50, MR = 50;
  const TW = BAR_W - ML - MR;
  const px = v => ML + ((v - lo) / span) * TW;

  let segs = '';
  // Stop → buy_low: danger zone (red-tint)
  if (stop !== null && bl !== null) {
    const x1 = px(stop), x2 = px(bl);
    if (x2 > x1) segs += `<rect x="${x1.toFixed(1)}" y="0" width="${(x2-x1).toFixed(1)}" height="${BAR_H}" fill="rgba(164,80,47,.14)"/>`;
  }
  // Buy zone band (green)
  if (bl !== null && bh !== null) {
    const x1 = px(bl), x2 = px(bh);
    if (x2 > x1) segs += `<rect x="${x1.toFixed(1)}" y="0" width="${(x2-x1).toFixed(1)}" height="${BAR_H}" fill="rgba(42,107,74,.2)" stroke="rgba(42,107,74,.4)" stroke-width="0.8"/>`;
  }
  // Trim zone band (amber)
  if (tl !== null && th !== null) {
    const x1 = px(tl), x2 = px(th);
    if (x2 > x1) segs += `<rect x="${x1.toFixed(1)}" y="0" width="${(x2-x1).toFixed(1)}" height="${BAR_H}" fill="rgba(138,106,44,.18)" stroke="rgba(138,106,44,.4)" stroke-width="0.8"/>`;
  }
  // Stop line
  if (stop !== null) {
    const sx = px(stop);
    segs += `<line x1="${sx.toFixed(1)}" y1="0" x2="${sx.toFixed(1)}" y2="${BAR_H}" stroke="rgba(164,80,47,.6)" stroke-width="1.5"/>`;
    segs += `<text x="${sx.toFixed(1)}" y="${BAR_H+11}" text-anchor="middle" font-size="9" fill="rgba(164,80,47,.7)">STOP</text>`;
    segs += `<text x="${sx.toFixed(1)}" y="${BAR_H+21}" text-anchor="middle" font-size="8" fill="rgba(164,80,47,.55)">$${fmt(stop,2)}</text>`;
  }
  // Buy zone labels
  if (bl !== null && bh !== null) {
    const mid = (px(bl)+px(bh))/2;
    segs += `<text x="${mid.toFixed(1)}" y="${BAR_H+11}" text-anchor="middle" font-size="9" fill="rgba(42,107,74,.8)" font-weight="600">BUY ZONE</text>`;
    segs += `<text x="${mid.toFixed(1)}" y="${BAR_H+21}" text-anchor="middle" font-size="8" fill="rgba(42,107,74,.6)">$${fmt(bl,0)}–$${fmt(bh,0)}</text>`;
  }
  // Trim label
  if (tl !== null) {
    const tx = px(tl);
    segs += `<text x="${tx.toFixed(1)}" y="${BAR_H+11}" text-anchor="middle" font-size="9" fill="rgba(138,106,44,.75)">TRIM</text>`;
    segs += `<text x="${tx.toFixed(1)}" y="${BAR_H+21}" text-anchor="middle" font-size="8" fill="rgba(138,106,44,.6)">$${fmt(tl,0)}+</text>`;
  }
  // Current price dot
  const cx2 = px(c);
  segs += `<circle cx="${cx2.toFixed(1)}" cy="${(BAR_H/2).toFixed(1)}" r="6" fill="rgba(26,23,20,.85)" stroke="#F7F3EB" stroke-width="2"/>`;
  segs += `<text x="${cx2.toFixed(1)}" y="${-6}" text-anchor="middle" font-size="9" fill="rgba(26,23,20,.8)" font-weight="600">$${fmt(c,2)}</text>`;

  return `<svg class="mu-zone-bar-svg" viewBox="0 -14 ${BAR_W} ${BAR_H+50}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">
  <rect x="${ML}" y="0" width="${TW}" height="${BAR_H}" fill="rgba(201,191,173,.12)" rx="3"/>
  ${segs}
</svg>`;
}

// Build LWC payload — 1-year window, clean annotations
function buildLwcPayload(h) {
  const ticker  = String(h.ticker || '').toUpperCase();
  // Load full history for correct MA computation; show last 252 candles (≈1 year)
  const allCdls = loadCandles(ticker, 1300);
  const display = allCdls.slice(-252);
  if (!display.length) return null;

  // MAs computed from full history, filtered to display range
  const allMa50  = computeMAValues(allCdls, Math.min(50,  allCdls.length));
  const allMa200 = computeMAValues(allCdls, Math.min(200, allCdls.length));
  const startTime = display[0].time;
  const ma50Data  = allMa50 .filter(d => d.time >= startTime);
  const ma200Data = allMa200.filter(d => d.time >= startTime);

  const sf = computeSubstanceFloor(ticker, num(h.current));
  return {
    id:       `lwc-${ticker}`,
    candles:  display.map(c => ({ time: c.time, open: c.open, high: c.high, low: c.low, close: c.close })),
    ma50:     ma50Data,
    ma200:    ma200Data,
    // Only the most important levels on chart — no axis label clutter
    zones: {
      hasBuyZone:  h.has_buy_zone || false,
      buyLow:      h.buy_zone?.low  ?? null,
      buyHigh:     h.buy_zone?.high ?? null,
      stop:        h.stop           ?? null,
      floorPrice:  sf?.floor15      ?? null,
    },
  };
}

function renderHoldingCard(h, route = {}) {
  const ticker     = String(h.ticker || '').toUpperCase();
  const signal     = String(h.signal || 'HOLD').toUpperCase();
  const sigCls     = signalCls(signal);
  const dayV       = num(h.dayChangePct);
  const daySign    = dayV !== null && dayV >= 0 ? '+' : '';
  const dayColor   = dayV !== null && dayV >= 0 ? 'var(--green)' : 'var(--red)';
  const perf3m     = pct(h.perf3mPct);
  const perf3mColor = num(h.perf3mPct) !== null && num(h.perf3mPct) >= 0 ? 'var(--green)' : 'var(--red)';
  const score      = h.healthScore ?? null;
  const scoreCls   = score !== null ? (score >= 65 ? 'good' : score >= 45 ? 'warn' : 'bad') : '';
  const zoneStatus = deriveZoneStatus(h);
  const verdict    = deriveVerdict(h);

  const inBuyZoneBadge = zoneStatus === 'in_buy_zone'
    ? `<span class="mu-zone-badge mu-zone-buy">IN BUY ZONE</span>` : '';
  const inTrimBadge = zoneStatus === 'in_trim_zone'
    ? `<span class="mu-zone-badge mu-zone-trim">TRIM ZONE</span>` : '';
  const belowBadge = zoneStatus === 'below_support'
    ? `<span class="mu-zone-badge mu-zone-below">BELOW SUPPORT</span>` : '';
  const exitBadge = zoneStatus === 'exit_only'
    ? `<span class="mu-zone-badge mu-zone-exit">EXIT ONLY</span>` : '';

  const levelsHtml = h.exit_only
    ? `<div class="mu-levels-strip">
        <div class="mu-level-cell"><span>NOW</span><b>${usd(h.current)}</b><small style="color:${dayColor}">${daySign}${fmt(dayV,2)}%</small></div>
        <div class="mu-level-cell"><span>MA200</span><b>${usd(h.ma200)}</b><small>${h.distance_from_200d !== null ? `${h.distance_from_200d > 0 ? '+' : ''}${h.distance_from_200d}% away` : ''}</small></div>
        <div class="mu-level-cell"><span>90D LOW</span><b>${usd(h.low90)}</b></div>
        <div class="mu-level-cell mu-level-exit"><span>ACTION</span><b>Exit review</b><small>No add zone</small></div>
      </div>`
    : `<div class="mu-levels-strip">
        <div class="mu-level-cell"><span>NOW</span><b>${usd(h.current)}</b><small style="color:${dayColor}">${daySign}${fmt(dayV,2)}%</small></div>
        <div class="mu-level-cell ${zoneStatus === 'in_buy_zone' ? 'mu-level-buy mu-level-active' : 'mu-level-buy'}">
          <span>BUY ZONE</span>
          <b>${h.buy_zone ? `${usd(h.buy_zone.low)}–${usd(h.buy_zone.high)}` : '—'}</b>
          <small>${h.zone_rationale ? esc(h.zone_rationale.split('—')[0].trim()) : ''}</small>
        </div>
        <div class="mu-level-cell ${zoneStatus === 'in_trim_zone' ? 'mu-level-trim mu-level-active' : 'mu-level-trim'}">
          <span>TRIM</span>
          <b>${h.trim_zone ? `${usd(h.trim_zone.low)}–${usd(h.trim_zone.high)}` : '—'}</b>
        </div>
        <div class="mu-level-cell mu-level-stop"><span>STOP</span><b>${usd(h.stop)}</b></div>
      </div>`;

  const thesisHtml = h.thesis
    ? `<div class="mu-thesis-row"><span>Thesis</span><p>${esc(h.thesis)}</p></div>` : '';
  const watchHtml = h.watch
    ? `<div class="mu-thesis-row mu-invalidation"><span>Watch</span><p>${esc(h.watch)}</p></div>` : '';

  const ma50chk  = `<span class="mu-ma-check ${h.above_ma50  ? 'pass' : 'fail'}">${h.above_ma50  ? '✓' : '✗'} MA50</span>`;
  const ma200chk = `<span class="mu-ma-check ${h.above_ma200 ? 'pass' : 'fail'}">${h.above_ma200 ? '✓' : '✗'} MA200</span>`;
  const rationale = h.zone_rationale
    ? `<span class="mu-zone-rationale">${esc(h.zone_rationale)}</span>` : '';

  const sf = computeSubstanceFloor(ticker, num(h.current));
  const substanceHtml = sf ? (() => {
    const subW = Math.round(Math.max(2, Math.min(98, sf.substancePct)) * 10) / 10;
    const hopW = Math.round((100 - subW) * 10) / 10;
    return `<div class="mu-substance-strip">
    <div class="mu-substance-bar"><div class="mu-substance-seg mu-sub" style="width:${subW}%"></div><div class="mu-substance-seg mu-hop" style="width:${hopW}%"></div></div>
    <div class="mu-substance-meta">
      <span class="mu-sub-label">Floor <b>$${fmt(sf.floor15,0)}</b> · ${sf.substancePct}% substance</span>
      <span class="mu-hop-label">+${sf.balloonPct}% hope · ${esc(sf.cycleRead)}</span>
    </div>
  </div>`;
  })() : '';

  return `<article class="mu-holding-card" data-ticker="${esc(ticker)}" data-profile="${esc(h.profile)}" data-zone-status="${esc(zoneStatus)}">
  <div class="mu-card-header">
    <div class="mu-header-left">
      <div class="mu-ticker-row">
        <h3 class="mu-ticker">${esc(ticker)}</h3>
        <span class="mu-signal-badge ${sigCls}">${esc(signal)}</span>
        ${score !== null ? `<span class="mu-health-badge ${scoreCls}">${score}/100</span>` : ''}
        ${inBuyZoneBadge}${inTrimBadge}${belowBadge}${exitBadge}
      </div>
      <div class="mu-sub-row">
        ${h.role ? `<span class="mu-role">${esc(h.role)}</span>` : ''}
        <span class="mu-perf3m" style="color:${perf3mColor}">3M ${perf3m}</span>
      </div>
    </div>
    <div class="mu-header-right">
      <div class="mu-price">${usd(h.current)}</div>
      <div class="mu-day-chg" style="color:${dayColor}">${daySign}${fmt(dayV,2)}%</div>
    </div>
  </div>
  <div class="mu-chart-wrap"><div id="lwc-${esc(ticker)}" class="mu-holding-lwc"></div></div>
  <div class="mu-zone-bar-wrap">${buildZoneBar(h)}</div>
  ${levelsHtml}
  ${substanceHtml}
  <div class="mu-posture-row ${esc(verdict.cls)}"><b>${esc(verdict.text)}</b></div>
  ${renderPermissionRow(route)}
  ${thesisHtml}${watchHtml}
  <div class="mu-tech-row">${ma50chk}${ma200chk}${rationale}</div>
</article>`;
}

function renderHoldingsSection({ zoneState, translation, decision, decisionZones }) {
  if (!decisionZones?.holdings?.length) {
    // Legacy fallback
    return `<section id="holdings-section" class="panel"><div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Price-zone radar</h2></div></div><p style="padding:18px;color:var(--muted)">Zone data unavailable.</p></section>`;
  }

  const holdings = decisionZones.holdings;
  const asOf = decisionZones.as_of
    ? new Date(decisionZones.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  // Build LWC payloads for all holdings
  const lwcPayloads = holdings.map(h => buildLwcPayload(h)).filter(Boolean);
  const payloadJson = JSON.stringify(lwcPayloads);

  const lwcScript = `<script>
(function(){
  var payload=${payloadJson};
  function toLineData(arr){return arr.filter(function(d){return d&&d.time&&Number.isFinite(d.value)});}
  function init(data){
    var el=document.getElementById(data.id);
    if(!el||!window.LightweightCharts)return;
    var chart=LightweightCharts.createChart(el,{
      height:260,
      layout:{background:{type:'solid',color:'rgba(251,250,246,.04)'},textColor:'rgba(26,23,20,.65)',fontSize:11},
      grid:{vertLines:{color:'rgba(201,191,173,.12)'},horzLines:{color:'rgba(201,191,173,.12)'}},
      crosshair:{mode:1},
      rightPriceScale:{borderColor:'rgba(201,191,173,.35)',scaleMargins:{top:0.08,bottom:0.08}},
      timeScale:{borderColor:'rgba(201,191,173,.35)',timeVisible:false,fixLeftEdge:true,fixRightEdge:true},
      handleScroll:true,handleScale:true
    });
    var cs=chart.addCandlestickSeries({
      upColor:'#2a6b4a',downColor:'#A4502F',
      borderUpColor:'#2a6b4a',borderDownColor:'#A4502F',
      wickUpColor:'rgba(42,107,74,.6)',wickDownColor:'rgba(164,80,47,.5)',
      priceLineVisible:false
    });
    cs.setData(data.candles);
    // MA50 — amber dashed, secondary reference
    var ma50s=chart.addLineSeries({color:'rgba(138,106,44,.55)',lineWidth:1.5,lineStyle:1,priceLineVisible:false,lastValueVisible:true,title:'MA50',crosshairMarkerVisible:false});
    ma50s.setData(toLineData(data.ma50));
    // MA200 — blue solid, primary anchor
    var ma200s=chart.addLineSeries({color:'rgba(77,111,145,.9)',lineWidth:2,priceLineVisible:false,lastValueVisible:true,title:'MA200',crosshairMarkerVisible:false});
    ma200s.setData(toLineData(data.ma200));
    var z=data.zones;
    // Buy zone: thick solid green lines with axis labels — clearly readable
    if(z.hasBuyZone&&z.buyHigh!=null){
      cs.createPriceLine({price:z.buyHigh,color:'#2a6b4a',lineWidth:2,lineStyle:0,axisLabelVisible:true,title:'Buy'});
      cs.createPriceLine({price:z.buyLow, color:'rgba(42,107,74,.65)',lineWidth:2,lineStyle:0,axisLabelVisible:true,title:'Buy'});
    }
    // Stop: thick solid red, axis label
    if(z.stop!=null){
      cs.createPriceLine({price:z.stop,color:'#A4502F',lineWidth:1.5,lineStyle:0,axisLabelVisible:true,title:'Stop'});
    }
    // Substanzwert floor: dashed indigo — what the business earns today (15× EPS)
    if(z.floorPrice!=null){
      cs.createPriceLine({price:z.floorPrice,color:'rgba(100,80,180,.72)',lineWidth:1.5,lineStyle:2,axisLabelVisible:true,title:'Floor'});
    }
    chart.timeScale().fitContent();
    if(typeof ResizeObserver!=='undefined'){
      var ro=new ResizeObserver(function(){chart.applyOptions({width:el.clientWidth});});
      ro.observe(el);
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',function(){payload.forEach(init);});
  } else {
    payload.forEach(init);
  }
})();
</script>`;

  const routeByTicker = buildLookup(zoneState.zones || []);
  const cards = holdings.map(h => renderHoldingCard(h, routeByTicker[String(h.ticker || '').toUpperCase()] || {})).join('');

  return `<section id="holdings-section" class="panel mu-holdings-section">
  <div class="section-head">
    <div>
      <p class="eyebrow">Holdings</p>
      <h2>Decision chart — position radar</h2>
      <p class="mu-section-desc">Zones anchored to MA levels &amp; 90D swing support — not % bands from current price. Charts are interactive — scroll and pinch to zoom.${asOf ? ` Data as of ${esc(asOf)}.` : ''}</p>
      <p class="mu-permission-explainer">Terms stay familiar: Buy means a buy-zone signal. Permission shows whether capital is actually allowed after route, evidence, and risk gates.</p>
    </div>
    <a class="button" href="outputs/holding-decision-zones.json">Open artifact</a>
  </div>
  <div class="mu-holdings-stack">${cards}</div>
  ${lwcScript}
</section>`;
}

function renderHoldingsStyle() {
  return `<style id="holdings-compact-style">
.mu-holdings-section .section-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap}
.mu-section-desc{max-width:760px;color:var(--muted);font-size:13px;line-height:1.45;margin:5px 0 0}
.mu-holdings-stack{display:flex;flex-direction:column;gap:24px;max-width:960px;margin:18px auto 0}
/* Base card */
.mu-holding-card{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.14);padding:18px 18px 14px;overflow:hidden;transition:border-color .15s,background .15s}
/* Zone-aware tinting */
.mu-holding-card[data-zone-status="in_buy_zone"]{border-color:rgba(42,107,74,.45);background:rgba(42,107,74,.07)}
.mu-holding-card[data-zone-status="in_trim_zone"]{border-color:rgba(138,106,44,.45);background:rgba(138,106,44,.06)}
.mu-holding-card[data-zone-status="below_support"]{border-color:rgba(164,80,47,.4);background:rgba(164,80,47,.06)}
.mu-holding-card[data-zone-status="exit_only"],.mu-holding-card[data-profile="tactical_risk"]{border-color:rgba(164,80,47,.3);background:rgba(164,80,47,.04)}
/* Header */
.mu-card-header{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}
.mu-header-left{flex:1;min-width:0}
.mu-header-right{text-align:right;flex-shrink:0}
.mu-ticker-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.mu-ticker{font-size:26px;font-weight:700;margin:0;line-height:1}
.mu-signal-badge{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;padding:3px 7px;border-radius:999px;border:1px solid var(--rule);background:rgba(251,250,246,.12);color:var(--muted)}
.mu-signal-badge.good{border-color:rgba(47,111,78,.4);color:var(--green);background:rgba(47,111,78,.08)}
.mu-signal-badge.bad{border-color:rgba(164,80,47,.4);color:var(--red);background:rgba(164,80,47,.07)}
.mu-signal-badge.warn{border-color:rgba(138,106,44,.4);color:var(--warn);background:rgba(138,106,44,.07)}
.mu-health-badge{display:inline-block;font-size:10px;font-weight:600;padding:3px 7px;border-radius:999px;border:1px solid var(--rule);color:var(--muted)}
.mu-health-badge.good{border-color:rgba(47,111,78,.35);color:var(--green)}
.mu-health-badge.warn{border-color:rgba(138,106,44,.35);color:var(--warn)}
.mu-health-badge.bad{border-color:rgba(164,80,47,.35);color:var(--red)}
/* Zone badges */
.mu-zone-badge{display:inline-block;font-size:8.5px;font-weight:700;letter-spacing:.1em;padding:2px 7px;border-radius:999px}
.mu-zone-buy{background:rgba(42,107,74,.15);color:#2a6b4a;border:1px solid rgba(42,107,74,.4)}
.mu-zone-trim{background:rgba(138,106,44,.12);color:#8a6a2c;border:1px solid rgba(138,106,44,.4)}
.mu-zone-below{background:rgba(164,80,47,.12);color:#A4502F;border:1px solid rgba(164,80,47,.4)}
.mu-zone-exit{background:rgba(164,80,47,.1);color:#A4502F;border:1px solid rgba(164,80,47,.35)}
/* Sub-header */
.mu-sub-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-top:5px}
.mu-role{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:300px}
.mu-perf3m{font-size:12px;font-weight:600}
.mu-price{font-size:22px;font-weight:700;line-height:1}
.mu-day-chg{font-size:13px;font-weight:600;margin-top:3px}
/* LWC chart */
.mu-chart-wrap{margin:10px 0 0;border:1px solid var(--rule);border-radius:10px 10px 0 0;overflow:hidden;background:rgba(251,250,246,.04)}
.mu-holding-lwc{width:100%;height:300px}
/* Zone position bar */
.mu-zone-bar-wrap{margin:0 0 8px;border:1px solid var(--rule);border-top:none;border-radius:0 0 10px 10px;padding:6px 14px 10px;background:rgba(251,250,246,.06)}
.mu-zone-bar-svg{display:block;width:100%;height:auto}
/* Levels strip */
.mu-levels-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin:8px 0}
.mu-level-cell{padding:10px 12px;border-right:1px solid var(--rule)}
.mu-level-cell:last-child{border-right:none}
.mu-level-cell>span{display:block;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
.mu-level-cell>b{display:block;font-size:13px;line-height:1.2;overflow-wrap:anywhere}
.mu-level-cell>small{display:block;font-size:10px;color:var(--muted);margin-top:3px;line-height:1.2}
.mu-level-buy{background:rgba(42,107,74,.05)}
.mu-level-buy>b{color:var(--green)}
.mu-level-buy.mu-level-active{background:rgba(42,107,74,.12)!important}
.mu-level-trim{background:rgba(138,106,44,.04)}
.mu-level-trim>b{color:var(--warn)}
.mu-level-trim.mu-level-active{background:rgba(138,106,44,.1)!important}
.mu-level-stop>b{color:var(--red)}
.mu-level-exit>b{color:var(--red)}
/* Posture */
.mu-posture-row{border-radius:10px;padding:9px 12px;background:rgba(251,250,246,.10);border:1px solid var(--rule);margin:8px 0}
.mu-posture-row b{font-size:13px;line-height:1.4;font-weight:500}
.mu-posture-row.good{border-color:rgba(47,111,78,.3);background:rgba(47,111,78,.07)}
.mu-posture-row.good b{color:var(--green)}
.mu-posture-row.bad{border-color:rgba(164,80,47,.3);background:rgba(164,80,47,.07)}
.mu-posture-row.bad b{color:var(--red)}
.mu-posture-row.warn{border-color:rgba(138,106,44,.3);background:rgba(138,106,44,.06)}
.mu-posture-row.warn b{color:var(--warn)}
/* Signal vs permission */
.mu-permission-explainer{max-width:760px;color:var(--muted);font-size:12px;line-height:1.4;margin:6px 0 0}
.mu-permission-row{display:grid;grid-template-columns:1fr 1fr 1.35fr;gap:0;border:1px solid var(--rule);border-radius:12px;overflow:hidden;margin:8px 0;background:rgba(251,250,246,.08)}
.mu-permission-row>div{padding:9px 11px;border-right:1px solid var(--rule);min-width:0}
.mu-permission-row>div:last-child{border-right:none}
.mu-permission-row span{display:block;font-size:9px;font-weight:700;letter-spacing:.08em;color:var(--muted);text-transform:uppercase;margin-bottom:4px}
.mu-permission-row b{display:block;font-size:12px;line-height:1.25;overflow-wrap:anywhere}
.mu-permission-row small{display:block;color:var(--muted);font-size:10px;line-height:1.3;margin-top:3px}
.mu-permission-row.good{border-color:rgba(47,111,78,.32);background:rgba(47,111,78,.06)}
.mu-permission-row.good b{color:var(--green)}
.mu-permission-row.warn{border-color:rgba(138,106,44,.32);background:rgba(138,106,44,.06)}
.mu-permission-row.warn b{color:var(--warn)}
.mu-permission-row.bad{border-color:rgba(164,80,47,.32);background:rgba(164,80,47,.06)}
.mu-permission-row.bad b{color:var(--red)}
/* Thesis */
.mu-thesis-row{margin:6px 0;display:flex;gap:10px;align-items:baseline}
.mu-thesis-row>span{flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);min-width:62px}
.mu-thesis-row>p{margin:0;font-size:12px;line-height:1.45;color:var(--muted)}
.mu-invalidation>span{color:rgba(164,80,47,.7)}
/* Substanzwert strip */
.mu-substance-strip{margin:6px 0;border:1px solid rgba(100,80,180,.22);border-radius:10px;padding:8px 12px;background:rgba(100,80,180,.04)}
.mu-substance-bar{display:flex;height:8px;border-radius:4px;overflow:hidden;margin-bottom:6px}
.mu-substance-seg{height:100%}
.mu-sub{background:rgba(47,111,78,.35)}
.mu-hop{background:rgba(138,106,44,.32)}
.mu-substance-meta{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap}
.mu-sub-label{font-size:10px;color:var(--muted)}
.mu-sub-label b{color:rgba(100,80,180,.9);font-weight:700}
.mu-hop-label{font-size:10px;color:var(--muted)}
/* Tech row */
.mu-tech-row{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px;align-items:center}
.mu-ma-check{font-size:10px;font-weight:600;padding:3px 8px;border-radius:999px;border:1px solid var(--rule)}
.mu-ma-check.pass{color:var(--green);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.07)}
.mu-ma-check.fail{color:var(--red);border-color:rgba(164,80,47,.35);background:rgba(164,80,47,.06)}
.mu-zone-rationale{font-size:10px;color:var(--muted);letter-spacing:.02em}
@media(max-width:640px){
  .mu-levels-strip{grid-template-columns:repeat(2,1fr)}
  .mu-permission-row{grid-template-columns:1fr}
  .mu-permission-row>div{border-right:none;border-bottom:1px solid var(--rule)}
  .mu-permission-row>div:last-child{border-bottom:none}
  .mu-level-cell:nth-child(2n){border-right:none}
  .mu-level-cell:nth-child(n+3){border-top:1px solid var(--rule)}
  .mu-ticker{font-size:22px}
  .mu-price{font-size:18px}
  .mu-holding-lwc{height:220px}
}
</style>`;
}

// Legacy helpers
function buildLookup(rows, key = 'ticker') {
  return Object.fromEntries(arr(rows).map(item => [String(item[key] || '').toUpperCase(), item]));
}

module.exports = { renderHoldingsSection, renderHoldingsStyle };
