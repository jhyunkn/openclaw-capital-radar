'use strict';

const esc   = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr   = v => Array.isArray(v) ? v : [];
const num   = v => Number.isFinite(Number(v)) ? Number(v) : null;
const fmt   = (v, d=0) => num(v) === null ? '—' : num(v).toLocaleString(undefined, { maximumFractionDigits: d });
const price = v => v == null ? null : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
const clean = v => String(v || '').replace(/_/g, ' ');

// ── OPPORTUNITY PIPELINE (existing research cards) ────────────────────────────

function stageLabel(v) {
  const s = String(v || '').toLowerCase();
  if (/promotion.review/.test(s)) return 'In review';
  if (/exception.review/.test(s)) return 'Exception';
  if (/build.evidence/.test(s))   return 'Building';
  if (/watch|collect/.test(s))    return 'Watching';
  return clean(v);
}

function flattenOpportunityRows(state) {
  return arr(state.opportunity_clusters).flatMap(cluster =>
    arr(cluster.candidate_tickers).map(ticker => {
      const evidence = num(ticker.evidence_completeness_pct);
      const required = num(ticker.evidence_required_pct) || 80;
      return {
        theme: cluster.macro_theme,
        themeSummary: cluster.macro_theme_summary,
        direction: cluster.second_order_direction,
        ticker: ticker.ticker,
        name: ticker.name || ticker.ticker,
        stage: ticker.promotion_status || ticker.asymmetry_stage || ticker.opportunity_type || 'research_task',
        display: ticker.display_as_opportunity === true || /promotion_review|exception_review/i.test(ticker.promotion_status || ''),
        near: ticker.display_as_near_miss === true || /watch|build|near|exception/i.test(`${ticker.promotion_status || ''} ${ticker.opportunity_type || ''}`),
        asymmetry: ticker.asymmetry_score ?? ticker.opportunity_score,
        evidence, required,
        undervaluation: ticker.undervaluation_score,
        conviction: ticker.conviction_score,
        gap: ticker.threshold_gap ?? (evidence === null ? null : Math.max(0, required - evidence)),
        zone: ticker.zone_status,
        secRecords: ticker.sec_record_count,
        next: ticker.primary_blocker || ticker.next_gate || arr(ticker.missing_evidence)[0] || 'human review',
        missing: arr(ticker.missing_evidence),
        gates: arr(ticker.evidence_gates),
        why: ticker.why_this_ticker,
        underpriced: ticker.what_is_underpriced,
        currentPrice: ticker.current_price ?? null,
        priceRead: ticker.price_read || '',
        provisionalZone: ticker.provisional_zone || '',
        whyNow: arr(ticker.why_now),
        invalidation: arr(ticker.invalidation_questions),
      };
    })
  ).sort((a, b) => (num(b.evidence) || 0) - (num(a.evidence) || 0) || (num(b.asymmetry) || 0) - (num(a.asymmetry) || 0));
}

function selectDisplayRows(rows) {
  const opportunities = rows.filter(r => r.display);
  const near = rows.filter(r => r.near).slice(0, 8);
  const all8 = rows.slice(0, 8);
  const selected = opportunities.length ? opportunities.slice(0, 8) : near.length ? near : all8;
  return { opportunities, near, selected };
}

function renderGate(gate) {
  const passed = gate.passed === true;
  return `<span class="op-gate ${passed ? 'pass' : 'fail'}">${esc(gate.label || gate.key)}${passed ? ' ✓' : ''}</span>`;
}

