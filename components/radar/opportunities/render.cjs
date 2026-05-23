const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;
const fmt = (value, digits = 0) => num(value) === null ? '—' : num(value).toLocaleString(undefined, { maximumFractionDigits: digits });

function stageClass(value) {
  const s = String(value || '').toUpperCase();
  if (/QUALIFIED|PROMOTION/.test(s)) return 'good';
  if (/EXCEPTION|NEAR/.test(s)) return 'warn';
  return 'bad';
}

function flattenOpportunityRows(state) {
  return arr(state.opportunity_clusters).flatMap(cluster =>
    arr(cluster.candidate_tickers).map(ticker => ({
      theme: cluster.macro_theme,
      ticker: ticker.ticker,
      stage: ticker.asymmetry_stage || 'research_task',
      display: ticker.display_as_opportunity === true,
      near: ticker.display_as_near_miss === true,
      asymmetry: ticker.asymmetry_score,
      downside: ticker.downside_control_score,
      upside: ticker.upside_potential_score,
      evidence: ticker.evidence_completeness_pct,
      required: ticker.evidence_required_pct || 80,
      undervaluation: ticker.undervaluation_score,
      conviction: ticker.conviction_score,
      risk: ticker.risk_budget_score,
      gap: ticker.threshold_gap,
      zone: ticker.zone_status,
      next: ticker.primary_blocker || ticker.next_gate || arr(ticker.missing_evidence)[0] || 'human review',
    }))
  ).sort((a, b) => (num(a.gap) || 999) - (num(b.gap) || 999) || (num(b.asymmetry) || 0) - (num(a.asymmetry) || 0));
}

function selectDisplayRows(rows) {
  const opportunities = rows.filter(row => row.display);
  const near = rows.filter(row => row.near).slice(0, 8);
  const selected = opportunities.length ? opportunities : near.length ? near : rows.slice(0, 8);
  return { opportunities, near, selected };
}

function renderSummaryStrip(summary = {}) {
  const rows = [
    ['Qualified', summary.qualified_asymmetry],
    ['Exception', summary.undervalued_exception],
    ['Near miss', summary.near_miss],
    ['Research', summary.research_task],
    ['Closest gap', summary.closest_threshold_gap],
    ['Avg risk', summary.average_risk_budget_score],
  ];
  return rows.map(([label, value]) => `<article><span>${esc(label)}</span><b>${fmt(value)}</b></article>`).join('');
}

function renderEmptyState(summary, qualifiedCount) {
  if (qualifiedCount !== 0) return '';
  return `<div class="empty-op"><b>0 qualified asymmetric opportunities</b><span>Closest gap: ${fmt(summary.closest_threshold_gap)} · Showing nearest candidates by threshold gap, not trade ideas.</span></div>`;
}

function renderOpportunityRow(row) {
  return `<article class="op-row">
    <span class="pill ${stageClass(row.stage)}" data-label="Stage">${esc(row.stage)}</span>
    <b data-label="Ticker">${esc(row.ticker)}</b>
    <span data-label="Gap">${fmt(row.gap)}</span>
    <span data-label="Asym.">${fmt(row.asymmetry)}</span>
    <span data-label="Downside">${fmt(row.downside)}</span>
    <span data-label="Risk">${fmt(row.risk)}</span>
    <span data-label="Evidence">${fmt(row.evidence)} / ${fmt(row.required)}</span>
    <span data-label="Next gate">${esc(row.next)}</span>
  </article>`;
}

function renderOpportunityBoard(rows) {
  const head = '<article class="op-head"><span>Stage</span><span>Ticker</span><span>Gap</span><span>Asym.</span><span>Downside</span><span>Risk</span><span>Evidence</span><span>Next gate</span></article>';
  return `<div class="op-board">${head}${rows.map(renderOpportunityRow).join('')}</div>`;
}

function renderOpportunitiesSection(state) {
  const summary = state.summary || {};
  const allRows = flattenOpportunityRows(state);
  const { opportunities, near, selected } = selectDisplayRows(allRows);
  return `<section id="opportunities-section" class="panel">
    <div class="section-head"><div><p class="eyebrow">Opportunity</p><h2>Asymmetry filter</h2></div><a class="button" href="outputs/opportunity-asymmetry-state.json">Open artifact</a></div>
    <div class="trust-strip">${renderSummaryStrip(summary)}</div>
    ${renderEmptyState(summary, opportunities.length)}
    ${renderOpportunityBoard(selected)}
  </section>`;
}

function renderOpportunitiesStyle() {
  return `<style>.empty-op{border:1px solid var(--rule);border-radius:16px;padding:14px;margin:14px 0;background:rgba(251,250,246,.12);display:grid;gap:4px}.empty-op b{font-size:20px}.empty-op span{color:var(--muted);font-size:12px}.op-board{border-left:1px solid var(--rule);border-top:1px solid var(--rule);margin-top:14px}.op-head,.op-row{display:grid;grid-template-columns:1fr .55fr .45fr .5fr .65fr .5fr .7fr 1.1fr;gap:8px;align-items:center;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px}.op-head{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.op-row b{font-size:18px}.op-row span{font-size:12px;line-height:1.25}.op-row [data-label]::before{display:none;content:attr(data-label);color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em;margin-bottom:4px}@media(max-width:900px){.op-board{border:0}.op-head{display:none}.op-row{grid-template-columns:repeat(2,minmax(0,1fr));border:1px solid var(--rule);border-radius:16px;margin:10px 0;padding:12px;background:rgba(251,250,246,.14)}.op-row [data-label]{display:block}.op-row [data-label]::before{display:block}.op-row b{font-size:22px}.op-row .pill{justify-content:center}}</style>`;
}

module.exports = { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows };
