const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];

function statusClass(value) {
  const s = String(value || '').toLowerCase();
  if (s.includes('contradict')) return 'bad';
  if (s.includes('confirm')) return 'good';
  return 'warn';
}

function renderSummaryStrip(summary = {}) {
  const rows = [
    ['Confirming', summary.confirming ?? 0],
    ['Contradicting', summary.contradicting ?? 0],
    ['Neutral', summary.neutral ?? 0],
    ['Stale', summary.stale_sources ?? 0],
    ['Blocked', summary.blocked_sources ?? 0],
  ];
  return rows.map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');
}

function renderSignalRow(signal) {
  return `<article class="tape-row">
    <span class="pill ${statusClass(signal.confirmation_status)}">${esc(signal.confirmation_status)}</span>
    <b>${esc(signal.signal)}</b>
    <span>${esc(signal.value)}</span>
    <span>${esc(signal.affected_thesis)}</span>
  </article>`;
}

function renderTapeBoard(signals) {
  const header = '<article class="tape-head"><span>Status</span><span>Signal</span><span>Value</span><span>Affects</span></article>';
  return `<div class="tape-board">${header}${arr(signals).map(renderSignalRow).join('')}</div>`;
}

function renderMarketTapeSection(state) {
  return `<section id="market-section" class="panel">
    <div class="section-head"><div><p class="eyebrow">Market Tape</p><h2>Confirmation board</h2></div><a class="button" href="outputs/market-tape-state.json">Open artifact</a></div>
    <div class="trust-strip">${renderSummaryStrip(state.summary || {})}</div>
    ${renderTapeBoard(state.signals)}
  </section>`;
}

function renderMarketTapeStyle() {
  return `<style>.tape-board{border-left:1px solid var(--rule);border-top:1px solid var(--rule);margin-top:14px}.tape-head,.tape-row{display:grid;grid-template-columns:1fr .8fr 1.2fr 1.6fr;gap:10px;align-items:center;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px}.tape-head{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.tape-row b{font-size:18px}.tape-row span{font-size:12px;line-height:1.25}@media(max-width:850px){.tape-head,.tape-row{grid-template-columns:1fr 1fr}.tape-head span:nth-child(n+3),.tape-row span:nth-child(n+4){display:none}}</style>`;
}

module.exports = { renderMarketTapeSection, renderMarketTapeStyle, statusClass };
