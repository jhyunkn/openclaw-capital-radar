function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function fmt(v, decimals = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtShares(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return n % 1 === 0 ? String(n) : n.toLocaleString('en-US', { maximumFractionDigits: 4 });
}

function fmtGain(gain, pct) {
  const gn = Number(gain);
  const pn = Number(pct);
  if (!Number.isFinite(gn)) return '—';
  const sign = gn >= 0 ? '+' : '';
  const pctStr = Number.isFinite(pn) ? ` (${sign}${pn.toFixed(1)}%)` : '';
  return `${sign}${fmt(gn, 0)}${pctStr}`;
}

function signalTone(signal) {
  const s = String(signal || '').toLowerCase();
  if (/exit|loss/.test(s)) return 'exit';
  if (/trim|sell/.test(s)) return 'trim';
  if (/investigate|review/.test(s)) return 'warn';
  if (/hold/.test(s)) return 'hold';
  return 'neutral';
}

function renderRobinhoodExecutionBridgeModule(state = {}) {
  const portfolio = state.portfolio || {};
  const positions = arr(state.positions);
  const syncedAt = state.syncedAt ? new Date(state.syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : null;

  const totalCostBasis = positions.reduce((s, p) => s + (p.totalCostBasis ?? 0), 0);
  const totalCurrentValue = positions.reduce((s, p) => s + (p.currentValue ?? 0), 0);
  const totalGain = totalCurrentValue - totalCostBasis;
  const totalGainPct = totalCostBasis > 0 ? (totalGain / totalCostBasis) * 100 : 0;
  const totalGainSign = totalGain >= 0 ? '+' : '';

  const portfolioStats = [
    { label: 'Portfolio', value: fmt(portfolio.totalValue) },
    { label: 'Equity', value: fmt(portfolio.equityValue) },
    { label: 'Cash', value: fmt(portfolio.cash) },
    { label: 'Positions', value: String(portfolio.positionCount ?? positions.length) },
  ].map(s => `<span class="rh-lh-stat"><b>${esc(s.value)}</b><small>${esc(s.label)}</small></span>`).join('');

  const rows = positions.map(pos => {
    const tone = signalTone(pos.signal);
    const gainClass = (pos.unrealizedGain ?? 0) >= 0 ? 'gain' : 'loss';
    return `<tr>
      <td class="rh-lh-ticker">${esc(pos.symbol)}</td>
      <td class="num">${esc(fmtShares(pos.shares))}</td>
      <td class="num">${esc(fmt(pos.avgCostPrice, 2))}</td>
      <td class="num">${esc(fmt(pos.totalCostBasis))}</td>
      <td class="num">${esc(fmt(pos.livePrice, 2))}</td>
      <td class="num">${esc(fmt(pos.currentValue))}</td>
      <td class="num ${gainClass}">${esc(fmtGain(pos.unrealizedGain, pos.unrealizedPct))}</td>
      <td><span class="rh-lh-signal ${tone}">${esc(pos.signal || '—')}</span></td>
    </tr>`;
  }).join('');

  const totalGainClass = totalGain >= 0 ? 'gain' : 'loss';
  const footer = `<tr class="rh-lh-total">
    <td colspan="3">Total</td>
    <td class="num">${fmt(totalCostBasis)}</td>
    <td>—</td>
    <td class="num">${fmt(totalCurrentValue)}</td>
    <td class="num ${totalGainClass}">${totalGainSign}${fmt(totalGain)} (${totalGainSign}${totalGainPct.toFixed(1)}%)</td>
    <td>—</td>
  </tr>`;

  const footnote = syncedAt ? `Synced from Robinhood on ${esc(syncedAt)} · Prices from Capital Radar live state` : 'Prices from Capital Radar live state';

  return `<div id="robinhood-execution-bridge-module" class="rh-live-holdings" aria-labelledby="rh-lh-title">
  <div class="rh-lh-head">
    <div>
      <p class="eyebrow">Robinhood · Live</p>
      <h3 id="rh-lh-title">Live holdings</h3>
    </div>
    <div class="rh-lh-portfolio">${portfolioStats}</div>
  </div>
  <div class="rh-lh-table-wrap">
    <table class="rh-lh-table">
      <thead>
        <tr>
          <th>Ticker</th><th class="num">Shares</th><th class="num">Avg Cost</th><th class="num">Cost Basis</th><th class="num">Price</th><th class="num">Value</th><th class="num">P&amp;L</th><th>Signal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>${footer}</tfoot>
    </table>
  </div>
  <p class="rh-lh-footnote">${footnote}</p>
</div>`;
}

function renderRobinhoodExecutionBridgeStyle() {
  return `<style id="robinhood-execution-bridge-style">
.rh-live-holdings{margin-top:18px;border:1px solid var(--rule,rgba(27,31,36,.14));background:#f8faf7;color:#171b17;padding:20px;border-radius:8px}
.rh-lh-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px;margin-bottom:16px;flex-wrap:wrap}
.rh-live-holdings h3{margin:0;font-size:22px;line-height:1.14;letter-spacing:0;color:#171b17}
.rh-live-holdings .eyebrow{margin:0 0 6px;font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(36,35,31,.5)}
.rh-lh-portfolio{display:flex;gap:18px;flex-wrap:wrap;align-items:flex-end}
.rh-lh-stat{display:flex;flex-direction:column;min-width:52px}
.rh-lh-stat b{font-size:18px;font-weight:500;letter-spacing:-.03em;color:rgba(36,35,31,.9)}
.rh-lh-stat small{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:rgba(36,35,31,.45);margin-top:1px}
.rh-lh-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
.rh-lh-table{width:100%;border-collapse:collapse;font-size:13px}
.rh-lh-table th{text-align:left;font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:rgba(36,35,31,.5);padding:0 8px 8px 0;border-bottom:1px solid rgba(27,31,36,.14);white-space:nowrap;font-weight:500}
.rh-lh-table th.num,.rh-lh-table td.num{text-align:right}
.rh-lh-table td{padding:8px 8px 8px 0;border-bottom:1px solid rgba(27,31,36,.07);color:#2a2e29;vertical-align:middle;white-space:nowrap}
.rh-lh-table tbody tr:last-child td{border-bottom:none}
.rh-lh-ticker{font-weight:600;font-size:13px;letter-spacing:.01em;color:#171b17}
.rh-lh-table td.gain{color:#157447;font-weight:500}
.rh-lh-table td.loss{color:#b13b31;font-weight:500}
.rh-lh-total td{font-weight:600;border-top:1px solid rgba(27,31,36,.18);border-bottom:none;padding-top:10px;color:#171b17}
.rh-lh-signal{display:inline-block;font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;padding:2px 6px;border-radius:3px;white-space:nowrap}
.rh-lh-signal.hold{background:rgba(27,31,36,.07);color:#4a4e47}
.rh-lh-signal.warn{background:rgba(245,158,11,.12);color:#92600a}
.rh-lh-signal.trim{background:rgba(245,120,11,.12);color:#924000}
.rh-lh-signal.exit{background:rgba(177,59,49,.1);color:#b13b31}
.rh-lh-signal.neutral{background:rgba(27,31,36,.05);color:rgba(27,31,36,.5)}
.rh-lh-footnote{margin:14px 0 0;font-size:11px;color:rgba(36,35,31,.45)}
@media(max-width:700px){.rh-lh-head{flex-direction:column}.rh-lh-portfolio{gap:12px}}
</style>`;
}

module.exports = {
  renderRobinhoodExecutionBridgeModule,
  renderRobinhoodExecutionBridgeStyle,
};
