'use strict';

/*
 * components/radar/momentum/render.cjs
 *
 * Renders the Phase 1 momentum engine as a compact module INSIDE an existing
 * homepage section (module mode) — not a standalone section — per the repo's
 * four-section rule. Mirrors components/radar/narrative-reality/render.cjs.
 */

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = v => Array.isArray(v) ? v : [];

function tierMeta(tierLabel, score, exposure) {
  // v2 gate: the badge must show tier/score/exposure, not just a color.
  const pct = exposure === null || exposure === undefined || !Number.isFinite(exposure)
    ? '—' : `${Math.round(exposure * 100)}%`;
  const s = Number.isInteger(score) ? score : '—';
  switch (tierLabel) {
    case 'FULL':     return { label: `FULL · stress ${s} · ${pct} exposure`,      cls: 'mom-green' };
    case 'REDUCED':  return { label: `REDUCED · stress ${s} · ${pct} exposure`,    cls: 'mom-yellow' };
    case 'DEFENSIVE':return { label: `DEFENSIVE · stress ${s}+ · ${pct} exposure`, cls: 'mom-red' };
    default:         return { label: `${tierLabel || 'unknown'} · stress ${s} · ${pct} exposure`, cls: '' };
  }
}

function fmtPct(v, digits = 1) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtNum(v, digits = 2) {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Number(v).toFixed(digits);
}

function renderRow(e) {
  const s = e.signals || {};
  return `<tr>
    <td class="mom-num">${esc(e.rank)}</td>
    <td class="mom-sym">${esc(e.symbol)}</td>
    <td class="mom-num">${fmtNum(e.composite, 3)}</td>
    <td class="mom-num">$${fmtNum(e.price)}</td>
    <td class="mom-num">${fmtPct(s.ret12m1m)}</td>
    <td class="mom-num">${fmtPct(s.dist52wHigh)}</td>
  </tr>`;
}