function renderOpportunityRow(row, rankMap) {
  const gates = row.gates.length ? row.gates.map(renderGate).join('') : '<span class="op-gate fail">evidence pending</span>';
  const priceDisplay = row.currentPrice != null ? price(row.currentPrice) : null;
  const zoneClean = row.zone ? clean(row.zone).replace('neutral hold','Hold zone').replace('inside buy zone','Buy zone ↓').replace('near buy zone','Near buy').replace('inside trim zone','Trim zone ↑') : null;
  const whyNowHtml = row.whyNow.length ? `<div class="op-why-now"><span>Active signal</span><p>${esc(row.whyNow[0])}</p></div>` : '';
  const priceContextHtml = row.priceRead ? `<div class="op-price-context"><span>Price read</span><p>${esc(row.priceRead)}${row.provisionalZone ? ` · ${row.provisionalZone}` : ''}</p></div>` : '';
  const rankData = rankMap && rankMap[row.ticker];
  const tierBadge = rankData ? `<span class="op-tier op-tier-${rankData.tier}">${esc(rankData.tier === 'A' ? 'Tier A' : rankData.tier === 'B' ? 'Tier B' : rankData.tier === 'C' ? 'Tier C' : `Tier ${rankData.tier}`)}</span>` : '';
  const signalChips = rankData && arr(rankData.fundamental_signals).length
    ? `<div class="op-signals">${rankData.fundamental_signals.slice(0,4).map(s=>`<span>${esc(s)}</span>`).join('')}</div>` : '';
  return `<article class="op-card">
    <div class="op-card-head">
      <div>
        <span class="op-theme">${esc(row.theme || 'Research')}</span>
        <h3>${esc(row.ticker)}</h3>
        <p>${esc(row.name)}</p>
      </div>
      <div class="op-head-right">
        ${priceDisplay ? `<div class="op-price">${esc(priceDisplay)}</div>` : ''}
        ${tierBadge}
      </div>
    </div>
    ${signalChips}
    <div class="op-gates">${gates}</div>
    ${whyNowHtml}
    <div class="op-thesis-grid">
      <div><span>Investment thesis</span><p>${esc(row.why || row.direction || 'Thesis rationale pending.')}</p></div>
      ${priceContextHtml || `<div><span>Price zone</span><p>${esc(zoneClean || 'Zone not established — research only.')}</p></div>`}
    </div>
    <div class="op-next-line"><span>Before any position</span><b>${row.missing.length ? esc(row.missing.slice(0,2).join(' + ')) : 'Human review'}</b><small>Research only — no buy authorization</small></div>
  </article>`;
}

// ── CONVICTION RANKING (primary view) ─────────────────────────────────────────

function windowBadge(score, status) {
  const cls = score === 3 ? 'win-active' : score === 2 ? 'win-watch' : 'win-wait';
  const label = score === 3 ? 'Entry window' : score === 2 ? 'Watch' : 'Wait';
  return `<span class="cv-window ${cls}">${label}</span>`;
}

function tierClass(t) {
  return { S: 'cv-tier-s', A: 'cv-tier-a', B: 'cv-tier-b', C: 'cv-tier-c', D: 'cv-tier-d' }[t] || '';
}

