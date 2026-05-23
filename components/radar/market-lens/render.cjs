const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = (value, digits = 2) => num(value) === null ? '—' : num(value).toLocaleString(undefined, { maximumFractionDigits: digits });
const pct = value => num(value) === null ? '—' : `${fmt(value, 1)}%`;

function stanceClass(value) {
  const s = String(value || '').toUpperCase();
  if (/SUPPORTIVE|CONTAINED/.test(s)) return 'good';
  if (/VERIFY|WATCH|EXTENDED|MIXED/.test(s)) return 'warn';
  if (/DEFENSIVE|STRESS/.test(s)) return 'bad';
  return '';
}

function renderSparkline(points) {
  const pts = arr(points).filter(point => num(point.v) !== null);
  if (pts.length < 2) return '';
  const values = pts.map(point => num(point.v));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = max === min ? 50 : 100 - ((value - min) / (max - min)) * 100;
    return `${x},${y}`;
  }).join(' ');
  return `<svg class="lens-spark" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${coords}"/></svg>`;
}

function renderLensCard(lens) {
  return `<article class="lens-card ${stanceClass(lens.stance)}">
    <div class="lens-head"><span>${esc(lens.label)}</span><b>${esc(lens.id)}</b><em>${esc(lens.stance)}</em></div>
    ${renderSparkline(lens.sparkline)}
    <div class="lens-metrics">
      <div><span>Price</span><b>${fmt(lens.price, lens.id === 'VIX' ? 1 : 2)}</b></div>
      <div><span>Day</span><b>${pct(lens.day_change_pct)}</b></div>
      <div><span>50D</span><b>${pct(lens.distance_to_50d_pct)}</b></div>
      <div><span>200D</span><b>${pct(lens.distance_to_200d_pct)}</b></div>
      <div><span>RSI</span><b>${fmt(lens.rsi14, 1)}</b></div>
    </div>
    <p>${esc(lens.read)}</p>
    <small>${esc(lens.action)}</small>
  </article>`;
}

function renderMarketLensSection(state) {
  const cards = arr(state.lenses).map(renderLensCard).join('');
  return `<section id="market-lens-section" class="panel market-lens">
    <div class="section-head"><div><p class="eyebrow">Cross-Asset Lens</p><h2>What confirms or contradicts the SPX decision chart?</h2><p class="lens-regime">${esc(state.regime)}</p></div><a class="button" href="outputs/market-lens-state.json">Open lens state</a></div>
    <div class="lens-grid">${cards}</div>
  </section>`;
}

function renderMarketLensStyle() {
  return `<style>.market-lens{margin-top:22px}.lens-regime{color:var(--muted);margin:4px 0 0;text-transform:uppercase;letter-spacing:.08em;font-size:12px}.lens-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}.lens-card{border:1px solid var(--rule);border-radius:18px;padding:12px;background:rgba(251,250,246,.10)}.lens-card.good{border-color:rgba(47,111,78,.38)}.lens-card.warn{border-color:rgba(174,124,44,.44)}.lens-card.bad{border-color:rgba(159,63,53,.44)}.lens-head{display:grid;grid-template-columns:1fr auto;gap:4px;align-items:start}.lens-head span{grid-column:1/-1;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.lens-head b{font-size:22px}.lens-head em{font-style:normal;font-size:10px;text-transform:uppercase;letter-spacing:.08em;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;color:var(--muted)}.lens-spark{width:100%;height:72px;margin:10px 0;border-top:1px solid var(--rule2);border-bottom:1px solid var(--rule2);padding:6px 0}.lens-spark polyline{fill:none;stroke:currentColor;stroke-width:2;vector-effect:non-scaling-stroke;opacity:.78}.lens-metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:4px;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.lens-metrics div{padding:6px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}.lens-metrics span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.lens-metrics b{display:block;font-size:12px;margin-top:2px}.lens-card p{font-size:12px;line-height:1.35;margin:10px 0 4px}.lens-card small{display:block;color:var(--muted);font-size:11px;line-height:1.35}@media(max-width:1100px){.lens-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:720px){.lens-grid{grid-template-columns:1fr}.lens-metrics{grid-template-columns:repeat(2,1fr)}}</style>`;
}

module.exports = { renderMarketLensSection, renderMarketLensStyle, renderLensCard, renderSparkline, stanceClass };
