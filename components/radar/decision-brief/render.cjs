const { normalizeDataPoint, formatDataPoint } = require('../../../scripts/data-truth-contract.cjs');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];
const num = value => Number.isFinite(Number(value)) ? Number(value) : null;

function badge(type) {
  const tier = String(type || 'MISSING').toUpperCase();
  return `<span class="brief-badge ${tier.toLowerCase()}">${esc(tier)}</span>`;
}

function macroDigits(item) {
  return item.key === 'spx' || item.key === 'm2' || item.key === 'confirmation' ? 0 : 2;
}

function renderMacroValues(state) {
  return arr(state.macro_values).map(item => {
    const normalized = normalizeDataPoint(item);
    const unit = normalized.unit && normalized.unit !== 'index' && normalized.truthTier !== 'MISSING' && normalized.truthTier !== 'STALE'
      ? ` ${esc(normalized.unit)}`
      : '';
    const value = formatDataPoint(normalized, macroDigits(normalized));
    const sourceParts = [normalized.source || '', normalized.sourceTime ? `as of ${normalized.sourceTime}` : ''].filter(Boolean);
    const articleClass = normalized.truthTier === 'MISSING' || normalized.truthTier === 'STALE'
      ? ' class="data-impaired"'
      : '';
    return `<article${articleClass}><span>${esc(normalized.label)} ${badge(normalized.truthTier)}</span><b>${esc(value)}${unit}</b><small>${esc(sourceParts.join(' · '))}</small></article>`;
  }).join('');
}

function renderRuleStrip(state) {
  const rows = [
    ['Portfolio action', state.portfolio_action],
    ['Change rule', state.change_rule],
    ['Risk rule', state.risk_rule || '—'],
  ];
  return rows.map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');
}

function renderDecisionBriefSection(state) {
  return `<section id="decision-brief-section" class="panel decision-brief-panel">
    <div class="section-head"><div><p class="eyebrow">Market Decision Brief</p><h2>What the chart and macro tape are saying</h2></div><a class="button" href="outputs/market-decision-brief-state.json">Open brief state</a></div>
    <p class="decision-brief-text">${esc(state.brief)}</p>
    ${state.confirmation_read ? `<p class="confirmation-read">${esc(state.confirmation_read)}</p>` : ''}
    <div class="macro-value-grid">${renderMacroValues(state)}</div>
    <div class="rule-strip">${renderRuleStrip(state)}</div>
  </section>`;
}

function renderDecisionBriefStyle() {
  return `<style>.decision-brief-panel{margin-top:22px}.decision-brief-text{font-size:18px;line-height:1.45;max-width:1100px;margin:12px 0 8px}.confirmation-read{color:var(--muted);font-size:13px;line-height:1.35;margin:0 0 16px}.macro-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;margin:12px 0}.macro-value-grid article,.rule-strip article{border:1px solid var(--rule);border-radius:14px;background:rgba(251,250,246,.12);padding:11px}.macro-value-grid article.data-impaired{border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.08)}.macro-value-grid span,.rule-strip span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.08em}.macro-value-grid b{display:block;font-size:22px;margin-top:4px}.macro-value-grid small{display:block;color:var(--muted);font-size:10px;margin-top:4px;line-height:1.25}.brief-badge{display:inline-block;font-size:8px;font-weight:700;padding:1px 4px;border-radius:4px;margin-left:3px;vertical-align:middle}.brief-badge.real{background:rgba(47,111,78,.16);color:var(--green);border:1px solid rgba(47,111,78,.38)}.brief-badge.derived{background:rgba(47,111,78,.12);color:var(--green);border:1px solid rgba(47,111,78,.30)}.brief-badge.est{background:rgba(174,124,44,.16);color:var(--warn);border:1px solid rgba(174,124,44,.38)}.brief-badge.proj{background:rgba(251,250,246,.10);color:var(--muted);border:1px solid var(--rule)}.brief-badge.missing,.brief-badge.stale{background:rgba(159,63,53,.16);color:var(--red);border:1px solid rgba(159,63,53,.42)}.rule-strip{display:grid;grid-template-columns:1fr 1.4fr 1.4fr;gap:8px;margin-top:10px}.rule-strip b{display:block;font-size:13px;line-height:1.35;margin-top:4px}@media(max-width:900px){.rule-strip{grid-template-columns:1fr}.decision-brief-text{font-size:16px}}</style>`;
}

module.exports = { renderDecisionBriefSection, renderDecisionBriefStyle, renderMacroValues, renderRuleStrip };
