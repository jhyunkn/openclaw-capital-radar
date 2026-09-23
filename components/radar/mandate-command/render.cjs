'use strict';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
const tone = value => ['PAUSED_STALE', 'BLACKOUT'].includes(value) ? 'blocked' : value === 'ARMED' ? 'armed' : value === 'IN_POSITION' ? 'position' : 'review';

function dependencyRows(rows = []) {
  return rows.map(row => `<li class="mc-dependency mc-${esc(String(row.status).toLowerCase())}"><span>${esc(row.label)}</span><b>${esc(row.status)}</b><small>${esc(row.reason || (row.asOf ? `As of ${row.asOf}` : 'Current'))}</small></li>`).join('');
}
function corePanel(mandate) {
  const portfolio = mandate.portfolio || {};
  return `<div class="mc-panel" data-mandate-panel="core">
    <div class="mc-state mc-${tone(mandate.state)}"><span>Core action state</span><strong>${esc(mandate.state.replaceAll('_', ' '))}</strong><p>${esc(mandate.reason)}</p></div>
    <div class="mc-metrics">
      <article><span>Portfolio</span><b>${money(portfolio.totalValue)}</b></article>
      <article><span>Buying power</span><b>${money(portfolio.buyingPower)}</b></article>
      <article><span>Positions</span><b>${esc(portfolio.positionCount ?? '—')}</b></article>
      <article><span>Execution</span><b>Human only</b></article>
    </div>
    <ul class="mc-dependencies">${dependencyRows(mandate.dependencies)}</ul>
  </div>`;
}
function agenticPanel(mandate) {
  const risk = mandate.riskPolicy || {};
  const playbook = mandate.playbook || {};
  const ticket = playbook.ticket || {};
  const conditions = (playbook.conditions || []).map(row => `<li class="mc-gate mc-${esc(String(row.status).toLowerCase())}"><i aria-hidden="true"></i><div><span>${esc(row.label)}</span><small>${esc(row.rule)}</small></div><b>${esc(row.status)}</b></li>`).join('');
  const deploymentPct = risk.maxDeployment ? Math.min(100, Math.max(0, Number(ticket.plannedDeployment || 0) / risk.maxDeployment * 100)) : 0;
  const riskPct = risk.maxPlannedRisk ? Math.min(100, Math.max(0, Number(ticket.plannedRisk || 0) / risk.maxPlannedRisk * 100)) : 0;
  return `<div class="mc-panel" data-mandate-panel="agentic" hidden>
    <div class="mc-state mc-${tone(mandate.state)}"><span>Agentic action state</span><strong>${esc(mandate.state.replaceAll('_', ' '))}</strong><p>${esc(mandate.reason)}</p></div>
    <div class="mc-agentic-grid">
      <div>
        <div class="mc-ticket">
          <span>Active playbook · ${esc(playbook.symbol || 'None')}</span>
          <b>${esc(playbook.name || 'No active playbook')}</b>
          <p>${esc(ticket.quantity ?? '—')} shares near ${money(ticket.referenceEntry)} · stop reference ${money(ticket.stopReference)} · objective ${money(ticket.minimumObjective)}</p>
          <small>Monitoring only · ${esc(String(ticket.authorization || 'not_authorized').replaceAll('_', ' '))}</small>
        </div>
        <div class="mc-budget">
          <article><span>Deployment</span><b>${money(ticket.plannedDeployment)} / ${money(risk.maxDeployment)}</b><i style="--fill:${deploymentPct.toFixed(1)}%"></i></article>
          <article><span>Planned risk</span><b>${money(ticket.plannedRisk)} / ${money(risk.maxPlannedRisk)}</b><i style="--fill:${riskPct.toFixed(1)}%"></i></article>
          <article><span>Position slots</span><b>${esc(mandate.account?.positionCount ?? 'Unknown')} / ${esc(risk.maxPositions ?? '—')}</b></article>
        </div>
      </div>
      <ol class="mc-gates">${conditions}</ol>
    </div>
    <details class="mc-dependency-details"><summary>Required data dependencies</summary><ul class="mc-dependencies">${dependencyRows(mandate.dependencies)}</ul></details>
  </div>`;
}
function renderMandateCommand(state) {
  const core = (state.mandates || []).find(row => row.id === 'core') || { id: 'core', state: 'PAUSED_STALE', dependencies: [] };
  const agentic = (state.mandates || []).find(row => row.id === 'agentic') || { id: 'agentic', state: 'PAUSED_STALE', dependencies: [] };
  return `<div id="mandate-command" class="mandate-command" data-default-mandate="${esc(state.defaultMandate || 'core')}">
    <div class="mc-wrap">
      <div class="mc-heading"><div><span>Decision authority</span><h2>One cockpit, separated mandates</h2></div><p>Freshness is evaluated per action dependency. Missing evidence blocks permission instead of being hidden.</p></div>
      <div class="mc-tabs" role="tablist" aria-label="Capital mandate">
        <button type="button" role="tab" aria-selected="true" data-mandate-tab="core">Core portfolio <b>${esc(core.state.replaceAll('_', ' '))}</b></button>
        <button type="button" role="tab" aria-selected="false" data-mandate-tab="agentic">Agentic tactical <b>${esc(agentic.state.replaceAll('_', ' '))}</b></button>
      </div>
      ${corePanel(core)}
      ${agenticPanel(agentic)}
    </div>
  </div>`;
}

module.exports = { renderMandateCommand };
