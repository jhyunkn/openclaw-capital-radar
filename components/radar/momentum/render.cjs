'use strict';

/*
 * components/radar/momentum/render.cjs
 *
 * Renders the Phase 1 momentum engine as a compact module INSIDE an existing
 * homepage section (module mode) — not a standalone section — per the repo's
 * four-section rule. Mirrors components/radar/narrative-reality/render.cjs.
 */

const { formatEarnings } = require('../../../scripts/lib/earnings.cjs');

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

function renderRow(e, changes) {
  const s = e.signals || {};
  return `<tr>
    <td class="mom-num">${esc(e.rank)}</td>
    <td class="mom-sym">${esc(e.symbol)}</td>
    <td>${entryBadge(e.entryQuality)}</td>
    <td class="mom-num">${changeChip(e.symbol, changes)}</td>
    <td class="mom-num">${fmtNum(e.composite, 3)}</td>
    <td class="mom-num">$${fmtNum(e.price)}</td>
    <td class="mom-num">${fmtPct(s.ret12m1m)}</td>
    <td class="mom-num">${fmtPct(s.dist52wHigh)}</td>
  </tr>`;
}

function entryBadge(eq) {
  const rating = eq && eq.rating;
  const cls = rating === 'GOOD' ? 'mom-eq-good'
    : rating === 'POOR' ? 'mom-eq-poor' : 'mom-eq-fair';
  const reasons = eq && Array.isArray(eq.reasons) ? eq.reasons.join('; ') : '';
  const et = eq && eq.earningsTiming;
  const earn = ` · ${formatEarnings(et, { short: true })}`;
  // Earnings inside two weeks changes the entry read, so it shows on the row, not only on hover.
  const soon = et && et.status === 'scheduled' && et.daysAway <= 14
    ? ` <span class="mom-earn" title="Source: ${esc(et.source)}">${esc(formatEarnings(et))}</span>` : '';
  const label = rating === 'GOOD' ? 'GOOD — constructive entry zone'
    : rating === 'POOR' ? 'POOR — chasing, wait'
    : rating === 'FAIR' ? 'FAIR — extended or consolidating, scale or wait' : '—';
  return `<span class="mom-eq ${cls}" title="${esc(reasons)}${esc(earn)}">${esc(label)}</span>${soon}`;
}

function changeChip(sym, changes) {
  if (!changes) return '—';
  if ((changes.newIn || []).includes(sym)) return '<span class="mom-new">NEW</span>';
  const rc = (changes.rankChanges || []).find(r => r.symbol === sym);
  if (rc && rc.change) {
    const up = rc.change > 0;
    return `<span class="mom-delta ${up ? 'mom-up' : 'mom-down'}" title="rank ${esc(rc.prevRank)} → ${esc(rc.rank)} since ${esc(changes.vsRebalanceDate || '')} rebalance">${up ? '▲' : '▼'}${esc(Math.abs(rc.change))}</span>`;
  }
  return '—';
}

function fmtRebalanceDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// Posture disagreement (display only — never changes engine math).
// The momentum gate and the narrative ladder are different systems with
// different thresholds: the gate trips only at VIX >= 30 / HY OAS >= 4%,
// while the ladder stands down at VIX > 25. When they point different ways,
// say so on the page with both as-of dates, so the reader never mistakes
// one system's close for the other's.
function renderPostureDisagreement(gate, options = {}) {
  const episode = options.episode || null;
  const stance = options.briefStance || null;
  if (!episode || !stance) return '';
  const epVix = episode.vix && Number.isFinite(Number(episode.vix.close))
    ? Number(episode.vix.close) : null;
  const standdownOn = epVix !== null && epVix > 25;
  const smhZone = episode.smh && episode.smh.zone ? String(episode.smh.zone) : null;
  const smhBelowZone2 = smhZone === 'BELOW_ZONE_2';
  const engineFull = gate.tierLabel === 'FULL' || gate.tierLabel === 'REDUCED';
  const ladderCautious = stance === 'Watch' || stance === 'Trim' || stance === 'Exit';
  if (!standdownOn && !(engineFull && ladderCautious)) return '';

  const gateVix = gate.inputs && gate.inputs.vix && Number.isFinite(Number(gate.inputs.vix.value))
    ? Number(gate.inputs.vix.value) : null;
  const gateAsOf = gate.generatedAt
    ? new Date(gate.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const epAsOf = episode.dataThrough ? fmtRebalanceDate(episode.dataThrough) : '';
  const exposurePct = Math.round((gate.exposure ?? 1) * 100);
  const smhNote = smhBelowZone2 ? ' SMH is below Zone 2.' : '';
  // Lead with the two thresholds in plain words: the same VIX number reads
  // differently because the two systems trip at different levels. Without
  // that sentence the badge ("stress 0") and the stand-down ("VIX above 25")
  // look like a contradiction.
  if (standdownOn) {
    return `<p class="mom-disagree"><strong>Two different thresholds — not a contradiction.</strong> The engine stays ${esc(gate.tierLabel || '?')} until VIX reaches 30 or HY OAS reaches 4%; the ladder stands down as soon as VIX passes 25. Right now the engine reads VIX ${gateVix === null ? 'n/a' : fmtNum(gateVix, 1)}${gateAsOf ? ` (${esc(gateAsOf)} — below its 30 line)` : ''} and says ${esc(gate.tierLabel || '?')} · ${exposurePct}%, while the ladder reads the ${epAsOf ? esc(epAsOf) + ' ' : ''}close, VIX ${epVix === null ? 'n/a' : fmtNum(epVix, 2)} (above its 25 line), and says ${esc(stance)}.${esc(smhNote)} Engine math unchanged — the two systems disagree, and the disagreement is the signal.</p>`;
  }
  return `<p class="mom-disagree"><strong>Posture disagreement.</strong> Engine ${esc(gate.tierLabel || '?')} · ${exposurePct}% vs ladder ${esc(stance)} — the two systems use different gates, so they can point different ways.${esc(smhNote)} Engine math unchanged — the disagreement is the signal.</p>`;
}

function renderMomentumSection(topDecile, gate, rebalance, state, options = {}) {
  if (!topDecile || !gate || !rebalance) return '';

  const meta  = tierMeta(gate.tierLabel, gate.score, gate.exposure);
  const list  = arr(topDecile.list).slice(0, 10);
  const changes = rebalance.changes || null;
  const rows  = list.map(e => {
    const full = (state?.table || []).find(t => t.symbol === e.symbol) || {};
    return renderRow({ ...e, signals: full.signals, entryQuality: full.entryQuality }, changes);
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

  // Ladder stand-down state as a displayed input (from the episode close,
  // not the gate's own VIX — the two are different as-of dates; see the
  // disagreement note below the inputs line).
  const episode = options.episode || null;
  const epVix = episode && episode.vix && Number.isFinite(Number(episode.vix.close))
    ? Number(episode.vix.close) : null;
  const epAsOf = episode && episode.dataThrough ? fmtRebalanceDate(episode.dataThrough) : '';
  const standdownLine = epVix === null ? ''
    : ` · Ladder stand-down ${epVix > 25 ? 'ON' : 'OFF'} (VIX ${fmtNum(epVix, 2)} vs 25, ${epAsOf} close)`;
  const disagreement = renderPostureDisagreement(gate, options);

  const topCount = topDecile.activeCount;
  const universeN = state?.includedCount || '';
  const sleevePct = Math.round((topDecile.exposure ?? gate.exposure ?? 1) * 100);
  const scope = `top decile of ${universeN} ranked names · the sleeve is ${sleevePct}% invested in these names${sleevePct < 100 ? ', the rest in cash' : ''}`;

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
    <p class="mom-inputs">${esc(gateInputsLine)}${standdownLine ? esc(standdownLine) : ''}</p>
    ${disagreement}

    ${list.length ? `<div class="mom-tablewrap"><table class="mom-table">
      <thead><tr>
        <th class="mom-num">#</th><th>Symbol</th><th>Entry</th><th class="mom-num" title="Rank change vs previous monthly rebalance">Δ</th><th class="mom-num">Composite</th>
        <th class="mom-num">Price</th><th class="mom-num" title="12-month return excluding the latest month — the momentum signal">12-month momentum</th><th class="mom-num" title="Distance below the 52-week high (0% = at the high)">vs 52-week high</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table></div>
    <p class="mom-scope">Showing top 10 of ${esc(topCount)} active portfolio names (${esc(scope)})</p>
    <p class="mom-note">The 12-month column excludes the latest month (the standard momentum window). Triple-digit values are real multi-baggers over the past year, not data errors.</p>
    ${(() => {
      if (!changes) return '';
      const base = fmtRebalanceDate(changes.vsRebalanceDate);
      const fromBacktest = /backtest/i.test(changes.baselineSource || '');
      const baseNote = fromBacktest ? ' <span class="mom-baseline" title="' + esc(changes.baselineSource || '') + '">(baseline: the actual Sep 1 rebalance list)</span>' : '';
      let out = '';
      if (changes.newIn && changes.newIn.length) out += `<details class="mom-changes"><summary>New in since ${esc(base)} rebalance — ${changes.newIn.length} names</summary><strong>${changes.newIn.map(esc).join(', ')}</strong>${baseNote}</details>`;
      if (changes.newOut && changes.newOut.length) out += `<details class="mom-changes"><summary>Out since ${esc(base)} rebalance — ${changes.newOut.length} names</summary><strong>${changes.newOut.map(esc).join(', ')}</strong></details>`;
      return out;
    })()}`
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
      <span class="mom-health ${esc(healthCls)}">Data: ${esc(health)}${state?.coverageCount ? ` · ${esc(state.coverageCount)} of ${esc(state.universeCount)} index constituents with price data` : ''}</span>
    </div>
    ${state?.excludedCount ? `<p class="mom-note">${esc(state.excludedCount)} of the symbols with data excluded from ranking (insufficient history or non-finite signals) — ${esc(state.includedCount)} ranked. Universe is current S&amp;P 500 members — historical ranks carry survivorship bias.</p>` : ''}
    <p class="mom-note">Entry reads are display-only — they never change the mechanical monthly portfolio. Earnings dates are from the Nasdaq earnings calendar; names reporting within two weeks are flagged on the row.</p>
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
.mom-disagree{font-size:12.5px;line-height:1.6;color:rgba(36,35,31,.88);background:#fffdf8;border:1px solid rgba(138,106,44,.45);border-left:3px solid rgba(138,106,44,.6);padding:10px 14px;margin:0 0 16px}
.mom-disagree strong{color:#8a6a1f}
.mom-table{width:100%;border-collapse:collapse;font-size:13px;margin-top:4px;min-width:640px}
.mom-tablewrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
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
.mom-earn{display:inline-block;margin-left:10px;font-size:10px;color:#9f3f35;white-space:nowrap}
.mom-eq{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.04em;padding:3px 10px;border-radius:999px;border:1px solid;white-space:nowrap}
.mom-eq-good{color:var(--green,#2f6f4e);border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.07)}
.mom-eq-fair{color:#8a6a1f;border-color:rgba(138,106,44,.5);background:rgba(138,106,44,.08)}
.mom-eq-poor{color:#a4502f;border-color:rgba(164,80,47,.5);background:rgba(164,80,47,.08)}
.mom-new{display:inline-block;font-size:10px;font-weight:700;letter-spacing:.06em;padding:3px 8px;border-radius:4px;color:#2f6f4e;background:rgba(47,111,78,.1);border:1px solid rgba(47,111,78,.35)}
.mom-delta{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.mom-up{color:var(--green,#2f6f4e)}
.mom-down{color:#a4502f}
.mom-changes{font-size:12px;color:#4a463c;margin:8px 0 0}
.mom-changes summary{cursor:pointer}
.mom-changes summary:hover{color:#24231f}
.mom-changes strong{font-weight:400}
.mom-baseline{color:#8a8578;font-size:11px}
</style>`;
}

module.exports = { renderMomentumSection, renderMomentumStyle };
