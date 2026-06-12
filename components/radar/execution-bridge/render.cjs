function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function money(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

function pct(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 'n/a';
  return `${n > 0 ? '+' : ''}${n.toFixed(2)}%`;
}

function toneClass(status) {
  const s = String(status || '').toLowerCase();
  if (/allowed|ready|proposal/.test(s)) return 'good';
  if (/blocked|not connected|no autonomous|reject/.test(s)) return 'bad';
  return 'warn';
}

function renderTickets(tickets) {
  const rows = arr(tickets).slice(0, 6).map(ticket => {
    const tone = toneClass(ticket.status);
    const entry = ticket.entry_zone ? `${money(ticket.entry_zone.low)}-${money(ticket.entry_zone.high)}` : 'n/a';
    return `<article class="reb-ticket ${tone}"><div><span>${esc(ticket.ticker)}</span><b>${esc(ticket.status)}</b></div><p>${esc(ticket.recommendation)}</p><dl><div><dt>Entry</dt><dd>${entry}</dd></div><div><dt>Current</dt><dd>${money(ticket.current_price)}</dd></div><div><dt>Distance</dt><dd>${pct(ticket.distance_to_entry_mid_pct)}</dd></div><div><dt>Max size</dt><dd>${esc(ticket.max_position_size_pct)}%</dd></div></dl><small>${esc(ticket.blocker || ticket.next_step || 'Requires exact human approval before any order.')}</small></article>`;
  }).join('');
  return rows || '<p class="reb-empty">No eligible proposal tickets generated from current Capital Radar state.</p>';
}

function renderChecks(checks) {
  return arr(checks).map(check => `<li class="${toneClass(check.status)}"><span>${esc(check.label)}</span><b>${esc(check.status)}</b><small>${esc(check.detail)}</small></li>`).join('');
}

function renderRobinhoodExecutionBridgeModule(state = {}) {
  const sync = state.sync || {};
  const policy = state.policy || {};
  const readiness = state.readiness || {};
  const connectionTone = sync.connected ? 'good' : 'bad';
  const modeTone = policy.execution_mode === 'proposal_only' ? 'warn' : 'bad';

  return `<div id="robinhood-execution-bridge-module" class="robinhood-execution-bridge" aria-labelledby="robinhood-execution-bridge-title"><div class="reb-head"><div><p class="eyebrow">Robinhood bridge</p><h3 id="robinhood-execution-bridge-title">Proposal-only execution rail</h3><p>Capital Radar remains the decision brain. Robinhood MCP is treated as account sync and approved-order plumbing, not autonomous judgment.</p></div><div class="reb-status ${connectionTone}"><span>Broker sync</span><b>${esc(sync.status || 'not_connected')}</b><small>${esc(sync.detail || 'Connect Robinhood Agentic Trading MCP before live portfolio sync.')}</small></div></div><div class="reb-grid"><article class="reb-card"><span>Execution mode</span><b class="${modeTone}">${esc(policy.execution_mode_label || 'Proposal only')}</b><p>${esc(policy.execution_policy || 'No order can be sent without an exact approved ticket from Jun.')}</p></article><article class="reb-card"><span>Readiness</span><b class="${toneClass(readiness.status)}">${esc(readiness.status || 'blocked')}</b><p>${esc(readiness.summary || 'Broker data is not connected; Capital Radar can generate proposals but cannot reconcile live buying power.')}</p></article><article class="reb-card"><span>Live data source</span><b>${esc(state.capital_radar?.status || 'active')}</b><p>${esc(state.capital_radar?.detail || 'Uses Capital Radar live macro, holdings, zones, and action-permission outputs.')}</p></article></div><div class="reb-body"><div class="reb-policy"><h4>Pre-trade gates</h4><ul>${renderChecks(state.gates)}</ul></div><div class="reb-policy"><h4>Hard rules</h4><ul>${renderChecks(state.hard_rules)}</ul></div></div><div class="reb-ticket-board"><div class="reb-board-title"><div><span>Generated from live Capital Radar state</span><h4>Trade tickets</h4></div><b>${esc(arr(state.tickets).length)} proposals</b></div>${renderTickets(state.tickets)}</div><p class="reb-footnote">Robinhood Agentic account integration target: ${esc(sync.mcp_url || 'https://agent.robinhood.com/mcp/trading')}. This module intentionally ships with execution disabled until broker authentication and approval logging are implemented.</p></div>`;
}

function renderRobinhoodExecutionBridgeStyle() {
  return `<style id="robinhood-execution-bridge-style">
#robinhood-execution-bridge-module{margin-top:18px;border:1px solid rgba(27,31,36,.14);background:#f8faf7;color:#171b17;padding:18px;border-radius:8px}
#robinhood-execution-bridge-module .reb-head{display:grid;grid-template-columns:minmax(0,1fr) minmax(220px,.34fr);gap:14px;align-items:start;margin-bottom:14px}
#robinhood-execution-bridge-module h3,#robinhood-execution-bridge-module h4{margin:0;letter-spacing:0;color:#171b17}
#robinhood-execution-bridge-module h3{font-size:22px;line-height:1.14}
#robinhood-execution-bridge-module h4{font-size:14px;line-height:1.2}
#robinhood-execution-bridge-module p{margin:7px 0 0;color:#596157;line-height:1.45}
#robinhood-execution-bridge-module .reb-status,#robinhood-execution-bridge-module .reb-card,#robinhood-execution-bridge-module .reb-policy,#robinhood-execution-bridge-module .reb-ticket{border:1px solid rgba(27,31,36,.12);background:#fff;border-radius:8px;padding:12px}
#robinhood-execution-bridge-module span,#robinhood-execution-bridge-module dt{display:block;color:#6b7268;font-size:10px;text-transform:uppercase;letter-spacing:.08em}
#robinhood-execution-bridge-module b{display:block;margin-top:4px;color:#171b17}
#robinhood-execution-bridge-module small{display:block;margin-top:6px;color:#697168;line-height:1.35}
#robinhood-execution-bridge-module .good b,#robinhood-execution-bridge-module b.good{color:#157447}
#robinhood-execution-bridge-module .warn b,#robinhood-execution-bridge-module b.warn{color:#9a6515}
#robinhood-execution-bridge-module .bad b,#robinhood-execution-bridge-module b.bad{color:#b13b31}
#robinhood-execution-bridge-module .reb-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
#robinhood-execution-bridge-module .reb-body{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
#robinhood-execution-bridge-module ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:7px}
#robinhood-execution-bridge-module li{border-top:1px solid rgba(27,31,36,.1);padding-top:7px}
#robinhood-execution-bridge-module .reb-ticket-board{margin-top:12px}
#robinhood-execution-bridge-module .reb-board-title{display:flex;justify-content:space-between;gap:12px;align-items:end;margin-bottom:8px}
#robinhood-execution-bridge-module .reb-ticket{display:grid;gap:8px;margin-top:8px}
#robinhood-execution-bridge-module .reb-ticket>div:first-child{display:flex;justify-content:space-between;gap:12px}
#robinhood-execution-bridge-module dl{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0}
#robinhood-execution-bridge-module dd{margin:2px 0 0;font-size:12px;color:#222821}
#robinhood-execution-bridge-module .reb-empty{border:1px dashed rgba(27,31,36,.2);border-radius:8px;padding:12px;background:#fff}
#robinhood-execution-bridge-module .reb-footnote{font-size:12px;color:#6b7268}
@media(max-width:900px){#robinhood-execution-bridge-module .reb-head,#robinhood-execution-bridge-module .reb-grid,#robinhood-execution-bridge-module .reb-body,#robinhood-execution-bridge-module dl{grid-template-columns:1fr}}
</style>`;
}

module.exports = {
  renderRobinhoodExecutionBridgeModule,
  renderRobinhoodExecutionBridgeStyle,
};
