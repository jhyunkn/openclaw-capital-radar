const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const fmt = value => String(value ?? '—').replaceAll('_', ' ').toUpperCase();

function tone(value) {
  const s = String(value || '').toLowerCase();
  if (/allowed|supported|active|risk-on|ok|selective/.test(s)) return 'good';
  if (/blocked|defensive|stress|defend/.test(s)) return 'bad';
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

function renderStrategyRoutingSection(state) {
  return `<section id="strategy-routing-section" class="panel strategy-routing">
    <div class="section-head">
      <div>
        <p class="eyebrow">Strategy Route</p>
        <h2>${esc(state.route)}</h2>
        <p class="route-sub">Market lens → portfolio permission → opportunity promotion.</p>
      </div>
      <a class="button" href="outputs/strategy-routing-state.json">Open route state</a>
    </div>
    <div class="route-verdict">${renderRouteVerdict(state)}</div>
    <div class="route-permission-grid">${renderPermissionCards(state)}</div>
    <div class="route-lists">
      <article><span>Promotes</span><ul>${renderSignalList(state.promotes, 'No active promotion signal.')}</ul></article>
      <article><span>Blocks</span><ul>${renderSignalList(state.blocks, 'No hard block from cross-asset route.')}</ul></article>
    </div>
    <div class="route-protocol">${renderProtocolCards(state)}</div>
  </section>`;
}

function renderStrategyRoutingStyle() {
  return `<style>.strategy-routing{margin-top:22px}.route-sub{color:var(--muted);margin:4px 0 0;font-size:13px}.route-verdict{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:12px 0}.route-verdict article,.route-perm,.route-lists article,.route-protocol article{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.1);padding:12px}.route-verdict article.good,.route-perm.good{border-color:rgba(47,111,78,.38)}.route-verdict article.warn,.route-perm.warn{border-color:rgba(174,124,44,.42)}.route-verdict article.bad,.route-perm.bad{border-color:rgba(159,63,53,.44)}.route-verdict span,.route-perm span,.route-lists span,.route-protocol span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.route-verdict b{display:block;font-size:18px;text-transform:uppercase;margin-top:5px}.route-permission-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin:12px 0}.route-perm b{display:block;font-size:13px;text-transform:uppercase;margin-top:6px}.route-perm small,.route-protocol small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:6px}.route-lists{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:12px 0}.route-lists ul{margin:8px 0 0;padding-left:18px;color:var(--muted);font-size:12px;line-height:1.45}.route-protocol{display:grid;grid-template-columns:repeat(5,1fr);gap:8px}.route-protocol b{display:block;font-size:12px;text-transform:uppercase;margin-top:6px}.route-protocol b.good{color:var(--green)}.route-protocol b.warn{color:var(--warn)}.route-protocol b.bad{color:var(--red)}@media(max-width:1000px){.route-verdict,.route-permission-grid,.route-protocol{grid-template-columns:repeat(2,1fr)}.route-lists{grid-template-columns:1fr}}@media(max-width:640px){.route-verdict,.route-permission-grid,.route-protocol{grid-template-columns:1fr}}</style>`;
}

module.exports = { renderStrategyRoutingSection, renderStrategyRoutingStyle };
