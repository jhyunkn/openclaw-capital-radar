const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => (Number.isFinite(Number(v)) ? Number(v) : null);
function fmtPct(v, d = 2) { const n = num(v); return n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(d)}%`; }
function fmtBp(v) { const n = num(v); return n == null ? '—' : `${n >= 0 ? '+' : ''}${n.toFixed(0)}bp`; }
function fmtLevel(v, d = 2) { const n = num(v); return n == null ? '—' : n.toFixed(d); }

const SEVERITY = {
  NO_STRESS: 'good',
  DOLLAR_STRENGTH_RIGHT_SIDE: 'info',
  NORMAL_RISK_OFF: 'warn',
  DOLLAR_LIQUIDITY_STRESS: 'bad',
  SELL_AMERICA_STRESS: 'bad',
  DATA_STALE: 'bad'
};

function tile(label, value, sub) {
  return `<article><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(sub)}</small></article>`;
}

function renderDollarStress(state) {
  if (!state || !state.verdict) {
    return `<section class="macro-operating-block dollar-stress-check" data-verdict="DATA_STALE"><div class="macro-block-title"><div><p class="eyebrow">Macro · Dollar stress check</p><h3>Dollar stress: state pending.</h3></div></div><p class="ds-implication">Dollar-stress state has not been generated yet.</p></section>`;
  }
  const i = state.inputs || {};
  const sev = SEVERITY[state.verdict] || 'info';
  const partialNote = state.partial
    ? `<p class="ds-note ds-partial">PARTIAL data: ${esc((state.staleInputs || []).join('; ') || 'one or more rate/credit inputs are stale or missing')} — verdict computed from the remaining inputs, not blocked.</p>`
    : '';
  const tiles = [
    tile('DXY', fmtLevel(i.dxy?.level, 2), `5d ${fmtPct(i.dxy?.change5dPct)} · 20d ${fmtPct(i.dxy?.change20dPct)} · ${esc(i.dxy?.asOf || '')}`),
    tile('SPY', fmtLevel(i.spy?.level, 2), `5d ${fmtPct(i.spy?.change5dPct)} · 20d ${fmtPct(i.spy?.change20dPct)} · ${esc(i.spy?.asOf || '')}`),
    tile('10Y yield', `${fmtLevel(i.dgs10?.levelPct, 2)}%`, `Δ ${fmtBp(i.dgs10?.change5dBp)} since ${esc(i.dgs10?.window5d?.fromDate || '—')} · as of ${esc(i.dgs10?.asOf || '')}`),
    tile('VIX', fmtLevel(i.vix?.level, 2), `5d ${i.vix?.change5dDelta == null ? '—' : `${num(i.vix.change5dDelta) >= 0 ? '+' : ''}${num(i.vix.change5dDelta).toFixed(2)} pts`} · ${esc(i.vix?.asOf || '')}`),
    tile('HY OAS', `${fmtLevel(i.hyOas?.levelPct, 2)}%`, `Δ ${fmtBp(i.hyOas?.change5dBp)} since ${esc(i.hyOas?.window5d?.fromDate || '—')} · as of ${esc(i.hyOas?.asOf || '')}`)
  ].join('');
  return `<section class="macro-operating-block dollar-stress-check" data-verdict="${esc(state.verdict)}"><div class="macro-block-title"><div><p class="eyebrow">Macro · Dollar stress check</p><h3>Is the dollar a haven right now — or is the haven failing?</h3></div><span class="ds-pill ds-${sev}">${esc(state.verdictLabel || state.verdict)}</span></div><div class="ds-tiles">${tiles}</div><p class="ds-implication">${esc(state.implication || '')}</p><p class="ds-note"><b>What changes this:</b> ${esc(state.whatWouldChange || '')}</p>${partialNote}<p class="ds-note">Anchor date ${esc(state.anchorDate || '—')} · inputs: committed Yahoo/FRED caches only · gold ${esc(i.gold?.level == null ? '—' : `$${fmtLevel(i.gold.level, 0)}`)} (5d ${esc(fmtPct(i.gold?.change5dPct))}) shown as the alternative-haven context.</p></section>`;
}

function renderDollarStressStyle() {
  return `<style>.dollar-stress-check{--ds-good:#2f6f4e;--ds-info:#4d6f91;--ds-warn:#ae7c2c;--ds-bad:#9f3f35}.dollar-stress-check .ds-pill{display:inline-block;font-size:11px;font-weight:600;letter-spacing:.02em;border:1px solid var(--rule);border-radius:999px;padding:6px 12px;white-space:nowrap}.dollar-stress-check .ds-good{color:var(--ds-good);border-color:rgba(47,111,78,.45);background:rgba(47,111,78,.08)}.dollar-stress-check .ds-info{color:var(--ds-info);border-color:rgba(77,111,145,.45);background:rgba(77,111,145,.08)}.dollar-stress-check .ds-warn{color:var(--ds-warn);border-color:rgba(174,124,44,.45);background:rgba(174,124,44,.08)}.dollar-stress-check .ds-bad{color:var(--ds-bad);border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.08)}.ds-tiles{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;margin:10px 0}.ds-tiles article{border:1px solid var(--rule);border-radius:16px;background:#ffffff;padding:12px}.ds-tiles span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.1em}.ds-tiles b{display:block;font-size:19px;font-weight:500;letter-spacing:-.02em;margin-top:4px}.ds-tiles small{display:block;color:var(--muted);font-size:10.5px;line-height:1.3;margin-top:5px}.ds-implication{font-size:14px;line-height:1.45;margin:8px 0 4px;max-width:920px}.ds-note{color:var(--muted);font-size:11.5px;line-height:1.4;margin:4px 0;max-width:920px}.ds-partial{color:var(--ds-bad)}@media(max-width:980px){.ds-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.ds-tiles{grid-template-columns:1fr}}</style>`;
}

module.exports = { renderDollarStress, renderDollarStressStyle };