function renderConvictionRow(item) {
  const signals = arr(item.fundamental_signals).slice(0, 4).map(s => `<span>${esc(s)}</span>`).join('');
  const macroLine = arr(item.macro_reasons).slice(0, 2).join(' · ');
  const gapLine   = arr(item.portfolio_gap_reasons)[0] || '';
  const coverageNew = item.coverage_gap ? `<span class="cv-new-badge">New</span>` : '';

  const timingHtml = `<div class="cv-timing">
    ${windowBadge(item.window_score, item.timing_status)}
    <div class="cv-timing-detail">
      <b>${esc(item.timing_status)}</b>
      <p>${esc(item.timing_note || '')}</p>
      ${item.next_catalyst ? `<small>Catalyst: ${esc(item.next_catalyst)}</small>` : ''}
    </div>
  </div>`;

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
        ${item.analyst_rating ? `<div class="cv-analyst-rating">${esc(item.analyst_rating)}</div>` : ''}
      </div>
      ${signals ? `<div class="cv-signals">${signals}</div>` : ''}
      <p class="cv-why">${esc((item.why_core || '').slice(0, 220))}</p>
      ${timingHtml}
      <div class="cv-modifiers">
        <div><span>Macro</span><p>${esc(macroLine || 'Neutral')}</p></div>
        <div><span>Portfolio fit</span><p>${esc(gapLine)}</p></div>
        <div><span>Risk</span><p>${esc((item.risk_note || '').slice(0, 100))}</p></div>
      </div>
    </div>
  </article>`;
}

function renderMacroBar(ctx) {
  if (!ctx) return '';
  const lean = arr(ctx.lean_into).map(l => `<li>${esc(l)}</li>`).join('');
  const avoid = arr(ctx.avoid).map(a => `<li>${esc(a)}</li>`).join('');
  return `<div class="cv-macro-bar">
    <div><span>Macro posture</span><b>${esc(ctx.posture)}</b><small>10Y ${ctx.ten_year_yield}% · HY OAS ${ctx.high_yield_oas}</small></div>
    <div><span>Lean into</span><ul>${lean}</ul></div>
    <div><span>Avoid</span><ul>${avoid}</ul></div>
    <div><span>Action rule</span><p>${esc(ctx.posture_note || '')}</p></div>
  </div>`;
}

function renderGapAlert(gaps) {
  if (!arr(gaps).length) return '';
  const chips = gaps.slice(0, 6).map(g =>
    `<span class="cv-gap-chip">${esc(g.ticker)} <i>${esc(g.theme)}</i></span>`
  ).join('');
  return `<div class="cv-gaps"><span>Major portfolio gaps</span><div class="cv-gap-chips">${chips}</div><small>These tickers scored higher because portfolio has no exposure to their theme.</small></div>`;
}

// ── COMBINED OPPORTUNITIES SECTION ────────────────────────────────────────────

function renderOpportunitiesSection(state, candidateRanking, conviction) {
  const summary  = state?.summary || {};
  const allRows  = flattenOpportunityRows(state || {});
  const { opportunities, selected } = selectDisplayRows(allRows);

  // Build rankMap from candidateRanking for research pipeline tier badges
  const rankMap = {};
  if (candidateRanking) {
    arr(candidateRanking.ranked).forEach(c => { rankMap[String(c.ticker).toUpperCase()] = c; });
  }

  // Conviction data
  const top10 = arr(conviction?.top10);
  const macroCxt = conviction?.macro_context || {};
  const gaps = arr(conviction?.portfolio_context?.major_gaps);
  const cvSummary = conviction?.summary || {};
  const asOf = conviction?.generated_at
    ? new Date(conviction.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : (state?.as_of ? new Date(state.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—');

  // ── SUMMARY STRIP ─────────────────────────────────────────────────────────
  const stripItems = [
    ['Universe', cvSummary.total_universe || summary.candidates || 0],
    ['Tier S — exceptional', cvSummary.tier_s || 0],
    ['Entry windows', cvSummary.active_windows || 0],
    ['Earnings watch', cvSummary.watch_windows || 0],
    ['Data as of', asOf, true],
  ];
  const trustStrip = stripItems.map(([label, value, isText]) =>
    `<article><span>${esc(label)}</span><b>${isText ? esc(value) : fmt(value)}</b></article>`
  ).join('');

  // ── CONVICTION ROWS ───────────────────────────────────────────────────────
  const convictionRows = top10.map(renderConvictionRow).join('');

  // ── RESEARCH PIPELINE CARDS ───────────────────────────────────────────────
  const pipelineCards = selected.map(r => renderOpportunityRow(r, rankMap)).join('');
  const emptyState = opportunities.length === 0
    ? `<div class="empty-op"><b>No promoted opportunities yet</b><span>All candidates are in evidence review — none are buy recommendations.</span></div>` : '';

  return `<section id="opportunities-section" class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">Opportunity</p>
        <h2>Conviction picks + research pipeline</h2>
        <p class="op-stance">Rankings integrate macro regime, portfolio gaps, and fundamentals. Timing windows show when to act. Research only — no ticker has buy authorization.</p>
      </div>
      <a class="button" href="outputs/conviction-ranking.json">Full ranking</a>
    </div>
    <div class="trust-strip">${trustStrip}</div>

    ${top10.length ? `
    <div class="cv-section-head"><h3>Top 10 — where to focus research</h3><p>Score = base quality + macro alignment + portfolio gap. Timing window shows current entry conditions.</p></div>
    ${renderMacroBar(macroCxt)}
    ${renderGapAlert(gaps)}
    <div class="cv-list">${convictionRows}</div>
    ` : ''}

    <div class="cv-pipeline-head">
      <h3>Research pipeline</h3>
      <p>All candidates in evidence review. None have buy authorization. Tier badges reference the candidate ranking.</p>
    </div>
    ${emptyState}
    <div class="op-card-board">${pipelineCards}</div>
  </section>`;
}

function renderOpportunitiesStyle() {
  return `<style>
.op-stance{color:var(--muted);font-size:13px;margin:6px 0 0}
.op-card-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin-top:14px}
.op-card{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.12);padding:14px;min-width:0}
.op-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}
.op-head-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}
.op-price{font-size:22px;font-weight:500;letter-spacing:-.04em;line-height:1}
.op-card-head h3{font-size:28px;line-height:.95;margin:4px 0 2px;letter-spacing:-.045em}
.op-card-head p{font-size:12px;color:var(--muted);margin:0}
.op-theme{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}
.op-gates{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}
.op-gate{font-size:10px;line-height:1;border:1px solid var(--rule);border-radius:999px;padding:5px 7px;color:var(--muted);background:rgba(251,250,246,.10)}
.op-gate.pass{border-color:rgba(47,111,78,.36);color:var(--green);background:rgba(47,111,78,.08)}
.op-gate.fail{border-color:rgba(174,124,44,.38);color:var(--warn);background:rgba(174,124,44,.08)}
.op-why-now{border:1px solid rgba(159,63,53,.25);border-radius:12px;padding:9px 11px;background:rgba(159,63,53,.04);margin-bottom:8px}
.op-why-now span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.op-why-now p{font-size:12px;line-height:1.4;color:rgba(36,35,31,.82);margin:0;font-weight:500}
.op-thesis-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}
.op-thesis-grid div,.op-price-context{border:1px solid var(--rule);border-radius:12px;padding:10px;background:rgba(251,250,246,.08);min-width:0}
.op-price-context{border-color:rgba(64,95,159,.25);background:rgba(64,95,159,.05)}
.op-thesis-grid span,.op-price-context span,.op-next-line span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.op-thesis-grid p,.op-price-context p{font-size:12px;line-height:1.42;color:rgba(36,35,31,.78);margin:0;overflow-wrap:anywhere}
.op-next-line{margin-top:8px;border:1px solid var(--rule);border-radius:12px;padding:9px 11px;background:rgba(251,250,246,.08)}
.op-next-line b{display:block;font-size:13px;line-height:1.25;margin:3px 0}
.op-next-line small{display:block;color:var(--muted);font-size:11px;line-height:1.35}
.op-tier{display:inline-flex;font-size:9px;font-weight:700;padding:3px 7px;border-radius:5px;border:1px solid var(--rule);letter-spacing:.06em}
.op-tier-A{border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.08);color:var(--green)}
.op-tier-B{border-color:rgba(174,124,44,.4);background:rgba(174,124,44,.08);color:var(--warn)}
.op-tier-C{border-color:var(--rule);color:var(--muted)}
.op-tier-D{border-color:rgba(159,63,53,.4);background:rgba(159,63,53,.06);color:var(--red)}
.op-signals{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px}
.op-signals span{font-size:10px;border:1px solid rgba(47,111,78,.28);border-radius:999px;padding:3px 8px;color:var(--green);background:rgba(47,111,78,.06);font-weight:500}
.empty-op{border:1px solid var(--rule);border-radius:16px;padding:14px;margin:14px 0;background:rgba(251,250,246,.12);display:grid;gap:4px}
.empty-op b{font-size:20px}.empty-op span{color:var(--muted);font-size:12px}
.cv-section-head{margin:20px 0 10px}
.cv-section-head h3{font-size:22px;letter-spacing:-.03em;margin:0 0 4px}
.cv-section-head p{font-size:12px;color:var(--muted);margin:0}
.cv-macro-bar{display:grid;grid-template-columns:140px 1fr 1fr 1fr;gap:10px;border:1px solid var(--rule);border-radius:16px;padding:14px;margin:10px 0;background:rgba(251,250,246,.08)}
.cv-macro-bar b{display:block;font-size:18px;letter-spacing:-.03em;margin:3px 0 2px}
.cv-macro-bar small{color:var(--muted);font-size:11px}
.cv-macro-bar span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:5px}
.cv-macro-bar ul{margin:0;padding:0 0 0 12px;font-size:12px;line-height:1.6;color:rgba(36,35,31,.78)}
.cv-macro-bar p{font-size:12px;line-height:1.45;color:rgba(36,35,31,.75);margin:0}
.cv-gaps{border:1px solid rgba(64,95,159,.2);border-radius:12px;padding:11px 13px;margin:8px 0;background:rgba(64,95,159,.04)}
.cv-gaps span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
.cv-gap-chips{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:5px}
.cv-gap-chip{font-size:11px;border:1px solid rgba(64,95,159,.28);border-radius:999px;padding:3px 9px;color:rgba(64,95,159,.9);background:rgba(64,95,159,.06)}
.cv-gap-chip i{font-style:normal;color:var(--muted);margin-left:4px}
.cv-gaps small{color:var(--muted);font-size:11px}
.cv-list{display:flex;flex-direction:column;gap:8px;margin-top:12px}
.cv-row{display:grid;grid-template-columns:80px 1fr;gap:12px;border:1px solid var(--rule);border-radius:18px;padding:14px;background:rgba(251,250,246,.10)}
.cv-rank-col{display:flex;flex-direction:column;align-items:center;gap:8px;padding-top:2px}
.cv-rank-num{font-size:30px;font-weight:600;letter-spacing:-.05em;line-height:1;color:var(--muted)}
.cv-score-ring{text-align:center;border:2px solid var(--rule);border-radius:12px;padding:5px 10px;min-width:54px}
.cv-score-ring b{display:block;font-size:20px;font-weight:600;letter-spacing:-.04em;line-height:1}
.cv-score-ring small{display:block;font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:2px}
.cv-tier-s{border-color:rgba(47,111,78,.5);background:rgba(47,111,78,.07)}
.cv-tier-s b,.cv-tier-s small{color:var(--green)}
.cv-tier-a{border-color:rgba(64,95,159,.4);background:rgba(64,95,159,.05)}
.cv-tier-a b,.cv-tier-a small{color:rgba(64,95,159,.9)}
.cv-tier-b{border-color:rgba(174,124,44,.4);background:rgba(174,124,44,.07)}
.cv-tier-b b,.cv-tier-b small{color:var(--warn)}
.cv-tier-c,cv-tier-d{border-color:var(--rule)}
.cv-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:6px}
.cv-theme-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:2px}
.cv-new-badge{display:inline-block;margin-left:6px;font-size:9px;font-weight:700;background:rgba(64,95,159,.1);border:1px solid rgba(64,95,159,.28);color:rgba(64,95,159,.9);padding:2px 5px;border-radius:4px;letter-spacing:.04em;vertical-align:middle}
.cv-head h3{font-size:24px;line-height:.95;letter-spacing:-.04em;margin:0}
.cv-head h3 span{font-size:13px;font-weight:400;letter-spacing:0;color:var(--muted);margin-left:5px}
.cv-analyst-rating{font-size:11px;font-weight:600;color:var(--green);border:1px solid rgba(47,111,78,.28);border-radius:8px;padding:4px 8px;flex-shrink:0;background:rgba(47,111,78,.06)}
.cv-signals{display:flex;flex-wrap:wrap;gap:4px;margin:5px 0}
.cv-signals span{font-size:10px;border:1px solid rgba(47,111,78,.26);border-radius:999px;padding:3px 8px;color:var(--green);background:rgba(47,111,78,.06);font-weight:500}
.cv-why{font-size:13px;line-height:1.45;color:rgba(36,35,31,.78);margin:5px 0 8px;overflow-wrap:anywhere}
.cv-timing{display:flex;gap:10px;border:1px solid var(--rule);border-radius:12px;padding:10px 12px;margin-bottom:8px;align-items:flex-start}
.cv-window{display:inline-block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:4px 8px;border-radius:6px;flex-shrink:0;margin-top:2px}
.win-active{background:rgba(47,111,78,.12);border:1px solid rgba(47,111,78,.4);color:var(--green)}
.win-watch{background:rgba(174,124,44,.10);border:1px solid rgba(174,124,44,.38);color:var(--warn)}
.win-wait{background:rgba(251,250,246,.12);border:1px solid var(--rule);color:var(--muted)}
.cv-timing-detail{min-width:0}
.cv-timing-detail b{display:block;font-size:12px;font-weight:600;line-height:1.25;margin-bottom:3px}
.cv-timing-detail p{font-size:12px;line-height:1.4;color:rgba(36,35,31,.76);margin:0 0 3px;overflow-wrap:anywhere}
.cv-timing-detail small{font-size:11px;color:var(--muted);display:block;overflow-wrap:anywhere}
.cv-modifiers{display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px}
.cv-modifiers div{border:1px solid var(--rule);border-radius:10px;padding:8px 10px;background:rgba(251,250,246,.08)}
.cv-modifiers span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}
.cv-modifiers p{font-size:11px;line-height:1.45;color:rgba(36,35,31,.72);margin:0;overflow-wrap:anywhere}
.cv-pipeline-head{margin:28px 0 10px;border-top:1px solid var(--rule);padding-top:20px}
.cv-pipeline-head h3{font-size:20px;letter-spacing:-.03em;margin:0 0 4px}
.cv-pipeline-head p{font-size:12px;color:var(--muted);margin:0}
@media(max-width:800px){
  .cv-macro-bar{grid-template-columns:1fr 1fr}
  .cv-modifiers{grid-template-columns:1fr 1fr}
  .cv-row{grid-template-columns:64px 1fr}
  .op-thesis-grid{grid-template-columns:1fr}
}
@media(max-width:520px){
  .cv-macro-bar,.cv-modifiers,.op-card-board{grid-template-columns:1fr}
  .cv-row{grid-template-columns:1fr}
  .cv-rank-col{flex-direction:row;align-items:center}
}
</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };
