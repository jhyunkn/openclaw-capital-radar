'use strict';

// TQQQ watcher panel — shared surface for the Agentic (••••2775) leverage sleeve.
// O's gateway watcher writes outputs/tqqq-watcher-state.json; C posts an
// independent review stamp into reviewStamp. Rendering is FAIL-CLOSED: if the
// observation is missing or older than maxAgeMinutes, every live reading
// (price, gates) renders as STALE/UNKNOWN. A frozen gate must never present
// as a live pass — that is how a leveraged dashboard gets someone to buy into
// a collapse.

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function arr(value) { return Array.isArray(value) ? value : []; }
function money(v) {
  const n = Number(v);
  return Number.isFinite(n) ? '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
}
function ageMinutes(iso) {
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? (Date.now() - t) / 60000 : Infinity;
}

// The single source of truth for freshness. Fail closed: anything we cannot
// positively confirm as fresh is treated as stale.
function freshness(state) {
  const max = Number(state.maxAgeMinutes) > 0 ? Number(state.maxAgeMinutes) : 20;
  const age = ageMinutes(state.observedAt);
  const declaredStale = state.stale === true || !state.observedAt;
  const ageStale = !Number.isFinite(age) || age > max;
  const stale = declaredStale || ageStale;
  let label;
  if (!state.observedAt) label = 'STALE · no observation yet';
  else if (stale) label = `STALE · observed ${Math.round(age)}m ago (max ${max}m)`;
  else label = `Live · observed ${Math.round(age)}m ago`;
  return { stale, label, max, age };
}

function gateTone(status, stale) {
  if (stale) return 'unknown';
  const s = String(status || '').toUpperCase();
  if (s === 'PASS') return 'pass';
  if (s === 'FAIL') return 'fail';
  return 'unknown';
}
function gateText(status, stale) {
  if (stale) return 'STALE';
  const s = String(status || '').toUpperCase();
  return (s === 'PASS' || s === 'FAIL') ? s : 'UNKNOWN';
}

function renderTqqqWatcherModule(state = {}) {
  const f = freshness(state);
  const zone = state.zone || {};
  const primary = zone.primary || {};
  const deeper = zone.deeper || {};
  const holdings = state.holdings || {};
  const order = state.order || {};
  const review = state.reviewStamp || {};
  const policy = state.policy || {};

  const priceLast = f.stale ? null : state.price?.last;
  const zonePrimary = (primary.low != null && primary.high != null) ? `${money(primary.low)}–${money(primary.high)}` : '—';
  const zoneDeeper = (deeper.low != null && deeper.high != null) ? `${money(deeper.low)}–${money(deeper.high)}` : '—';

  const gates = arr(state.gates).map(g => {
    const tone = gateTone(g.status, f.stale);
    return `<li class="tqw-gate tqw-${tone}">
      <div class="tqw-gate-top"><b>${esc(gateText(g.status, f.stale))}</b><span>${esc(g.label)}</span></div>
      <p class="tqw-gate-detail">${esc(f.stale ? 'Not confirmable — data is stale.' : (g.detail || ''))}</p>
    </li>`;
  }).join('');

  const reviewLine = review.status && review.status !== 'NONE'
    ? `${esc(review.by || 'C')} · ${esc(review.status)}${review.at ? ' · ' + esc(review.at) : ''}`
    : 'No current C review stamp';

  return `<section class="tqqq-watcher" id="tqqq-watcher">
    <div class="tqw-head">
      <div>
        <p class="tqw-kicker">Agentic ••••2775 · TQQQ watcher</p>
        <h2 class="tqw-title">TQQQ Bottoming Watch</h2>
      </div>
      <div class="tqw-fresh tqw-${f.stale ? 'stale' : 'live'}"><span>Data status</span><b>${esc(f.label)}</b></div>
    </div>

    <div class="tqw-grid">
      <article class="tqw-card">
        <span>Live price</span>
        <b>${f.stale ? '<i class="tqw-dim">— (stale)</i>' : money(priceLast)}</b>
        <small>${esc(f.stale ? 'Awaiting fresh observation' : ('as of ' + (state.price?.asOf || 'unknown')))}</small>
      </article>
      <article class="tqw-card">
        <span>Primary zone</span><b>${esc(zonePrimary)}</b>
        <small>Deeper ${esc(zoneDeeper)} · ${esc(zone.note || '')}</small>
      </article>
      <article class="tqw-card">
        <span>Agentic holdings</span><b>${esc(String(holdings.shares ?? 0))} sh</b>
        <small>Avg cost ${money(holdings.avgDeployedCost)} · −12% halt ${money(holdings.haltTriggerPrice)}</small>
      </article>
      <article class="tqw-card">
        <span>Order state</span><b>${esc(order.state || 'NONE')}</b>
        <small>${esc(order.detail || '')}</small>
      </article>
    </div>

    <div class="tqw-gates-head">Confirmation gates <em>(all must pass before an order is presented for approval)</em></div>
    <ul class="tqw-gates">${gates}</ul>

    <div class="tqw-foot">
      <div class="tqw-review"><span>Independent review</span><b>${esc(reviewLine)}</b></div>
      <div class="tqw-policy"><span>Policy</span><b>${esc(policy.entryRule || '')}</b><small>${esc(policy.haltRule || '')} · ${esc(policy.approval || '')}</small></div>
    </div>
  </section>`;
}

