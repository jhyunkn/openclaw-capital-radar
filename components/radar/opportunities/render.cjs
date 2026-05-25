const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = (value, digits = 0) => num(value) === null ? '—' : num(value).toLocaleString(undefined, { maximumFractionDigits: digits });
const clean = value => String(value || '').replace(/_/g, ' ');

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
  const selected = opportunities.length ? opportunities : near.length ? near : rows.slice(0, 8);
  return { opportunities, near, selected };
}

function renderSummaryStrip(summary = {}) {
  const rows = [
    ['Candidates', summary.candidates],
    ['Promotion review', summary.promotion_review],
    ['Exception review', summary.exception_review],
    ['Build evidence', summary.build_evidence_packet],
    ['Watch / collect', summary.watch_and_collect],
    ['Avg evidence', summary.average_evidence_completeness_pct, '%'],
  ];
  return rows.map(([label, value, suffix]) => `<article><span>${esc(label)}</span><b>${fmt(value)}${suffix || ''}</b></article>`).join('');
}

function renderEmptyState(summary, qualifiedCount) {
  if (qualifiedCount !== 0) return '';
  return `<div class="empty-op"><b>No fully promoted opportunities yet</b><span>Average evidence: ${fmt(summary.average_evidence_completeness_pct)}% · Showing candidates by evidence support and next research gate, not trade recommendations.</span></div>`;
}

function renderGate(gate) {
  const passed = gate.passed === true;
  return `<span class="op-gate ${passed ? 'pass' : 'fail'}">${esc(gate.label || gate.key)} ${passed ? '✓' : '·'}</span>`;
}

function renderMiniMetric(label, value, suffix = '') {
  return `<div><span>${esc(label)}</span><b>${esc(value)}${suffix}</b></div>`;
}

function renderOpportunityRow(row) {
  const gates = row.gates.length ? row.gates.map(renderGate).join('') : '<span class="op-gate fail">evidence pending</span>';
  const missing = row.missing.length ? row.missing.slice(0, 3).join(' · ') : 'human review';
  const sources = row.requiredSources.length ? row.requiredSources.slice(0, 3).join(' · ') : 'source map pending';
  return `<article class="op-card">
    <div class="op-card-head">
      <div><span class="op-theme">${esc(row.theme || 'unmapped theme')}</span><h3>${esc(row.ticker)}</h3><p>${esc(row.name)}</p></div>
      <span class="pill ${stageClass(row.stage)}">${esc(clean(row.stage))}</span>
    </div>
    <div class="op-card-metrics">
      ${renderMiniMetric('Evidence', `${fmt(row.evidence)} / ${fmt(row.required)}`, '')}
      ${renderMiniMetric('Undervaluation', fmt(row.undervaluation), '')}
      ${renderMiniMetric('Conviction', fmt(row.conviction), '')}
      ${renderMiniMetric('Zone', clean(row.zone || 'unmapped'), '')}
    </div>
    <div class="op-gates">${gates}</div>
    <div class="op-thesis-grid">
      <div><span>Why it matters</span><p>${esc(row.why || row.direction || 'Thesis rationale pending.')}</p></div>
      <div><span>Underpriced condition</span><p>${esc(row.underpriced || 'No underpriced condition established yet.')}</p></div>
    </div>
    <div class="op-next-line"><span>Next gate</span><b>${esc(row.next)}</b><small>${esc(missing)}</small></div>
    <div class="op-source-line"><span>Evidence sources</span><small>${esc(sources)} · SEC records: ${fmt(row.secRecords)} · market structure: ${esc(row.marketStructure || 'missing')}</small></div>
  </article>`;
}

function renderOpportunityBoard(rows) {
  return `<div class="op-card-board">${rows.map(renderOpportunityRow).join('')}</div>`;
}

function renderOpportunitiesSection(state) {
  const summary = state.summary || {};
  const allRows = flattenOpportunityRows(state);
  const { opportunities, selected } = selectDisplayRows(allRows);
  return `<section id="opportunities-section" class="panel">
    <div class="section-head"><div><p class="eyebrow">Opportunity</p><h2>Evidence-backed opportunity research</h2></div><a class="button" href="outputs/opportunity-asymmetry-state.json">Open artifact</a></div>
    <div class="trust-strip">${renderSummaryStrip(summary)}</div>
    ${renderEmptyState(summary, opportunities.length)}
    ${renderOpportunityBoard(selected)}
  </section>`;
}

function renderOpportunitiesStyle() {
  return `<style>.empty-op{border:1px solid var(--rule);border-radius:16px;padding:14px;margin:14px 0;background:rgba(251,250,246,.12);display:grid;gap:4px}.empty-op b{font-size:20px}.empty-op span{color:var(--muted);font-size:12px}.op-card-board{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:10px;margin-top:14px}.op-card{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.12);padding:14px;min-width:0;overflow:hidden}.op-card-head{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.op-card-head h3{font-size:28px;line-height:.95;margin:4px 0 2px;letter-spacing:-.045em}.op-card-head p{font-size:12px;color:var(--muted);margin:0}.op-theme{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;max-width:220px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.op-card-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin:12px 0}.op-card-metrics div{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:7px;min-width:0}.op-card-metrics span,.op-thesis-grid span,.op-next-line span,.op-source-line span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.op-card-metrics b{display:block;font-size:13px;line-height:1.15;margin-top:4px;overflow-wrap:anywhere}.op-gates{display:flex;flex-wrap:wrap;gap:5px;margin:10px 0}.op-gate{font-size:10px;line-height:1;border:1px solid var(--rule);border-radius:999px;padding:5px 7px;color:var(--muted);background:rgba(251,250,246,.10)}.op-gate.pass{border-color:rgba(47,111,78,.36);color:var(--green);background:rgba(47,111,78,.08)}.op-gate.fail{border-color:rgba(174,124,44,.38);color:var(--warn);background:rgba(174,124,44,.08)}.op-thesis-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:10px 0}.op-thesis-grid div,.op-next-line,.op-source-line{border:1px solid var(--rule);border-radius:14px;padding:10px;background:rgba(251,250,246,.08);min-width:0}.op-thesis-grid p{font-size:12px;line-height:1.42;color:rgba(36,35,31,.78);margin:6px 0 0;overflow-wrap:anywhere}.op-next-line{margin-top:8px}.op-next-line b{display:block;font-size:14px;line-height:1.25;margin-top:4px}.op-next-line small,.op-source-line small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:5px;overflow-wrap:anywhere}.op-source-line{margin-top:8px}@media(max-width:760px){.op-card-board,.op-thesis-grid{grid-template-columns:1fr}.op-card-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.op-card-head{display:grid}}</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };