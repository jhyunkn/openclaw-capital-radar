const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'market-decision-brief-state.json');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;

function macro(state, key) {
  return arr(state.macro_values).find(item => item.key === key) || null;
}

function val(state, key) {
  return num(macro(state, key)?.value);
}

function fmt(value, suffix = '') {
  return Number.isFinite(value) ? `${value.toFixed(value >= 100 ? 0 : 2)}${suffix}` : '—';
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function bandLabel(value, bands) {
  if (!Number.isFinite(value)) return 'No print';
  for (const band of bands) {
    if (value >= band.min && value < band.max) return band.label;
  }
  return bands[bands.length - 1]?.label || '—';
}

function position(value, min, max) {
  if (!Number.isFinite(value)) return 50;
  return clamp(((value - min) / (max - min)) * 100, 0, 100);
}

function gauge({ label, value, suffix = '', min, max, bands, left, right }) {
  const pct = position(value, min, max);
  const state = bandLabel(value, bands);
  const ticks = bands.map(b => `<span style="left:${position(b.min, min, max)}%">${esc(b.label)}</span>`).join('');
  return `<article class="market-gauge"><div><span>${esc(label)}</span><b>${esc(fmt(value, suffix))}</b><small>${esc(state)}</small></div><div class="market-gauge-bar"><i style="left:${pct}%"></i></div><div class="market-gauge-axis"><em>${esc(left)}</em><em>${esc(right)}</em></div><div class="market-gauge-ticks">${ticks}</div></article>`;
}

function tile(label, status, metric) {
  return `<article class="market-state-tile"><span>${esc(label)}</span><b>${esc(status)}</b><small>${esc(metric)}</small></article>`;
}

function buildMap(state) {
  const vix = val(state, 'vix');
  const tenY = val(state, 'dgs10');
  const hy = val(state, 'hy_oas');
  const conf = val(state, 'confirmation');
  const rsi = val(state, 'rsi14');

  const gauges = [
    gauge({ label: 'VIX · volatility temperature', value: vix, min: 10, max: 40, bands: [{ min: 10, max: 18, label: 'Calm' }, { min: 18, max: 24, label: 'Watch' }, { min: 24, max: 100, label: 'Stress' }], left: 'calm', right: 'stress' }),
    gauge({ label: '10Y Treasury · price of time', value: tenY, suffix: '%', min: 3.2, max: 5.2, bands: [{ min: 0, max: 4.1, label: 'Relief' }, { min: 4.1, max: 4.45, label: 'Pressure' }, { min: 4.45, max: 10, label: 'Restrictive' }], left: 'cheap time', right: 'expensive time' }),
    gauge({ label: 'HY OAS · credit stress', value: hy, suffix: '%', min: 2.5, max: 7, bands: [{ min: 0, max: 3.5, label: 'Contained' }, { min: 3.5, max: 5, label: 'Watch' }, { min: 5, max: 20, label: 'Stress' }], left: 'contained', right: 'stress' }),
    gauge({ label: 'Confirmation · breadth / structure', value: conf, min: 0, max: 100, bands: [{ min: 0, max: 45, label: 'Weak' }, { min: 45, max: 70, label: 'Mixed' }, { min: 70, max: 101, label: 'Broad' }], left: 'weak', right: 'broad' }),
    gauge({ label: 'RSI 14 · heat', value: rsi, min: 20, max: 85, bands: [{ min: 0, max: 45, label: 'Weak' }, { min: 45, max: 70, label: 'Tradable' }, { min: 70, max: 100, label: 'Heated' }], left: 'cold', right: 'heated' })
  ].join('');

  const assetTiles = [
    tile('Cash / Money', Number.isFinite(vix) && vix < 18 ? 'Buffer available' : 'Keep liquidity close', `VIX ${fmt(vix)}`),
    tile('Sovereign Bonds / Duration', Number.isFinite(tenY) && tenY >= 4.45 ? 'Restrictive' : Number.isFinite(tenY) && tenY >= 4.1 ? 'Pressure' : 'Relief', `10Y ${fmt(tenY, '%')}`),
    tile('Credit', Number.isFinite(hy) && hy < 3.5 ? 'Contained' : Number.isFinite(hy) && hy < 5 ? 'Watch' : 'Stress', `HY OAS ${fmt(hy, '%')}`),
    tile('Equity Ownership', Number.isFinite(conf) && conf >= 70 ? 'Broad participation' : Number.isFinite(conf) && conf >= 45 ? 'Selective participation' : 'Weak participation', `Confirmation ${fmt(conf)}`),
    tile('Volatility / Optionality', Number.isFinite(vix) && vix < 18 ? 'Optionality cheapens' : 'Optionality has value', `VIX ${fmt(vix)}`),
    tile('Speculative Liquidity', Number.isFinite(rsi) && rsi >= 70 ? 'Heated' : Number.isFinite(vix) && vix < 18 ? 'Open but watch heat' : 'Fragile', `RSI ${fmt(rsi)}`)
  ].join('');

  return `<section class="market-state-map" id="market-state-map"><div class="market-state-head"><div><p class="eyebrow">6A · Market state map</p><h3>Let the instruments speak.</h3><p>Threshold bands replace prose. Read left-to-right: volatility, price of time, credit stress, participation, and heat.</p></div></div><div class="market-gauge-grid">${gauges}</div><div class="market-state-tile-grid">${assetTiles}</div></section>`;
}

function main() {
  if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
  const state = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, 'utf8')) : {};
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(/<section class="macro-compression">[\s\S]*?<\/section>\s*/g, '');
  html = html.replace(/<section class="market-state-map"[\s\S]*?<\/section>\s*/g, '');
  html = html.replace(/<style>\.market-state-map[\s\S]*?<\/style>/g, '');

  const style = `<style>.market-state-map{border:1px solid rgba(36,35,31,.18);border-radius:24px;background:#ffffff;padding:18px;margin:0 0 18px}.market-state-head{display:flex;justify-content:space-between;gap:18px;align-items:end}.market-state-head h3{font-size:clamp(28px,3.2vw,52px);line-height:.94;letter-spacing:-.065em;font-weight:500;margin:4px 0}.market-state-head p{max-width:780px;color:rgba(36,35,31,.68);font-size:13px;line-height:1.4}.market-gauge-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin-top:14px}.market-gauge,.market-state-tile{border:1px solid var(--rule);border-radius:16px;background:rgba(255,255,255,.18);padding:12px;min-width:0}.market-gauge span,.market-state-tile span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.1em}.market-gauge b,.market-state-tile b{display:block;font-size:20px;line-height:1.05;letter-spacing:-.03em;font-weight:500;margin-top:8px}.market-gauge small,.market-state-tile small{display:block;color:var(--muted);font-size:11px;line-height:1.3;margin-top:4px}.market-gauge-bar{position:relative;height:9px;border-radius:999px;margin:12px 0 6px;background:linear-gradient(90deg,rgba(47,111,78,.36),rgba(174,124,44,.34),rgba(159,63,53,.36));overflow:hidden}.market-gauge-bar i{position:absolute;top:-3px;width:3px;height:15px;border-radius:999px;background:rgba(36,35,31,.86);box-shadow:0 0 0 3px rgba(251,250,246,.8)}.market-gauge-axis{display:flex;justify-content:space-between;color:var(--muted);font-size:9px}.market-gauge-axis em{font-style:normal}.market-gauge-ticks{position:relative;height:14px;margin-top:4px;color:rgba(36,35,31,.48);font-size:8px}.market-gauge-ticks span{position:absolute;transform:translateX(-50%);white-space:nowrap;font-size:8px;color:rgba(36,35,31,.48);letter-spacing:0;text-transform:none}.market-state-tile-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-top:8px}@media(max-width:1180px){.market-gauge-grid{grid-template-columns:repeat(3,1fr)}.market-state-tile-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:720px){.market-gauge-grid,.market-state-tile-grid{grid-template-columns:1fr}}</style>`;
  html = html.replace('</head>', `${style}</head>`);

  const insertAfter = html.indexOf('</div>\n    <div class="macro-signal-grid">');
  if (insertAfter >= 0) {
    html = html.slice(0, insertAfter + 6) + `\n    ${buildMap(state)}` + html.slice(insertAfter + 6);
  } else {
    const macroStart = html.indexOf('<section id="decision-brief-section"');
    if (macroStart < 0) throw new Error('decision-brief-section missing for market-state-map injection');
    const firstGrid = html.indexOf('<div class="macro-signal-grid">', macroStart);
    if (firstGrid < 0) throw new Error('macro-signal-grid missing for market-state-map injection');
    html = html.slice(0, firstGrid) + buildMap(state) + html.slice(firstGrid);
  }

  fs.writeFileSync(indexPath, html);
  console.log('injected chart-driven Market State Map into Macro');
}

main();