function renderTqqqWatcherStyle() {
  return `<style id="tqqq-watcher-style">
.tqqq-watcher{border-top:1px solid var(--rule);padding:48px clamp(18px,4vw,56px);background:#ffffff}
.tqw-head{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:24px}
.tqw-kicker{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 8px}
.tqw-title{font-size:clamp(28px,3.2vw,52px);line-height:.96;letter-spacing:-.05em;font-weight:500;margin:0}
.tqw-fresh{border:1px solid var(--rule);padding:10px 14px;text-align:right;min-width:200px}
.tqw-fresh span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:4px}
.tqw-fresh b{font-size:14px;font-weight:600}
.tqw-fresh.tqw-stale{border-color:var(--neg,#9f3f35);background:rgba(159,63,53,.06)}
.tqw-fresh.tqw-stale b{color:var(--neg,#9f3f35)}
.tqw-fresh.tqw-live{border-color:var(--pos,#2f6f4e);background:rgba(47,111,78,.05)}
.tqw-fresh.tqw-live b{color:var(--pos,#2f6f4e)}
.tqw-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:22px}
.tqw-card{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px}
.tqw-card span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.tqw-card b{display:block;font-size:24px;letter-spacing:-.04em;font-weight:500;margin:8px 0 4px}
.tqw-card small{display:block;color:var(--muted);font-size:12px;line-height:1.35}
.tqw-dim{color:var(--muted);font-style:normal}
.tqw-gates-head{font-size:13px;color:var(--muted);margin-bottom:10px}
.tqw-gates-head em{font-style:normal}
.tqw-gates{list-style:none;padding:0;margin:0 0 22px;display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px}
.tqw-gate{border:1px solid var(--rule);padding:12px 14px}
.tqw-gate-top{display:flex;align-items:baseline;gap:10px}
.tqw-gate-top b{font-size:14px}
.tqw-gate-top span{font-size:12px;color:var(--muted)}
.tqw-gate-detail{font-size:12px;color:var(--muted);margin:6px 0 0;line-height:1.35}
.tqw-pass{box-shadow:inset 4px 0 0 var(--pos,#2f6f4e)}
.tqw-pass b{color:var(--pos,#2f6f4e)}
.tqw-fail{box-shadow:inset 4px 0 0 var(--neg,#9f3f35)}
.tqw-fail b{color:var(--neg,#9f3f35)}
.tqw-unknown{box-shadow:inset 4px 0 0 rgba(36,35,31,.3)}
.tqw-unknown b{color:var(--muted)}
.tqw-foot{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;border-top:1px solid var(--rule);padding-top:16px}
.tqw-foot span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:5px}
.tqw-foot b{font-size:14px;font-weight:500;line-height:1.3}
.tqw-foot small{display:block;color:var(--muted);font-size:12px;margin-top:5px;line-height:1.35}
@media(max-width:700px){.tqw-head{display:block}.tqw-fresh{margin-top:12px;text-align:left}}
</style>`;
}

module.exports = { renderTqqqWatcherModule, renderTqqqWatcherStyle };
