'use strict';

/*
 * Opportunity decision surface — engine-fed render (2026-10-01).
 *
 * Two tiers, no hand-picked names:
 *   ACTIONABLE — full trade cards (entry / ceiling→margin / invalidation→risk
 *                / duration / catalyst / strategy / evidence)
 *   WATCHLIST  — WAIT-state names with the written condition that flips them
 *                to actionable.
 *
 * Fail-closed: a missing or malformed state renders an honest "unavailable"
 * block, never placeholder cards.
 */

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
const fmt$ = v => '$' + Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtPct = v => (v >= 0 ? '+' : '') + Number(v).toFixed(1) + '%';

function strategyTag(s) {
  return s === 'arb-fit' ? 'arb-fit' : 'momentum-fit';
}

function cardHtml(c) {
  const inv = c.strategy === 'arb-fit'
    ? `<div class="opp-row"><span class="opp-k">Invalidation</span><span class="opp-v">${esc(c.invalidation.condition)}</span></div>`
    : `<div class="opp-row"><span class="opp-k">Invalidation</span><span class="opp-v">${fmt$(c.invalidation.price)} <span class="opp-sub">(${esc(c.invalidation.basis)})</span> → <b class="opp-risk">−${Number(c.invalidation.riskPct).toFixed(1)}%</b> risk</span></div>`;
  const dur = c.duration.through
    ? `${esc(c.duration.through)} <span class="opp-sub">(${esc(c.duration.basis || '')})</span>`
    : `${esc(c.duration.label || '')} <span class="opp-sub">(${esc(c.duration.basis || '')})</span>`;
  const ev = c.evidence || {};
  const evLine = c.strategy === 'arb-fit'
    ? `arb engine · ${ev.acquirer ? esc(ev.acquirer) + ' · ' : ''}${ev.considerationType ? esc(ev.considerationType) + ' · ' : ''}${ev.spreadPct != null ? 'spread ' + fmtPct(ev.spreadPct) : ''}${ev.annualizedSpreadPct != null ? ' · ' + Number(ev.annualizedSpreadPct).toFixed(1) + '% ann.' : ''}`
    : `momentum rank #${esc(c.momentumRank)} · composite ${esc(c.composite)} · entry ${esc(c.entryRating)}`;
  const rr = (c.strategy === 'momentum-fit' && isFinite(c.ceiling.marginPct) && isFinite(c.invalidation.riskPct) && c.invalidation.riskPct > 0)
    ? `<div class="opp-row"><span class="opp-k">Reward/risk</span><span class="opp-v">${(c.ceiling.marginPct / c.invalidation.riskPct).toFixed(2)}</span></div>` : '';
  return `<article class="opp-card">
    <div class="opp-cardhead">
      <div><span class="opp-sym">${esc(c.symbol)}</span><span class="opp-name">${esc(c.name || '')}</span></div>
      <div class="opp-tags"><span class="opp-strat">${esc(strategyTag(c.strategy))}</span>${c.momentumRank ? `<span class="opp-rank">mom #${esc(c.momentumRank)}</span>` : ''}</div>
    </div>
    <div class="opp-row"><span class="opp-k">Entry</span><span class="opp-v"><b>${fmt$(c.entry.price)}</b> <span class="opp-sub">${esc(c.entry.note || '')}</span></span></div>
    <div class="opp-row"><span class="opp-k">Ceiling</span><span class="opp-v">${fmt$(c.ceiling.price)} <span class="opp-sub">(${esc(c.ceiling.basis)})</span> → <b class="opp-margin">${fmtPct(c.ceiling.marginPct)}</b> approx margin</span></div>
    ${inv}
    ${rr}
    <div class="opp-row"><span class="opp-k">Duration</span><span class="opp-v">through ${dur}</span></div>
    <div class="opp-row"><span class="opp-k">Catalyst</span><span class="opp-v">${esc(c.catalyst)}</span></div>
    <div class="opp-ev">Evidence · ${evLine}</div>
  </article>`;
}

function watchRow(w) {
  const chip = w.entryRating === 'POOR' ? 'opp-chip poor' : w.entryRating === 'GOOD' ? 'opp-chip goodwait' : 'opp-chip fair';
  return `<div class="opp-watchrow">
    <div class="opp-watchhead"><span class="opp-sym">${esc(w.symbol)}</span><span class="opp-name">${esc(w.name || '')}</span><span class="${chip}">${esc(w.entryRating)}</span>${w.momentumRank ? `<span class="opp-rank">mom #${esc(w.momentumRank)}</span>` : ''}</div>
    <div class="opp-wait">${esc(w.waitingFor)}</div>
    <div class="opp-watchmeta">${fmt$(w.current.price)} · ${fmtPct(w.current.offHighPct)} off 20-day high · SMA50 ${fmt$(w.current.sma50)}</div>
  </div>`;
}

function anticipatoryCard(c) {
  const p21 = c.calibration?.pPositive21 == null ? 'n/a' : `${(c.calibration.pPositive21 * 100).toFixed(1)}%`;
  const v21 = c.validation?.pPositive21 == null ? 'n/a' : `${(c.validation.pPositive21 * 100).toFixed(1)}%`;
  const oneMonth = c.projectedPath?.oneMonthPct || {};
  return `<article class="opp-card opp-probe-card">
    <div class="opp-cardhead"><div><span class="opp-sym">${esc(c.symbol)}</span><span class="opp-name">anticipatory probe</span></div><div class="opp-tags"><span class="opp-strat probe">PROBE</span><span class="opp-rank">${esc(c.confidence)} confidence</span></div></div>
    <div class="opp-row"><span class="opp-k">Entry band</span><span class="opp-v"><b>${fmt$(c.entry.low)}–${fmt$(c.entry.high)}</b></span></div>
    <div class="opp-row"><span class="opp-k">Invalidation</span><span class="opp-v">${fmt$(c.invalidation.price)} → <b class="opp-risk">−${Number(c.invalidation.riskPct).toFixed(1)}%</b> risk</span></div>
    <div class="opp-row"><span class="opp-k">Target</span><span class="opp-v">${fmt$(c.target.price)} → <b class="opp-margin">${fmtPct(c.target.rewardPct)}</b> · R/R ${Number(c.rewardRisk).toFixed(2)}</span></div>
    <div class="opp-row"><span class="opp-k">Probability</span><span class="opp-v">${p21} calibrated · ${v21} held-out validation <span class="opp-sub">(${esc(c.calibration?.n)} / ${esc(c.validation?.n)} observations)</span></span></div>
    <div class="opp-row"><span class="opp-k">1m path</span><span class="opp-v">p10 ${fmtPct(oneMonth.p10)} · median ${fmtPct(oneMonth.median)} · p90 ${fmtPct(oneMonth.p90)}</span></div>
    <div class="opp-row"><span class="opp-k">Risk budget</span><span class="opp-v">max ${Number(c.sizing.maxPortfolioRiskPct).toFixed(2)}% portfolio risk · max ${Number(c.sizing.maxPositionPct).toFixed(2)}% position</span></div>
    <div class="opp-ev">Forecast is scored after 21 bars · no ADD without confirmation · ${esc(c.cohort)}</div>
  </article>`;
}

function renderOpportunitiesSection(state) {
  const shellOpen = '<section id="opportunities-section" class="cr-section opp-section">';
  const shellClose = '</section>';

  if (!state || !Array.isArray(state.board) || !Array.isArray(state.watchlist)) {
    return `${shellOpen}
    <div class="section-head"><div><p class="eyebrow">Decision surface · Opportunity</p><h2>Opportunity</h2></div></div>
    <p class="opp-unavailable">Opportunity data unavailable this cycle — the decision surface failed closed rather than show stale cards.</p>
  ${shellClose}`;
  }

  const board = state.board, watch = state.watchlist, alerts = state.alerts || {};
  const anticipatory = state.anticipatory || {};
  const probes = (anticipatory.candidates || []).filter(c => c.state === 'PROBE_ELIGIBLE');
  const probeBlocked = (anticipatory.candidates || []).filter(c => c.state === 'BLOCKED');
  const asOf = state.asOf ? ` · prices ${esc(state.asOf)}` : '';
  const gate = state.recognitionGate || {};

  const alertBits = [];
  for (const s of (alerts.newlyActionable || [])) alertBits.push(`<span class="opp-alert new"><b>${esc(s)}</b> newly actionable</span>`);
  for (const s of (alerts.graduatedToBoard || [])) alertBits.push(`<span class="opp-alert grad"><b>${esc(s)}</b> graduated from watchlist</span>`);
  for (const s of (alerts.demotedToWait || [])) alertBits.push(`<span class="opp-alert dem"><b>${esc(s)}</b> back to watchlist</span>`);
  const alertsHtml = alertBits.length ? `<div class="opp-alerts">${alertBits.join('')}</div>` : '';

  const momCount = board.filter(c => c.strategy === 'momentum-fit').length;
  const arbCount = board.filter(c => c.strategy === 'arb-fit').length;

  const boardHtml = board.length
    ? `<div class="opp-grid">${board.map(cardHtml).join('')}</div>`
    : `<p class="opp-empty">${esc(state.emptyReasons && state.emptyReasons.momentum ? state.emptyReasons.momentum : 'No actionable trades this cycle.')}</p>`;

  const arbNote = arbCount === 0
    ? `<p class="opp-arbempty">Arb leg: ${esc(state.emptyReasons && state.emptyReasons.arb ? state.emptyReasons.arb : 'no qualifying arb trades right now.')}</p>` : '';

  const watchHtml = watch.length
    ? `<div class="opp-watchlist">${watch.map(watchRow).join('')}</div>`
    : `<p class="opp-empty">Watchlist clear — every recognizable momentum name is either actionable or out of the top decile.</p>`;

  return `${shellOpen}
  <div class="opp-wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Decision surface · Opportunity${asOf}</p>
        <h2>Opportunity</h2>
      </div>
    </div>
    <p class="opp-lede">Confirmed entries, small anticipatory probes, and waiting names remain separate. A probe requires calibrated history, held-out validation, a ruled band and invalidation, and a capped risk budget; it never grants ADD authority.</p>
    ${alertsHtml}
    <h3 class="opp-tier">Actionable <span class="opp-count">${board.length}</span> <span class="opp-tiersub">${momCount} momentum-fit · ${arbCount} arb-fit</span></h3>
    ${boardHtml}
    ${arbNote}
    <h3 class="opp-tier">Anticipatory probes <span class="opp-count">${probes.length}</span> <span class="opp-tiersub">pre-confirmation · probability-gated · max 0.25% portfolio risk each</span></h3>
    ${probes.length ? `<div class="opp-grid">${probes.map(anticipatoryCard).join('')}</div>` : `<p class="opp-empty">Unavailable this cycle. ${probeBlocked.length ? `${probeBlocked.length} candidate(s) failed calibration, validation, reward/risk, or regime gates.` : 'No qualified pullback candidates entered the calibration gate.'}</p>`}
    <h3 class="opp-tier">Watchlist <span class="opp-count">${watch.length}</span> <span class="opp-tiersub">momentum candidates waiting on entry — POOR stays visible, never hidden</span></h3>
    ${watchHtml}
    <p class="opp-foot">Recognizability gate: top 200 S&amp;P 500 by market cap${gate.asOf ? ` (ranks ${esc(gate.asOf)})` : ''} — the momentum engine itself is unfiltered. Entry reads are display-only; they never change the mechanical monthly portfolio. Earnings timing unknown for every name (no feed; never guessed).</p>
  </div>
${shellClose}`;
}

function renderOpportunitiesStyle() {
  return `<style>
.opp-wrap{padding:0}
.opp-lede{font-size:13px;color:rgba(44,42,37,.62);margin:2px 0 14px;max-width:72ch}
.opp-tier{font-size:15px;margin:22px 0 12px;display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.opp-count{font-family:var(--mono,monospace);font-size:12px;background:rgba(44,42,37,.07);border:1px solid rgba(44,42,37,.14);border-radius:10px;padding:1px 8px}
.opp-tiersub{font-size:11px;color:rgba(44,42,37,.45);font-weight:400}
.opp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:12px}
.opp-card{border:1px solid rgba(201,191,173,.4);border-radius:8px;padding:12px 14px;background:rgba(255,255,255,.55)}
.opp-cardhead{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px;flex-wrap:wrap}
.opp-sym{font-family:var(--mono,monospace);font-weight:700;font-size:15px;margin-right:8px}
.opp-name{font-size:12px;color:rgba(44,42,37,.55)}
.opp-tags{display:flex;gap:6px;flex-wrap:wrap}
.opp-strat{font-family:var(--mono,monospace);font-size:10px;padding:2px 8px;border-radius:3px;background:rgba(30,90,60,.08);color:#1e5a3c;border:1px solid rgba(30,90,60,.2)}
.opp-strat.probe{background:rgba(37,88,145,.08);color:#255891;border-color:rgba(37,88,145,.25)}
.opp-probe-card{border-color:rgba(37,88,145,.28);background:rgba(37,88,145,.025)}
.opp-rank{font-family:var(--mono,monospace);font-size:10px;padding:2px 8px;border-radius:3px;background:rgba(44,42,37,.05);color:rgba(44,42,37,.6);border:1px solid rgba(44,42,37,.12)}
.opp-row{display:flex;gap:10px;padding:5px 0;border-top:1px solid rgba(201,191,173,.25);font-size:12.5px}
.opp-row:first-of-type{border-top:none}
.opp-k{flex:0 0 86px;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:rgba(44,42,37,.42);padding-top:2px}
.opp-v{flex:1;color:rgba(44,42,37,.85)}
.opp-sub{color:rgba(44,42,37,.5);font-size:11.5px}
.opp-margin{color:#1e5a3c}.opp-risk{color:#b3541e}
.opp-ev{margin-top:8px;padding-top:8px;border-top:1px dashed rgba(201,191,173,.4);font-size:11px;color:rgba(44,42,37,.5);font-family:var(--mono,monospace)}
.opp-alerts{display:flex;gap:8px;flex-wrap:wrap;margin:4px 0 6px}
.opp-alert{font-family:var(--mono,monospace);font-size:11px;padding:3px 10px;border-radius:3px}
.opp-alert.new{background:rgba(30,90,60,.09);color:#1e5a3c;border:1px solid rgba(30,90,60,.25)}
.opp-alert.grad{background:rgba(30,90,120,.09);color:#1e4a7a;border:1px solid rgba(30,90,120,.25)}
.opp-alert.dem{background:rgba(180,120,20,.09);color:#8a5a10;border:1px solid rgba(180,120,20,.25)}
.opp-empty{font-size:13px;color:rgba(44,42,37,.55);padding:12px;border:1px dashed rgba(201,191,173,.5);border-radius:6px}
.opp-arbempty{font-size:12px;color:rgba(44,42,37,.5);margin-top:10px}
.opp-watchlist{display:flex;flex-direction:column;gap:8px}
.opp-watchrow{border:1px solid rgba(201,191,173,.35);border-radius:6px;padding:10px 12px;background:rgba(255,255,255,.4)}
.opp-watchhead{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.opp-chip{font-family:var(--mono,monospace);font-size:10px;padding:2px 8px;border-radius:3px}
.opp-chip.fair{background:rgba(180,120,20,.1);color:#8a5a10;border:1px solid rgba(180,120,20,.25)}
.opp-chip.poor{background:rgba(200,40,40,.08);color:#a02020;border:1px solid rgba(200,40,40,.22)}
.opp-chip.goodwait{background:rgba(30,90,60,.08);color:#1e5a3c;border:1px solid rgba(30,90,60,.22)}
.opp-wait{font-size:12.5px;color:rgba(44,42,37,.75)}
.opp-watchmeta{font-family:var(--mono,monospace);font-size:11px;color:rgba(44,42,37,.45);margin-top:4px}
.opp-foot{font-size:11.5px;color:rgba(44,42,37,.45);margin-top:18px;max-width:80ch}
.opp-unavailable{font-size:13px;color:#a02020;padding:14px;border:1px solid rgba(200,40,40,.3);border-radius:6px}
@media(max-width:640px){.opp-grid{grid-template-columns:1fr}.opp-k{flex-basis:78px}}
</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle };
