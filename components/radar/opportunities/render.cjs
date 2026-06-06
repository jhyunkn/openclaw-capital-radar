const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = (value, digits = 0) => num(value) === null ? '—' : num(value).toLocaleString(undefined, { maximumFractionDigits: digits });
const price = v => v == null ? null : `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: Number(v) < 10 ? 2 : 0 })}`;
const clean = value => String(value || '').replace(/_/g, ' ');

function stageLabel(value) {
  const s = String(value || '').toLowerCase();
  if (/promotion.review/.test(s)) return 'In review';
  if (/exception.review/.test(s)) return 'Exception';
  if (/build.evidence/.test(s)) return 'Building';
  if (/watch|collect/.test(s)) return 'Watching';
  return clean(value);
}

function stageClass(value) {
  const s = String(value || '').toUpperCase();
  if (/QUALIFIED|PROMOTION|REVIEW|PASS/.test(s)) return 'good';
  if (/EXCEPTION|NEAR|BUILD|WATCH|COLLECT/.test(s)) return 'warn';
  return 'bad';
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
        opportunityType: ticker.opportunity_type,
        display: ticker.display_as_opportunity === true || /promotion_review|exception_review/i.test(ticker.promotion_status || ''),
        near: ticker.display_as_near_miss === true || /watch|build|near|exception/i.test(`${ticker.promotion_status || ''} ${ticker.opportunity_type || ''}`),
        asymmetry: ticker.asymmetry_score ?? ticker.opportunity_score,
        downside: ticker.downside_control_score,
        upside: ticker.upside_potential_score,
        evidence,
        required,
        undervaluation: ticker.undervaluation_score,
        conviction: ticker.conviction_score,
        risk: ticker.risk_budget_score,
        gap: ticker.threshold_gap ?? (evidence === null ? null : Math.max(0, required - evidence)),
        zone: ticker.zone_status,
        zoneSource: ticker.zone_source,
        secRecords: ticker.sec_record_count,
        institutionalRecords: ticker.institutional_filing_records,
        marketStructure: ticker.market_structure,
        next: ticker.primary_blocker || ticker.next_gate || arr(ticker.missing_evidence)[0] || 'human review',
        missing: arr(ticker.missing_evidence),
        gates: arr(ticker.evidence_gates),
        why: ticker.why_this_ticker,
        underpriced: ticker.what_is_underpriced,
        currentPrice: ticker.current_price ?? null,
        priceRead: ticker.price_read || '',
        provisionalZone: ticker.provisional_zone || '',
        whyNow: arr(ticker.why_now),
        task: ticker.assigned_agent_task,
        requiredSources: arr(ticker.required_sources),
        invalidation: arr(ticker.invalidation_questions),
      };
    })
  ).sort((a, b) => (num(b.evidence) || 0) - (num(a.evidence) || 0) || (num(b.undervaluation) || 0) - (num(a.undervaluation) || 0) || (num(b.asymmetry) || 0) - (num(a.asymmetry) || 0));
}

function selectDisplayRows(rows) {
  const opportunities = rows.filter(row => row.display);
  const near = rows.filter(row => row.near).slice(0, 8);
  const all8 = rows.slice(0, 8);
  const selected = opportunities.length ? opportunities.slice(0, 8) : near.length ? near : all8;
  return { opportunities, near, selected };
}

function renderSummaryStrip(state) {
  const summary = state.summary || {};
  const clusters = arr(state.opportunity_clusters);
  const themeCount = clusters.length;
  const candidates = summary.candidates || 0;
  const promoted = summary.promotion_review || 0;
  const asOf = state.as_of ? new Date(state.as_of).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—';
  const items = [
    ['Research candidates', candidates],
    ['Active themes', themeCount],
    ['In evidence review', promoted],
    ['Data as of', asOf, true],
  ];
  return items.map(([label, value, isText]) =>
    `<article><span>${esc(label)}</span><b>${isText ? esc(value) : fmt(value)}</b></article>`
  ).join('');
}

function renderGate(gate) {
  const passed = gate.passed === true;
  return `<span class="op-gate ${passed ? 'pass' : 'fail'}">${esc(gate.label || gate.key)}${passed ? ' ✓' : ''}</span>`;
}

function renderOpportunityRow(row, rankMap) {
  const gates = row.gates.length ? row.gates.map(renderGate).join('') : '<span class="op-gate fail">evidence pending</span>';
  const priceDisplay = row.currentPrice != null ? price(row.currentPrice) : null;
  const zoneClean = row.zone ? clean(row.zone).replace('neutral hold', 'Hold zone').replace('inside buy zone', 'Buy zone ↓').replace('near buy zone', 'Near buy').replace('inside trim zone', 'Trim zone ↑') : null;
  const whyNowHtml = row.whyNow.length ? `<div class="op-why-now"><span>Active signal</span><p>${esc(row.whyNow[0])}</p></div>` : '';
  const priceContextHtml = row.priceRead ? `<div class="op-price-context"><span>Price read</span><p>${esc(row.priceRead)}${row.provisionalZone ? ` · ${row.provisionalZone}` : ''}</p></div>` : '';
  const rankData = rankMap && rankMap[row.ticker];
  const tierClass = rankData ? ({ A: 'good', B: 'warn', C: '', D: 'bad' }[rankData.tier] || '') : '';
  const tierBadge = rankData ? `<span class="op-tier op-tier-${rankData.tier} ${tierClass}">Tier ${rankData.tier}</span>` : '';
  const signalChips = rankData && arr(rankData.fundamental_signals).length
    ? `<div class="op-signals">${rankData.fundamental_signals.slice(0, 4).map(s => `<span>${esc(s)}</span>`).join('')}</div>` : '';
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
    <div class="op-next-line"><span>Before any position</span><b>${row.missing.length ? esc(row.missing.slice(0, 2).join(' + ')) : 'Human review'}</b><small>Research only — no buy authorization</small></div>
  </article>`;
}

function renderOpportunityBoard(rows, rankMap) {
  return `<div class="op-card-board">${rows.map(r => renderOpportunityRow(r, rankMap)).join('')}</div>`;
}

function renderEmptyState(summary, qualifiedCount) {
  if (qualifiedCount !== 0) return '';
  return `<div class="empty-op"><b>No promoted opportunities yet</b><span>All candidates are in evidence review — showing top research candidates below. None are buy recommendations.</span></div>`;
}

function renderOpportunitiesSection(state, ranking) {
  const summary = state.summary || {};
  const allRows = flattenOpportunityRows(state);
  const { opportunities, selected } = selectDisplayRows(allRows);
  const rankMap = {};
  if (ranking) {
    arr(ranking.ranked).forEach(c => { rankMap[String(c.ticker).toUpperCase()] = c; });
  }
  return `<section id="opportunities-section" class="panel">
    <div class="section-head"><div><p class="eyebrow">Opportunity</p><h2>Research pipeline</h2><p class="op-stance">Ideas are research candidates, not capital allocations. No candidate below has buy authorization.</p></div><a class="button" href="outputs/opportunity-asymmetry-state.json">Full artifact</a></div>
    <div class="trust-strip">${renderSummaryStrip(state)}</div>
    ${renderEmptyState(summary, opportunities.length)}
    ${renderOpportunityBoard(selected, rankMap)}
  </section>`;
}

function renderOpportunitiesStyle() {
  return `<style>.empty-op{border:1px solid var(--rule);border-radius:16px;padding:14px;margin:14px 0;background:rgba(251,250,246,.12);display:grid;gap:4px}.empty-op b{font-size:20px}.empty-op span{color:var(--muted);font-size:12px}.op-stance{color:var(--muted);font-size:13px;margin:6px 0 0}.op-card-board{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin-top:14px}.op-card{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.12);padding:14px;min-width:0;overflow:hidden}.op-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.op-head-right{display:flex;flex-direction:column;align-items:flex-end;gap:6px;flex-shrink:0}.op-price{font-size:22px;font-weight:500;letter-spacing:-.04em;line-height:1}.op-card-head h3{font-size:28px;line-height:.95;margin:4px 0 2px;letter-spacing:-.045em}.op-card-head p{font-size:12px;color:var(--muted);margin:0}.op-theme{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:2px}.op-gates{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}.op-gate{font-size:10px;line-height:1;border:1px solid var(--rule);border-radius:999px;padding:5px 7px;color:var(--muted);background:rgba(251,250,246,.10)}.op-gate.pass{border-color:rgba(47,111,78,.36);color:var(--green);background:rgba(47,111,78,.08)}.op-gate.fail{border-color:rgba(174,124,44,.38);color:var(--warn);background:rgba(174,124,44,.08)}.op-why-now{border:1px solid rgba(159,63,53,.25);border-radius:12px;padding:9px 11px;background:rgba(159,63,53,.04);margin-bottom:8px}.op-why-now span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.op-why-now p{font-size:12px;line-height:1.4;color:rgba(36,35,31,.82);margin:0;font-weight:500}.op-thesis-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:8px 0}.op-thesis-grid div,.op-price-context{border:1px solid var(--rule);border-radius:12px;padding:10px;background:rgba(251,250,246,.08);min-width:0}.op-price-context{border-color:rgba(64,95,159,.25);background:rgba(64,95,159,.05)}.op-thesis-grid span,.op-price-context span,.op-next-line span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}.op-thesis-grid p,.op-price-context p{font-size:12px;line-height:1.42;color:rgba(36,35,31,.78);margin:0;overflow-wrap:anywhere}.op-next-line{margin-top:8px;border:1px solid var(--rule);border-radius:12px;padding:9px 11px;background:rgba(251,250,246,.08)}.op-next-line b{display:block;font-size:13px;line-height:1.25;margin:3px 0}.op-next-line small{display:block;color:var(--muted);font-size:11px;line-height:1.35;overflow-wrap:anywhere}.op-tier{display:inline-flex;font-size:9px;font-weight:700;padding:3px 7px;border-radius:5px;border:1px solid var(--rule);letter-spacing:.06em}.op-tier-A{border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.08);color:var(--green)}.op-tier-B{border-color:rgba(174,124,44,.4);background:rgba(174,124,44,.08);color:var(--warn)}.op-tier-C{border-color:var(--rule);color:var(--muted)}.op-tier-D{border-color:rgba(159,63,53,.4);background:rgba(159,63,53,.06);color:var(--red)}.op-signals{display:flex;flex-wrap:wrap;gap:4px;margin:8px 0 4px}.op-signals span{font-size:10px;border:1px solid rgba(47,111,78,.28);border-radius:999px;padding:3px 8px;color:var(--green);background:rgba(47,111,78,.06);font-weight:500}@media(max-width:760px){.op-card-board,.op-thesis-grid{grid-template-columns:1fr}.op-card-head{display:grid}}</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };
