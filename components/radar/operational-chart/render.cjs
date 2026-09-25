const CHART_ID = 'opclaw-operational-lwc';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr = v => Array.isArray(v) ? v : [];
const num = v => Number.isFinite(Number(v)) ? Number(v) : null;
const pos = v => Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null;

function buildAutoscalePolicy(bands, overlays, series) {
  const latest = arr(series).slice(-1)[0] || {};
  const authorized = [
    bands.current,
    arr(bands.add_zone)[0],
    arr(bands.add_zone)[1],
    bands.hold_above,
    arr(bands.trim_zone)[0],
    arr(bands.trim_zone)[1],
    bands.defense_below,
    bands.hard_risk,
    bands.target,
    overlays.ma50,
    overlays.ma200,
    latest.c,
  ].map(Number).filter(Number.isFinite).filter(v => v > 0);
  if (!authorized.length) return null;
  const lo = Math.min(...authorized);
  const hi = Math.max(...authorized);
  const pad = Math.max((hi - lo) * 0.18, 250);
  return { minValue: lo - pad, maxValue: hi + pad };
}

function buildChartPayload(state) {
  const bands = state.action_bands || {};
  const overlays = state.chart?.overlays || {};
  const sourceSeries = arr(state.chart?.series);
  const events = arr(state.chart?.annotated_events);
  const series = sourceSeries.map(row => ({
    time: Math.floor((row.t || 0) / 1000),
    open: row.o,
    high: row.h,
    low: row.l,
    close: row.c,
    ma50: pos(row.ma50),
    ma200: pos(row.ma200),
  })).filter(row => row.time && num(row.close) !== null);
  return {
    series,
    events: events.map(e => ({
      id: e.id, label: e.label, type: e.type,
      time: Math.floor((e.time || 0) / 1000), price: e.price,
    })),
    bands: {
      current: bands.current,
      addLow: arr(bands.add_zone)[0],
      addHigh: arr(bands.add_zone)[1],
      defenseBelow: bands.defense_below,
      hardRisk: bands.hard_risk,
      target: bands.target,
      ma50: overlays.ma50,
      ma200: overlays.ma200,
    },
    policy: { autoscale: buildAutoscalePolicy(bands, overlays, sourceSeries) },
  };
}

function renderChartRuntime(payload) {
  const data = JSON.stringify(payload);
  const src = '<scr' + 'ipt src="https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js"></scr' + 'ipt>';
  const runtime = `(function(){const payload=${data};function ok(v){return Number.isFinite(Number(v))&&Number(v)>0;}function applyAutoscale(candle,b){try{const p=payload.policy&&payload.policy.autoscale;if(p&&Number.isFinite(p.minValue)&&Number.isFinite(p.maxValue)){candle.applyOptions({autoscaleInfoProvider:()=>({priceRange:{minValue:p.minValue,maxValue:p.maxValue}})});}}catch(e){}}function build(){const el=document.getElementById('${CHART_ID}');if(!el||!window.LightweightCharts)return;const chart=LightweightCharts.createChart(el,{autoSize:true,layout:{background:{type:'solid',color:'#ffffff'},textColor:'#2c2a25'},grid:{vertLines:{color:'rgba(44,42,37,.08)'},horzLines:{color:'rgba(44,42,37,.08)'}},rightPriceScale:{borderColor:'rgba(44,42,37,.18)'},timeScale:{borderColor:'rgba(44,42,37,.18)',timeVisible:true},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});const candle=chart.addCandlestickSeries({upColor:'#4f9b82',downColor:'#c76b60',borderUpColor:'#4f9b82',borderDownColor:'#c76b60',wickUpColor:'#4f9b82',wickDownColor:'#c76b60',priceLineVisible:true});candle.setData(payload.series);function line(key,color,width,style){const d=payload.series.filter(r=>ok(r[key])).map(r=>({time:r.time,value:Number(r[key])}));if(!d.length)return;const s=chart.addLineSeries({color,lineWidth:width,lineStyle:style,priceLineVisible:false,lastValueVisible:false});s.setData(d);}line('ma50','#6f6a5f',1.4,LightweightCharts.LineStyle.Solid);line('ma200','#4088a8',2.1,LightweightCharts.LineStyle.Solid);const b=payload.bands||{};function pl(price,title,color,style,width){if(!ok(price))return;candle.createPriceLine({price:Number(price),color,lineWidth:width,lineStyle:style,axisLabelVisible:true,title});}pl(b.addLow,'ADD LOW','#2f6f4e',LightweightCharts.LineStyle.Dotted,2);pl(b.addHigh,'ADD HIGH','#2f6f4e',LightweightCharts.LineStyle.Dotted,2);pl(b.defenseBelow,'DEFENSE','#4088a8',LightweightCharts.LineStyle.Dashed,2);pl(b.hardRisk,'HARD RISK','#9f3f35',LightweightCharts.LineStyle.LargeDashed,2);pl(b.target,'TARGET','#2f6f4e',LightweightCharts.LineStyle.LargeDashed,1);const last=payload.series[payload.series.length-1];applyAutoscale(candle,b);const markers=[];if(last)markers.push({time:last.time,position:'aboveBar',color:'#2c2a25',shape:'circle',text:'NOW '+Math.round(last.close).toLocaleString()});candle.setMarkers(markers);chart.timeScale().fitContent();window.addEventListener('resize',()=>{try{chart.timeScale().fitContent();}catch(e){}});}build();})();`;
  return `${src}<scr` + `ipt>${runtime}</scr` + `ipt>`;
}

function fmtPrice(asset) {
  const p = asset.price;
  if (p == null) return '—';
  if (asset.format === 'dollar') {
    return '$' + Number(p).toLocaleString('en-US', { maximumFractionDigits: asset.decimals ?? 0 });
  }
  if (asset.format === 'rate') {
    return Number(p).toFixed(asset.decimals ?? 2) + '%';
  }
  return Number(p).toLocaleString('en-US', { maximumFractionDigits: asset.decimals ?? 1 });
}

function fmtChg(pct) {
  if (pct == null) return { cls: '', text: '—' };
  const sign = pct >= 0 ? '+' : '';
  return { cls: pct >= 0 ? 'up' : 'dn', text: `${sign}${Number(pct).toFixed(2)}%` };
}

function renderMacroPriceStrip(assets) {
  if (!assets || !assets.length) return '';
  const tiles = assets.map(a => {
    const chg = fmtChg(a.changePct);
    return `<div class="mp-tile"><span class="mp-label">${esc(a.label)}</span><b class="mp-price">${esc(fmtPrice(a))}</b><small class="mp-chg ${esc(chg.cls)}">${esc(chg.text)}</small></div>`;
  }).join('');
  return `<div class="macro-price-strip">${tiles}</div>`;
}

function fmtLevel(value) {
  if (value == null) return 'n/a';
  if (Array.isArray(value)) return value.map(fmtLevel).join('-');
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(value);
}

function renderRouteHero(state) {
  const brief = state.brief || {};
  const route = brief.portfolio_posture;
  if (!route) return '';
  const sub = brief.market_state ? `<p class="op-route-sub">${esc(brief.market_state)}</p>` : '';
  return `<div class="op-route-hero"><span class="op-route-eyebrow">Current route</span><p class="op-route-line">${esc(route)}</p>${sub}</div>`;
}

function renderRulesStrip(state) {
  const brief = state.brief || {};
  const items = [
    ['Add rule', brief.change_trigger],
    ['Risk rule', brief.risk_trigger],
    ['Confidence', brief.confidence]
  ].filter(([, value]) => value != null && value !== '');
  if (!items.length) return '';
  return `<div class="op-rules-strip">${items.map(([label, value]) => `<div class="op-rule"><b>${esc(label)}</b><p>${esc(value)}</p></div>`).join('')}</div>`;
}

// ── Zone ladder: vertical, linear in price, with the current-price marker.
// All levels come from state.action_bands; nothing is invented. ──
function renderZoneLadder(state) {
  const bands = state.action_bands || {};
  const addLo = arr(bands.add_zone)[0], addHi = arr(bands.add_zone)[1];
  const trimLo = arr(bands.trim_zone)[0], trimHi = arr(bands.trim_zone)[1];
  const defense = num(bands.defense_below), hardRisk = num(bands.hard_risk), target = num(bands.target);
  const current = num(bands.current);
  const zones = [];
  if (Number.isFinite(target)) zones.push({ name: 'Target', cls: 'target', point: target, note: 'Upside reference' });
  if (Number.isFinite(trimLo) && Number.isFinite(trimHi)) zones.push({ name: 'Trim', cls: 'trim', lo: trimLo, hi: trimHi, note: 'No-chase / rebalance zone' });
  if (Number.isFinite(addLo) && Number.isFinite(addHi)) zones.push({ name: 'Add', cls: 'add', lo: addLo, hi: addHi, note: 'Pullback review zone' });
  if (Number.isFinite(defense)) zones.push({ name: 'Defense', cls: 'defense', point: defense, note: 'Defense trigger' });
  if (Number.isFinite(hardRisk)) zones.push({ name: 'Hard risk', cls: 'risk', point: hardRisk, note: 'Stop adding / reassess' });
  const vals = zones.flatMap(z => z.point != null ? [z.point] : [z.lo, z.hi]).filter(Number.isFinite);
  if (Number.isFinite(current)) vals.push(current);
  if (!vals.length) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = Math.max((hi - lo) * 0.055, 40);
  const sLo = lo - pad, span = (hi + pad) - sLo;
  const pctOf = v => (v - sLo) / span;
  const topOf = v => (pctOf(v) * -100 + 100).toFixed(2) + '%';
  const labelFor = z => {
    const level = z.point != null ? fmtLevel(z.point) : `${fmtLevel(z.lo)}–${fmtLevel(z.hi)}`;
    const mid = z.point != null ? z.point : (z.lo + z.hi) / 2;
    return `<span class="op-ladder-label" style="top:${topOf(mid)}"><span><b>${esc(z.name)}</b><i>${esc(level)} · ${esc(z.note)}</i></span></span>`;
  };
  const parts = ['<div class="op-ladder-rail"></div>'];
  for (const z of zones) {
    if (z.point != null) {
      parts.push(`<div class="op-ladder-rung op-ladder-rung--${z.cls}" style="top:${topOf(z.point)}"></div>${labelFor(z)}`);
    } else {
      parts.push(`<div class="op-ladder-band op-ladder-band--${z.cls}" style="top:${topOf(z.hi)};height:${((pctOf(z.hi) - pctOf(z.lo)) * 100).toFixed(2)}%"></div>${labelFor(z)}`);
    }
  }
  if (Number.isFinite(current)) {
    const below = pctOf(current) > 0.86;
    parts.push(`<div class="op-ladder-now" style="top:${topOf(current)}"><span class="op-ladder-nowtag${below ? ' op-ladder-nowtag--below' : ''}">SPX ${Math.round(current).toLocaleString('en-US')} · now</span></div>`);
  }
  return `<div class="op-ladder-card"><span class="op-card-eyebrow">Action zones</span><h3 class="op-card-title">Where the S&amp;P 500 sits on the ladder</h3><div class="op-ladder" style="height:400px">${parts.join('')}</div><p class="op-ladder-note">Levels from the current action bands, unchanged. Ladder scale is linear between hard risk and target; the marker is the latest close.</p></div>`;
}

function renderOperationalChartSection(state, macroPrices) {
  const payload = buildChartPayload(state);
  const priceStrip = renderMacroPriceStrip(macroPrices);
  return `<section id="operational-chart-section" class="cr-section op-chart-section decision-chart-v2-shell" data-autoscale-policy="actionable_spx_levels_only"><div class="cr-wrap"><div class="section-head"><div><p class="eyebrow">Market</p><h2>Operational Decision Chart</h2><p class="op-chart-subtitle">S&amp;P 500 decision map</p></div></div>${renderRouteHero(state)}<div id="${CHART_ID}" class="op-lwc-chart"></div>${renderChartRuntime(payload)}${renderZoneLadder(state)}${renderRulesStrip(state)}${priceStrip}</div></section>`;
}

function renderOperationalChartStyle() {
  return `<style id="operational-chart-style">
.op-chart-section .section-head{margin-bottom:20px}
.op-route-hero{border:1px solid var(--rule);background:#ffffff;padding:24px 28px;margin:0 0 20px;border-left:5px solid var(--ink,#24231f)}
.op-route-eyebrow{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin-bottom:10px}
.op-route-line{font-size:clamp(26px,4.6vw,40px);font-weight:600;letter-spacing:-.03em;line-height:1.08;color:var(--ink,#24231f);margin:0}
.op-route-sub{margin:12px 0 0;font-size:13px;color:var(--muted);line-height:1.5}
.op-lwc-chart{height:520px;border:1px solid var(--rule);border-radius:0;background:#ffffff;overflow:hidden;margin:0 0 20px}
.op-ladder-card{border:1px solid var(--rule);border-radius:0;background:#ffffff;padding:24px 28px;margin:0 0 20px}
.op-card-eyebrow{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted);margin-bottom:8px}
.op-card-title{font-size:17px;font-weight:600;letter-spacing:-.02em;color:var(--ink,#24231f);margin:0}
.op-ladder{position:relative;margin:22px 0 8px}
.op-ladder-rail{position:absolute;left:20px;top:0;bottom:0;width:2px;background:rgba(44,42,37,.14)}
.op-ladder-band{position:absolute;left:20px;right:0;border-top:1px solid;border-bottom:1px solid}
.op-ladder-band--add{background:rgba(47,111,78,.10);border-color:rgba(47,111,78,.55)}
.op-ladder-band--trim{background:rgba(180,130,40,.12);border-color:rgba(180,130,40,.55)}
.op-ladder-rung{position:absolute;left:20px;right:0;border-top:2px solid transparent}
.op-ladder-rung--target{border-top-color:#2f6f4e}
.op-ladder-rung--defense{border-top:2px dashed #4088a8}
.op-ladder-rung--risk{border-top-color:#9f3f35}
.op-ladder-label{position:absolute;left:40px;right:6px;transform:translateY(-50%);z-index:3;pointer-events:none}
.op-ladder-label>span{display:inline-block;background:rgba(255,255,255,.94);border:1px solid rgba(44,42,37,.08);padding:3px 9px}
.op-ladder-label b{display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--ink,#24231f);line-height:1.5}
.op-ladder-label i{display:block;font-style:normal;font-size:12px;color:var(--muted);line-height:1.4}
.op-ladder-now{position:absolute;left:0;right:0;border-top:2px solid #1c1a17;z-index:2}
.op-ladder-nowtag{position:absolute;left:0;top:0;transform:translateY(calc(-100% - 4px));background:#1c1a17;color:#ffffff;font-size:11px;font-weight:600;letter-spacing:.02em;padding:3px 10px;white-space:nowrap}
.op-ladder-nowtag--below{transform:translateY(4px)}
.op-ladder-note{font-size:11px;color:var(--muted);margin:8px 0 0;line-height:1.55}
.op-rules-strip{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:0 0 20px}
.op-rule{border:1px solid var(--rule);border-radius:0;background:#ffffff;padding:14px 16px}
.op-rule b{display:block;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.1em;color:var(--ink,#24231f);margin-bottom:6px}
.op-rule p{margin:0;font-size:12.5px;line-height:1.55;color:var(--muted)}
.macro-price-strip{display:grid;grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px}
.mp-tile{border:1px solid var(--rule);border-radius:0;background:#ffffff;padding:14px 13px}
.mp-label{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:500}
.mp-price{display:block;font-size:17px;line-height:1.05;letter-spacing:-.025em;font-weight:600;margin-top:10px}
.mp-chg{display:block;font-size:11px;margin-top:6px;color:var(--muted)}
.mp-chg.up{color:var(--green,#2f6f4e)}.mp-chg.dn{color:var(--red,#9f3f35)}
@media(max-width:900px){.macro-price-strip{grid-template-columns:repeat(3,1fr)}.op-lwc-chart{height:380px}}
@media(max-width:560px){.macro-price-strip{grid-template-columns:repeat(2,1fr)}.op-lwc-chart{height:300px}.op-route-hero,.op-ladder-card{padding:18px 16px}.op-ladder{height:360px !important}.op-ladder-label{left:34px}.op-rules-strip{grid-template-columns:1fr}}
</style>`;
}

module.exports = { renderOperationalChartSection, renderOperationalChartStyle, buildChartPayload, buildAutoscalePolicy };
