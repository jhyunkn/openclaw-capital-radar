'use strict';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = v => Array.isArray(v) ? v : [];
const pct = v => (v == null ? '—' : `${(v * 100).toFixed(2)}%`);
const money = v => (v == null ? '—' : (v >= 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }).replace(/^-/, v < 0 ? '-' : ''));

function verdictClass(verdict) {
  if (/TRADEABLE —/.test(verdict)) return 'arb-v-tradeable';
  if (/THIN/.test(verdict)) return 'arb-v-thin';
  if (/NEGATIVE/.test(verdict)) return 'arb-v-negative';
  return 'arb-v-na';
}

function riskChips(flags) {
  const chips = [];
  if (!flags) return '';
  if (flags.regulatory === 'elevated') chips.push('<span class="arb-chip arb-chip-risk">regulatory elevated</span>');
  if (flags.financing && flags.financing !== 'none-mentioned') chips.push('<span class="arb-chip arb-chip-risk">financing condition</span>');
  if (flags.goShop) chips.push('<span class="arb-chip">go-shop</span>');
  if (flags.shareholderVote === 'pending') chips.push('<span class="arb-chip">shareholder vote pending</span>');
  return chips.join('');
}

function renderDealCard(d) {
  const terms = d.considerationType === 'cash' && d.offerPricePerShare != null
    ? `$${d.offerPricePerShare} cash / share`
    : (d.considerationType === 'stock' || d.considerationType === 'collar') && d.exchangeRatio != null
      ? `${d.exchangeRatio}× ${esc(d.acquirerSymbol || d.acquirer || '')} / share`
      : esc(d.considerationType || 'terms?');
  const capRows = arr(d.capacityTable).map(r =>
    `<tr><td>$${r.notional.toLocaleString()}</td><td>${money(r.expectedGross)}</td><td>${money(r.annualizedGross)}</td></tr>`).join('');
  const closeLine = d.expectedCloseLabel
    ? `${esc(d.expectedCloseLabel)}${d.tradingDaysToClose != null ? ` · ~${d.tradingDaysToClose} trading days` : ''}`
    : 'close date unknown';
  return `<article class="arb-deal-card">
    <header class="arb-deal-head">
      <div>
        <span class="arb-target">${esc(d.targetSymbol || d.target)}</span>
        <span class="arb-target-name">${esc(d.targetName || '')}</span>
      </div>
      <span class="arb-conf arb-conf-${esc(String(d.confidence).toLowerCase())}">${esc(d.confidence)}</span>
    </header>
    <div class="arb-deal-sub">${d.acquirer ? `← ${esc(d.acquirer)}` : 'acquirer unconfirmed'} · ${terms}${d.shortRequired ? ' · <span class="arb-short">short required (borrow data unavailable)</span>' : ''}</div>
    <div class="arb-metrics">
      <div class="arb-metric"><span class="arb-metric-label">Spread</span><span class="arb-metric-value">${pct(d.spreadPct)}</span></div>
      <div class="arb-metric"><span class="arb-metric-label">Annualized</span><span class="arb-metric-value">${pct(d.annualizedSpreadPct)}</span></div>
      <div class="arb-metric"><span class="arb-metric-label">Target px</span><span class="arb-metric-value">${d.targetPrice != null ? '$' + d.targetPrice : '—'}</span></div>
      <div class="arb-metric"><span class="arb-metric-label">Close</span><span class="arb-metric-value arb-metric-small">${closeLine}</span></div>
    </div>
    <div class="arb-flags">${riskChips(d.riskFlags)}</div>
    <table class="arb-cap"><thead><tr><th>Notional</th><th>Gross</th><th>Annualized</th></tr></thead><tbody>${capRows}</tbody></table>
    <div class="arb-verdict ${verdictClass(d.verdict || '')}">${esc(d.verdict || '')}</div>
  </article>`;
}

function renderArbDealBoardSection(board, options = {}) {
  // Single source of truth: display counts and cards derive from the VERDICT,
  // not the loose `tradeable` pre-filter boolean on each deal.
  const isTradeableVerdict = d => String(d.verdict || '').startsWith('TRADEABLE');
  const deals = arr(board.deals).filter(isTradeableVerdict).slice(0, 5);
  const allDeals = arr(board.deals);
  const watchlist = arr(board.watchlist);
  const health = board.dataHealth || {};
  const asOf = board.generatedAt
    ? new Date(board.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';
  const healthCls = health.status === 'OK' ? 'arb-health-ok' : health.status === 'PARTIAL' ? 'arb-health-partial' : health.status === 'STALE' ? 'arb-health-stale' : 'arb-health-down';

  const moduleMode = options.module === true;
  const shellOpen = moduleMode
    ? '<div id="arb-deal-board-module" class="arb-section arb-module">'
    : '<section id="arb-deal-board-section" class="panel arb-section">';
  const shellClose = moduleMode ? '</div>' : '</section>';

  const cards = deals.length
    ? deals.map(renderDealCard).join('')
    : `<p class="arb-empty">No tradeable merger-arb spreads on the board right now. ${allDeals.length ? `${allDeals.length} mined deal(s) cleared none of the verdict bars (thin spread, no timeline, negative spread, no terms, no price, or already closed).` : 'The 8-K miner found no qualifying deals in the lookback window.'} Empty is an honest answer — thin spreads are the norm.</p>`;

  return `${shellOpen}
  <div class="arb-wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Merger Arb${asOf ? ` · ${esc(asOf)}` : ''}</p>
        <h2>Arb deal board</h2>
      </div>
      <span class="arb-health ${healthCls}" title="${esc(health.note || '')}">data: ${esc(health.status || '?')}</span>
    </div>
    <div class="arb-summary">${allDeals.length} mined deal(s) · ${deals.length} tradeable · ${watchlist.length} watchlist</div>
    <div class="arb-cards">${cards}</div>
    ${watchlist.length ? `<p class="arb-watchlist">${watchlist.length} low-confidence item(s) on the watchlist — not tradeable.</p>` : ''}
    <p class="arb-footnote">Spreads are gross of $0 commissions. Stock-deal math requires shorting the acquirer; borrow cost/availability is not modeled. Annualization assumes the stated close date holds — it often doesn't.</p>
  </div>
${shellClose}`;
}

function renderArbDealBoardStyle() {
  return `<style id="arb-deal-board-style">
.arb-section { margin: 1.5rem 0; }
.arb-wrap { max-width: 1100px; }
.arb-health { font-size: .75rem; padding: .25rem .6rem; border-radius: 999px; border: 1px solid #888; }
.arb-health-ok { color: #2a6b4a; border-color: #2a6b4a; }
.arb-health-partial { color: #b8860b; border-color: #b8860b; }
.arb-health-stale { color: #a33; border-color: #a33; }
.arb-health-down { color: #fff; background: #a33; border-color: #a33; }
.arb-summary { font-size: .85rem; opacity: .75; margin: .4rem 0 1rem; }
.arb-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem; }
.arb-deal-card { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; background: #fff; }
.arb-deal-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: .25rem; }
.arb-target { font-weight: 700; font-size: 1.2rem; }
.arb-target-name { font-size: .8rem; opacity: .7; margin-left: .4rem; }
.arb-conf { font-size: .7rem; padding: .15rem .5rem; border-radius: 999px; background: #eee; }
.arb-conf-high { background: #dff0d8; } .arb-conf-medium { background: #fcf8e3; } .arb-conf-low { background: #f2dede; } .arb-conf-manual { background: #d9edf7; }
.arb-deal-sub { font-size: .85rem; margin-bottom: .75rem; }
.arb-short { color: #a33; }
.arb-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: .5rem; margin-bottom: .6rem; }
.arb-metric-label { display: block; font-size: .65rem; text-transform: uppercase; opacity: .6; }
.arb-metric-value { font-weight: 600; } .arb-metric-small { font-size: .75rem; font-weight: 400; }
.arb-flags { margin-bottom: .6rem; }
.arb-chip { display: inline-block; font-size: .7rem; padding: .15rem .5rem; border-radius: 999px; background: #eef; margin-right: .3rem; }
.arb-chip-risk { background: #fde8e8; }
.arb-cap { width: 100%; font-size: .8rem; border-collapse: collapse; margin-bottom: .6rem; }
.arb-cap th, .arb-cap td { text-align: right; padding: .2rem .3rem; border-top: 1px solid #eee; }
.arb-cap th:first-child, .arb-cap td:first-child { text-align: left; }
.arb-verdict { font-weight: 700; font-size: .85rem; }
.arb-v-tradeable { color: #2a7; } .arb-v-thin { color: #b8860b; } .arb-v-negative { color: #a33; } .arb-v-na { color: #666; }
.arb-empty { font-size: .9rem; line-height: 1.5; }
.arb-watchlist { font-size: .8rem; opacity: .75; }
.arb-footnote { font-size: .75rem; opacity: .6; margin-top: .8rem; }
</style>`;
}

module.exports = { renderArbDealBoardSection, renderArbDealBoardStyle };
