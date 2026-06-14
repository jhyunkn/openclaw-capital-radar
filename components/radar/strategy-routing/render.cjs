const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const fmt = value => String(value ?? '—').replaceAll('_', ' ').toUpperCase();

function tone(value) {
  const s = String(value || '').toLowerCase();
  if (/allowed|supported|active|risk-on|ok|selective/.test(s)) return 'good';
  if (/blocked|defensive|stress|defend|block/.test(s)) return 'bad';
  return 'warn';
}

function renderPermissionCards(state) {
  return arr(state.permissions).map(item => `
    <article class="route-perm ${tone(item.permission)}">
      <span>${esc(item.domain)}</span>
      <b>${esc(item.permission)}</b>
      <small>${esc(item.driver)}</small>
    </article>`).join('');
}

function renderProtocolCards(state) {
  return arr(state.action_protocol).map(item => `
    <article>
      <span>${esc(item.rule)}</span>
      <b class="${tone(item.permission)}">${fmt(item.permission)}</b>
      <small>${esc(item.condition)}</small>
    </article>`).join('');
}

function renderSignalList(items, fallback) {
  const rows = arr(items).slice(0, 4).map(item => `<li>${esc(item)}</li>`).join('');
  return rows || `<li>${esc(fallback)}</li>`;
}

function renderRouteVerdict(state) {
  const cards = [
    ['Route', state.route, tone(state.route), value => esc(value)],
    ['Risk budget', state.risk_budget, tone(state.risk_budget), fmt],
    ['Add permission', state.add_permission, tone(state.add_permission), fmt],
    ['Opportunity', state.opportunity_permission, tone(state.opportunity_permission), fmt],
  ];
  return cards.map(([label, value, cls, format]) => `
    <article class="${cls}">
      <span>${esc(label)}</span>
      <b>${format(value)}</b>
    </article>`).join('');
}

function renderRouteDecision(state) {
  return `<div class="route-decision-board">
    <article class="route-main ${tone(state.add_permission)}">
      <span>Strategy permission</span>
      <b>${fmt(state.add_permission)}</b>
      <p>Route converts cycle context and movement confirmation into what capital can do now. It is the permission layer, not another market summary.</p>
    </article>
    <article><span>Route state</span><b>${esc(state.route || '—')}</b><small>Market movement translated into posture.</small></article>
    <article><span>Risk budget</span><b>${fmt(state.risk_budget)}</b><small>How much aggression is currently justified.</small></article>
    <article><span>Opportunity gate</span><b>${fmt(state.opportunity_permission)}</b><small>Whether new ideas are promotable or research-only.</small></article>
  </div>`;
}

function renderRouteBridge() {
  const steps = [
    ['01', 'Cycle', 'Egg sets macro allocation bias.'],
    ['02', 'Movement', 'Cross-assets confirm or contradict risk.'],
    ['03', 'Permission', 'Route allows, blocks, or delays action.'],
    ['04', 'Execution', 'Decision Map and Holdings apply the rule.'],
  ];
  return `<div class="route-bridge">${steps.map(([n, title, text]) => `<article><i>${esc(n)}</i><b>${esc(title)}</b><span>${esc(text)}</span></article>`).join('')}</div>`;
}

function renderStrategyRoutingSection(state) {
  return `<section id="strategy-routing-section" class="panel strategy-routing route-engine">
    <div class="section-head">
      <div>
        <p class="eyebrow">Route</p>
        <h2>Strategy permission engine</h2>
        <p class="route-sub">Cycle context + movement confirmation → portfolio permission → opportunity promotion.</p>
      </div>
      <a class="button" href="outputs/strategy-routing-state.json">Open route state</a>
    </div>
    ${renderRouteDecision(state)}
    ${renderRouteBridge()}
    <details class="route-collapse" open><summary>Permission matrix</summary><div class="route-verdict">${renderRouteVerdict(state)}</div><div class="route-permission-grid">${renderPermissionCards(state)}</div></details>
    <details class="route-collapse"><summary>Promotes / blocks</summary><div class="route-lists">
      <article><span>Promotes</span><ul>${renderSignalList(state.promotes, 'No active promotion signal.')}</ul></article>
      <article><span>Blocks</span><ul>${renderSignalList(state.blocks, 'No hard block from cross-asset route.')}</ul></article>
    </div></details>
    <details class="route-collapse"><summary>Action protocol</summary><div class="route-protocol">${renderProtocolCards(state)}</div></details>
  </section>`;
}

