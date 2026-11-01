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

function sourceTime(value) {
  if (!value) return 'missing';
  const date = new Date(value);
  return Number.isFinite(date.getTime())
    ? date.toLocaleString('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })
    : String(value);
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
  const decision = state.decision || {};
  const market = state.market || {};
  const approval = state.approval || {};
  const sources = arr(state.sources);

  const priceLast = f.stale ? null : state.price?.last;
  const zonePrimary = (primary.low != null && primary.high != null) ? `${money(primary.low)}–${money(primary.high)}` : '—';
  const zoneDeeper = (deeper.low != null && deeper.high != null) ? `${money(deeper.low)}–${money(deeper.high)}` : '—';

  // Deployable cash and the resulting next tranche (entry rule = deploy
  // deployFraction of available cash). Shown so an order can be sized, not
  // just triggered. Fail closed: no fresh price means no share estimate.
  const sizing = state.sizing || {};
  const cash = Number(sizing.availableCash);
  const frac = Number(sizing.deployFraction) > 0 ? Number(sizing.deployFraction) : 0.5;
  const trancheDollars = Number.isFinite(cash) ? cash * frac : NaN;
  const trancheShares = (!f.stale && Number.isFinite(trancheDollars) && Number(priceLast) > 0)
    ? Math.floor(trancheDollars / Number(priceLast)) : null;
  const cashText = Number.isFinite(cash) ? money(cash) : '—';
  const trancheText = Number.isFinite(trancheDollars) ? money(trancheDollars) : '—';

  // Distance from live price to the top of the primary trigger zone.
  let distText = 'Awaiting fresh price';
  if (!f.stale && Number(priceLast) > 0 && primary.high != null) {
    const pct = ((Number(priceLast) - Number(primary.high)) / Number(primary.high)) * 100;
    const sign = pct >= 0 ? '+' : '';
    distText = pct >= 0
      ? `${sign}${pct.toFixed(1)}% above zone top (${money(primary.high)})`
      : `${pct.toFixed(1)}% — in/below zone`;
  }
  const distBig = (!f.stale && Number(priceLast) > 0 && primary.high != null)
    ? `${(((Number(priceLast) - Number(primary.high)) / Number(primary.high)) * 100).toFixed(1)}%`
    : '<i class="tqw-dim">— (stale)</i>';

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

  const action = String(decision.action || 'WAIT').toUpperCase();
  const actionReason = decision.blocker || decision.summary || state.staleReason || 'Awaiting a fresh market observation.';
  const regime = String(decision.regime || 'UNKNOWN').toUpperCase();
  const marketStatus = String(market.status || 'UNKNOWN').toUpperCase();
  const approvalStatus = approval.status || (approval.authorized ? 'AUTHORIZED' : 'NOT AUTHORIZED');
  const sourceRows = sources.length
    ? sources.map(source => `<li><b>${esc(source.label || source.id || 'Source')}</b><span>${esc(source.status || 'UNKNOWN')} · ${esc(sourceTime(source.asOf))}</span></li>`).join('')
    : '<li><b>Sources</b><span>Missing</span></li>';

  return `<section class="tqqq-watcher" id="tqqq-watcher">
    <div class="tqw-head">
      <div>
        <p class="tqw-kicker">Agentic ••••2775 · TQQQ watcher</p>
        <h2 class="tqw-title">TQQQ Bottoming Watch</h2>
      </div>
      <div class="tqw-fresh tqw-${f.stale ? 'stale' : 'live'}"><span>Data status</span><b>${esc(f.label)}</b></div>
    </div>

    <div class="tqw-grid">
      <article class="tqw-card tqw-decision">
        <span>Current action</span><b>${esc(action)}</b>
        <small>${esc(actionReason)}</small>
      </article>
      <article class="tqw-card">
        <span>Regime / market</span><b>${esc(regime)}</b>
        <small>${esc(marketStatus)}${market.session ? ' · session ' + esc(market.session) : ''}</small>
      </article>
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
        <span>Distance to zone</span><b>${distBig}</b>
        <small>${esc(distText)}</small>
      </article>
      <article class="tqw-card">
        <span>Deployable cash</span><b>${esc(cashText)}</b>
        <small>Next tranche ${esc(trancheText)} (${Math.round(frac * 100)}%)${trancheShares != null ? ' · ≈' + trancheShares + ' sh' : ''}</small>
      </article>
      <article class="tqw-card">
        <span>Order state</span><b>${esc(order.state || 'NONE')}</b>
        <small>${esc(order.detail || '')}</small>
      </article>
      <article class="tqw-card">
        <span>Jun approval</span><b>${esc(approvalStatus)}</b>
        <small>${esc(approval.detail || 'A fresh approval is required before every order submission.')}</small>
      </article>
    </div>

    <div class="tqw-gates-head">Confirmation gates <em>(all must pass before an order is presented for approval)</em></div>
    <ul class="tqw-gates">${gates}</ul>

    <div class="tqw-foot">
      <div class="tqw-review"><span>Independent review</span><b>${esc(reviewLine)}</b></div>
      <div class="tqw-policy"><span>Policy</span><b>${esc(policy.entryRule || '')}</b><small>${esc(policy.haltRule || '')} · ${esc(policy.approval || '')}</small></div>
      <div class="tqw-blueprint"><span>System blueprint</span><b><a href="/pages/tqqq-strategy.html">How TQQQ is invested here — PARTIAL-ROT 30% rule, evidence, live grade</a></b><small>Machine-readable spec: <a href="/data/tqqq-strategy.json">data/tqqq-strategy.json</a> · the watcher above hunts intraday bottoms; the blueprint is the monthly position system. Do not merge them.</small></div>
    </div>
    <div class="tqw-evidence">
      <div><span>Evidence fingerprint</span><b>${esc(state.fingerprint || 'not available')}</b><small>C's review is valid only for this exact fingerprint and freshness state.</small></div>
      <ul>${sourceRows}</ul>
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
.tqw-decision{background:rgba(36,35,31,.025)}
.tqw-evidence{display:grid;grid-template-columns:minmax(220px,.7fr) minmax(280px,1.3fr);gap:18px;border-top:1px solid var(--rule);margin-top:16px;padding-top:16px}
.tqw-evidence>div>span{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:5px}
.tqw-evidence>div>b{display:block;font-size:12px;overflow-wrap:anywhere}
.tqw-evidence>div>small{display:block;color:var(--muted);font-size:11px;margin-top:5px;line-height:1.35}
.tqw-evidence ul{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}
.tqw-evidence li{border-left:2px solid var(--rule);padding-left:10px}
.tqw-evidence li b,.tqw-evidence li span{display:block;font-size:11px;line-height:1.35}
.tqw-evidence li span{color:var(--muted)}
@media(max-width:700px){.tqw-head{display:block}.tqw-fresh{margin-top:12px;text-align:left}}
@media(max-width:700px){.tqw-evidence{grid-template-columns:1fr}}
</style>`;
}

module.exports = { renderTqqqWatcherModule, renderTqqqWatcherStyle };
