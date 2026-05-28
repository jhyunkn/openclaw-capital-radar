const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;

function takeWindow(rows, years = 10, limit = 420) {
  const valid = arr(rows).filter(row => row && row.date && Number.isFinite(Number(row.value))).map(row => ({ date: row.date, value: Number(row.value) }));
  if (!valid.length) return [];
  const latest = valid[valid.length - 1];
  const cutoff = new Date(`${latest.date}T00:00:00Z`);
  cutoff.setUTCFullYear(cutoff.getUTCFullYear() - years);
  let windowed = valid.filter(row => new Date(`${row.date}T00:00:00Z`) >= cutoff);
  if (windowed.length > limit) {
    const step = Math.ceil(windowed.length / limit);
    windowed = windowed.filter((_, index) => index % step === 0 || index === windowed.length - 1);
  }
  return windowed;
}

function domainForSeries(seriesMap) {
  const allRows = Object.values(seriesMap || {}).flatMap(rows => arr(rows));
  const values = allRows.map(row => Number(row.value)).filter(Number.isFinite);
  const dates = allRows.map(row => new Date(`${row.date}T00:00:00Z`).getTime()).filter(Number.isFinite);
  if (!values.length || !dates.length) return null;
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const pad = Math.max((maxValue - minValue) * 0.12, 0.5);
  return {
    minDate: Math.min(...dates),
    maxDate: Math.max(...dates),
    minValue: minValue - pad,
    maxValue: maxValue + pad
  };
}

