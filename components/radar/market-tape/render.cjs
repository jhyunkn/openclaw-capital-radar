const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];

function statusClass(value) {
  const s = String(value || '').toLowerCase();
  if (s.includes('contradict')) return 'bad';
  if (s.includes('confirm')) return 'good';
  if (s.includes('blocked') || s.includes('stale')) return 'bad';
  return 'warn';
}

function statusLabel(value) {
  const s = String(value || '').toLowerCase();
  if (s.includes('contradict')) return 'Contradicts';
  if (s.includes('confirm')) return 'Supports';
  if (s.includes('blocked')) return 'Blocked';
  if (s.includes('stale')) return 'Stale';
  return 'Neutral / verify';
}

function signalGroup(signals, predicate) {
  return arr(signals).filter(predicate);
}

function renderSummaryStrip(summary = {}) {
  const rows = [
    ['Supports', summary.confirming ?? 0, 'signals confirming strategy', 'good'],
    ['Contradicts', summary.contradicting ?? 0, 'signals arguing against strategy', 'bad'],
    ['Neutral', summary.neutral ?? 0, 'signals requiring interpretation', 'warn'],
    ['Stale', summary.stale_sources ?? 0, 'stale source layers', summary.stale_sources ? 'bad' : 'warn'],
    ['Blocked', summary.blocked_sources ?? 0, 'blocked source layers', summary.blocked_sources ? 'bad' : 'warn'],
  ];
  return rows.map(([label, value, note, cls]) => `<article class="${cls}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(note)}</small></article>`).join('');
}

function marketRead(summary = {}) {
  const confirming = Number(summary.confirming || 0);
  const contradicting = Number(summary.contradicting || 0);
  const neutral = Number(summary.neutral || 0);
  if (contradicting > confirming) return 'Tape is mixed with active contradiction; route should stay selective and avoid automatic adds.';
  if (confirming > contradicting && neutral <= confirming + 2) return 'Tape supports the current strategy, but individual signals still require source and price-zone confirmation.';
  return 'Tape is mostly neutral; it should qualify the macro read rather than drive capital decisions by itself.';
}

function renderSignalRow(signal) {
  const cls = statusClass(signal.confirmation_status);
  return `<article class="tape-row ${cls}">
    <span class="pill ${cls}">${esc(statusLabel(signal.confirmation_status))}</span>
    <b>${esc(signal.signal)}</b>
    <span>${esc(signal.value)}</span>
    <span>${esc(signal.affected_thesis)}</span>
  </article>`;
}

function renderSignalMini(signal) {
  const cls = statusClass(signal.confirmation_status);
  return `<li class="${cls}"><b>${esc(signal.signal)}</b><span>${esc(signal.value)}</span></li>`;
}

function renderEvidenceBalance(state) {
  const signals = arr(state.signals);
  const supports = signalGroup(signals, s => statusClass(s.confirmation_status) === 'good');
  const contradicts = signalGroup(signals, s => statusClass(s.confirmation_status) === 'bad');
  const neutral = signalGroup(signals, s => statusClass(s.confirmation_status) === 'warn');
  const list = items => items.length ? `<ul>${items.slice(0, 4).map(renderSignalMini).join('')}</ul>` : '<p>No active signal in this bucket.</p>';
  return `<div class="tape-balance-grid">
    <article><div><span class="dot good"></span><b>Supports</b></div>${list(supports)}</article>
    <article><div><span class="dot bad"></span><b>Contradicts</b></div>${list(contradicts)}</article>
    <article><div><span class="dot warn"></span><b>Neutral / verify</b></div>${list(neutral)}</article>
  </div>`;
}

function renderTapeBoard(signals) {
  const header = '<article class="tape-head"><span>Status</span><span>Signal</span><span>Value</span><span>Affects</span></article>';
  return `<details class="tape-detail"><summary>Inspect all market tape signals</summary><div class="tape-board">${header}${arr(signals).map(renderSignalRow).join('')}</div></details>`;
}

