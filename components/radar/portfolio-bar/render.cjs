'use strict';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const arr = v => Array.isArray(v) ? v : [];

function fmtDollar(v, decimals = 0) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  const abs = Math.abs(n).toLocaleString('en-US', { maximumFractionDigits: decimals });
  return (n < 0 ? '-$' : '$') + abs;
}

function fmtPct(v, sign = true) {
  if (v == null || !Number.isFinite(Number(v))) return '—';
  const n = Number(v);
  return (sign && n > 0 ? '+' : '') + n.toFixed(2) + '%';
}

function signCls(v) {
  if (v == null) return '';
  return Number(v) >= 0 ? 'pb-up' : 'pb-dn';
}

function renderPortfolioBar(state) {
  if (!state || !state.portfolio) return '';

  const p   = state.portfolio;
  const sum = state.summary || {};
  const aq  = arr(sum.actionQueue);

  const actionBadges = aq.map(item => {
    const cls = item.signalClass === 'exit'        ? 'pb-exit'
              : item.signalClass === 'trim'         ? 'pb-trim'
              : item.signalClass === 'investigate'  ? 'pb-inv'
              : 'pb-watch';
    return `<span class="pb-action-badge ${cls}"><b>${esc(item.symbol)}</b>&thinsp;${esc(item.signal)}</span>`;
  }).join('');

  const asOf = state.fetchedAt
    ? new Date(state.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }) + ' · ' +
      new Date(state.fetchedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  const dayChangeCls  = signCls(sum.totalDayChange);
  const unrealCls     = signCls(sum.totalUnrealizedGain);

  return `<div id="portfolio-bar" class="pb-bar">
  <div class="pb-wrap">
    <div class="pb-tiles">
      <div class="pb-tile">
        <span class="pb-label">Portfolio</span>
        <b class="pb-val">${esc(fmtDollar(p.totalValue))}</b>
      </div>
      <div class="pb-tile">
        <span class="pb-label">Today</span>
        <b class="pb-val ${dayChangeCls}">${esc(fmtDollar(sum.totalDayChange))} <span class="pb-pct">${esc(fmtPct(sum.totalDayChangePct))}</span></b>
      </div>
      <div class="pb-tile">
        <span class="pb-label">Unrealized P&amp;L</span>
        <b class="pb-val ${unrealCls}">${esc(fmtDollar(sum.totalUnrealizedGain))} <span class="pb-pct">${esc(fmtPct(sum.totalUnrealizedPct))}</span></b>
      </div>
      <div class="pb-tile">
        <span class="pb-label">Buying power</span>
        <b class="pb-val">${esc(fmtDollar(p.buyingPower))}</b>
      </div>
      <div class="pb-tile">
        <span class="pb-label">Positions</span>
        <b class="pb-val">${esc(p.positionCount)}</b>
      </div>
    </div>
    ${aq.length ? `<div class="pb-actions"><span class="pb-actions-label">Action queue</span>${actionBadges}</div>` : ''}
    ${asOf ? `<span class="pb-timestamp">${esc(asOf)}</span>` : ''}
  </div>
</div>`;
}

function renderPortfolioBarStyle() {
  return `<style id="portfolio-bar-style">
.pb-bar{background:rgba(26,23,20,.032);border-bottom:1px solid rgba(201,191,173,.32);padding:10px 0}
.pb-wrap{width:min(1240px,calc(100% - 48px));margin:0 auto;display:flex;align-items:center;flex-wrap:wrap;gap:12px}
.pb-tiles{display:flex;flex-wrap:wrap;gap:20px;align-items:center;flex:1;min-width:0}
.pb-tile{display:flex;flex-direction:column;gap:2px}
.pb-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-family:var(--mono,monospace)}
.pb-val{font-size:14px;font-weight:600;letter-spacing:-.025em;color:rgba(36,35,31,.9);display:flex;align-items:baseline;gap:5px}
.pb-pct{font-size:11px;font-weight:500;letter-spacing:-.01em}
.pb-up{color:var(--green,#2f6f4e)!important}
.pb-dn{color:var(--red,#9f3f35)!important}
.pb-actions{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.pb-actions-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(36,35,31,.35);font-family:var(--mono,monospace);margin-right:2px}
.pb-action-badge{font-size:10px;padding:2px 9px;border-radius:2px;border:1px solid;white-space:nowrap;font-family:var(--mono,monospace)}
.pb-action-badge b{font-weight:700;margin-right:3px}
.pb-exit{color:#c62828;background:rgba(220,38,38,.07);border-color:rgba(220,38,38,.2)}
.pb-trim{color:var(--warn,#8a6a2c);background:rgba(138,106,44,.07);border-color:rgba(138,106,44,.2)}
.pb-inv{color:rgba(64,95,159,.9);background:rgba(64,95,159,.07);border-color:rgba(64,95,159,.2)}
.pb-watch{color:var(--muted);background:transparent;border-color:var(--rule)}
.pb-timestamp{font-size:9px;color:rgba(36,35,31,.3);font-family:var(--mono,monospace);white-space:nowrap;margin-left:auto}
@media(max-width:760px){.pb-tiles{gap:14px}.pb-timestamp{display:none}}
</style>`;
}

module.exports = { renderPortfolioBar, renderPortfolioBarStyle };
