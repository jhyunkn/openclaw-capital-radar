const { normalizeDataPoint, formatDataPoint } = require('../../../scripts/data-truth-contract.cjs');

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = value => Array.isArray(value) ? value : [];

function badge(type) {
  const tier = String(type || 'MISSING').toUpperCase();
  return `<span class="brief-badge ${tier.toLowerCase()}">${esc(tier)}</span>`;
}

function macroDigits(item) {
  return item.key === 'spx' || item.key === 'm2' || item.key === 'confirmation' ? 0 : 2;
}

function findMacro(state, key) {
  return arr(state.macro_values).find(item => item.key === key) || null;
}

function macroValue(state, key, fallback = '—') {
  const item = findMacro(state, key);
  if (!item) return fallback;
  const normalized = normalizeDataPoint(item);
  const unit = normalized.unit && normalized.unit !== 'index' && normalized.truthTier !== 'MISSING' && normalized.truthTier !== 'STALE'
    ? ` ${esc(normalized.unit)}`
    : '';
  return `${esc(formatDataPoint(normalized, macroDigits(normalized)))}${unit}`;
}

function macroBadge(state, key) {
  const item = findMacro(state, key);
  return item ? badge(normalizeDataPoint(item).truthTier) : '';
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
    ['Change trigger', state.change_rule],
    ['Risk trigger', state.risk_rule || '—'],
  ];
  return rows.map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');
}

function renderCommandTiles(state) {
  const tiles = [
    ['Market regime', state.market_read || '—', 'regime'],
    ['Liquidity / macro', state.macro_read || '—', 'liquidity'],
    ['Portfolio action', state.portfolio_action || '—', 'action'],
    ['Risk line', state.risk_rule || '—', 'risk'],
  ];
  return tiles.map(([label, value, tone]) => `<article class="command-tile ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');
}

function renderKeyMetrics(state) {
  const rows = [
    ['Confirmation', macroValue(state, 'confirmation'), macroBadge(state, 'confirmation')],
    ['S&P 500', macroValue(state, 'spx'), macroBadge(state, 'spx')],
    ['10Y Treasury', macroValue(state, 'dgs10'), macroBadge(state, 'dgs10')],
    ['HY OAS', macroValue(state, 'hy_oas'), macroBadge(state, 'hy_oas')],
  ];
  return rows.map(([label, value, sourceBadge]) => `<article><span>${esc(label)} ${sourceBadge}</span><b>${value}</b></article>`).join('');
}

function renderDecisionBriefSection(state) {
  return `<section id="decision-brief-section" class="panel decision-brief-panel command-brief">
    <div class="section-head"><div><p class="eyebrow">Market Decision Brief</p><h2>Command center</h2></div><a class="button" href="outputs/market-decision-brief-state.json">Open brief state</a></div>
    <div class="command-layout">
      <div class="command-primary">
        <p class="command-kicker">Current instruction</p>
        <p class="decision-brief-text">${esc(state.brief)}</p>
        ${state.confirmation_read ? `<p class="confirmation-read">${esc(state.confirmation_read)}</p>` : ''}
      </div>
      <aside class="command-metrics">${renderKeyMetrics(state)}</aside>
    </div>
    <div class="command-grid">${renderCommandTiles(state)}</div>
    <div class="macro-value-grid">${renderMacroValues(state)}</div>
    <div class="rule-strip">${renderRuleStrip(state)}</div>
  </section>`;
}

function renderDecisionBriefStyle() {
  return `<style>.decision-brief-panel{margin-top:0}.command-brief{background:linear-gradient(180deg,rgba(251,250,246,.22),rgba(251,250,246,.08));position:relative}.command-brief:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(36,35,31,.32),transparent)}.command-layout{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:18px;align-items:stretch}.command-primary{border:1px solid var(--rule);border-radius:24px;background:rgba(251,250,246,.42);padding:22px;box-shadow:0 18px 60px rgba(36,35,31,.055)}.command-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 12px}.decision-brief-text{font-size:clamp(21px,2.4vw,34px);line-height:1.16;letter-spacing:-.035em;max-width:1120px;margin:0;color:rgba(36,35,31,.9)}.confirmation-read{color:var(--muted);font-size:12px;line-height:1.4;margin:16px 0 0;border-top:1px solid var(--rule);padding-top:12px}.command-metrics{display:grid;grid-template-columns:1fr 1fr;gap:8px}.command-metrics article,.command-tile,.macro-value-grid article,.rule-strip article{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.30);padding:13px}.command-metrics article{min-height:104px}.command-metrics span,.command-tile span,.macro-value-grid span,.rule-strip span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.095em}.command-metrics b{display:block;font-size:clamp(22px,2.3vw,36px);letter-spacing:-.045em;line-height:.98;margin-top:12px;font-weight:500}.command-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.command-tile{min-height:136px}.command-tile b{display:block;font-size:14px;line-height:1.36;margin-top:10px;font-weight:500;color:rgba(36,35,31,.88)}.command-tile.action{border-color:rgba(47,111,78,.36)}.command-tile.risk{border-color:rgba(159,63,53,.32)}.command-tile.liquidity{border-color:rgba(174,124,44,.34)}.macro-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(154px,1fr));gap:8px;margin:10px 0}.macro-value-grid article.data-impaired{border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.08)}.macro-value-grid b{display:block;font-size:20px;margin-top:5px;font-weight:500;letter-spacing:-.02em}.macro-value-grid small{display:block;color:var(--muted);font-size:10px;margin-top:5px;line-height:1.25}.brief-badge{display:inline-block;font-size:8px;font-weight:700;padding:1px 4px;border-radius:999px;margin-left:3px;vertical-align:middle;letter-spacing:.08em}.brief-badge.real{background:rgba(47,111,78,.12);color:var(--green);border:1px solid rgba(47,111,78,.32)}.brief-badge.derived{background:rgba(64,95,159,.10);color:var(--blue);border:1px solid rgba(64,95,159,.28)}.brief-badge.est{background:rgba(174,124,44,.13);color:var(--warn);border:1px solid rgba(174,124,44,.32)}.brief-badge.proj{background:rgba(251,250,246,.10);color:var(--muted);border:1px solid var(--rule)}.brief-badge.missing,.brief-badge.stale{background:rgba(159,63,53,.16);color:var(--red);border:1px solid rgba(159,63,53,.42)}.rule-strip{display:grid;grid-template-columns:1fr 1.35fr 1.35fr;gap:8px;margin-top:10px}.rule-strip b{display:block;font-size:13px;line-height:1.35;margin-top:5px;font-weight:500}@media(max-width:980px){.command-layout,.command-grid,.rule-strip{grid-template-columns:1fr}.command-metrics{grid-template-columns:repeat(2,1fr)}.decision-brief-text{font-size:22px}}@media(max-width:620px){.command-metrics{grid-template-columns:1fr}.command-primary{padding:16px}.command-tile{min-height:auto}}</style>`;
}

module.exports = { renderDecisionBriefSection, renderDecisionBriefStyle, renderMacroValues, renderRuleStrip };