function renderStrategyRoutingStyle() {
  return `<style>.strategy-routing{margin-top:22px}.route-engine{background:#ffffff)}.route-sub{color:var(--muted);margin:4px 0 0;font-size:13px}.route-decision-board{display:grid;grid-template-columns:minmax(0,1.4fr) repeat(3,minmax(0,.62fr));gap:8px;margin:16px 0}.route-decision-board article,.route-bridge article,.route-verdict article,.route-perm,.route-lists article,.route-protocol article{border:1px solid var(--rule);border-radius:16px;background:#ffffff;padding:13px}.route-decision-board .route-main{padding:18px;background:#ffffff}.route-decision-board .good,.route-verdict article.good,.route-perm.good{border-color:rgba(47,111,78,.38)}.route-decision-board .warn,.route-verdict article.warn,.route-perm.warn{border-color:rgba(174,124,44,.42)}.route-decision-board .bad,.route-verdict article.bad,.route-perm.bad{border-color:rgba(159,63,53,.44)}.route-decision-board span,.route-bridge i,.route-verdict span,.route-perm span,.route-lists span,.route-protocol span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.route-decision-board b{display:block;font-size:18px;line-height:1.16;text-transform:uppercase;margin-top:7px}.route-decision-board .route-main b{font-size:clamp(26px,3.2vw,44px);letter-spacing:-.055em}.route-decision-board p{font-size:13px;line-height:1.45;color:rgba(36,35,31,.70);max-width:620px;margin:10px 0 0}.route-decision-board small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:7px}.route-bridge{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:10px 0 14px}.route-bridge article{min-height:92px}.route-bridge b{display:block;font-size:15px;line-height:1.1;margin-top:9px}.route-bridge span{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:7px}.route-collapse{border:1px solid var(--rule);border-radius:18px;background:#ffffff;overflow:hidden;margin-top:8px}.route-collapse summary{cursor:pointer;list-style:none;padding:13px 15px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.10em;border-bottom:1px solid var(--rule)}.route-collapse summary::-webkit-details-marker{display:none}.route-collapse summary:after{content:'+';float:right}.route-collapse[open] summary:after{content:'−'}.route-verdict{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}.route-verdict b{display:block;font-size:18px;text-transform:uppercase;margin-top:5px}.route-permission-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:0 12px 12px}.route-perm b{display:block;font-size:13px;text-transform:uppercase;margin-top:6px}.route-perm small,.route-protocol small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:6px}.route-lists{display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:12px}.route-lists ul{margin:8px 0 0;padding-left:18px;color:var(--muted);font-size:12px;line-height:1.45}.route-protocol{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;padding:12px}.route-protocol b{display:block;font-size:12px;text-transform:uppercase;margin-top:6px}.route-protocol b.good{color:var(--green)}.route-protocol b.warn{color:var(--warn)}.route-protocol b.bad{color:var(--red)}@media(max-width:1050px){.route-decision-board{grid-template-columns:1fr 1fr}.route-decision-board .route-main{grid-column:1/-1}.route-bridge,.route-verdict,.route-permission-grid,.route-protocol{grid-template-columns:repeat(2,1fr)}.route-lists{grid-template-columns:1fr}}@media(max-width:640px){.route-decision-board,.route-bridge,.route-verdict,.route-permission-grid,.route-protocol{grid-template-columns:1fr}}</style>`;
}

module.exports = { renderStrategyRoutingSection, renderStrategyRoutingStyle };