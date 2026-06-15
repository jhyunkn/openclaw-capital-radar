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
  const runtime = `(function(){const payload=${data};function ok(v){return Number.isFinite(Number(v))&&Number(v)>0;}function applyAutoscale(candle,b){try{const p=payload.policy&&payload.policy.autoscale;if(p&&Number.isFinite(p.minValue)&&Number.isFinite(p.maxValue)){candle.applyOptions({autoscaleInfoProvider:()=>({priceRange:{minValue:p.minValue,maxValue:p.maxValue}})});}}catch(e){}}function build(){const el=document.getElementById('${CHART_ID}');if(!el||!window.LightweightCharts)return;const chart=LightweightCharts.createChart(el,{autoSize:true,layout:{background:{type:'solid',color:'#f6f4ee'},textColor:'#2c2a25'},grid:{vertLines:{color:'rgba(44,42,37,.08)'},horzLines:{color:'rgba(44,42,37,.08)'}},rightPriceScale:{borderColor:'rgba(44,42,37,.18)'},timeScale:{borderColor:'rgba(44,42,37,.18)',timeVisible:true},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});const candle=chart.addCandlestickSeries({upColor:'#4f9b82',downColor:'#c76b60',borderUpColor:'#4f9b82',borderDownColor:'#c76b60',wickUpColor:'#4f9b82',wickDownColor:'#c76b60',priceLineVisible:true});candle.setData(payload.series);function line(key,color,width,style){const d=payload.series.filter(r=>ok(r[key])).map(r=>({time:r.time,value:Number(r[key])}));if(!d.length)return;const s=chart.addLineSeries({color,lineWidth:width,lineStyle:style,priceLineVisible:false,lastValueVisible:false});s.setData(d);}line('ma50','#6f6a5f',1.4,LightweightCharts.LineStyle.Solid);line('ma200','#4088a8',2.1,LightweightCharts.LineStyle.Solid);const b=payload.bands||{};function pl(price,title,color,style,width){if(!ok(price))return;candle.createPriceLine({price:Number(price),color,lineWidth:width,lineStyle:style,axisLabelVisible:true,title});}pl(b.addLow,'ADD LOW','#2f6f4e',LightweightCharts.LineStyle.Dotted,2);pl(b.addHigh,'ADD HIGH','#2f6f4e',LightweightCharts.LineStyle.Dotted,2);pl(b.defenseBelow,'DEFENSE','#4088a8',LightweightCharts.LineStyle.Dashed,2);pl(b.hardRisk,'HARD RISK','#9f3f35',LightweightCharts.LineStyle.LargeDashed,2);pl(b.target,'TARGET','#2f6f4e',LightweightCharts.LineStyle.LargeDashed,1);const last=payload.series[payload.series.length-1];applyAutoscale(candle,b);const markers=[];if(last)markers.push({time:last.time,position:'aboveBar',color:'#2c2a25',shape:'circle',text:'NOW '+Math.round(last.close).toLocaleString()});candle.setMarkers(markers);chart.timeScale().fitContent();window.addEventListener('resize',()=>{try{chart.timeScale().fitContent();}catch(e){}});}build();})();`;
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

function renderDecisionRail(state) {
  const bands = state.action_bands || {};
  const items = [
    ['ADD', bands.add_zone, 'Pullback review zone'],
    ['TRIM', bands.trim_zone, 'No-chase / rebalance zone'],
    ['DEFENSE', bands.defense_below, 'Defense trigger'],
    ['HARD RISK', bands.hard_risk, 'Stop adding / reassess'],
    ['TARGET', bands.target, 'Upside reference']
  ];
  return `<div class="decision-chart-rail">${items.map(([label, value, note]) => `<article><span>${esc(label)}</span><b>${esc(fmtLevel(value))}</b><small>${esc(note)}</small></article>`).join('')}</div>`;
}

function renderConfirmationStrip(state) {
  const brief = state.brief || {};
  const items = [
    ['Route', brief.portfolio_posture],
    ['Add rule', brief.change_trigger],
    ['Risk rule', brief.risk_trigger],
    ['Confidence', brief.confidence]
  ].filter(([, value]) => value != null && value !== '');
  return `<div class="decision-chart-confirmation-strip">${items.map(([label, value]) => `<span><b>${esc(label)}</b>${esc(value)}</span>`).join('')}</div>`;
}

function renderOperationalChartSection(state, macroPrices) {
  const payload = buildChartPayload(state);
  const priceStrip = renderMacroPriceStrip(macroPrices);
  return `<section id="operational-chart-section" class="cr-section op-chart-section decision-chart-v2-shell" data-autoscale-policy="actionable_spx_levels_only"><div class="cr-wrap"><div class="section-head"><div><p class="eyebrow">Market</p><h2>Operational Decision Chart</h2><p class="op-chart-subtitle">S&amp;P 500 decision map</p></div></div>${renderConfirmationStrip(state)}<div id="${CHART_ID}" class="op-lwc-chart"></div>${renderChartRuntime(payload)}${renderDecisionRail(state)}${priceStrip}</div></section>`;
}

function renderOperationalChartStyle() {
  return `<style id="operational-chart-style">.op-chart-subtitle{margin:8px 0 0;color:var(--muted);font-size:14px}.op-lwc-chart{height:520px;border:1px solid var(--rule);border-radius:0;background:#ffffff;overflow:hidden;margin:0 0 14px}.op-chart-section .section-head{margin-bottom:18px}.decision-chart-confirmation-strip{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:0 0 12px}.decision-chart-confirmation-strip span,.decision-chart-rail article{border:1px solid var(--rule);background:#ffffff;padding:11px}.decision-chart-confirmation-strip b,.decision-chart-rail span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:6px}.decision-chart-confirmation-strip span{font-size:12px;line-height:1.35;color:var(--ink)}.decision-chart-rail{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:0 0 16px}.decision-chart-rail b{display:block;font-size:18px;line-height:1.05;letter-spacing:-.03em;font-weight:500}.decision-chart-rail small{display:block;color:var(--muted);font-size:11px;line-height:1.3;margin-top:6px}.macro-price-strip{display:grid;grid-template-columns:repeat(6,1fr);gap:8px}.mp-tile{border:1px solid var(--rule);border-radius:0;background:#ffffff;padding:13px}.mp-label{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}.mp-price{display:block;font-size:17px;line-height:1.05;letter-spacing:-.025em;font-weight:500;margin-top:10px}.mp-chg{display:block;font-size:11px;margin-top:6px;color:var(--muted)}.mp-chg.up{color:var(--green,#2f6f4e)}.mp-chg.dn{color:var(--red,#9f3f35)}@media(max-width:900px){.macro-price-strip{grid-template-columns:repeat(3,1fr)}.decision-chart-confirmation-strip,.decision-chart-rail{grid-template-columns:repeat(2,1fr)}.op-lwc-chart{height:380px}}@media(max-width:560px){.macro-price-strip,.decision-chart-confirmation-strip,.decision-chart-rail{grid-template-columns:1fr}.op-lwc-chart{height:300px}}</style>`;
}

module.exports = { renderOperationalChartSection, renderOperationalChartStyle, buildChartPayload, buildAutoscalePolicy };