function renderMarketTapeSection(state) {
  return `<section id="market-section" class="panel market-tape-panel">
    <div class="section-head"><div><p class="eyebrow">Market Tape</p><h2>Evidence balance board</h2></div><a class="button" href="outputs/market-tape-state.json">Open artifact</a></div>
    <div class="tape-read">
      <div>
        <p class="tape-kicker">Tape interpretation</p>
        <p>${esc(marketRead(state.summary || {}))}</p>
      </div>
      <aside>
        <span>Required coverage</span>
        <b>Rates · liquidity · volatility · BTC · oil · credit spread · signal</b>
        <small>Market Tape should confirm, contradict, or qualify the macro read. It should not create a strategy alone.</small>
      </aside>
    </div>
    <div class="trust-strip tape-summary-strip">${renderSummaryStrip(state.summary || {})}</div>
    ${renderEvidenceBalance(state)}
    ${renderTapeBoard(state.signals)}
  </section>`;
}

function renderMarketTapeStyle() {
  return `<style>.market-tape-panel{margin-top:22px;background:linear-gradient(180deg,rgba(251,250,246,.18),rgba(251,250,246,.08))}.tape-read{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(280px,.8fr);gap:10px;margin:14px 0}.tape-read>div,.tape-read aside,.tape-balance-grid article,.tape-detail{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.22);padding:16px}.tape-kicker,.tape-read aside span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin:0 0 10px}.tape-read p{font-size:clamp(18px,2vw,28px);line-height:1.12;letter-spacing:-.035em;margin:0;max-width:920px}.tape-read aside b{display:block;font-size:18px;line-height:1.15;letter-spacing:-.02em}.tape-read aside small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:10px}.tape-summary-strip article.good{border-color:rgba(47,111,78,.36)}.tape-summary-strip article.warn{border-color:rgba(174,124,44,.38)}.tape-summary-strip article.bad{border-color:rgba(159,63,53,.40)}.tape-summary-strip small{display:block;color:var(--muted);font-size:10px;line-height:1.3;margin-top:5px}.tape-balance-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:12px 0}.tape-balance-grid article>div{display:flex;align-items:center;gap:8px;margin-bottom:10px}.tape-balance-grid b{font-size:16px;letter-spacing:-.02em}.tape-balance-grid ul{list-style:none;margin:0;padding:0;display:grid;gap:7px}.tape-balance-grid li{font-size:12px;line-height:1.35;color:rgba(36,35,31,.75);position:relative;padding-left:14px}.tape-balance-grid li:before{content:'';position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:currentColor}.tape-balance-grid li b{display:block;font-size:12px}.tape-balance-grid li span{display:block;color:var(--muted);font-size:11px;margin-top:2px}.tape-balance-grid p{font-size:12px;color:var(--muted);line-height:1.35;margin:0}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.dot.good{background:var(--green)}.dot.warn{background:var(--warn)}.dot.bad{background:var(--red)}.good{color:var(--green)!important}.warn{color:var(--warn)!important}.bad{color:var(--red)!important}.tape-detail{margin-top:10px}.tape-detail summary{cursor:pointer;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.tape-board{border-left:1px solid var(--rule);border-top:1px solid var(--rule);margin-top:14px}.tape-head,.tape-row{display:grid;grid-template-columns:1fr .9fr 1.35fr 1.7fr;gap:10px;align-items:center;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px}.tape-head{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.tape-row b{font-size:16px}.tape-row span{font-size:12px;line-height:1.25}.pill{display:inline-flex;width:max-content;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;font-size:10px;text-transform:uppercase;letter-spacing:.08em}.pill.good{border-color:rgba(47,111,78,.36);background:rgba(47,111,78,.10)}.pill.warn{border-color:rgba(174,124,44,.36);background:rgba(174,124,44,.10)}.pill.bad{border-color:rgba(159,63,53,.36);background:rgba(159,63,53,.10)}@media(max-width:950px){.tape-read,.tape-balance-grid{grid-template-columns:1fr}.tape-head,.tape-row{grid-template-columns:1fr 1fr}.tape-head span:nth-child(n+3),.tape-row span:nth-child(n+4){display:none}}</style>`;
}

module.exports = { renderMarketTapeSection, renderMarketTapeStyle, statusClass };
