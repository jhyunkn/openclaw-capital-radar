'use strict';
const fs   = require('fs');
const path = require('path');

const ROOT       = path.join(__dirname, '../../..');
const CANDLE_DIR = path.join(ROOT, 'data', 'market-candles');

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

// Build LWC payload for a holding (candle data + MA data + zone levels)
function buildLwcPayload(h) {
  const ticker  = String(h.ticker || '').toUpperCase();
  const candles = loadCandles(ticker, 200);
  const display = candles.slice(-90);
  if (!display.length) return null;

  // MA computed over full history, displayed for last 90
  const allMa50  = computeMAValues(candles, Math.min(50,  candles.length));
  const allMa200 = computeMAValues(candles, Math.min(200, candles.length));
  const startTime = display[0].time;
  const ma50Data  = allMa50 .filter(d => d.time >= startTime);
  const ma200Data = allMa200.filter(d => d.time >= startTime);

  const candleData = display.map(c => ({
    time: c.time, open: c.open, high: c.high, low: c.low, close: c.close,
  }));

  return {
    id:       `lwc-${ticker}`,
    candles:  candleData,
    ma50:     ma50Data,
    ma200:    ma200Data,
    zones: {
      hasBuyZone:   h.has_buy_zone || false,
      buyLow:       h.buy_zone?.low   ?? null,
      buyHigh:      h.buy_zone?.high  ?? null,
      trimLow:      h.trim_zone?.low  ?? null,
      trimHigh:     h.trim_zone?.high ?? null,
      stop:         h.stop            ?? null,
      trigger:      h.trigger         ?? null,
      triggerLabel: h.trigger_label   ?? null,
      current:      h.current         ?? null,
    },
  };
}

function renderHoldingCard(h) {
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
  ${levelsHtml}
  <div class="mu-posture-row ${esc(verdict.cls)}"><b>${esc(verdict.text)}</b></div>
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
      wickUpColor:'rgba(42,107,74,.65)',wickDownColor:'rgba(164,80,47,.55)'
    });
    cs.setData(data.candles);
    var ma50s=chart.addLineSeries({color:'#8a6a2c',lineWidth:1.5,priceLineVisible:false,lastValueVisible:true,title:'MA50',crosshairMarkerVisible:false});
    ma50s.setData(toLineData(data.ma50));
    var ma200s=chart.addLineSeries({color:'#4d6f91',lineWidth:1.8,priceLineVisible:false,lastValueVisible:true,title:'MA200',crosshairMarkerVisible:false});
    ma200s.setData(toLineData(data.ma200));
    var z=data.zones;
    if(z.hasBuyZone&&z.buyHigh!=null){
      cs.createPriceLine({price:z.buyHigh,color:'rgba(42,107,74,.55)',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Buy ↑'});
      cs.createPriceLine({price:z.buyLow, color:'rgba(42,107,74,.35)',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Buy ↓'});
    }
    if(z.trimHigh!=null){
      cs.createPriceLine({price:z.trimHigh,color:'rgba(138,106,44,.5)',lineWidth:1,lineStyle:2,axisLabelVisible:false,title:''});
      cs.createPriceLine({price:z.trimLow, color:'rgba(138,106,44,.35)',lineWidth:1,lineStyle:2,axisLabelVisible:true,title:'Trim'});
    }
    if(z.stop!=null){
      cs.createPriceLine({price:z.stop,color:'rgba(164,80,47,.55)',lineWidth:1,lineStyle:1,axisLabelVisible:true,title:'Stop'});
    }
    if(z.trigger!=null){
      cs.createPriceLine({price:z.trigger,color:'rgba(77,111,145,.55)',lineWidth:1.2,lineStyle:2,axisLabelVisible:true,title:z.triggerLabel||'Target'});
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

  const cards = holdings.map(h => renderHoldingCard(h)).join('');

  return `<section id="holdings-section" class="panel mu-holdings-section">
  <div class="section-head">
    <div>
      <p class="eyebrow">Holdings</p>
      <h2>Decision chart — position radar</h2>
      <p class="mu-section-desc">Zones anchored to MA levels &amp; 90D swing support — not % bands from current price. Charts are interactive — scroll and pinch to zoom.${asOf ? ` Data as of ${esc(asOf)}.` : ''}</p>
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
.mu-chart-wrap{margin:10px 0;border:1px solid var(--rule);border-radius:10px;overflow:hidden;background:rgba(251,250,246,.04)}
.mu-holding-lwc{width:100%;height:260px}
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
/* Thesis */
.mu-thesis-row{margin:6px 0;display:flex;gap:10px;align-items:baseline}
.mu-thesis-row>span{flex-shrink:0;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);min-width:62px}
.mu-thesis-row>p{margin:0;font-size:12px;line-height:1.45;color:var(--muted)}
.mu-invalidation>span{color:rgba(164,80,47,.7)}
/* Tech row */
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
  .mu-holding-lwc{height:200px}
}
</style>`;
}

// Legacy helpers
function buildLookup(rows, key = 'ticker') {
  return Object.fromEntries(arr(rows).map(item => [String(item[key] || '').toUpperCase(), item]));
}

module.exports = { renderHoldingsSection, renderHoldingsStyle };
