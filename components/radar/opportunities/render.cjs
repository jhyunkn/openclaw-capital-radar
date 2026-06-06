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

  // Entry zone
  const entryHtml = (() => {
    const e = item.entry;
    if (!e) return '';
    const fmtP = v => `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
    const isDeep  = e.status === 'in_zone_deep';
    const inZone  = e.status === 'in_zone' || isDeep;
    const statusLabel = isDeep ? 'Deep in entry zone — verify thesis' : inZone ? 'In entry zone' : 'Above entry zone — wait';
    const statusCls   = isDeep ? 'entry-deep' : inZone ? 'entry-in' : 'entry-above';
    const isLive  = e.priceSource === 'live';
    const cur     = e.currentPrice ?? e.currentEst;  // live preferred
    const low = e.low, high = e.high, tgt = e.target;
    const rangeMin = Math.min(low * 0.90, cur * 0.88);
    const rangeMax = Math.max(tgt * 1.05, cur * 1.05);
    const span = rangeMax - rangeMin;
    const pctOf = v => Math.max(0, Math.min(100, Math.round((v - rangeMin) / span * 100)));
    const lowPct = pctOf(low), highPct = pctOf(high), curPct = pctOf(cur), tgtPct = pctOf(tgt);
    const priceLabel = isLive ? 'live' : 'est';
    // Supplementary live signals if available
    const liveSignals = [
      e.pctFrom52wHigh != null ? `${e.pctFrom52wHigh > 0 ? '+' : ''}${e.pctFrom52wHigh}% from 52wH` : null,
      e.trend1mPct != null    ? `${e.trend1mPct > 0 ? '+' : ''}${e.trend1mPct}% (1m)` : null,
      e.rsi14 != null         ? `RSI ${e.rsi14}` : null,
    ].filter(Boolean).join(' · ');
    return `<div class="cv-entry ${statusCls}">
      <div class="cv-entry-head">
        <span>Entry zone</span>
        <b class="cv-entry-status">${statusLabel}</b>
      </div>
      <div class="cv-price-bar-wrap">
        <div class="cv-price-bar">
          <div class="cv-zone-fill" style="left:${lowPct}%;width:${highPct - lowPct}%"></div>
          <div class="cv-marker cv-marker-cur" style="left:${curPct}%"><span>${priceLabel}<br>${fmtP(cur)}</span></div>
          <div class="cv-marker cv-marker-tgt" style="left:${tgtPct}%"><span>target<br>${fmtP(tgt)}</span></div>
        </div>
        <div class="cv-price-labels">
          <span style="left:${lowPct}%">${fmtP(low)}</span>
          <span style="left:${highPct}%" class="cv-label-right">${fmtP(high)} entry</span>
        </div>
      </div>
      ${liveSignals ? `<p class="cv-live-signals">${esc(liveSignals)}</p>` : ''}
      <p class="cv-entry-rationale">${esc(e.rationale || '')}</p>
    </div>`;
  })();

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
      ${entryHtml}
      ${timingHtml}
      <div class="cv-modifiers">
        <div><span>Macro</span><p>${esc(macroLine || 'Neutral')}</p></div>
        <div><span>Portfolio fit</span><p>${esc(gapLine)}</p></div>
        <div><span>Risk</span><p>${esc((item.risk_note || '').slice(0, 100))}</p></div>
      </div>
    </div>
  </article>`;
}

function renderPullbackContext(pb) {
  if (!pb || !pb.has_pullback) return '';

  const holdingsRows = arr(pb.holdings_affected).slice(0, 6).map(h => {
    const pct = Number(h.trend1mPct);
    const cls = pct < -15 ? 'pb-bad' : 'pb-warn';
    return `<div class="pb-row ${cls}">
      <b>${esc(h.ticker)}</b>
      <span class="pb-pct">${pct.toFixed(1)}%</span>
      <span class="pb-thesis">${esc(h.thesis || '—')}</span>
    </div>`;
  }).join('');

  const watchlistRows = arr(pb.watchlist_dislocations).map(w =>
    `<div class="pb-row pb-warn">
      <b>${esc(w.ticker)}</b>
      <span class="pb-theme">${esc(w.theme)}</span>
      <span class="pb-note">${esc((w.note || '').slice(0, 60))}</span>
    </div>`
  ).join('');

  const actionItems = arr(pb.action_items).map(a => `<li>${esc(a)}</li>`).join('');

  const spyLine = pb.spy_trend_1m_pct != null
    ? `S&P 500 (1-month): <b>${pb.spy_trend_1m_pct > 0 ? '+' : ''}${Number(pb.spy_trend_1m_pct).toFixed(2)}%</b> — index held while sector names corrected.`
    : '';

  return `<div class="pb-context">
    <div class="pb-header">
      <div class="pb-badge">Pullback in progress</div>
      <p class="pb-summary">${esc(pb.market_summary)} ${spyLine}</p>
    </div>
    <div class="pb-grid">
      <div class="pb-col">
        <span class="pb-col-label">Holdings affected (1-month)</span>
        ${holdingsRows || '<p class="pb-none">No significant moves</p>'}
        <small class="pb-note-text">Holdings price data is live (Yahoo Finance).</small>
      </div>
      <div class="pb-col">
        <span class="pb-col-label">Watchlist dislocations</span>
        ${watchlistRows || '<p class="pb-none">No active dislocations flagged</p>'}
        <small class="pb-note-text">Watchlist prices are seeded — verify before acting.</small>
      </div>
      <div class="pb-col">
        <span class="pb-col-label">What to do now</span>
        <ul class="pb-actions">${actionItems}</ul>
        <p class="pb-posture">${esc(pb.posture_on_pullback)}</p>
      </div>
    </div>
  </div>`;
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

// ── SCANNER: EMERGING CANDIDATES ─────────────────────────────────────────────
// Renders tickers that the Moat-at-Trough scanner has flagged but are NOT yet in
// the active conviction universe. These are potential promotions.

function renderScannerCard(candidate) {
  const livePct = candidate.pct_from_52w_high;
  const trend1m = candidate.trend_1m_pct;
  const rsi     = candidate.rsi14;
  const sigColor = candidate.signal === 'FULL_SIGNAL' ? 'scan-full' : 'scan-partial';
  const sigLabel = candidate.signal === 'FULL_SIGNAL'
    ? 'All 3 criteria — promote to watch'
    : 'Partial signal — monitor';

  const priceRow = [
    livePct  != null ? `${livePct > 0 ? '+' : ''}${livePct}% from 52wH` : null,
    trend1m  != null ? `${trend1m > 0 ? '+' : ''}${trend1m}% (1m)` : null,
    rsi      != null ? `RSI ${rsi}` : null,
    candidate.live_price != null ? `$${Number(candidate.live_price).toLocaleString(undefined, { maximumFractionDigits: candidate.live_price < 10 ? 2 : 0 })}` : null,
  ].filter(Boolean).join(' · ');

  const themeHits = arr(candidate.active_theme_hits).map(t => `<span class="scan-theme">${esc(t.replace(/_/g, ' '))}</span>`).join('');
  const signals   = arr(candidate.signals_detected).slice(0, 3).map(s => `<li>${esc(s)}</li>`).join('');
  const gaps      = arr(candidate.gaps).slice(0, 2).map(g => `<li>${esc(g)}</li>`).join('');

  const insiderNote = candidate.insider_signal && candidate.insider_signal !== 'QUIET' && candidate.insider_signal !== 'UNKNOWN'
    ? `<div class="scan-insider"><span>Insider (Form 4)</span><b>${esc(candidate.insider_signal)}</b><small>${esc(candidate.insider_filings_90d)} filings 90d</small></div>`
    : '';

  return `<article class="scan-card ${sigColor}">
    <div class="scan-head">
      <div>
        <span class="scan-sector">${esc(candidate.sector)}</span>
        <h4>${esc(candidate.ticker)} <span>${esc(candidate.name)}</span></h4>
        <span class="scan-level">Supply chain level ${esc(candidate.supply_chain_level)} · ${esc(candidate.signal.replace(/_/g, ' '))} (score ${candidate.total_score})</span>
      </div>
      <div class="scan-status-badge ${sigColor}">${sigLabel}</div>
    </div>
    ${priceRow ? `<div class="scan-price-row">${esc(priceRow)}</div>` : ''}
    <p class="scan-moat">${esc((candidate.moat_summary || '').slice(0, 200))}</p>
    ${themeHits ? `<div class="scan-themes">${themeHits}</div>` : ''}
    ${signals ? `<ul class="scan-signals">${signals}</ul>` : ''}
    ${insiderNote}
    <p class="scan-inflection">${esc((candidate.demand_inflection_signal || '').slice(0, 180))}</p>
    ${gaps ? `<ul class="scan-gaps">${gaps}</ul>` : ''}
    ${candidate.insider_edgar_url ? `<a class="scan-link" href="${esc(candidate.insider_edgar_url)}" target="_blank">Check insider filings →</a>` : ''}
  </article>`;
}

function renderScannerSection(scannerData) {
  if (!scannerData) return '';
  const fullSignal    = arr(scannerData.full_signal_candidates);
  const partialSignal = arr(scannerData.partial_signal_candidates).slice(0, 6);
  const coverageGaps  = arr(scannerData.coverage_gaps);

  if (!fullSignal.length && !partialSignal.length) return '';

  const fullCards    = fullSignal.map(renderScannerCard).join('');
  const partialCards = partialSignal.map(renderScannerCard).join('');

  const gapAlerts = coverageGaps.length
    ? `<div class="scan-gap-alerts">${coverageGaps.slice(0, 3).map(g =>
        `<div class="scan-gap-alert"><b>${esc(g.theme.replace(/_/g, ' '))}</b><span>${esc(g.urgency)}</span><small>Not covered at Level 2: ${arr(g.missing_levels?.level2).slice(0, 4).join(', ') || '—'}</small></div>`
      ).join('')}</div>`
    : '';

  const activeThemes = arr(scannerData.active_themes).map(t => `<span>${esc(t.replace(/_/g, ' '))}</span>`).join('');

  return `<div class="scan-section">
    <div class="scan-section-head">
      <div>
        <h3>Scanner: emerging candidates</h3>
        <p>Moat-at-Trough screen — finding the next Micron before the street catches on. Checks moat quality, price dislocation, and active theme adjacency across ${scannerData.all_scored?.length || 0} candidates not yet in the conviction universe.</p>
      </div>
    </div>
    ${activeThemes ? `<div class="scan-active-themes"><span>Active themes driving scan:</span>${activeThemes}</div>` : ''}
    ${gapAlerts}
    ${fullSignal.length ? `
      <div class="scan-subsection-head">
        <h4>All 3 criteria met — promote to watch</h4>
        <p>Moat durable + price near trough + active demand inflection. These are the Micron setups. Research required before any position.</p>
      </div>
      <div class="scan-card-grid">${fullCards}</div>
    ` : ''}
    ${partialSignal.length ? `
      <div class="scan-subsection-head scan-partial-head">
        <h4>Partial signal — monitor</h4>
        <p>Moat confirmed + theme adjacency present. Waiting for price to reach trough or demand inflection to strengthen.</p>
      </div>
      <div class="scan-card-grid">${partialCards}</div>
    ` : ''}
  </div>`;
}

// ── COMBINED OPPORTUNITIES SECTION ────────────────────────────────────────────

// ── DYNAMIC UNIVERSE PROMOTION SECTION ───────────────────────────────────────
// Shows scanner-promoted candidates that passed multi-signal confirmation.
// "Conviction promoted" = FULL score + insider buy + revenue recovery.
// "Watchlist promoted" = scanner FULL_SIGNAL but fewer confirmation sources.

function renderDynamicPromoCard(entry, tier) {
  const mkt    = entry.live_price != null ? `<span class="dp-price">${price(entry.live_price)}</span>` : '';
  const pct    = entry.pct_from_52w_high != null ? `<span class="dp-pct ${entry.pct_from_52w_high <= -30 ? 'dp-deep' : ''}">${entry.pct_from_52w_high}% from 52wH</span>` : '';
  const rsi    = entry.rsi14 != null ? `<span class="dp-rsi">RSI ${entry.rsi14}</span>` : '';
  const isConv = tier === 'CONVICTION';

  const ev = arr(entry.evidence).slice(0, 4).map(e =>
    `<li>${esc(e.replace(/^(Scanner|Live price)[^|]+\|?\s*/, '').slice(0, 110))}</li>`
  ).join('');

  // Revenue status badge
  const revStatus = entry.revenue_inflection;
  const revBadge  = revStatus ? `<span class="dp-rev dp-rev-${String(revStatus).toLowerCase()}">${esc(revStatus)}</span>` : '';

  return `<div class="dp-card ${isConv ? 'dp-conv' : 'dp-watch'}">
    <div class="dp-head">
      <div class="dp-ticker-row">
        <b class="dp-ticker">${esc(entry.ticker)}</b>
        <span class="dp-name">${esc(entry.name || '')}</span>
        <span class="dp-tier-badge ${isConv ? 'dp-tier-conv' : 'dp-tier-watch'}">${isConv ? 'Conviction promoted' : 'Watchlist promoted'}</span>
      </div>
      <div class="dp-price-row">${mkt}${pct}${rsi}${revBadge}</div>
    </div>
    <p class="dp-thesis">${esc((entry.thesis || '').slice(0, 220))}</p>
    ${ev ? `<ul class="dp-evidence">${ev}</ul>` : ''}
    <div class="dp-score">Promotion score: ${entry.score ?? '—'}/100 · ${isConv ? 'Multi-signal confirmed' : 'Scanner confirmed, awaiting further data'}</div>
  </div>`;
}

function renderDynamicSection(dynamicUniverse) {
  if (!dynamicUniverse?.available) return '';
  const convPromo = arr(dynamicUniverse.conviction_promotions);
  const watchPromo = arr(dynamicUniverse.watchlist_promotions);
  if (!convPromo.length && !watchPromo.length) return '';

  // Merge scanner live_price/rsi14/pct_from_52w_high into the promotion entries
  // (dynamic universe stores thesis + score; scanner stores price signals)
  const convCards  = convPromo.map(e => renderDynamicPromoCard(e, 'CONVICTION')).join('');
  const watchCards = watchPromo.map(e => renderDynamicPromoCard(e, 'WATCHLIST')).join('');

  const promoted = convPromo.length + watchPromo.length;

  return `<div class="dp-section">
    <div class="dp-section-head">
      <div>
        <h3>Dynamic promotions — scanner finds, data confirms</h3>
        <p>System-generated candidates that passed the Moat-at-Trough screen AND multi-source confirmation (open-market insider buys, XBRL revenue recovery, institutional backing). ${promoted} promoted this build. Research required before any position.</p>
      </div>
      <span class="dp-badge">${promoted} promoted</span>
    </div>
    ${convPromo.length ? `
      <div class="dp-subsection-head">
        <h4>Conviction tier — multi-signal confirmed</h4>
        <p>Strong insider buying + revenue recovery + active theme alignment. Highest-priority for research.</p>
      </div>
      <div class="dp-card-grid">${convCards}</div>
    ` : ''}
    ${watchPromo.length ? `
      <div class="dp-subsection-head dp-watch-head">
        <h4>Watchlist tier — scanner confirmed, monitoring for additional signals</h4>
        <p>All 3 scanner criteria met (moat + trough + demand inflection). Awaiting insider buy confirmation or revenue inflection data.</p>
      </div>
      <div class="dp-card-grid">${watchCards}</div>
    ` : ''}
  </div>`;
}

function renderOpportunitiesSection(state, candidateRanking, conviction, scannerData, dynamicUniverse) {
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

  // Pullback context
  const pullback = conviction?.pullback_context || null;
  const pullbackHtml = renderPullbackContext(pullback);

  return `<section id="opportunities-section" class="panel">
    <div class="section-head">
      <div>
        <p class="eyebrow">Opportunity</p>
        <h2>Conviction picks + research pipeline</h2>
        <p class="op-stance">Rankings integrate macro regime, portfolio gaps, and fundamentals. Timing windows show when to act. Research only — no ticker has buy authorization.</p>
      </div>
      <a class="button" href="outputs/conviction-ranking.json">Full ranking</a>
    </div>
    ${pullbackHtml}
    <div class="trust-strip">${trustStrip}</div>

    ${top10.length ? `
    <div class="cv-section-head"><h3>Top 10 — where to focus research</h3><p>Score = base quality + macro alignment + portfolio gap. Timing window shows current entry conditions.</p></div>
    ${renderMacroBar(macroCxt)}
    ${renderGapAlert(gaps)}
    <div class="cv-list">${convictionRows}</div>
    ` : ''}

    ${renderDynamicSection(dynamicUniverse)}

    ${renderScannerSection(scannerData)}

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
.pb-context{border:1px solid rgba(174,124,44,.45);border-radius:18px;padding:16px;margin:14px 0;background:rgba(174,124,44,.06)}
.pb-header{margin-bottom:12px}
.pb-badge{display:inline-block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;background:rgba(174,124,44,.15);border:1px solid rgba(174,124,44,.45);color:var(--warn);padding:4px 10px;border-radius:6px;margin-bottom:8px}
.pb-summary{font-size:13px;line-height:1.5;color:rgba(36,35,31,.82);margin:0}
.pb-summary b{font-weight:600}
.pb-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-top:12px}
.pb-col{background:rgba(251,250,246,.12);border:1px solid var(--rule);border-radius:14px;padding:12px}
.pb-col-label{display:block;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:8px}
.pb-row{display:grid;grid-template-columns:44px 1fr auto;gap:6px;align-items:center;padding:5px 0;border-bottom:1px solid var(--rule);font-size:12px}
.pb-row:last-of-type{border-bottom:none}
.pb-row b{font-size:13px;font-weight:600;letter-spacing:-.02em}
.pb-pct{font-weight:600;font-size:12px}
.pb-bad .pb-pct{color:var(--red)}
.pb-warn .pb-pct{color:var(--warn)}
.pb-thesis,.pb-theme{font-size:11px;color:var(--muted);text-align:right}
.pb-note{font-size:11px;color:var(--muted);grid-column:2/-1}
.pb-note-text{display:block;font-size:10px;color:var(--muted);margin-top:8px;line-height:1.4}
.pb-none{font-size:12px;color:var(--muted);margin:4px 0}
.pb-actions{margin:0 0 8px;padding:0 0 0 14px;font-size:12px;line-height:1.7;color:rgba(36,35,31,.78)}
.pb-posture{font-size:11px;line-height:1.5;color:var(--muted);margin:0;border-top:1px solid var(--rule);padding-top:8px}
@media(max-width:800px){.pb-grid{grid-template-columns:1fr 1fr}}
@media(max-width:520px){.pb-grid{grid-template-columns:1fr}}
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
.cv-entry{border:1px solid var(--rule);border-radius:12px;padding:11px 13px;margin-bottom:8px;background:rgba(251,250,246,.08)}
.cv-entry.entry-in{border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.06)}
.cv-entry.entry-above{border-color:rgba(174,124,44,.35);background:rgba(174,124,44,.05)}
.cv-entry-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.cv-entry-head span{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.cv-entry-status{font-size:11px;font-weight:600}
.entry-in .cv-entry-status{color:var(--green)}
.entry-above .cv-entry-status{color:var(--warn)}
.cv-price-bar-wrap{position:relative;margin:0 0 18px}
.cv-price-bar{position:relative;height:6px;background:rgba(36,35,31,.10);border-radius:3px;margin:0 0 20px}
.cv-zone-fill{position:absolute;top:0;height:6px;border-radius:3px;background:rgba(47,111,78,.35)}
.entry-above .cv-zone-fill{background:rgba(174,124,44,.35)}
.cv-marker{position:absolute;top:-4px;transform:translateX(-50%)}
.cv-marker::before{content:'';display:block;width:14px;height:14px;border-radius:50%;border:2px solid;margin:0 auto}
.cv-marker-cur::before{border-color:var(--warn);background:#fff}
.entry-in .cv-marker-cur::before{border-color:var(--green)}
.cv-marker-tgt::before{border-color:rgba(64,95,159,.6);background:rgba(64,95,159,.15)}
.cv-marker span{display:block;font-size:9px;line-height:1.2;text-align:center;margin-top:3px;white-space:nowrap;color:var(--muted)}
.cv-marker-cur span{font-weight:600;color:rgba(36,35,31,.8)}
.cv-price-labels{position:relative;height:14px}
.cv-price-labels span{position:absolute;font-size:10px;font-weight:600;transform:translateX(-50%);color:var(--green);white-space:nowrap}
.entry-above .cv-price-labels span{color:var(--warn)}
.cv-label-right{transform:translateX(-80%)!important}
.cv-entry-rationale{font-size:11px;line-height:1.45;color:var(--muted);margin:0;border-top:1px solid var(--rule);padding-top:7px}
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
.cv-live-signals{font-size:11px;color:var(--muted);margin:4px 0 0;font-weight:500}
.cv-entry.entry-deep{border-color:rgba(47,111,78,.6);background:rgba(47,111,78,.10)}
.entry-deep .cv-entry-status{color:var(--green);font-weight:700}
/* Scanner section */
.scan-section{border:1px solid rgba(64,95,159,.2);border-radius:18px;padding:16px;margin:20px 0;background:rgba(64,95,159,.03)}
.scan-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:12px}
.scan-section-head h3{font-size:20px;letter-spacing:-.03em;margin:0 0 4px}
.scan-section-head p{font-size:12px;color:var(--muted);margin:0;line-height:1.45}
.scan-active-themes{display:flex;flex-wrap:wrap;gap:5px;align-items:center;margin-bottom:10px}
.scan-active-themes span:first-child{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-right:4px}
.scan-active-themes span:not(:first-child){font-size:11px;border:1px solid rgba(64,95,159,.3);border-radius:999px;padding:3px 9px;color:rgba(64,95,159,.85);background:rgba(64,95,159,.07)}
.scan-subsection-head{margin:16px 0 8px}
.scan-subsection-head h4{font-size:16px;letter-spacing:-.02em;margin:0 0 3px}
.scan-subsection-head p{font-size:12px;color:var(--muted);margin:0}
.scan-partial-head{opacity:.85}
.scan-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:10px}
.scan-card{border:1px solid var(--rule);border-radius:16px;padding:13px;background:rgba(251,250,246,.10);min-width:0}
.scan-full{border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.04)}
.scan-partial{border-color:rgba(174,124,44,.35);background:rgba(174,124,44,.04)}
.scan-head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:8px}
.scan-sector{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);margin-bottom:2px}
.scan-head h4{font-size:20px;line-height:.95;letter-spacing:-.04em;margin:0 0 2px}
.scan-head h4 span{font-size:12px;font-weight:400;letter-spacing:0;color:var(--muted);margin-left:4px}
.scan-level{display:block;font-size:10px;color:var(--muted);line-height:1.3}
.scan-status-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;padding:4px 8px;border-radius:6px;white-space:nowrap;flex-shrink:0}
.scan-full .scan-status-badge{background:rgba(47,111,78,.12);border:1px solid rgba(47,111,78,.4);color:var(--green)}
.scan-partial .scan-status-badge{background:rgba(174,124,44,.10);border:1px solid rgba(174,124,44,.38);color:var(--warn)}
.scan-price-row{font-size:12px;font-weight:600;color:rgba(36,35,31,.8);margin:6px 0;letter-spacing:-.01em}
.scan-moat{font-size:12px;line-height:1.4;color:rgba(36,35,31,.76);margin:6px 0 5px;overflow-wrap:anywhere}
.scan-themes{display:flex;flex-wrap:wrap;gap:4px;margin:6px 0}
.scan-theme{font-size:10px;border:1px solid rgba(64,95,159,.28);border-radius:999px;padding:2px 7px;color:rgba(64,95,159,.85);background:rgba(64,95,159,.06)}
.scan-signals{margin:5px 0;padding:0 0 0 13px;font-size:12px;line-height:1.6;color:rgba(36,35,31,.78)}
.scan-gaps{margin:5px 0;padding:0 0 0 13px;font-size:11px;line-height:1.5;color:var(--muted)}
.scan-inflection{font-size:11px;line-height:1.4;color:var(--muted);margin:5px 0;border-top:1px solid var(--rule);padding-top:5px;overflow-wrap:anywhere}
.scan-insider{display:flex;gap:6px;align-items:center;margin:5px 0;background:rgba(64,95,159,.05);border:1px solid rgba(64,95,159,.2);border-radius:8px;padding:5px 8px}
.scan-insider span{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.scan-insider b{font-size:11px;font-weight:700;color:rgba(64,95,159,.9)}
.scan-insider small{font-size:10px;color:var(--muted)}
.scan-link{display:inline-block;font-size:11px;color:rgba(64,95,159,.8);margin-top:5px;text-decoration:none}
.scan-link:hover{text-decoration:underline}
.scan-gap-alerts{display:flex;flex-direction:column;gap:6px;margin-bottom:12px}
.scan-gap-alert{border:1px solid rgba(174,124,44,.3);border-radius:10px;padding:8px 11px;background:rgba(174,124,44,.05);display:grid;gap:2px}
.scan-gap-alert b{font-size:13px;font-weight:600;letter-spacing:-.01em}
.scan-gap-alert span{font-size:11px;color:var(--warn);font-weight:500}
.scan-gap-alert small{font-size:11px;color:var(--muted)}
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
/* ── Dynamic Promotion Section ── */
.dp-section{border:2px solid rgba(16,185,129,.25);border-radius:18px;padding:20px;margin:24px 0;background:rgba(16,185,129,.03)}
.dp-section-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:16px}
.dp-section-head h3{font-size:20px;letter-spacing:-.03em;margin:0 0 4px;color:rgb(16,185,129)}
.dp-section-head p{font-size:12px;color:var(--muted);margin:0;line-height:1.45;max-width:520px}
.dp-badge{background:rgba(16,185,129,.15);color:rgb(16,185,129);border-radius:20px;padding:4px 12px;font-size:11px;font-weight:600;white-space:nowrap}
.dp-subsection-head{margin:16px 0 8px;border-left:3px solid rgb(16,185,129);padding-left:12px}
.dp-subsection-head h4{font-size:14px;margin:0 0 2px;font-weight:600}
.dp-subsection-head p{font-size:11px;color:var(--muted);margin:0}
.dp-watch-head{border-left-color:rgba(251,191,36,.7)}
.dp-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;margin-bottom:8px}
.dp-card{border:1px solid rgba(16,185,129,.2);border-radius:12px;padding:14px;background:#fff}
.dp-conv{border-color:rgba(16,185,129,.5);background:rgba(16,185,129,.04)}
.dp-watch{border-color:rgba(251,191,36,.4);background:rgba(251,191,36,.03)}
.dp-head{margin-bottom:8px}
.dp-ticker-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:4px}
.dp-ticker{font-size:16px;font-weight:700;letter-spacing:.02em}
.dp-name{font-size:11px;color:var(--muted)}
.dp-tier-badge{font-size:10px;padding:2px 7px;border-radius:10px;font-weight:600}
.dp-tier-conv{background:rgba(16,185,129,.15);color:rgb(5,150,105)}
.dp-tier-watch{background:rgba(251,191,36,.15);color:rgb(180,130,0)}
.dp-price-row{display:flex;gap:8px;flex-wrap:wrap;font-size:11px}
.dp-price{font-weight:600}
.dp-pct{color:#d97706}
.dp-deep{color:#dc2626}
.dp-rsi{color:var(--muted)}
.dp-rev{padding:2px 6px;border-radius:8px;font-weight:600;font-size:10px}
.dp-rev-recovery{background:rgba(16,185,129,.15);color:rgb(5,150,105)}
.dp-rev-inflecting{background:rgba(59,130,246,.15);color:rgb(37,99,235)}
.dp-rev-improving{background:rgba(251,191,36,.15);color:rgb(161,120,0)}
.dp-rev-deteriorating{background:rgba(239,68,68,.1);color:#dc2626}
.dp-thesis{font-size:12px;color:#374151;margin:0 0 8px;line-height:1.5}
.dp-evidence{margin:0 0 8px;padding-left:16px;font-size:11px;color:var(--muted);line-height:1.5}
.dp-evidence li{margin-bottom:2px}
.dp-score{font-size:10px;color:var(--muted);border-top:1px solid rgba(0,0,0,.05);padding-top:6px;margin-top:4px}
</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };
