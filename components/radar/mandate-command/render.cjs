'use strict';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const money = value => Number.isFinite(Number(value)) ? `$${Number(value).toLocaleString('en-US', { maximumFractionDigits: 0 })}` : '—';
const tone = value => ['PAUSED_STALE', 'BLACKOUT'].includes(value) ? 'blocked' : value === 'ARMED' ? 'armed' : value === 'IN_POSITION' ? 'position' : 'review';

// Plain-language guidance per dependency id. Values (ages, dates, statuses) stay
// data-driven; these strings only explain what each dependency is and what clears it.
const DEPENDENCY_GUIDANCE = {
  positions: { what: 'Your share counts and holdings list.', unblock: 'Share counts come from Robinhood and are updated by hand — there is no automatic sync. A fresh manual sync clears this.' },
  quotes: { what: 'Current market prices for each holding.', unblock: 'Refreshes automatically with the price feed. No manual step — it clears on the next successful refresh.' },
  data_health: { what: 'The site\u2019s own freshness report across all data feeds.', unblock: 'PARTIAL means one or more feeds are behind. It clears when every feed reports fresh again; nothing you can do by hand.' },
  calendar: { what: 'The market-events calendar — FOMC, CPI, earnings blackouts.', unblock: 'Updated by a scheduled resync. It clears when the next resync completes.' },
  account: { what: 'The Agentic account snapshot — cash, equity, balances.', unblock: 'Provide a fresh account snapshot from your broker.' },
  orders: { what: 'Open orders and protective-stop status on the Agentic account.', unblock: 'Provide a fresh orders snapshot from your broker.' },
  buying_power: { what: 'How much the Agentic account can deploy right now.', unblock: 'Arrives with the fresh account snapshot.' },
  gate_observations: { what: 'The timestamped checklist readings (price, breadth, volume) the Agentic gates are scored against.', unblock: 'Recorded automatically during market hours. Clears when a fresh observation round lands.' },
};
const FALLBACK_GUIDANCE = { what: 'A required piece of evidence for this mandate.', unblock: 'The reason above describes what is missing or stale.' };

function humanAge(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m)) return null;
  if (m >= 1440) {
    const days = m / 1440;
    if (m >= 2880) return `${Math.round(days)} days`;
    return `${days === 1 ? '1 day' : `${days.toFixed(1)} days`}`;
  }
  if (m >= 120) return `${(m / 60).toFixed(1)} hours`;
  if (m >= 2) return `${Math.round(m)} minutes`;
  return 'just now';
}
function fmtDate(iso) {
  const src = /^\d{4}-\d{2}-\d{2}$/.test(String(iso || '')) ? `${iso}T12:00:00Z` : iso;
  const d = new Date(src);
  if (Number.isNaN(d.getTime())) return iso ? String(iso) : 'pending';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/New_York' });
}
function whyLine(row) {
  const blocked = row.status !== 'OK';
  if (row.reason) {
    const ageOf = (match, num) => {
      const age = humanAge(Number(String(num).replace(/,/g, '')));
      return age ? `${age} old` : match;
    };
    const maxOf = (match, num) => {
      const age = humanAge(Number(String(num).replace(/,/g, '')));
      return age ? `maximum is ${age}` : match;
    };
    const reason = row.reason
      .replace(/([\d][\d.,]*)\s*minutes?\s*old/i, ageOf)
      .replace(/maximum is ([\d][\d.,]*)/i, maxOf);
    return `${blocked ? 'Why it\u2019s blocked: ' : 'Why it passes: '}${reason}`;
  }
  if (row.asOf) {
    const window = row.maxMinutes ? ` — inside the ${humanAge(row.maxMinutes) || `${row.maxMinutes} minute`} freshness window` : '';
    return `${blocked ? 'Why it\u2019s blocked: ' : 'Current: '}last refreshed ${fmtDate(row.asOf)}${window}.`;
  }
  return blocked ? 'Why it\u2019s blocked: no evidence yet.' : 'Current.';
}
function guidanceLine(row) {
  const g = DEPENDENCY_GUIDANCE[row.id] || FALLBACK_GUIDANCE;
  const unblock = row.status === 'OK' ? 'Healthy — no action needed while it stays fresh.' : g.unblock;
  return `<p class="mc-dep-guidance"><strong>What this is:</strong> ${esc(g.what)} <strong>What unblocks it:</strong> ${esc(unblock)}</p>`;
}
function dependencyRows(rows = []) {
  return rows.map(row => `<li class="mc-dependency mc-${esc(String(row.status).toLowerCase())}">
    <div class="mc-dep-top"><b>${esc(row.status)}</b><span>${esc(row.label)}</span></div>
    <p class="mc-dep-why">${esc(whyLine(row))}</p>
    ${guidanceLine(row)}
    <small>${row.asOf ? `Last checked ${esc(fmtDate(row.asOf))}` : 'Not yet observed'}</small>
  </li>`).join('');
}
function blockersLine(mandate) {
  const blockers = mandate.blockers || [];
  if (!blockers.length) return `<p class="mc-blockers mc-none"><strong>All clear:</strong> every required dependency is fresh.</p>`;
  const byId = Object.fromEntries((mandate.dependencies || []).map(d => [d.id, d]));
  const items = blockers.map(b => {
    const d = byId[b.id];
    return `${esc(d ? d.label : b.id)} (${esc(String(b.status).toLowerCase())})`;
  }).join(' · ');
  return `<p class="mc-blockers"><strong>Blocked by:</strong> ${items}</p>`;
}
function explainer(core, agentic) {
  return `<div class="mc-explainer">
    <p class="mc-explainer-lede"><strong>What “decision authority” means:</strong> nothing on this page can place an order. It answers one question per mandate — is the evidence fresh and complete enough for <em>you</em>, the human, to decide in your own broker? When a required piece is missing or stale, the mandate pauses instead of guessing.</p>
    <dl class="mc-mandate-defs">
      <div><dt>${esc(core.label || 'Core portfolio')}</dt><dd>${esc(core.description || 'Unavailable')}</dd></div>
      <div><dt>${esc(agentic.label || 'Agentic tactical')}</dt><dd>${esc(agentic.description || 'Unavailable')}</dd></div>
    </dl>
    <p class="mc-explainer-note">Execution is human-only on both mandates. The Agentic account watches a single tactical playbook — monitoring never implies order authorization.</p>
  </div>`;
}
function corePanel(mandate) {
  const portfolio = mandate.portfolio || {};
  return `<div class="mc-panel" data-mandate-panel="core">
    <div class="mc-state mc-${tone(mandate.state)}"><span>Core action state</span><strong>${esc(mandate.state.replaceAll('_', ' '))}</strong><p>${esc(mandate.reason)}</p></div>
    ${blockersLine(mandate)}
    <div class="mc-metrics">
      <article><span>Portfolio</span><b>${money(portfolio.totalValue)}</b></article>
      <article><span>Buying power</span><b>${money(portfolio.buyingPower)}</b></article>
      <article><span>Positions</span><b>${esc(portfolio.positionCount ?? '—')}</b></article>
      <article><span>Execution</span><b>Human only</b></article>
    </div>
    <h3 class="mc-dep-heading">Required evidence</h3>
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
    ${blockersLine(mandate)}
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
      ${explainer(core, agentic)}
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
