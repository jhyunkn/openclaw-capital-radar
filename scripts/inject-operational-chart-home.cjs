const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'operational-chart-state.json');
const chartId = 'opclaw-operational-lwc';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const pos = value => Number.isFinite(Number(value)) && Number(value) > 0 ? Number(value) : null;
const fmt = (value, digits = 0) => num(value) === null ? '—' : num(value).toLocaleString(undefined, { maximumFractionDigits: digits });

function runScript(name) {
  return spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, encoding: 'utf8', timeout: 60000 });
}

function badge(type) {
  return `<span class="op-badge ${String(type).toLowerCase()}">${esc(type)}</span>`;
}

function removeSection(html, id) {
  const token = `<section id="${id}"`;
  let start = html.indexOf(token);
  while (start >= 0) {
    const next = html.indexOf('<section id="', start + token.length);
    const footer = html.indexOf('<footer', start + token.length);
    const mainEnd = html.indexOf('</main>', start + token.length);
    const candidates = [next, footer, mainEnd].filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : html.length;
    html = html.slice(0, start) + html.slice(end);
    start = html.indexOf(token);
  }
  return html;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) runScript('generate-operational-chart-state.cjs');
if (!fs.existsSync(statePath)) throw new Error('operational-chart-state missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (state.render_permission === false) process.exit(0);

const bands = state.action_bands || {};
const overlays = state.chart?.overlays || {};
const brief = state.brief || {};
const indicators = state.chart?.indicators || {};
const series = arr(state.chart?.series);
const scenarios = arr(state.chart?.scenarios).slice(0, 3);
const confirmations = arr(state.chart?.confirmations).slice(0, 4);
const events = arr(state.chart?.annotated_events);

const chartPayload = {
  series: series.map(row => ({
    time: Math.floor((row.t || 0) / 1000),
    open: row.o,
    high: row.h,
    low: row.l,
    close: row.c,
    ma20: pos(row.ma20),
    ma50: pos(row.ma50),
    ma200: pos(row.ma200),
  })).filter(row => row.time && num(row.close) !== null),
  events: events.map(event => ({
    id: event.id,
    label: event.label,
    type: event.type,
    time: Math.floor((event.time || 0) / 1000),
    price: event.price,
  })),
  bands: {
    current: bands.current,
    addLow: arr(bands.add_zone)[0],
    addHigh: arr(bands.add_zone)[1],
    holdAbove: bands.hold_above,
    trimLow: arr(bands.trim_zone)[0],
    trimHigh: arr(bands.trim_zone)[1],
    defenseBelow: bands.defense_below,
    hardRisk: bands.hard_risk,
    target: bands.target,
    ma50: overlays.ma50,
    ma200: overlays.ma200,
  }
};

const verdictCards = [
  ['Verdict', brief.market_state || '—'],
  ['Action', brief.portfolio_posture || '—'],
  ['Change line', brief.change_trigger || '—'],
  ['Risk line', brief.risk_trigger || '—'],
].map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');

const levelCards = [
  ['Current', 'REAL', fmt(bands.current)],
  ['Add review', 'EST', `${fmt(arr(bands.add_zone)[0])}–${fmt(arr(bands.add_zone)[1])}`],
  ['Hold above', 'EST', fmt(bands.hold_above)],
  ['Defense below', 'EST', fmt(bands.defense_below)],
  ['Hard risk', 'EST', fmt(bands.hard_risk)],
  ['Target', 'PROJ', fmt(bands.target)],
].map(([label, type, value]) => `<article><span>${esc(label)} ${badge(type)}</span><b>${esc(value)}</b></article>`).join('');

const scenarioCards = scenarios.map(sc => `<article class="${esc(sc.id)}"><span>${esc(sc.label)} ${badge('PROJ')}</span><b>${fmt(sc.end_value)}</b><p>${esc(sc.trigger)}</p></article>`).join('');
const confirmationChips = confirmations.map(c => `<article class="${esc(c.status)}"><span>${esc(c.name)}</span><b>${esc(c.status)} · ${fmt(c.value, 1)}</b></article>`).join('');

const indicatorChips = [
  ['RSI', fmt(indicators.rsi14, 1)],
  ['MACD', fmt(indicators.macd12_26, 2)],
  ['VIX', fmt(indicators.vix, 1)],
].map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');

const chart = `<div class="op-chart-shell"><div id="${chartId}" class="lwc-chart"></div><aside class="op-level-rail"><h3>Levels</h3><div class="level-grid">${levelCards}</div></aside></div><script src="https://unpkg.com/lightweight-charts@4.2.3/dist/lightweight-charts.standalone.production.js"></script><script>(function(){const payload=${JSON.stringify(chartPayload)};function ok(v){return Number.isFinite(Number(v))&&Number(v)>0;}function build(){const el=document.getElementById('${chartId}');if(!el||!window.LightweightCharts)return;const chart=LightweightCharts.createChart(el,{autoSize:true,layout:{background:{type:'solid',color:'#f6f4ee'},textColor:'#2c2a25'},grid:{vertLines:{color:'rgba(44,42,37,.08)'},horzLines:{color:'rgba(44,42,37,.08)'}},rightPriceScale:{borderColor:'rgba(44,42,37,.18)'},timeScale:{borderColor:'rgba(44,42,37,.18)',timeVisible:true},crosshair:{mode:LightweightCharts.CrosshairMode.Normal}});const candle=chart.addCandlestickSeries({upColor:'#4f9b82',downColor:'#c76b60',borderUpColor:'#4f9b82',borderDownColor:'#c76b60',wickUpColor:'#4f9b82',wickDownColor:'#c76b60',priceLineVisible:true});candle.setData(payload.series);function line(key,color,width,style){const data=payload.series.filter(d=>ok(d[key])).map(d=>({time:d.time,value:Number(d[key])}));if(!data.length)return;const s=chart.addLineSeries({color,lineWidth:width,lineStyle:style,priceLineVisible:false,lastValueVisible:false});s.setData(data);}line('ma20','rgba(111,106,95,.35)',1,LightweightCharts.LineStyle.Dotted);line('ma50','#6f6a5f',1.4,LightweightCharts.LineStyle.Solid);line('ma200','#4088a8',2.1,LightweightCharts.LineStyle.Solid);const b=payload.bands||{};function pl(price,title,color,style,width){if(!ok(price))return;candle.createPriceLine({price:Number(price),color,lineWidth:width,lineStyle:style,axisLabelVisible:true,title});}pl(b.addLow,'ADD LOW','#2f6f4e',LightweightCharts.LineStyle.Dotted,2);pl(b.addHigh,'ADD HIGH','#2f6f4e',LightweightCharts.LineStyle.Dotted,2);pl(b.trimLow,'TRIM LOW','#ae7c2c',LightweightCharts.LineStyle.Dashed,2);pl(b.trimHigh,'TRIM HIGH','#ae7c2c',LightweightCharts.LineStyle.Dashed,2);pl(b.ma200,'200D DEFENSE','#4088a8',LightweightCharts.LineStyle.Solid,2);pl(b.hardRisk,'HARD RISK','#9f3f35',LightweightCharts.LineStyle.LargeDashed,2);pl(b.target,'TARGET','#2f6f4e',LightweightCharts.LineStyle.LargeDashed,2);const last=payload.series[payload.series.length-1];const markers=[];if(last)markers.push({time:last.time,position:'aboveBar',color:'#2c2a25',shape:'circle',text:'NOW '+Math.round(last.close).toLocaleString()});payload.events.filter(e=>e.id!=='now'&&e.time&&ok(e.price)).slice(0,3).forEach(e=>markers.push({time:e.time,position:last&&e.price>=last.close?'aboveBar':'belowBar',color:e.type==='REAL'?'#2f6f4e':e.type==='PROJ'?'#6f6a5f':'#ae7c2c',shape:e.type==='PROJ'?'arrowUp':'square',text:e.label}));candle.setMarkers(markers);chart.timeScale().fitContent();window.addEventListener('resize',()=>{try{chart.timeScale().fitContent()}catch(e){}});}build();})();</script>`;

const section = `<section id="operational-chart-section" class="panel operational-chart decision-map-compact"><div class="section-head"><div><p class="eyebrow">Operational Decision Chart</p><h2>${esc(state.label)}</h2><p class="op-stance">Compact SPX decision surface: read posture first, then price levels, then scenario confirmation.</p></div><a class="button" href="outputs/operational-chart-state.json">Open chart state</a></div><div class="working-verdict">${verdictCards}</div>${chart}<div class="scenario-cards">${scenarioCards}</div><div class="confirmation-row">${confirmationChips}${indicatorChips}</div></section>`;

const style = `<style id="operational-chart-style">#operational-chart-section,.decision-map-compact{max-width:100%;min-width:0;overflow:hidden;box-sizing:border-box}.decision-map-compact *{box-sizing:border-box}.decision-map-compact{margin-top:22px}.decision-map-compact .section-head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;flex-wrap:wrap;min-width:0}.decision-map-compact h2{font-size:clamp(28px,4vw,42px);line-height:1.02;margin:4px 0 8px}.op-stance{max-width:760px;color:var(--muted);font-size:14px;line-height:1.45}.working-verdict{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.working-verdict article,.level-grid article,.scenario-cards article,.confirmation-row article{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.10);padding:12px;min-width:0;overflow:hidden}.working-verdict span,.level-grid span,.scenario-cards span,.confirmation-row span{display:block;color:var(--muted);font-size:13px;line-height:1.35;text-transform:uppercase;letter-spacing:.06em}.working-verdict b{display:block;font-size:16px;line-height:1.35;margin-top:5px;overflow-wrap:anywhere}.op-chart-shell{display:grid;grid-template-columns:minmax(0,1fr) 260px;gap:12px;align-items:stretch;margin:12px 0 14px;min-width:0}.lwc-chart{height:600px;border:1px solid var(--rule);border-radius:18px;background:#f6f4ee;overflow:hidden;min-width:0}.op-level-rail{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.08);padding:12px;min-width:0;overflow:hidden}.op-level-rail h3{font-size:18px;margin:0 0 10px}.level-grid{display:grid;grid-template-columns:1fr;gap:8px;min-width:0}.level-grid b,.scenario-cards b,.confirmation-row b{display:block;font-size:16px;line-height:1.35;margin-top:4px;overflow-wrap:anywhere}.scenario-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:12px 0}.scenario-cards p{display:block;width:100%;font-size:14px;line-height:1.45;color:var(--muted);margin:6px 0 0;white-space:normal;overflow-wrap:anywhere}.confirmation-row{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin-top:10px}.op-badge{display:inline-block;font-size:11px;font-weight:700;padding:2px 5px;border-radius:4px;margin-left:4px;vertical-align:middle}.op-badge.real{background:rgba(47,111,78,.16);color:var(--green);border:1px solid rgba(47,111,78,.38)}.op-badge.est{background:rgba(174,124,44,.16);color:var(--warn);border:1px solid rgba(174,124,44,.38)}.op-badge.proj{background:rgba(251,250,246,.10);color:var(--muted);border:1px solid var(--rule)}.scenario-cards .bull{border-color:rgba(47,111,78,.38)}.scenario-cards .base{border-color:rgba(174,124,44,.42)}.scenario-cards .correction{border-color:rgba(159,63,53,.38)}@media(max-width:1180px){.op-chart-shell{grid-template-columns:1fr}.level-grid{grid-template-columns:repeat(3,minmax(0,1fr))}.working-verdict,.confirmation-row{grid-template-columns:repeat(2,minmax(0,1fr))}.lwc-chart{height:520px}}@media(max-width:760px){.working-verdict,.scenario-cards,.confirmation-row,.level-grid{grid-template-columns:1fr}.lwc-chart{height:420px}.decision-map-compact h2{font-size:30px}}</style>`;

let html = fs.readFileSync(indexPath, 'utf8');
html = removeSection(html, 'chart-wall-section');
html = removeSection(html, 'spx-cycle-map-section');
html = removeSection(html, 'cycle-scenario-section');
html = removeSection(html, 'operational-chart-section');
html = html.replace(/<style id="operational-chart-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style>\.operational-chart\{[\s\S]*?<\/style>/, '');
html = html.replace('</head>', `${style}</head>`);
html = html.replace(/<a href="#operational-chart-section">Decision Chart<\/a>/g, '');
html = html.replace(/<nav class="nav">/, '<nav class="nav"><a href="#operational-chart-section">Decision Chart</a>');
html = html.replace(/(<\/header>)/, `$1${section}`);
fs.writeFileSync(indexPath, html);
console.log(`injected compact SPX decision map: ${state.symbol || 'SPX'}`);
