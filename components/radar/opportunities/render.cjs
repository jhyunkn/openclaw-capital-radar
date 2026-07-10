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

// ── UNIFIED BRIEF CARD VIEW ───────────────────────────────────────────────────
// Merges conviction top10 + dynamic promotions into ONE ranked list.
// Attention score = base quality score + active-signal boost.
// This ensures detected signals (LEU, HUBS) naturally rank above static picks
// when signals are strong — the system determines importance, not a fixed list.

function attentionBoost(pct52wh, openMktSignal, windowScore, isFullSignal) {
  let b = 0;
  if (openMktSignal === 'STRONG')   b += 15;
  else if (openMktSignal === 'PRESENT') b += 6;
  if (isFullSignal)                 b += 10;
  if (pct52wh != null && pct52wh <= -50) b += 8;
  else if (pct52wh != null && pct52wh <= -30) b += 4;
  if (windowScore === 3)            b += 8;
  return b;
}

function snip(str, max) {
  if (!str || str.length <= max) return str || '';
  const cut = str.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function dynOneLiner(e) {
  // Pure company description — revenue growth is shown separately in metric chips
  return snip(e.moat_summary || '', 160);
}

function buildUnifiedList(conviction, dynamicUniverse, bandMap) {
  // Tier 1: Dynamic signals — conviction/watchlist promotions (scanner confirmed, highest quality)
  // Tier 2: Event-driven — up to 2 by score, compete for slots (no guaranteed placement)
  // Tier 3: Static conviction — framework picks, sorted by attention score
  // All tiers compete in a single sorted list; top MAX shown. Conviction over coverage.
  const MAX = 10;
  const seen = new Set();
  const tier1 = [], tier2 = [], tier3 = [];

  for (const e of arr(dynamicUniverse?.conviction_promotions)) {
    seen.add(e.ticker);
    const boost = attentionBoost(e.pct_from_52w_high, e.open_market_signal, 0, false);
    const pctDown = e.pct_from_52w_high != null ? `${Math.abs(e.pct_from_52w_high)}%` : null;
    const revGrowth = e.revenue_interp
      ? e.revenue_interp.replace('Revenue growing ', '').replace(/ — recovery confirmed$/i, '').trim()
      : null;
    const revLabel = revGrowth ? `+${revGrowth}` : (e.revenue_inflection || null);

    const isRevRecovery = e.revenue_inflection === 'RECOVERY' || (e.revenue_interp || '').startsWith('Revenue growing');
    let tag, explain;
    if (e.open_market_signal === 'STRONG') {
      const mm = e.open_market_value_mm ? `$${Number(e.open_market_value_mm).toFixed(1)}M` : 'significant';
      tag = 'Insider buy';
      explain = `${pctDown ? `Down ${pctDown} from its 52-week high` : 'At a cyclical trough'}${isRevRecovery && revGrowth ? `, yet revenue is still growing ${revGrowth}` : ''}. That gap — stock falling while the business grows — is the setup. An insider put ${mm} of personal money in at this price. Executives don't do that when they expect it to go lower.`;
    } else {
      const eventEv = arr(e.evidence).find(s => /market event/i.test(s)) || '';
      const eventNote = eventEv
        ? ' ' + eventEv.replace(/^[^:]+:\s*/, '').replace(/ \(.*?\)$/, '').replace(/ — HIGH signal$/i, ' is also in play.').slice(0, 90)
        : '';
      tag = 'Promoted';
      explain = `${pctDown ? `Down ${pctDown} from its high` : 'At a cyclical trough'}${isRevRecovery && revGrowth ? ` with ${revGrowth} revenue growth` : ''}.${eventNote} The system confirmed: competitive position is intact, price is at a trough, and demand is beginning to recover.`;
    }
    const b1 = (bandMap || {})[e.ticker];
    tier1.push({ ticker: e.ticker, name: e.name || '', attention: e.score + boost,
      source: 'dynamic_conviction', tag, explain, why: dynOneLiner(e),
      earlyEntrySignal: e.early_entry_signal || null,
      catalyst: e.next_catalyst || null,
      invalidation: e.invalidation || null,
      crowding: null,
      price: e.live_price, pct52wh: e.pct_from_52w_high, rsi: e.rsi14,
      rev: isRevRecovery ? revLabel : null,
      entryLow: b1?.entry_band_low ?? null, entryHigh: b1?.entry_band_high ?? null,
      upsideTarget: b1?.upside_reference ?? null });
  }

  for (const e of arr(dynamicUniverse?.watchlist_promotions)) {
    seen.add(e.ticker);
    const boost = attentionBoost(e.pct_from_52w_high, e.open_market_signal, 0, true);
    const pctDown = e.pct_from_52w_high != null ? `${Math.abs(e.pct_from_52w_high)}%` : null;
    const revGrowth = e.revenue_interp
      ? e.revenue_interp.replace('Revenue growing ', '').replace(/ — recovery confirmed$/i, '').trim()
      : null;
    const isRevRecovery2 = e.revenue_inflection === 'RECOVERY' || (e.revenue_interp || '').startsWith('Revenue growing');
    const revLabel2 = isRevRecovery2 && revGrowth ? `+${revGrowth}` : null;
    const explain = `${pctDown ? `Down ${pctDown} from its high` : 'At a cyclical trough'}${isRevRecovery2 && revGrowth ? ` with ${revGrowth} revenue growth` : ''}. The scanner confirmed all three criteria: durable competitive moat, price at a cyclical trough, and demand starting to inflect. No insider confirmation yet — keep on close watch before acting.`;
    const b2 = (bandMap || {})[e.ticker];
    tier1.push({ ticker: e.ticker, name: e.name || '', attention: e.score + boost,
      source: 'dynamic_watchlist', tag: 'Full scan', explain,
      why: dynOneLiner(e),
      earlyEntrySignal: e.early_entry_signal || null,
      catalyst: e.next_catalyst || null,
      invalidation: e.invalidation || null,
      crowding: null,
      price: e.live_price, pct52wh: e.pct_from_52w_high,
      rsi: e.rsi14, rev: revLabel2,
      entryLow: b2?.entry_band_low ?? null, entryHigh: b2?.entry_band_high ?? null,
      upsideTarget: b2?.upside_reference ?? null });
  }

  // Event-driven: up to 2 by score — compete for slots, no guarantee
  const eventCandidates = arr(dynamicUniverse?.event_driven_candidates)
    .filter(e => !seen.has(e.ticker))
    .sort((a, b) => b.score - a.score)
    .slice(0, 2);
  for (const e of eventCandidates) {
    seen.add(e.ticker);
    const troughBoost = (e.pct_from_52w_high != null && e.pct_from_52w_high <= -50) ? 8
                      : (e.pct_from_52w_high != null && e.pct_from_52w_high <= -30) ? 4 : 0;
    const pctDown = e.pct_from_52w_high != null ? `${Math.abs(e.pct_from_52w_high)}%` : null;
    const explain = `${e.event_name || 'A major market event'} creates a direct tailwind here. ${pctDown ? `Currently ${pctDown} below its 52-week high. ` : ''}No scanner entry signal yet — this is early positioning before the market prices in the catalyst. If it materializes, you want to already be watching.`;
    const b3 = (bandMap || {})[e.ticker];
    tier2.push({ ticker: e.ticker, name: e.name || '', attention: e.score + troughBoost,
      source: 'event_driven', tag: 'Catalyst', explain,
      why: snip(e.moat_summary || '', 160),
      earlyEntrySignal: e.early_entry_signal || null,
      catalyst: e.next_catalyst || (e.event_name ? `${e.event_name}: watch for materializing catalyst.` : null),
      invalidation: e.invalidation || null,
      crowding: null,
      price: e.live_price, pct52wh: e.pct_from_52w_high, rsi: e.rsi14, rev: null,
      entryLow: b3?.entry_band_low ?? null, entryHigh: b3?.entry_band_high ?? null,
      upsideTarget: b3?.upside_reference ?? null });
  }

  for (const cv of arr(conviction?.top10)) {
    if (seen.has(cv.ticker)) continue;
    const e = cv.entry || {};
    const livePct = cv.pct_from_52w_high ?? e.pctFrom52wHigh;
    const boost = attentionBoost(livePct, null, cv.window_score, false);
    const isActive = cv.window_score === 3;
    const b4 = (bandMap || {})[cv.ticker];
    tier3.push({ ticker: cv.ticker, name: cv.name || '', attention: cv.conviction_score + boost,
      source: 'conviction', tag: isActive ? 'Entry window' : 'Monitoring',
      why: snip(cv.why_core || cv.moat_summary || cv.decline_explanation || '', 220),
      earlyEntrySignal: cv.early_entry_signal || null,
      catalyst: cv.next_catalyst || null,
      invalidation: cv.invalidation || null,
      crowding: cv.institutional_crowding || null,
      declineLabel: cv.decline_label || null,
      timingNote: cv.timing_note || null,
      fundamentalSignals: arr(cv.fundamental_signals).slice(0, 3),
      price: cv.live_price ?? e.currentPrice ?? e.currentEst,
      pct52wh: livePct,
      rsi: cv.rsi14 ?? e.rsi14,
      rev: null,
      timing: isActive ? (cv.timing_status || '') : '',
      entryLow: e.low ?? b4?.entry_band_low ?? null,
      entryHigh: e.high ?? b4?.entry_band_high ?? null,
      upsideTarget: e.target ?? b4?.upside_reference ?? null,
      window_score: cv.window_score });
  }

  // Merge all tiers into a single attention-ranked list; top MAX wins.
  // Scanner-promoted picks (tier1) already carry the highest attention scores naturally.
  const all = [...tier1, ...tier2, ...tier3];
  all.sort((a, b) => b.attention - a.attention);
  return all.slice(0, MAX);
}

function renderEntryZoneBlock(item) {
  const fmtP = v => v == null ? null : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
  const low = item.entryLow, high = item.entryHigh, tgt = item.upsideTarget, cur = item.price;

  if (!low || !high || !tgt) {
    const pctTx = item.pct52wh != null ? `${item.pct52wh > 0 ? '+' : ''}${item.pct52wh}% from 52wH` : null;
    const rsiTx = item.rsi != null ? `RSI ${item.rsi}` : null;
    const contextChips = [pctTx, rsiTx].filter(Boolean).map(t => `<span class="ub-chip">${esc(t)}</span>`).join('');
    return `<div class="ub-ez ub-ez-noband">
      <div class="ub-ez-head"><span class="ub-ez-label">Entry &amp; projection</span><b class="ub-ez-noband-note">Zone not yet established</b></div>
      ${contextChips ? `<div class="ub-chips ub-ez-chips">${contextChips}</div>` : ''}
    </div>`;
  }

  const inZone    = cur != null && cur >= low && cur <= high;
  const belowZone = cur != null && cur < low;
  const statusLabel = inZone ? 'In entry zone' : belowZone ? 'Below entry — deep value' : 'Above entry — wait for pullback';
  const statusCls   = inZone ? 'ez-in' : belowZone ? 'ez-below' : 'ez-above';

  const upsidePct = cur && tgt ? Math.round((tgt / cur - 1) * 100) : null;
  const upsideFromEntry = low && tgt ? Math.round((tgt / low - 1) * 100) : null;

  const rangeMin = Math.min(low * 0.88, cur ? cur * 0.86 : low * 0.88);
  const rangeMax = Math.max(tgt * 1.06, cur ? cur * 1.05 : tgt * 1.06);
  const span = rangeMax - rangeMin;
  const pctOf = v => Math.max(2, Math.min(97, Math.round((v - rangeMin) / span * 100)));
  const lowPct = pctOf(low), highPct = pctOf(high), tgtPct = pctOf(tgt);
  const curPct = cur != null ? pctOf(cur) : null;

  const rsiTx = item.rsi != null ? `RSI ${item.rsi}` : null;
  const pct52Tx = item.pct52wh != null ? `${item.pct52wh > 0 ? '+' : ''}${item.pct52wh}% from 52wH` : null;

  return `<div class="ub-ez ${statusCls}">
    <div class="ub-ez-head">
      <span class="ub-ez-label">Entry &amp; projection</span>
      <b class="ub-ez-status">${esc(statusLabel)}</b>
      ${upsidePct != null ? `<span class="ub-ez-upside">+${upsidePct}% to target</span>` : ''}
    </div>
    <div class="ub-ez-bar-wrap">
      <div class="ub-ez-bar">
        <div class="ub-ez-fill" style="left:${lowPct}%;width:${highPct - lowPct}%"></div>
        ${curPct != null ? `<div class="ub-ez-cur-marker" style="left:${curPct}%"><span class="ub-ez-cur-label">${esc(fmtP(cur))}</span></div>` : ''}
        <div class="ub-ez-tgt-marker" style="left:${tgtPct}%"><span class="ub-ez-tgt-label">${esc(fmtP(tgt))}</span></div>
      </div>
      <div class="ub-ez-price-row">
        <span class="ub-ez-range">Entry <b>${esc(fmtP(low))}–${esc(fmtP(high))}</b></span>
        ${cur != null ? `<span class="ub-ez-now">Now <b>${esc(fmtP(cur))}</b></span>` : ''}
        <span class="ub-ez-target">Target <b>${esc(fmtP(tgt))}</b>${upsideFromEntry != null ? ` <i>(+${upsideFromEntry}% from entry)</i>` : ''}</span>
      </div>
    </div>
    ${(rsiTx || pct52Tx) ? `<div class="ub-ez-sigs">${[pct52Tx,rsiTx].filter(Boolean).map(t=>`<span>${esc(t)}</span>`).join('')}</div>` : ''}
  </div>`;
}

function renderBriefCard(item, rank) {
  const isEvent  = item.source === 'event_driven';
  const isSignal = item.source === 'dynamic_conviction' || item.source === 'dynamic_watchlist';
  const isActive = item.source === 'conviction' && item.window_score === 3;
  const cardCls  = isSignal ? 'ub-signal' : isEvent ? 'ub-event' : isActive ? 'ub-active' : 'ub-research';
  const tagCls   = isSignal ? 'ub-tag-signal' : isEvent ? 'ub-tag-event' : isActive ? 'ub-tag-active' : 'ub-tag-research';

  let action, actionCls;
  if (isSignal && item.tag === 'Insider buy') { action = 'Strong signal'; actionCls = 'ub-action-signal'; }
  else if (isSignal)  { action = 'Signal confirmed'; actionCls = 'ub-action-signal'; }
  else if (isEvent)   { action = 'Catalyst watch';   actionCls = 'ub-action-event'; }
  else if (isActive)  { action = 'Entry zone open';  actionCls = 'ub-action-active'; }
  else                { action = 'Monitoring';        actionCls = 'ub-action-research'; }

  const fmtP = v => v == null ? null : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
  const priceDisplay = fmtP(item.price);

  const revTx = item.rev
    ? (item.rev.startsWith('+') ? item.rev : item.rev.charAt(0).toUpperCase() + item.rev.slice(1).toLowerCase())
    : null;
  const isUrgent = item.timing && (/this month|high urgency/i.test(item.timing));
  const timingTx = item.timing || null;
  const chips = [
    revTx ? `<span class="ub-chip ub-rev">${esc(revTx)}</span>` : '',
    timingTx ? `<span class="ub-chip ${isUrgent ? 'ub-urgent' : 'ub-timing'}">${esc(timingTx)}</span>` : '',
  ].filter(Boolean).join('');

  const thesisText = item.earlyEntrySignal || item.why || item.explain || '';

  const crowdingLabel = item.crowding === 'low' ? 'Pre-consensus'
    : item.crowding === 'medium' ? 'Some institutional interest'
    : item.crowding === 'high'   ? 'Consensus trade'
    : null;

  const declineChip = item.declineLabel
    ? `<span class="ub-chip ub-decline">${esc(item.declineLabel)}</span>` : '';

  const crowdChip = crowdingLabel && item.crowding === 'low'
    ? `<span class="ub-chip ub-crowd-low">${esc(crowdingLabel)}</span>` : '';

  const sigChips = arr(item.fundamentalSignals).slice(0, 2)
    .map(s => `<span class="ub-chip ub-sig">${esc(snip(s, 45))}</span>`).join('');

  const metaChips = [declineChip, crowdChip, sigChips].filter(Boolean).join('');

  const frameworkRows = [
    item.catalyst    && `<div class="ub-fw-row"><span class="ub-fw-label">Catalyst</span><span class="ub-fw-val">${esc(snip(item.catalyst, 120))}</span></div>`,
    item.invalidation && `<div class="ub-fw-row"><span class="ub-fw-label">Exit if</span><span class="ub-fw-val">${esc(snip(item.invalidation, 100))}</span></div>`,
  ].filter(Boolean).join('');
  const frameworkGrid = frameworkRows ? `<div class="ub-framework">${frameworkRows}</div>` : '';

  return `<article class="ub-card ${cardCls}">
    <div class="ub-row-top">
      <div class="ub-rank">${rank}</div>
      <div class="ub-identity">
        <b class="ub-ticker">${esc(item.ticker)}</b>
        ${priceDisplay ? `<span class="ub-price">${esc(priceDisplay)}</span>` : ''}
        <span class="ub-name">${esc(item.name)}</span>
        <span class="ub-tag ${tagCls}">${esc(item.tag)}</span>
      </div>
      <span class="ub-action ${actionCls}">${esc(action)}</span>
    </div>
    ${thesisText ? `<p class="ub-thesis">${esc(thesisText)}</p>` : ''}
    ${metaChips ? `<div class="ub-chips">${metaChips}</div>` : ''}
    ${renderEntryZoneBlock(item)}
    ${frameworkGrid}
    ${chips ? `<div class="ub-chips">${chips}</div>` : ''}
  </article>`;
}

// ── DYNAMIC UNIVERSE PROMOTION SECTION (kept for reference, not rendered) ─────
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

// ── TWO-GROUP SECTION (asymmetric + price-window) ─────────────────────────────

function renderAsymmetricCard(ticker, td, isAlsoPw) {
  const fmtP = v => v == null ? '—' : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
  const pctCls = pct => pct == null ? '' : (pct < 0 ? 'below' : 'above');
  const pctTx = pct => pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  const cardCls = isAlsoPw ? 'opp-card opp-card-both' : 'opp-card opp-card-asym';
  const thesis = td.early_entry_signal || td.moat_summary || '';
  const fw = [
    td.next_catalyst ? `<div class="opp-fw-row"><span class="opp-fw-lbl">Catalyst</span><span class="opp-fw-val">${esc(td.next_catalyst)}</span></div>` : '',
    td.invalidation  ? `<div class="opp-fw-row"><span class="opp-fw-lbl">Exit if</span><span class="opp-fw-val">${esc(td.invalidation)}</span></div>` : '',
  ].filter(Boolean).join('');
  const convBadge = td.conviction_score != null
    ? `<span class="opp-badge opp-badge-conv">Conv ${td.conviction_score}</span>` : '';
  const maGrid = (td.ma50 || td.ma200 || td.rsi14) ? `
    <div class="opp-ma-grid">
      <div class="opp-ma-cell">
        <span class="opp-ma-label">vs MA50</span>
        <b class="opp-ma-val">${esc(fmtP(td.ma50))}</b>
        <span class="opp-ma-pct ${pctCls(td.vsMa50Pct)}">${esc(pctTx(td.vsMa50Pct))}</span>
      </div>
      <div class="opp-ma-cell">
        <span class="opp-ma-label">vs MA200</span>
        <b class="opp-ma-val">${esc(fmtP(td.ma200))}</b>
        <span class="opp-ma-pct ${pctCls(td.vsMa200Pct)}">${esc(pctTx(td.vsMa200Pct))}</span>
      </div>
      <div class="opp-ma-cell">
        <span class="opp-ma-label">RSI 14</span>
        <b class="opp-ma-val">${esc(td.rsi14 ?? '—')}</b>
        <span class="opp-ma-pct">${td.rsi14 != null && td.rsi14 < 40 ? 'oversold' : td.rsi14 != null && td.rsi14 < 50 ? 'cooling' : ''}</span>
      </div>
      <div class="opp-ma-cell">
        <span class="opp-ma-label">52w high</span>
        <b class="opp-ma-val">${esc(td.pct_from_52w_high != null ? `${td.pct_from_52w_high}%` : '—')}</b>
        <span class="opp-ma-pct">from peak</span>
      </div>
    </div>` : '';
  return `<article class="${cardCls}">
    <div class="opp-card-id">
      <b class="opp-ticker">${esc(ticker)}</b>
      <span class="opp-price">${esc(fmtP(td.price))}</span>
      <span class="opp-name">${esc(td.name || '')}</span>
    </div>
    <div class="opp-badges">
      <span class="opp-badge opp-badge-asym">Pre-consensus</span>
      ${isAlsoPw ? '<span class="opp-badge opp-badge-pw">At entry zone</span>' : ''}
      ${convBadge}
    </div>
    ${maGrid}
    ${thesis ? `<p class="opp-thesis">${esc(thesis)}</p>` : ''}
    ${td.selection_reason ? `<p class="opp-sel-reason"><span>Why selected</span> ${esc(td.selection_reason)}</p>` : ''}
    ${renderEvidenceTrail(td)}
    ${fw ? `<div class="opp-fw">${fw}</div>` : ''}
  </article>`;
}

function renderEvidenceTrail(td) {
  const items = arr(td.evidence);
  if (!items.length) {
    return `<div class="opp-evidence opp-evidence-none"><span class="opp-ev-badge opp-ev-unverified">UNVERIFIED</span><small>Hand-written thesis — no source attached yet. Treat as hypothesis, not evidence.</small></div>`;
  }
  const rows = items.map(ev => {
    const cls = ev.status === 'VERIFIED' ? 'opp-ev-verified' : ev.status === 'CORRECTED' ? 'opp-ev-corrected' : 'opp-ev-unverified';
    const src = ev.url
      ? `<a href="${esc(ev.url)}" target="_blank" rel="noopener">${esc(ev.source || 'source')}</a>`
      : esc(ev.source || '');
    return `<div class="opp-ev-row"><span class="opp-ev-badge ${cls}">${esc(ev.status)}</span><small>${esc(ev.claim)} · ${src}${ev.tier ? ` · <b>${esc(String(ev.tier).split(' ')[0])}</b>` : ''}${ev.checked ? ` · checked ${esc(ev.checked)}` : ''}</small></div>`;
  }).join('');
  return `<div class="opp-evidence">${rows}</div>`;
}

function renderPriceWindowCard(ticker, td, isAlsoAsym) {
  const fmtP = v => v == null ? '—' : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
  const pctCls = pct => pct == null ? '' : (pct < 0 ? 'below' : 'above');
  const pctTx = pct => pct == null ? '—' : `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`;
  const cardCls = isAlsoAsym ? 'opp-card opp-card-both' : 'opp-card opp-card-pw';
  const moat = td.moat_summary || '';
  const convBadge = td.conviction_score != null
    ? `<span class="opp-badge opp-badge-conv">Conv ${td.conviction_score}</span>` : '';
  const fw = [
    td.next_catalyst ? `<div class="opp-fw-row"><span class="opp-fw-lbl">Catalyst</span><span class="opp-fw-val">${esc(td.next_catalyst)}</span></div>` : '',
    td.invalidation  ? `<div class="opp-fw-row"><span class="opp-fw-lbl">Exit if</span><span class="opp-fw-val">${esc(td.invalidation)}</span></div>` : '',
  ].filter(Boolean).join('');
  return `<article class="${cardCls}">
    <div class="opp-card-id">
      <b class="opp-ticker">${esc(ticker)}</b>
      <span class="opp-price">${esc(fmtP(td.price))}</span>
      <span class="opp-name">${esc(td.name || '')}</span>
    </div>
    <div class="opp-badges">
      ${isAlsoAsym ? '<span class="opp-badge opp-badge-asym">Pre-consensus</span>' : ''}
      ${convBadge}
    </div>
    <div class="opp-ma-grid">
      <div class="opp-ma-cell">
        <span class="opp-ma-label">vs MA50</span>
        <b class="opp-ma-val">${esc(fmtP(td.ma50))}</b>
        <span class="opp-ma-pct ${pctCls(td.vsMa50Pct)}">${esc(pctTx(td.vsMa50Pct))}</span>
      </div>
      <div class="opp-ma-cell">
        <span class="opp-ma-label">vs MA200</span>
        <b class="opp-ma-val">${esc(fmtP(td.ma200))}</b>
        <span class="opp-ma-pct ${pctCls(td.vsMa200Pct)}">${esc(pctTx(td.vsMa200Pct))}</span>
      </div>
      <div class="opp-ma-cell">
        <span class="opp-ma-label">RSI 14</span>
        <b class="opp-ma-val">${esc(td.rsi14 ?? '—')}</b>
        <span class="opp-ma-pct">${td.rsi14 != null && td.rsi14 < 40 ? 'oversold' : td.rsi14 != null && td.rsi14 < 50 ? 'cooling' : ''}</span>
      </div>
      <div class="opp-ma-cell">
        <span class="opp-ma-label">52w high</span>
        <b class="opp-ma-val">${esc(td.pct_from_52w_high != null ? `${td.pct_from_52w_high}%` : '—')}</b>
        <span class="opp-ma-pct">from peak</span>
      </div>
    </div>
    ${moat ? `<p class="opp-moat">${esc(moat)}</p>` : ''}
    ${fw ? `<div class="opp-fw">${fw}</div>` : ''}
  </article>`;
}

function renderContextBrief(brief) {
  if (!brief) return '';
  const topEntry = brief.topEntry;
  const topEntryHtml = topEntry ? `
    <div class="opp-ctx-top-entry">
      <span class="opp-ctx-entry-label">Top entry now</span>
      <b class="opp-ctx-entry-ticker">${esc(topEntry.ticker)}</b>
      <span class="opp-ctx-entry-why">${esc(topEntry.why)}</span>
    </div>` : '';

  const watchForHtml = (brief.watchFor || []).length > 0 ? `
    <div class="opp-ctx-watch">
      <span class="opp-ctx-watch-label">Watch for</span>
      <ul class="opp-ctx-watch-list">${(brief.watchFor || []).map(w => `<li>${esc(w)}</li>`).join('')}</ul>
    </div>` : '';

  const fp = brief.frameworkPanel;
  const plateauChip = p => `<span class="opp-fp-chip" title="Fed plateau began ${esc(p.from)} at ${esc(p.rate)}%; max drawdown next 18m: ${esc(p.maxDD)}%">${esc(p.from)} <em>${esc(p.fwd12m > 0 ? '+' : '')}${esc(p.fwd12m)}%</em></span>`;
  const calChip = c => `<span class="opp-fp-chip" title="calibrated P(positive 6m) ${esc(c.p)}%${c.rev != null ? ` · SEC revenue +${esc(c.rev)}% YoY` : ''}">${esc(c.ticker)} <em>${esc(c.p)}%</em></span>`;
  const frameworkHtml = fp ? `
    <div class="opp-ctx-framework">
      <span class="opp-ctx-fp-label">Framework v${esc(fp.version)} · macro thesis tested against history · ${esc(fp.tested_at)}</span>
      <p class="opp-fp-verdict"><b>${esc(fp.thesis)}</b> → ${esc(fp.verdict || '')} ${esc(fp.sizing || '')}</p>
      <div class="opp-disc-row"><b>Fed-plateau base rates (SPX fwd 12m)</b>${(fp.plateau_episodes || []).map(plateauChip).join('')}</div>
      ${fp.calibration_finding ? `<p class="opp-fp-cal">${esc(fp.calibration_finding)}</p>` : ''}
      ${(fp.calibrated_top || []).length ? `<div class="opp-disc-row"><b>Calibrated wide-scan leaders (${esc(fp.scanned_at)})</b>${fp.calibrated_top.map(calChip).join('')}</div>` : ''}
      <small class="opp-disc-note">${esc(fp.activation)}. Base rates from FRED/SPX history at test time; small samples — probabilities, not certainties.</small>
    </div>` : '';

  const db = brief.durationBooks;
  const b1Chip = b => `<span class="opp-db-chip" title="${esc(b.why)}${b.crash_add ? ` · crash-add ${esc(b.crash_add)}` : ''}">${esc(b.ticker)} <em>${esc(b.zone)}</em></span>`;
  const b2Chip = b => `<span class="opp-db-chip opp-db-tac" title="${esc(b.catalyst)} · exit: ${esc(b.exit)}">${esc(b.ticker)} <em>${esc(b.entry)}</em></span>`;
  const booksHtml = db ? `
    <div class="opp-ctx-books">
      <span class="opp-ctx-db-label">Action plan by duration · ${esc(db.split || '')} · ${esc(db.as_of || '')}</span>
      <div class="opp-disc-row"><b>Book 1 · long-term (&gt;1y), buy zones</b>${(db.book1 || []).map(b1Chip).join('')}</div>
      <div class="opp-disc-row"><b>Book 2 · tactical (hard exits)</b>${(db.book2 || []).map(b2Chip).join('')}</div>
      ${(db.protocol || []).map(p => `<small class="opp-disc-note">${esc(p)}</small>`).join('')}
    </div>` : '';

  const ta = brief.tripleAlignment;
  const taChip = r => `<span class="opp-ta-chip" title="macro ${esc(r.macro)}/30 · quality ${esc(r.quality)}/40 · momentum ${esc(r.momentum)}/30${r.coverage === 'XBRL_FALLBACK' ? ' · quality via XBRL fallback' : ''}">${esc(r.ticker)} <em>${esc(r.total)}</em></span>`;
  const tripleHtml = ta && (ta.aligned || []).length ? `
    <div class="opp-ctx-triple">
      <span class="opp-ctx-triple-label">Triple-aligned · macro fit + quality math + momentum, all floors cleared · regime: ${esc(ta.regime || '')}</span>
      <div class="opp-disc-row">${ta.aligned.slice(0, 8).map(taChip).join('')}</div>
      ${(ta.near_miss || []).length ? `<small class="opp-disc-note">Near-miss (one lens below floor): ${ta.near_miss.map(n => `${esc(n.ticker)} (${esc(n.failing_lens)})`).join(' · ')}</small>` : ''}
    </div>` : '';

  const disc = brief.discovery;
  const discChip = c => `<span class="opp-disc-chip" title="${esc(c.why)}">${esc(c.ticker)} <em>RSI ${esc(c.rsi)}</em></span>`;
  const discoveryHtml = disc ? `
    <div class="opp-ctx-discovery">
      <span class="opp-ctx-disc-label">Market-wide discovery · snapshots ${esc(disc.snapshot_status)}</span>
      <div class="opp-disc-row"><b>Dislocated quality — ${esc(disc.new_counts?.dislocated_quality ?? 0)} new</b>${(disc.top_dislocated || []).map(discChip).join('')}</div>
      <div class="opp-disc-row"><b>Inflection leaders — ${esc(disc.new_counts?.inflection_leaders ?? 0)} new</b>${(disc.top_leaders || []).map(discChip).join('')}</div>
      <small class="opp-disc-note">Passed the market-wide screen, not yet the evidence gates — research queue, not buy list. Framework: opportunity-framework v1.</small>
    </div>` : '';

  return `<div class="opp-context-brief">
    <p class="opp-ctx-headline">${esc(brief.headline)}</p>
    <p class="opp-ctx-market">${esc(brief.marketContext)}</p>
    ${topEntryHtml}
    ${frameworkHtml}
    ${booksHtml}
    ${tripleHtml}
    ${discoveryHtml}
    ${watchForHtml}
  </div>`;
}

function renderTwoGroupSection(techState, contextBrief) {
  const tickers = techState.tickers || {};

  const asymTickers = Object.entries(tickers).filter(([, td]) => td.isAsymmetric).map(([t]) => t);
  const pwTickers   = Object.entries(tickers).filter(([, td]) => td.isPriceWindow).map(([t]) => t);
  const pwSet       = new Set(pwTickers);
  const asymSet     = new Set(asymTickers);

  const asymCards = asymTickers
    .map(t => renderAsymmetricCard(t, tickers[t], pwSet.has(t)))
    .join('');
  const pwCards = pwTickers
    .map(t => renderPriceWindowCard(t, tickers[t], asymSet.has(t)))
    .join('');

  const asOf = techState.generatedAt
    ? new Date(techState.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  const groupACtx = contextBrief?.groupAContext
    ? `<p class="opp-group-ctx">${esc(contextBrief.groupAContext)}</p>` : '';
  const groupBCtx = contextBrief?.groupBContext
    ? `<p class="opp-group-ctx">${esc(contextBrief.groupBContext)}</p>` : '';

  return `<section id="opportunities-section" class="cr-section">
    <div class="cr-wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow">Opportunity radar · research only${asOf ? ` · ${asOf}` : ''}</p>
          <h2>Radar</h2>
        </div>
        <a class="button" href="outputs/conviction-ranking.json">Full ranking</a>
      </div>

      ${renderContextBrief(contextBrief)}

      <div class="opp-group">
        <div class="opp-group-head">
          <span class="opp-group-label">Group A</span>
          <p class="opp-group-title">Phase-defining asymmetric picks</p>
          <p class="opp-group-desc">Selected by framework, not by hand: quality + moat gates passed, decline not fundamentals-driven, ≥18% below 52-week high, conviction ≥55 — top 5 by conviction. Holdings excluded. Each card shows why it was selected.</p>
          ${groupACtx}
        </div>
        <div class="opp-asym-grid">${asymCards}</div>
      </div>

      <div class="opp-group">
        <div class="opp-group-head">
          <span class="opp-group-label">Group B</span>
          <p class="opp-group-title">High-conviction names — price context</p>
          <p class="opp-group-desc">Selected by framework: conviction ≥60 with RSI below 55 — quality names cooling into the entry window, top 7 by conviction. Use MA50/MA200 and RSI to time entry, not to discover the idea.</p>
          ${groupBCtx}
        </div>
        <div class="opp-pw-grid">${pwCards}</div>
      </div>
    </div>
  </section>`;
}

function renderOpportunitiesSection(state, candidateRanking, conviction, scannerData, dynamicUniverse, bandMap, techState, contextBrief) {
  if (techState && techState.tickers && Object.keys(techState.tickers).length) {
    return renderTwoGroupSection(techState, contextBrief || null);
  }
  // fallback to unified list render
  return renderOpportunitiesSectionLegacy(state, candidateRanking, conviction, scannerData, dynamicUniverse, bandMap);
}

function renderOpportunitiesSectionLegacy(state, candidateRanking, conviction, scannerData, dynamicUniverse, bandMap) {
  const allRows = flattenOpportunityRows(state || {});
  const { opportunities } = selectDisplayRows(allRows);

  const dynConv   = arr(dynamicUniverse?.conviction_promotions).length;
  const dynWatch  = arr(dynamicUniverse?.watchlist_promotions).length;
  const dynEvent  = arr(dynamicUniverse?.event_driven_candidates).length;
  const activeWindows = arr(conviction?.top10).filter(c => c.window_score === 3).length;
  const asOf = conviction?.generated_at
    ? new Date(conviction.generated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '—';

  const stripItems = [
    ['System picks', dynConv + dynWatch],
    ['Catalysts', dynEvent],
    ['Entry windows', activeWindows],
    ['As of', asOf, true],
  ];
  const trustStrip = stripItems.map(([label, value, isText]) =>
    `<article><span>${esc(label)}</span><b>${isText ? esc(value) : fmt(value)}</b></article>`
  ).join('');

  const legend = [
    ['ub-tag-signal',   'Green — Strong signal', 'Multiple data sources converged: moat, trough depth, insider buy, and/or revenue recovery. This is a name you should look at seriously.'],
    ['ub-tag-event',    'Blue — Catalyst watch', 'A major market event (IPO, permitting, defense program) creates a tailwind here. Early — not yet scanner-confirmed. Worth tracking before the market prices it in.'],
    ['ub-tag-active',   'Amber — Entry zone open', 'The system sees current price inside a defined buy range. A name you already like is now at a level worth acting on.'],
    ['ub-tag-research', 'Neutral — Monitoring',  'High-conviction name with no active buy signal. Too expensive right now — watch for a 15–20% pullback.'],
  ].map(([cls, label, desc]) =>
    `<div class="ub-legend-row"><span class="ub-tag ${cls}">${label.split(' — ')[0]}</span><span class="ub-legend-text"><b>${label.split(' — ')[1]}</b> — ${desc}</span></div>`
  ).join('');

  const unified = buildUnifiedList(conviction, dynamicUniverse, bandMap);
  const cards   = unified.map((item, i) => renderBriefCard(item, i + 1)).join('');

  return `<section id="opportunities-section" class="cr-section">
    <div class="cr-wrap">
      <div class="section-head">
        <div>
          <p class="eyebrow">Opportunity radar · system-ranked · research only</p>
          <h2>Radar</h2>
          <p class="op-stance">Ranked by signal strength, trough depth, and conviction. No buy authorization until macro Phase D.</p>
        </div>
        <a class="button" href="outputs/conviction-ranking.json">Full ranking</a>
      </div>
      <div class="trust-strip">${trustStrip}</div>
      <div class="ub-list">${cards}</div>
      <p class="ub-footer">${esc(opportunities.length)} in research pipeline · <a href="outputs/conviction-ranking.json">Full conviction ranking →</a></p>
    </div>
  </section>`;
}
// end renderOpportunitiesSectionLegacy

function renderOpportunitiesStyle() {
  return `<style>
.op-stance{color:var(--muted);font-size:13px;margin:6px 0 0}
/* Trust strip — 4 stat chips above the card list */
.trust-strip{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 14px}
.trust-strip article{border:1px solid rgba(201,191,173,.45);border-radius:2px;padding:6px 14px;background:#ffffff;display:flex;align-items:center;gap:8px}
.trust-strip span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.trust-strip b{font-size:13px;font-weight:600;letter-spacing:-.01em;color:rgba(36,35,31,.88)}
/* Ranked card list */
.ub-list{display:flex;flex-direction:column;gap:8px;margin-top:0}
.ub-card{border:1px solid rgba(201,191,173,.45);border-left:3px solid transparent;border-radius:2px;padding:14px 16px;background:#ffffff;min-width:0}
/* Signal colors — aligned to app palette: --green #2f6f4e, --blue #405f9f, --warn #8a6a2c */
.ub-signal{border-left-color:rgba(47,111,78,.65);background:rgba(47,111,78,.04)}
.ub-event{border-left-color:rgba(64,95,159,.65);background:rgba(64,95,159,.04)}
.ub-active{border-left-color:rgba(138,106,44,.65);background:rgba(138,106,44,.04)}
/* Top row: rank + identity + action */
.ub-row-top{display:flex;align-items:center;gap:10px;margin-bottom:8px}
.ub-rank{font-size:11px;font-weight:700;color:var(--soft);width:18px;flex-shrink:0;letter-spacing:-.01em}
.ub-identity{display:flex;align-items:baseline;flex-wrap:wrap;gap:6px;flex:1;min-width:0}
.ub-ticker{font-size:20px;font-weight:700;letter-spacing:-.04em;line-height:1;flex-shrink:0}
.ub-price{font-size:15px;font-weight:600;letter-spacing:-.02em;color:rgba(36,35,31,.88);flex-shrink:0}
.ub-name{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:200px}
/* Tags — pill shape */
.ub-tag{font-size:9px;font-weight:700;padding:2px 8px;border-radius:999px;letter-spacing:.05em;white-space:nowrap;flex-shrink:0;text-transform:uppercase;border:1px solid var(--rule);color:var(--muted)}
.ub-tag-signal{background:rgba(47,111,78,.08);border-color:rgba(47,111,78,.32);color:var(--green)}
.ub-tag-event{background:rgba(64,95,159,.08);border-color:rgba(64,95,159,.32);color:var(--blue)}
.ub-tag-active{background:rgba(138,106,44,.08);border-color:rgba(138,106,44,.32);color:var(--warn)}
.ub-tag-research{background:#ffffff;border-color:var(--rule);color:var(--muted)}
/* Action badge — tells user what to do */
.ub-action{font-size:9px;font-weight:700;white-space:nowrap;flex-shrink:0;padding:3px 8px;border-radius:2px;border:1px solid;text-transform:uppercase;letter-spacing:.06em;font-family:var(--mono,monospace)}
.ub-action-signal{color:var(--green);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.07)}
.ub-action-event{color:var(--blue);border-color:rgba(64,95,159,.3);background:rgba(64,95,159,.06)}
.ub-action-active{color:var(--warn);border-color:rgba(138,106,44,.35);background:rgba(138,106,44,.07)}
.ub-action-research{color:var(--muted);border-color:var(--rule);background:transparent}
/* Card body text */
.ub-thesis{font-size:13px;color:rgba(36,35,31,.85);margin:0 0 10px;line-height:1.55;padding-left:28px}
/* Framework grid — catalyst / exit-if / crowd */
.ub-framework{display:flex;flex-direction:column;gap:4px;padding-left:28px;margin:0 0 8px}
.ub-fw-row{display:flex;gap:8px;align-items:baseline;font-size:12px;line-height:1.45}
.ub-fw-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);white-space:nowrap;width:52px;flex-shrink:0}
.ub-fw-val{color:rgba(36,35,31,.78)}
.ub-fw-crowd-low{color:var(--green)!important;font-weight:600}
.ub-fw-crowd-medium{color:var(--warn)!important;font-weight:600}
.ub-fw-crowd-high{color:var(--red,#9f3f35)!important;font-weight:600}
/* Metric chips */
.ub-chips{display:flex;flex-wrap:wrap;gap:5px;padding-left:28px}
.ub-chip{font-size:11px;color:rgba(36,35,31,.62);background:#ffffff;border:1px solid var(--rule);border-radius:999px;padding:2px 8px}
.ub-deep{color:var(--red)!important;border-color:rgba(159,63,53,.28)!important;background:rgba(159,63,53,.05)!important}
.ub-rev{color:var(--green)!important;border-color:rgba(47,111,78,.28)!important;background:rgba(47,111,78,.06)!important}
.ub-entry{color:var(--warn)!important;border-color:rgba(138,106,44,.28)!important;background:rgba(138,106,44,.05)!important}
.ub-upside{color:var(--green)!important;border-color:rgba(47,111,78,.28)!important;background:rgba(47,111,78,.06)!important;font-weight:600!important}
.ub-timing{color:rgba(36,35,31,.52)!important;border-color:rgba(201,191,173,.5)!important;background:#ffffff!important}
.ub-urgent{color:var(--warn)!important;border-color:rgba(138,106,44,.38)!important;background:rgba(138,106,44,.08)!important;font-weight:700!important}
.ub-decline{color:var(--muted)!important;border-color:rgba(201,191,173,.45)!important;background:rgba(201,191,173,.1)!important}
.ub-crowd-low{color:var(--green)!important;border-color:rgba(47,111,78,.28)!important;background:rgba(47,111,78,.06)!important}
.ub-sig{color:rgba(36,35,31,.58)!important;border-color:rgba(201,191,173,.4)!important;background:transparent!important;font-size:10px!important}
/* Legend — explains the 4 card tiers */
.ub-legend{display:flex;flex-direction:column;gap:6px;margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,191,173,.45);border-radius:2px;background:#ffffff}
.ub-legend-row{display:flex;align-items:baseline;gap:10px}
.ub-legend-row .ub-tag{flex-shrink:0;pointer-events:none}
.ub-legend-text{font-size:12px;color:rgba(36,35,31,.72);line-height:1.4}
.ub-legend-text b{font-weight:600;color:rgba(36,35,31,.88)}
.ub-footer{font-size:12px;color:var(--muted);margin:14px 0 0;padding-top:12px;border-top:1px solid var(--rule)}
.ub-footer a{color:var(--blue);text-decoration:none}
.ub-footer a:hover{text-decoration:underline}
/* Entry & projection zone block */
.ub-ez{margin:10px 0 8px;padding:10px 12px;border-radius:4px;border:1px solid rgba(201,191,173,.3);background:#ffffff;padding-left:28px}
.ub-ez-head{display:flex;align-items:baseline;gap:10px;margin-bottom:8px;flex-wrap:wrap}
.ub-ez-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);flex-shrink:0}
.ub-ez-status{font-size:12px;font-weight:600;color:rgba(36,35,31,.82);flex:1}
.ez-in .ub-ez-status{color:var(--green)!important}
.ez-below .ub-ez-status{color:var(--warn)!important}
.ez-above .ub-ez-status{color:rgba(36,35,31,.6)!important}
.ub-ez-upside{font-size:13px;font-weight:700;color:var(--green);letter-spacing:-.02em;white-space:nowrap}
/* price bar */
.ub-ez-bar-wrap{margin-bottom:6px}
.ub-ez-bar{position:relative;height:6px;background:rgba(201,191,173,.25);border-radius:3px;margin-bottom:18px}
.ub-ez-fill{position:absolute;top:0;bottom:0;background:rgba(47,111,78,.28);border-radius:3px;border:1px solid rgba(47,111,78,.4)}
.ez-in .ub-ez-fill{background:rgba(47,111,78,.38)!important;border-color:rgba(47,111,78,.6)!important}
.ub-ez-cur-marker{position:absolute;top:-3px;width:2px;height:12px;background:rgba(36,35,31,.75);border-radius:1px;transform:translateX(-50%)}
.ub-ez-cur-label{position:absolute;top:14px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:700;color:rgba(36,35,31,.75);white-space:nowrap}
.ub-ez-tgt-marker{position:absolute;top:-4px;width:10px;height:10px;background:#fff;border:2px solid var(--green);border-radius:50%;transform:translateX(-50%)}
.ub-ez-tgt-label{position:absolute;top:12px;left:50%;transform:translateX(-50%);font-size:9px;font-weight:600;color:var(--green);white-space:nowrap}
/* price row below bar */
.ub-ez-price-row{display:flex;gap:14px;flex-wrap:wrap;font-size:11px;color:rgba(36,35,31,.55)}
.ub-ez-price-row b{color:rgba(36,35,31,.85);font-weight:600}
.ub-ez-price-row i{font-style:normal;color:var(--green);font-size:10px}
.ub-ez-target b{color:var(--green)!important}
/* live signals row */
.ub-ez-sigs{display:flex;gap:8px;margin-top:6px}
.ub-ez-sigs span{font-size:10px;color:rgba(36,35,31,.5);background:rgba(201,191,173,.15);border:1px solid rgba(201,191,173,.3);border-radius:999px;padding:1px 7px}
/* no-band variant */
.ub-ez-noband{background:#ffffff;border-style:dashed}
.ub-ez-noband-note{font-size:12px;color:rgba(36,35,31,.42);font-weight:400}
.ub-ez-chips{margin-top:4px}
/* ── Two-group layout ── */
.opp-group{margin:0 0 28px}
.opp-group-head{margin:0 0 14px;padding-bottom:10px;border-bottom:1px solid rgba(201,191,173,.35)}
.opp-group-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.opp-group-title{font-size:15px;font-weight:700;letter-spacing:-.02em;margin:4px 0 0;color:rgba(36,35,31,.9)}
.opp-group-desc{font-size:12px;color:var(--muted);margin:3px 0 0;line-height:1.45}
.opp-asym-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}
.opp-pw-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:10px}
.opp-card{border:1px solid rgba(201,191,173,.45);border-top:2px solid transparent;border-radius:0;padding:16px;background:#ffffff}
.opp-card-asym{border-top-color:rgba(47,111,78,.5);background:rgba(47,111,78,.03)}
.opp-card-pw{border-top-color:rgba(138,106,44,.45);background:rgba(138,106,44,.02)}
.opp-card-both{border-top-color:rgba(64,95,159,.55);background:rgba(64,95,159,.03)}
.opp-card-id{display:flex;align-items:baseline;flex-wrap:wrap;gap:7px;margin-bottom:10px}
.opp-ticker{font-size:22px;font-weight:700;letter-spacing:-.04em;line-height:1}
.opp-price{font-size:14px;font-weight:600;letter-spacing:-.02em;color:rgba(36,35,31,.88)}
.opp-name{font-size:11px;color:var(--muted)}
.opp-badges{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px}
.opp-badge{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;padding:2px 8px;border-radius:999px;border:1px solid;white-space:nowrap}
.opp-badge-asym{color:var(--green);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.07)}
.opp-badge-pw{color:var(--warn);border-color:rgba(138,106,44,.35);background:rgba(138,106,44,.07)}
.opp-badge-conv{color:rgba(36,35,31,.55);border-color:rgba(201,191,173,.55);background:rgba(201,191,173,.15)}
.opp-thesis{font-size:12.5px;line-height:1.55;color:rgba(36,35,31,.82);margin:0 0 10px}
.opp-moat{font-size:11.5px;color:var(--muted);line-height:1.4;margin:0 0 8px}
.opp-ma-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;margin-bottom:10px}
.opp-ma-cell{border:1px solid rgba(201,191,173,.3);padding:8px 10px;border-radius:0}
.opp-ma-label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted)}
.opp-ma-val{display:block;font-size:14px;font-weight:600;letter-spacing:-.02em;margin-top:3px}
.opp-ma-pct{display:block;font-size:11px;margin-top:2px;color:var(--muted)}
.opp-ma-pct.below{color:var(--warn,#8a6a2c)}
.opp-ma-pct.above{color:var(--green,#2f6f4e)}
.opp-fw{display:flex;flex-direction:column;gap:4px;margin-top:8px}
.opp-fw-row{display:flex;gap:8px;align-items:baseline;font-size:12px}
.opp-fw-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--muted);white-space:nowrap;width:52px;flex-shrink:0}
.opp-fw-val{color:rgba(36,35,31,.75);line-height:1.4}
@media(max-width:620px){.opp-asym-grid,.opp-pw-grid{grid-template-columns:1fr}}
.opp-context-brief{background:rgba(201,191,173,.1);border:1px solid rgba(201,191,173,.35);border-radius:0;padding:18px 22px;margin-bottom:28px}
.opp-ctx-headline{font-size:15px;font-weight:700;letter-spacing:-.02em;color:rgba(36,35,31,.92);margin:0 0 8px;line-height:1.3}
.opp-ctx-market{font-size:12.5px;line-height:1.6;color:rgba(36,35,31,.65);margin:0 0 14px}
.opp-ctx-top-entry{display:flex;align-items:baseline;gap:10px;padding:10px 14px;background:rgba(255,255,255,.55);border:1px solid rgba(201,191,173,.4);margin-bottom:12px;flex-wrap:wrap}
.opp-ctx-entry-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);flex-shrink:0}
.opp-ctx-entry-ticker{font-size:15px;font-weight:700;letter-spacing:-.02em;flex-shrink:0}
.opp-ctx-entry-why{font-size:11.5px;color:rgba(36,35,31,.65);line-height:1.4}
.opp-ctx-watch{margin-top:0}
.opp-ctx-watch-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);display:block;margin-bottom:5px}
.opp-ctx-watch-list{margin:0;padding-left:16px;list-style:disc}
.opp-ctx-watch-list li{font-size:11.5px;color:rgba(36,35,31,.65);line-height:1.5;margin-bottom:2px}
.opp-group-ctx{font-size:12px;color:rgba(36,35,31,.6);line-height:1.5;margin:6px 0 0;font-style:italic}
.opp-ctx-discovery{padding:10px 14px;background:rgba(47,111,78,.05);border:1px solid rgba(47,111,78,.25);margin-bottom:12px}
.opp-ctx-disc-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--green,#2f6f4e);display:block;margin-bottom:7px}
.opp-disc-row{display:flex;align-items:center;gap:7px;flex-wrap:wrap;margin-bottom:5px}
.opp-disc-row b{font-size:11px;font-weight:600;color:rgba(36,35,31,.75);margin-right:3px}
.opp-disc-chip{font-size:11px;font-weight:700;padding:2px 8px;border:1px solid rgba(47,111,78,.35);background:rgba(255,255,255,.6);color:rgba(36,35,31,.85);letter-spacing:.02em}
.opp-disc-chip em{font-style:normal;font-weight:400;font-size:10px;color:var(--muted)}
.opp-disc-note{display:block;font-size:10.5px;color:rgba(36,35,31,.5);line-height:1.4;margin-top:4px}
.opp-evidence{margin:8px 0 0;border-top:1px dashed rgba(201,191,173,.5);padding-top:7px}
.opp-ev-row{display:flex;align-items:baseline;gap:6px;margin-bottom:4px}
.opp-ev-row small,.opp-evidence-none small{font-size:10.5px;line-height:1.45;color:rgba(36,35,31,.6)}
.opp-ev-row a{color:rgba(47,111,78,.9)}
.opp-ev-badge{flex-shrink:0;font-size:8px;font-weight:700;letter-spacing:.08em;padding:1px 5px;border:1px solid}
.opp-ev-verified{color:#2f6f4e;border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.07)}
.opp-ev-corrected{color:#8a6a2c;border-color:rgba(138,106,44,.4);background:rgba(138,106,44,.07)}
.opp-ev-unverified{color:#9f3f35;border-color:rgba(159,63,53,.4);background:rgba(159,63,53,.06)}
.opp-evidence-none{display:flex;align-items:baseline;gap:6px}
.opp-sel-reason{font-size:10.5px;line-height:1.45;color:rgba(36,35,31,.6);margin:8px 0 0;padding:6px 8px;background:rgba(64,95,159,.05);border-left:2px solid rgba(64,95,159,.35)}
.opp-sel-reason span{font-weight:700;text-transform:uppercase;font-size:8.5px;letter-spacing:.08em;color:rgba(64,95,159,.85);margin-right:5px}
.opp-ctx-triple{padding:10px 14px;background:rgba(64,95,159,.05);border:1px solid rgba(64,95,159,.28);margin-bottom:12px}
.opp-ctx-triple-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(64,95,159,.9);display:block;margin-bottom:7px}
.opp-ta-chip{font-size:11px;font-weight:700;padding:2px 8px;border:1px solid rgba(64,95,159,.35);background:rgba(255,255,255,.6);color:rgba(36,35,31,.85);letter-spacing:.02em}
.opp-ta-chip em{font-style:normal;font-weight:400;font-size:10px;color:var(--muted)}
.opp-ctx-framework{padding:11px 14px;background:rgba(138,106,44,.05);border:1px solid rgba(138,106,44,.3);margin-bottom:12px}
.opp-ctx-fp-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(138,106,44,.95);display:block;margin-bottom:6px}
.opp-fp-verdict{font-size:12px;line-height:1.5;color:rgba(36,35,31,.8);margin:0 0 7px}
.opp-fp-cal{font-size:11px;line-height:1.5;color:rgba(36,35,31,.7);margin:6px 0;padding:6px 8px;background:rgba(255,255,255,.5);border-left:2px solid rgba(138,106,44,.4)}
.opp-fp-chip{font-size:11px;font-weight:700;padding:2px 8px;border:1px solid rgba(138,106,44,.35);background:rgba(255,255,255,.6);color:rgba(36,35,31,.85)}
.opp-fp-chip em{font-style:normal;font-weight:400;font-size:10px;color:var(--muted)}
.opp-ctx-books{padding:11px 14px;background:rgba(47,111,78,.06);border:1px solid rgba(47,111,78,.35);margin-bottom:12px}
.opp-ctx-db-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--green,#2f6f4e);display:block;margin-bottom:7px}
.opp-db-chip{font-size:11px;font-weight:700;padding:2px 8px;border:1px solid rgba(47,111,78,.4);background:rgba(255,255,255,.65);color:rgba(36,35,31,.85)}
.opp-db-chip em{font-style:normal;font-weight:400;font-size:10px;color:var(--muted)}
.opp-db-chip.opp-db-tac{border-color:rgba(64,95,159,.4)}
</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };
