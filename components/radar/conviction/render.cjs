'use strict';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr = v => Array.isArray(v) ? v : [];

function tierClass(t) {
  return { S: 'cv-tier-s', A: 'cv-tier-a', B: 'cv-tier-b', C: 'cv-tier-c', D: 'cv-tier-d' }[t] || '';
}

function renderMacroContext(ctx) {
  if (!ctx) return '';
  const leanItems = arr(ctx.lean_into).map(l => `<li>${esc(l)}</li>`).join('');
  const avoidItems = arr(ctx.avoid).map(a => `<li>${esc(a)}</li>`).join('');
  return `<div class="cv-macro-bar">
    <div class="cv-macro-posture"><span>Macro posture</span><b>${esc(ctx.posture)}</b><small>10Y ${ctx.ten_year_yield}% · HY OAS ${ctx.high_yield_oas}</small></div>
    <div class="cv-macro-lean"><span>Lean into</span><ul>${leanItems}</ul></div>
    <div class="cv-macro-avoid"><span>Macro avoid</span><ul>${avoidItems}</ul></div>
    <div class="cv-macro-note"><span>Posture note</span><p>${esc(ctx.posture_note || '')}</p></div>
  </div>`;
}

function renderGapAlert(gaps) {
  if (!arr(gaps).length) return '';
  const items = gaps.slice(0, 5).map(g =>
    `<span class="cv-gap-chip">${esc(g.ticker)} <i>${esc(g.theme)}</i></span>`
  ).join('');
  return `<div class="cv-gaps"><span>Portfolio gaps driving these rankings</span><div class="cv-gap-chips">${items}</div><small>Tickers above scored higher because portfolio has zero exposure to their theme.</small></div>`;
}

function renderConvictionRow(item) {
  const signals = arr(item.fundamental_signals).slice(0, 4).map(s => `<span>${esc(s)}</span>`).join('');
  const macroReasonsHtml = arr(item.macro_reasons).slice(0, 2).map(r => `<li>${esc(r)}</li>`).join('');
  const gapReasonsHtml = arr(item.portfolio_gap_reasons).slice(0, 1).map(r => `<li>${esc(r)}</li>`).join('');
  const activeSignalHtml = item.active_signal
    ? `<div class="cv-active-signal"><span>Active signal</span><p>${esc(item.active_signal)}</p></div>` : '';
  const coverageNew = item.coverage_gap
    ? `<span class="cv-new-badge">New</span>` : '';

  return `<article class="cv-row">
    <div class="cv-rank-col">
      <div class="cv-rank-num">${item.rank}</div>
      <div class="cv-score-ring ${tierClass(item.conviction_tier)}">
        <b>${item.conviction_score}</b>
        <small>Tier ${item.conviction_tier}</small>
      </div>
    </div>
    <div class="cv-body">
      <div class="cv-head">
        <div>
          <div class="cv-theme-label">${esc(item.theme)}${coverageNew}</div>
          <h3>${esc(item.ticker)} <span>${esc(item.name)}</span></h3>
        </div>
        ${item.analyst_rating ? `<div class="cv-rating">${esc(item.analyst_rating)}</div>` : ''}
      </div>
      ${signals ? `<div class="cv-signals">${signals}</div>` : ''}
      <p class="cv-why">${esc((item.why_core || '').slice(0, 200))}</p>
      ${activeSignalHtml}
      <div class="cv-modifiers">
        <div><span>Macro</span><ul>${macroReasonsHtml || '<li>Neutral</li>'}</ul></div>
        <div><span>Portfolio fit</span><ul>${gapReasonsHtml || '<li>Covers existing theme</li>'}</ul></div>
        <div><span>Risk</span><p>${esc((item.risk_note || 'No specific flag').slice(0, 120))}</p></div>
      </div>
    </div>
  </article>`;
}

function renderConvictionSection(state) {
  if (!state) return '';
  const macro = state.macro_context || {};
  const top10 = arr(state.top10);
  const gaps = arr(state.portfolio_context?.major_gaps);
  const summary = state.summary || {};
  const asOf = state.generated_at ? new Date(state.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';

  const tierSummary = [
    ['S', summary.tier_s, 'Must research'],
    ['A', summary.tier_a, 'High conviction'],
    ['B', summary.tier_b, 'Watchlist'],
  ].filter(([,n]) => n > 0).map(([t, n, label]) =>
    `<article><span>Tier ${t} — ${label}</span><b>${n}</b></article>`
  ).join('');

  const rowsHtml = top10.map(renderConvictionRow).join('');

  return `<section id="conviction-section" class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">Conviction ranking</p>
        <h2>Top 10 — where to focus research</h2>
        <p class="cv-stance">Scores integrate macro regime, portfolio gaps, and fundamentals. Research only — no buy authorization on any ticker below.</p>
      </div>
      <a class="button" href="outputs/conviction-ranking.json">Full ranking</a>
    </div>
    <div class="trust-strip">${tierSummary}<article><span>Universe</span><b>${summary.total_universe}</b></article><article><span>New tickers</span><b>${summary.new_tickers}</b></article><article><span>Ranked</span><b>${asOf}</b></article></div>
    ${renderMacroContext(macro)}
    ${renderGapAlert(gaps)}
    <div class="cv-list">${rowsHtml}</div>
    <p class="cv-footer">Scores = base quality + fundamentals + macro alignment + portfolio gap. No ticker scores 100 — all carry unquantified risk. Read methodology: <code>outputs/conviction-ranking.json</code></p>
  </section>`;
}

function renderConvictionStyle() {
  return `<style>
.cv-stance{color:var(--muted);font-size:13px;margin:6px 0 0}
.cv-macro-bar{display:grid;grid-template-columns:140px 1fr 1fr 1fr;gap:10px;border:1px solid var(--rule);border-radius:16px;padding:14px;margin:14px 0;background:#ffffff}
.cv-macro-posture b{display:block;font-size:20px;letter-spacing:-.03em;margin:3px 0 2px}
.cv-macro-posture small{color:var(--muted);font-size:11px}
.cv-macro-bar span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.cv-macro-lean ul,.cv-macro-avoid ul{margin:0;padding:0 0 0 14px;font-size:12px;line-height:1.6;color:rgba(36,35,31,.78)}
.cv-macro-note p{font-size:12px;line-height:1.45;color:rgba(36,35,31,.75);margin:0}
.cv-gaps{border:1px solid rgba(64,95,159,.22);border-radius:14px;padding:12px 14px;margin:8px 0;background:rgba(64,95,159,.04)}
.cv-gaps span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:8px}
.cv-gap-chips{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:6px}
.cv-gap-chip{font-size:11px;border:1px solid rgba(64,95,159,.3);border-radius:999px;padding:4px 10px;color:rgba(64,95,159,.9);background:rgba(64,95,159,.06)}
.cv-gap-chip i{font-style:normal;color:var(--muted);margin-left:4px}
.cv-gaps small{color:var(--muted);font-size:11px}
.cv-list{display:flex;flex-direction:column;gap:8px;margin-top:14px}
.cv-row{display:grid;grid-template-columns:80px 1fr;gap:12px;border:1px solid var(--rule);border-radius:18px;padding:14px;background:#ffffff}
.cv-rank-col{display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:4px}
.cv-rank-num{font-size:32px;font-weight:600;letter-spacing:-.05em;line-height:1;color:var(--muted)}
.cv-score-ring{text-align:center;border:2px solid var(--rule);border-radius:12px;padding:6px 10px;min-width:56px}
.cv-score-ring b{display:block;font-size:22px;font-weight:600;letter-spacing:-.04em;line-height:1}
.cv-score-ring small{display:block;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.cv-tier-s{border-color:rgba(47,111,78,.5);background:rgba(47,111,78,.07)}
.cv-tier-s b,.cv-tier-s small{color:var(--green)}
.cv-tier-a{border-color:rgba(64,95,159,.4);background:rgba(64,95,159,.05)}
.cv-tier-a b,.cv-tier-a small{color:rgba(64,95,159,.9)}
.cv-tier-b{border-color:rgba(174,124,44,.4);background:rgba(174,124,44,.06)}
.cv-tier-b b,.cv-tier-b small{color:var(--warn)}
.cv-tier-c{border-color:var(--rule)}
.cv-tier-d{border-color:rgba(159,63,53,.3);background:rgba(159,63,53,.04)}
.cv-tier-d b,.cv-tier-d small{color:var(--red)}
.cv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
.cv-theme-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:2px}
.cv-theme-label .cv-new-badge{display:inline-block;margin-left:6px;font-size:9px;font-weight:700;background:rgba(64,95,159,.12);border:1px solid rgba(64,95,159,.3);color:rgba(64,95,159,.9);padding:2px 6px;border-radius:4px;letter-spacing:.04em}
.cv-head h3{font-size:26px;line-height:.95;letter-spacing:-.04em;margin:0}
.cv-head h3 span{font-size:13px;font-weight:400;letter-spacing:0;color:var(--muted);margin-left:6px}
.cv-rating{font-size:11px;font-weight:600;color:var(--green);border:1px solid rgba(47,111,78,.3);border-radius:8px;padding:4px 8px;flex-shrink:0;background:rgba(47,111,78,.06)}
.cv-signals{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.cv-signals span{font-size:10px;border:1px solid rgba(47,111,78,.28);border-radius:999px;padding:3px 8px;color:var(--green);background:rgba(47,111,78,.06);font-weight:500}
.cv-why{font-size:13px;line-height:1.45;color:rgba(36,35,31,.78);margin:6px 0 8px;overflow-wrap:anywhere}
.cv-active-signal{border:1px solid rgba(159,63,53,.25);border-radius:10px;padding:8px 11px;background:rgba(159,63,53,.04);margin-bottom:8px}
.cv-active-signal span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px}
.cv-active-signal p{font-size:12px;line-height:1.4;color:rgba(36,35,31,.82);margin:0;font-weight:500}
.cv-modifiers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px}
.cv-modifiers div{border:1px solid var(--rule);border-radius:10px;padding:8px 10px;background:#ffffff}
.cv-modifiers span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.cv-modifiers ul{margin:0;padding:0 0 0 12px;font-size:11px;line-height:1.55;color:rgba(36,35,31,.75)}
.cv-modifiers p{font-size:11px;line-height:1.45;color:rgba(36,35,31,.72);margin:0;overflow-wrap:anywhere}
.cv-footer{color:var(--muted);font-size:11px;margin-top:16px;line-height:1.5}
@media(max-width:800px){
  .cv-macro-bar{grid-template-columns:1fr 1fr}
  .cv-modifiers{grid-template-columns:1fr}
  .cv-row{grid-template-columns:64px 1fr}
}
@media(max-width:520px){
  .cv-macro-bar{grid-template-columns:1fr}
  .cv-row{grid-template-columns:1fr}
  .cv-rank-col{flex-direction:row;align-items:center}
}
</style>`;
}

module.exports = { renderConvictionSection, renderConvictionStyle };