function pathForRows(rows, domain, width, height, pad) {
  if (!domain || !rows.length) return '';
  const innerW = width - pad.left - pad.right;
  const innerH = height - pad.top - pad.bottom;
  return rows.map((row, index) => {
    const t = new Date(`${row.date}T00:00:00Z`).getTime();
    const x = pad.left + ((t - domain.minDate) / Math.max(1, domain.maxDate - domain.minDate)) * innerW;
    const y = pad.top + (1 - ((row.value - domain.minValue) / Math.max(1e-9, domain.maxValue - domain.minValue))) * innerH;
    return `${index ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
}

function xForDate(date, domain, width, pad) {
  if (!domain || !date) return null;
  const t = new Date(`${date}T00:00:00Z`).getTime();
  if (!Number.isFinite(t) || t < domain.minDate || t > domain.maxDate) return null;
  return pad.left + ((t - domain.minDate) / Math.max(1, domain.maxDate - domain.minDate)) * (width - pad.left - pad.right);
}

function formatValue(value) {
  const n = num(value);
  return n == null ? '—' : `${n.toFixed(2)}%`;
}

function renderMainChart(state) {
  const chart = state?.chart_series?.money_cash_main || null;
  const rawSeries = chart?.series || {};
  const series = {
    tbill_3m_yield: takeWindow(rawSeries.tbill_3m_yield, 10),
    cpi_yoy: takeWindow(rawSeries.cpi_yoy, 10),
    real_cash_yield: takeWindow(rawSeries.real_cash_yield, 10)
  };
  const domain = domainForSeries(series);
  if (!domain) return `<div class="money-cash-empty">Money / Cash chart data is pending. Run <code>npm run generate:money-cash</code>.</div>`;

  const width = 920;
  const height = 330;
  const pad = { left: 42, right: 26, top: 26, bottom: 36 };
  const annotations = arr(state?.annotation_spec?.charts?.money_cash_main)
    .filter(item => item && item.date_start)
    .map(item => ({ ...item, x: xForDate(item.date_start, domain, width, pad) }))
    .filter(item => Number.isFinite(item.x));
  const selectedAnnotations = annotations.filter((_, index) => index % Math.ceil(Math.max(1, annotations.length / 8)) === 0).slice(0, 8);

  const y0 = pad.top + (1 - ((0 - domain.minValue) / Math.max(1e-9, domain.maxValue - domain.minValue))) * (height - pad.top - pad.bottom);
  const current = state?.web_summary?.current_reading || {};

  return `<div class="money-cash-chart-shell">
    <div class="money-cash-chart-topline">
      <div><span>Raw chart</span><b>3M T-bill yield vs CPI YoY vs real cash yield</b></div>
      <div class="money-cash-current-strip">
        <article><span>3M bill</span><b>${esc(formatValue(current.tbill_3m_yield))}</b></article>
        <article><span>CPI YoY</span><b>${esc(formatValue(state?.derived?.cpi_yoy?.value))}</b></article>
        <article><span>Real cash</span><b>${esc(formatValue(current.real_cash_yield))}</b></article>
      </div>
    </div>
    <svg class="money-cash-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Money Cash historical data chart">
      <line x1="${pad.left}" y1="${height - pad.bottom}" x2="${width - pad.right}" y2="${height - pad.bottom}" class="mc-axis" />
      <line x1="${pad.left}" y1="${pad.top}" x2="${pad.left}" y2="${height - pad.bottom}" class="mc-axis" />
      ${Number.isFinite(y0) ? `<line x1="${pad.left}" y1="${y0.toFixed(1)}" x2="${width - pad.right}" y2="${y0.toFixed(1)}" class="mc-zero" />` : ''}
      ${selectedAnnotations.map((item, index) => `<g class="mc-annotation"><line x1="${item.x.toFixed(1)}" y1="${pad.top}" x2="${item.x.toFixed(1)}" y2="${height - pad.bottom}" /><text x="${Math.min(width - 180, item.x + 5).toFixed(1)}" y="${(pad.top + 14 + (index % 4) * 16).toFixed(1)}">${esc(item.label)}</text></g>`).join('')}
      <path d="${esc(pathForRows(series.tbill_3m_yield, domain, width, height, pad))}" class="mc-line mc-tbill" />
      <path d="${esc(pathForRows(series.cpi_yoy, domain, width, height, pad))}" class="mc-line mc-cpi" />
      <path d="${esc(pathForRows(series.real_cash_yield, domain, width, height, pad))}" class="mc-line mc-real" />
      <text x="${pad.left}" y="${height - 10}" class="mc-axis-label">${esc(series.tbill_3m_yield[0]?.date || '')}</text>
      <text x="${width - pad.right - 82}" y="${height - 10}" class="mc-axis-label">${esc(series.tbill_3m_yield[series.tbill_3m_yield.length - 1]?.date || '')}</text>
    </svg>
    <div class="money-cash-legend"><span class="tbill">3M T-bill</span><span class="cpi">CPI YoY</span><span class="real">Real cash yield</span><span class="mark">Historical set points</span></div>
  </div>`;
}

function renderAnnotationTable(state) {
  const rows = arr(state?.annotation_spec?.charts?.money_cash_main).slice(-10).reverse();
  if (!rows.length) return `<p class="money-cash-note">No supported historical annotations yet. The generator will suppress set points if the dataset does not cover them.</p>`;
  return `<div class="money-cash-annotation-table"><table><thead><tr><th>Set point</th><th>Period</th><th>Current vs set point</th></tr></thead><tbody>${rows.map(item => {
    const comp = item.current_comparison?.real_cash_yield || item.current_comparison?.tbill_3m_yield || null;
    const basis = comp ? (comp.difference_from_event ?? comp.difference_from_regime_average) : null;
    return `<tr><th>${esc(item.label)}<small>${esc(item.why_it_matters || item.note || '')}</small></th><td>${esc(item.date_start || item.target_date || '')}${item.date_end ? ` → ${esc(item.date_end)}` : ''}</td><td>${basis == null ? 'Dataset-supported marker' : `${basis > 0 ? '+' : ''}${esc(Number(basis).toFixed(2))} vs reference`}</td></tr>`;
  }).join('')}</tbody></table></div>`;
}

function renderMoneyCashWorkbench(state) {
  const status = state ? state.coverage || 'PARTIAL' : 'PENDING';
  return `<section class="macro-operating-block money-cash-workbench"><div class="macro-block-title"><p class="eyebrow">Asset-class workbench</p><h3>Money / Cash: raw dataset with historical set-point annotations.</h3></div>
    <div class="money-cash-grid">
      <div>${renderMainChart(state)}</div>
      <aside class="money-cash-sidecar">
        <article><span>Coverage</span><b>${esc(status)}</b><small>Annotations are rendered only if the dataset covers the historical set point.</small></article>
        <article><span>Annotation policy</span><b>Data-backed only</b><small>No values are invented. Unsupported historical points are suppressed and recorded.</small></article>
        <article><span>Suppressed markers</span><b>${esc(arr(state?.annotation_spec?.suppressed).length)}</b><small>Suppressed because chart series did not reach the event/regime window.</small></article>
      </aside>
    </div>
    ${renderAnnotationTable(state)}
  </section>`;
}

function renderMoneyCashWorkbenchStyle() {
  return `<style>.money-cash-workbench{--mc-tbill:#4d6f91;--mc-cpi:#a4502f;--mc-real:#2f6f4e}.money-cash-grid{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:10px}.money-cash-chart-shell,.money-cash-sidecar article,.money-cash-annotation-table{border:1px solid var(--rule);border-radius:20px;background:rgba(251,250,246,.24);padding:14px}.money-cash-chart-topline{display:flex;align-items:start;justify-content:space-between;gap:18px;margin-bottom:8px}.money-cash-chart-topline span,.money-cash-current-strip span,.money-cash-sidecar span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.1em}.money-cash-chart-topline b{display:block;font-size:22px;line-height:1.05;letter-spacing:-.035em;font-weight:500;margin-top:4px}.money-cash-current-strip{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px;min-width:280px}.money-cash-current-strip article{border:1px solid var(--rule);border-radius:14px;padding:8px;background:rgba(255,255,255,.18)}.money-cash-current-strip b,.money-cash-sidecar b{display:block;font-size:17px;font-weight:500;margin-top:4px}.money-cash-svg{width:100%;height:auto;display:block}.mc-axis{stroke:rgba(36,35,31,.28);stroke-width:1}.mc-zero{stroke:rgba(36,35,31,.34);stroke-dasharray:4 5;stroke-width:1}.mc-line{fill:none;stroke-width:2.2;vector-effect:non-scaling-stroke}.mc-tbill{stroke:var(--mc-tbill)}.mc-cpi{stroke:var(--mc-cpi)}.mc-real{stroke:var(--mc-real);stroke-width:2.9}.mc-annotation line{stroke:rgba(36,35,31,.22);stroke-width:1;stroke-dasharray:2 4}.mc-annotation text,.mc-axis-label{fill:rgba(36,35,31,.62);font-size:10px}.money-cash-legend{display:flex;gap:12px;flex-wrap:wrap;color:var(--muted);font-size:11px}.money-cash-legend span:before{content:'';display:inline-block;width:16px;height:2px;margin-right:5px;vertical-align:middle;background:currentColor}.money-cash-legend .tbill{color:var(--mc-tbill)}.money-cash-legend .cpi{color:var(--mc-cpi)}.money-cash-legend .real{color:var(--mc-real)}.money-cash-legend .mark{color:rgba(36,35,31,.45)}.money-cash-sidecar{display:grid;gap:8px;align-content:start}.money-cash-sidecar small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:6px}.money-cash-annotation-table{margin-top:10px;overflow:auto}.money-cash-annotation-table table{width:100%;border-collapse:collapse}.money-cash-annotation-table th,.money-cash-annotation-table td{padding:10px;border-bottom:1px solid var(--rule);font-size:12px;text-align:left;vertical-align:top}.money-cash-annotation-table tr:last-child th,.money-cash-annotation-table tr:last-child td{border-bottom:0}.money-cash-annotation-table small{display:block;color:var(--muted);font-weight:400;line-height:1.3;margin-top:3px}.money-cash-empty,.money-cash-note{border:1px dashed var(--rule);border-radius:16px;padding:18px;color:var(--muted);font-size:12px}@media(max-width:980px){.money-cash-grid{grid-template-columns:1fr}.money-cash-current-strip{min-width:0}}@media(max-width:620px){.money-cash-chart-topline{display:block}.money-cash-current-strip{grid-template-columns:1fr;margin-top:10px}}</style>`;
}

module.exports = { renderMoneyCashWorkbench, renderMoneyCashWorkbenchStyle };