function renderMomentumSection(topDecile, gate, rebalance, state, options = {}) {
  if (!topDecile || !gate || !rebalance) return '';

  const meta  = tierMeta(gate.tierLabel, gate.score, gate.exposure);
  const list  = arr(topDecile.list).slice(0, 10);
  const rows  = list.map(e => {
    const full = (state?.table || []).find(t => t.symbol === e.symbol) || {};
    return renderRow({ ...e, signals: full.signals });
  }).join('');
  const health = state?.dataHealth || gate.dataHealth || 'UNKNOWN';
  const healthCls = health === 'FULL' ? 'mom-health-full' : 'mom-health-partial';

  const asOf = gate.generatedAt
    ? new Date(gate.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  const spx = gate.inputs?.spxVs200d || {};
  const hy  = gate.inputs?.hyOas || {};
  const vix = gate.inputs?.vix || {};
  const gateInputsLine = [
    spx.above === null ? 'SPX vs 200D: n/a' : `SPX ${spx.above ? 'above' : 'below'} 200D (${fmtPct(spx.marginPct)})`,
    hy.value  === null ? 'HY OAS: n/a'      : `HY OAS ${fmtNum(hy.value)}%`,
    vix.value === null ? 'VIX: n/a'         : `VIX ${fmtNum(vix.value, 0)}`,
  ].join(' · ');

  const topCount = topDecile.activeCount;
  const universeN = state?.includedCount || '';
  const scope = `top decile of ${universeN} · ${Math.round((topDecile.exposure ?? gate.exposure ?? 1) * 100)}% invested, rest cash`;

  const moduleMode = options.module === true;
  const shellOpen = moduleMode
    ? '<div id="momentum-module" class="mom-section mom-module">'
    : '<section id="momentum-section" class="panel mom-section">';
  const shellClose = moduleMode ? '</div>' : '</section>';

  return `${shellOpen}
  <div class="mom-wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Systematic engines · Momentum${asOf ? ` · ${esc(asOf)}` : ''}</p>
        <h2>Momentum rank</h2>
      </div>
      <span class="mom-gate ${esc(meta.cls)}">${esc(meta.label)}</span>
    </div>

    <p class="mom-reason">${esc(gate.reason || '')}</p>
    <p class="mom-inputs">${esc(gateInputsLine)}</p>

    ${list.length ? `<table class="mom-table">
      <thead><tr>
        <th class="mom-num">#</th><th>Symbol</th><th class="mom-num">Composite</th>
        <th class="mom-num">Price</th><th class="mom-num">12m−1m</th><th class="mom-num">vs 52wH</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="mom-scope">Showing top 10 of ${esc(topCount)} active names (${esc(scope)})</p>`
    : `<p class="mom-empty">No active momentum names — engine data unavailable.</p>`}

    <div class="mom-foot">
      <span class="mom-rebal">Next rebalance: <strong>${esc(rebalance.nextRebalanceDate || '—')}</strong>${(() => {
        const d = rebalance.tradingDaysRemaining;
        if (d === undefined || d === null) return '';
        // On rebalance day itself the countdown reads "1 trading days away"
        // for a date that is today — say "today" instead. Also fix singular.
        const todayIso = new Date().toISOString().slice(0, 10);
        if (rebalance.nextRebalanceDate && rebalance.nextRebalanceDate <= todayIso) return ' · today';
        return ` · ${esc(d)} trading day${d === 1 ? '' : 's'} away`;
      })()}</span>
      <span class="mom-health ${esc(healthCls)}">Data: ${esc(health)}${state?.coverageCount ? ` · ${esc(state.coverageCount)}/${esc(state.universeCount)} symbols` : ''}</span>
    </div>
    ${state?.excludedCount ? `<p class="mom-note">${esc(state.excludedCount)} symbols excluded (insufficient history). Universe is current S&amp;P 500 members — historical ranks carry survivorship bias.</p>` : ''}
  </div>
${shellClose}`;
}

function renderMomentumStyle() {
  return `<style id="momentum-style">
.mom-section{padding-top:28px}
.mom-module{margin-top:22px;border-top:1px solid rgba(201,191,173,.45);padding-top:22px}
.mom-wrap{width:min(1240px,calc(100% - 48px));margin:0 auto}
.mom-wrap .section-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.mom-gate{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:4px 12px;border-radius:999px;border:1px solid;white-space:nowrap}
.mom-green{color:var(--green,#2f6f4e);border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.07)}
.mom-yellow{color:#8a6a1f;border-color:rgba(138,106,44,.5);background:rgba(138,106,44,.08)}
.mom-red{color:#a4502f;border-color:rgba(164,80,47,.5);background:rgba(164,80,47,.08)}
.mom-reason{font-size:14px;color:#24231f;margin:10px 0 4px}
.mom-inputs{font-size:12px;color:#6b675c;margin:0 0 16px}
.mom-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px}
.mom-table th{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#6b675c;text-align:left;padding:6px 10px;border-bottom:1px solid rgba(201,191,173,.6)}
.mom-table td{padding:7px 10px;border-bottom:1px solid rgba(201,191,173,.25)}
.mom-table .mom-num{text-align:right;font-variant-numeric:tabular-nums}
.mom-sym{font-weight:700;letter-spacing:.02em}
.mom-scope{font-size:12px;color:#6b675c;margin:8px 0 0}
.mom-empty{font-size:14px;color:#24231f;background:rgba(164,80,47,.05);border:1px solid rgba(164,80,47,.25);padding:14px 16px;margin:12px 0 0}
.mom-foot{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:16px;font-size:12px;color:#6b675c}
.mom-health{font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:10px}
.mom-health-full{color:var(--green,#2f6f4e)}
.mom-health-partial{color:#8a6a1f}
.mom-note{font-size:11px;color:#8a8578;margin:8px 0 0}
</style>`;
}

module.exports = { renderMomentumSection, renderMomentumStyle };
