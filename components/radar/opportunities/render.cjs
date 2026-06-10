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

function buildUnifiedList(conviction, dynamicUniverse) {
  // Tier 1: Dynamic signals — all conviction promotions + watchlist promotions (scored, ranked)
  // Tier 2: Event-driven — top 3 by score, always guaranteed a slot (time-sensitive, not in scanner yet)
  // Tier 3: Static conviction — fill remaining slots up to max
  const MAX = 12;
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
    tier1.push({ ticker: e.ticker, name: e.name || '', attention: e.score + boost,
      source: 'dynamic_conviction', tag, explain, why: dynOneLiner(e),
      earlyEntrySignal: null, catalyst: e.next_catalyst || null,
      invalidation: null, crowding: null,
      price: e.live_price, pct52wh: e.pct_from_52w_high, rsi: e.rsi14,
      rev: isRevRecovery ? revLabel : null });
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
    tier1.push({ ticker: e.ticker, name: e.name || '', attention: e.score + boost,
      source: 'dynamic_watchlist', tag: 'Full scan', explain,
      why: dynOneLiner(e), earlyEntrySignal: null, catalyst: e.next_catalyst || null,
      invalidation: null, crowding: null,
      price: e.live_price, pct52wh: e.pct_from_52w_high,
      rsi: e.rsi14, rev: revLabel2 });
  }

  // Event-driven: top 3 by score, guaranteed slots (market events are time-sensitive)
  const eventCandidates = arr(dynamicUniverse?.event_driven_candidates)
    .filter(e => !seen.has(e.ticker))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  for (const e of eventCandidates) {
    seen.add(e.ticker);
    const troughBoost = (e.pct_from_52w_high != null && e.pct_from_52w_high <= -50) ? 8
                      : (e.pct_from_52w_high != null && e.pct_from_52w_high <= -30) ? 4 : 0;
    const pctDown = e.pct_from_52w_high != null ? `${Math.abs(e.pct_from_52w_high)}%` : null;
    const explain = `${e.event_name || 'A major market event'} creates a direct tailwind here. ${pctDown ? `Currently ${pctDown} below its 52-week high. ` : ''}No scanner entry signal yet — this is early positioning before the market prices in the catalyst. If it materializes, you want to already be watching.`;
    tier2.push({ ticker: e.ticker, name: e.name || '', attention: e.score + troughBoost,
      source: 'event_driven', tag: 'Catalyst', explain,
      why: snip(e.moat_summary || '', 140), earlyEntrySignal: null,
      catalyst: e.event_name ? `Catalyst: ${e.event_name}` : null,
      invalidation: null, crowding: null,
      price: e.live_price, pct52wh: e.pct_from_52w_high, rsi: e.rsi14, rev: null });
  }

  for (const cv of arr(conviction?.top10)) {
    if (seen.has(cv.ticker)) continue;
    const e = cv.entry || {};
    const livePct = cv.pct_from_52w_high ?? e.pctFrom52wHigh;
    const boost = attentionBoost(livePct, null, cv.window_score, false);
    const isActive = cv.window_score === 3;
    tier3.push({ ticker: cv.ticker, name: cv.name || '', attention: cv.conviction_score + boost,
      source: 'conviction', tag: isActive ? 'Entry window' : 'Monitoring',
      why: snip(cv.why_core || cv.decline_explanation || cv.moat_summary || '', 160),
      earlyEntrySignal: cv.early_entry_signal || null,
      catalyst: cv.next_catalyst || null,
      invalidation: cv.invalidation || null,
      crowding: cv.institutional_crowding || null,
      price: cv.live_price ?? e.currentPrice ?? e.currentEst,
      pct52wh: livePct,
      rsi: cv.rsi14 ?? e.rsi14,
      rev: null,
      timing: isActive ? (cv.timing_status || '') : '',
      entryLow: e.low ?? null, entryHigh: e.high ?? null,
      window_score: cv.window_score });
  }

  tier1.sort((a, b) => b.attention - a.attention);
  tier2.sort((a, b) => b.attention - a.attention);
  tier3.sort((a, b) => b.attention - a.attention);

  // Merge: tier1 first (all), then tier2 (all, guaranteed), then fill with tier3 up to MAX
  const merged = [...tier1, ...tier2];
  const remaining = MAX - merged.length;
  return [...merged, ...tier3.slice(0, Math.max(0, remaining))];
}

function renderBriefCard(item, rank) {
  const isEvent  = item.source === 'event_driven';
  const isSignal = item.source === 'dynamic_conviction' || item.source === 'dynamic_watchlist';
  const isActive = item.source === 'conviction' && item.window_score === 3;
  const cardCls  = isSignal ? 'ub-signal' : isEvent ? 'ub-event' : isActive ? 'ub-active' : 'ub-research';
  const tagCls   = isSignal ? 'ub-tag-signal' : isEvent ? 'ub-tag-event' : isActive ? 'ub-tag-active' : 'ub-tag-research';

  // Action word — tells the user what to do with this card right now
  let action, actionCls, signalLabel;
  if (isSignal && item.tag === 'Insider buy') {
    action = 'Strong signal'; actionCls = 'ub-action-signal';
    signalLabel = 'Signal';
  } else if (isSignal) {
    action = 'Signal confirmed'; actionCls = 'ub-action-signal';
    signalLabel = 'Signal';
  } else if (isEvent) {
    action = 'Catalyst watch'; actionCls = 'ub-action-event';
    signalLabel = 'Catalyst';
  } else if (isActive) {
    action = 'Entry zone open'; actionCls = 'ub-action-active';
    signalLabel = 'Timing';
  } else {
    action = 'Monitoring'; actionCls = 'ub-action-research';
    signalLabel = 'Next catalyst';
  }

  const fmtP  = v => v == null ? null : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
  const deepPct = item.pct52wh != null && item.pct52wh <= -40;
  const pctTx = item.pct52wh != null
    ? `${item.pct52wh > 0 ? '+' : ''}${item.pct52wh}% from peak`
    : null;
  const rsiTx = item.rsi != null ? `RSI ${item.rsi}` : null;
  const revTx = item.rev
    ? (item.rev.startsWith('+') ? item.rev : item.rev.charAt(0).toUpperCase() + item.rev.slice(1).toLowerCase())
    : null;

  const priceDisplay = fmtP(item.price);
  const fmtShort = v => v == null ? null : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
  const entryTx = (item.entryLow && item.entryHigh)
    ? `Entry ${fmtShort(item.entryLow)}–${fmtShort(item.entryHigh)}`
    : null;
  const isUrgent = item.timing && (/this month|high urgency/i.test(item.timing));
  const timingTx = item.timing || null;
  const chips = [
    pctTx ? `<span class="ub-chip ${deepPct ? 'ub-deep' : ''}">${esc(pctTx)}</span>` : '',
    entryTx ? `<span class="ub-chip ub-entry">${esc(entryTx)}</span>` : '',
    rsiTx ? `<span class="ub-chip">${esc(rsiTx)}</span>` : '',
    revTx ? `<span class="ub-chip ub-rev">${esc(revTx)}</span>` : '',
    timingTx ? `<span class="ub-chip ${isUrgent ? 'ub-urgent' : 'ub-timing'}">${esc(timingTx)}</span>` : '',
  ].filter(Boolean).join('');

  // Thesis block — show earlyEntrySignal for framework picks, fallback to explain/why for scanner picks
  const thesisText = item.earlyEntrySignal || item.explain || item.why || '';
  const moatLine   = item.earlyEntrySignal ? null : null; // suppress redundant moat when thesis is shown

  const crowdingLabel = item.crowding === 'low' ? 'Low — pre-consensus'
    : item.crowding === 'medium' ? 'Medium — some institutional interest'
    : item.crowding === 'high'   ? 'High — consensus trade'
    : null;

  const frameworkGrid = (item.catalyst || item.invalidation || item.crowding)
    ? `<div class="ub-framework">
        ${item.catalyst    ? `<div class="ub-fw-row"><span class="ub-fw-label">Catalyst</span><span class="ub-fw-val">${esc(snip(item.catalyst, 120))}</span></div>` : ''}
        ${item.invalidation ? `<div class="ub-fw-row"><span class="ub-fw-label">Exit if</span><span class="ub-fw-val">${esc(snip(item.invalidation, 100))}</span></div>` : ''}
        ${crowdingLabel     ? `<div class="ub-fw-row"><span class="ub-fw-label">Crowd</span><span class="ub-fw-val ub-fw-crowd-${esc(item.crowding)}">${esc(crowdingLabel)}</span></div>` : ''}
      </div>`
    : '';

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

function renderOpportunitiesSection(state, candidateRanking, conviction, scannerData, dynamicUniverse) {
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

  const unified = buildUnifiedList(conviction, dynamicUniverse);
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

function renderOpportunitiesStyle() {
  return `<style>
.op-stance{color:var(--muted);font-size:13px;margin:6px 0 0}
/* Trust strip — 4 stat chips above the card list */
.trust-strip{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 14px}
.trust-strip article{border:1px solid rgba(201,191,173,.45);border-radius:2px;padding:6px 14px;background:rgba(251,250,246,.28);display:flex;align-items:center;gap:8px}
.trust-strip span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.trust-strip b{font-size:13px;font-weight:600;letter-spacing:-.01em;color:rgba(36,35,31,.88)}
/* Ranked card list */
.ub-list{display:flex;flex-direction:column;gap:8px;margin-top:0}
.ub-card{border:1px solid rgba(201,191,173,.45);border-left:3px solid transparent;border-radius:2px;padding:14px 16px;background:rgba(251,250,246,.14);min-width:0}
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
.ub-tag-research{background:rgba(251,250,246,.12);border-color:var(--rule);color:var(--muted)}
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
.ub-chip{font-size:11px;color:rgba(36,35,31,.62);background:rgba(251,250,246,.20);border:1px solid var(--rule);border-radius:999px;padding:2px 8px}
.ub-deep{color:var(--red)!important;border-color:rgba(159,63,53,.28)!important;background:rgba(159,63,53,.05)!important}
.ub-rev{color:var(--green)!important;border-color:rgba(47,111,78,.28)!important;background:rgba(47,111,78,.06)!important}
.ub-entry{color:var(--warn)!important;border-color:rgba(138,106,44,.28)!important;background:rgba(138,106,44,.05)!important}
.ub-timing{color:rgba(36,35,31,.52)!important;border-color:rgba(201,191,173,.5)!important;background:rgba(251,250,246,.18)!important}
.ub-urgent{color:var(--warn)!important;border-color:rgba(138,106,44,.38)!important;background:rgba(138,106,44,.08)!important;font-weight:700!important}
/* Legend — explains the 4 card tiers */
.ub-legend{display:flex;flex-direction:column;gap:6px;margin:0 0 16px;padding:14px 16px;border:1px solid rgba(201,191,173,.45);border-radius:2px;background:rgba(251,250,246,.18)}
.ub-legend-row{display:flex;align-items:baseline;gap:10px}
.ub-legend-row .ub-tag{flex-shrink:0;pointer-events:none}
.ub-legend-text{font-size:12px;color:rgba(36,35,31,.72);line-height:1.4}
.ub-legend-text b{font-weight:600;color:rgba(36,35,31,.88)}
.ub-footer{font-size:12px;color:var(--muted);margin:14px 0 0;padding-top:12px;border-top:1px solid var(--rule)}
.ub-footer a{color:var(--blue);text-decoration:none}
.ub-footer a:hover{text-decoration:underline}
</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };
