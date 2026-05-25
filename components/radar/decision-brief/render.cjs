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
    ['Portfolio permission', state.portfolio_action],
    ['Change trigger', state.change_rule],
    ['Risk trigger', state.risk_rule || '—'],
  ];
  return rows.map(([label, value]) => `<article><span>${esc(label)}</span><b>${esc(value)}</b></article>`).join('');
}

function renderCommandTiles(state) {
  const tiles = [
    ['Regime', state.market_read || '—', 'regime', 'What the market tape and trend currently imply.'],
    ['Liquidity', state.macro_read || '—', 'liquidity', 'Rates, credit, and macro pressure behind the posture.'],
    ['Permission', state.portfolio_action || '—', 'action', 'What the environment permits for portfolio action.'],
    ['Invalidation', state.risk_rule || '—', 'risk', 'What would make the current read unreliable.'],
  ];
  return tiles.map(([label, value, tone, help]) => `<article class="command-tile ${tone}"><span>${esc(label)}</span><b>${esc(value)}</b><small>${esc(help)}</small></article>`).join('');
}

function renderKeyMetrics(state) {
  const rows = [
    ['Confirmation', macroValue(state, 'confirmation'), macroBadge(state, 'confirmation'), 'Composite support'],
    ['S&P 500', macroValue(state, 'spx'), macroBadge(state, 'spx'), 'Primary execution map'],
    ['10Y Treasury', macroValue(state, 'dgs10'), macroBadge(state, 'dgs10'), 'Rate pressure'],
    ['HY OAS', macroValue(state, 'hy_oas'), macroBadge(state, 'hy_oas'), 'Credit risk'],
  ];
  return rows.map(([label, value, sourceBadge, note]) => `<article><span>${esc(label)} ${sourceBadge}</span><b>${value}</b><small>${esc(note)}</small></article>`).join('');
}

function renderReadingFlow() {
  const steps = [
    ['01', 'Macro regime', 'Egg + rates + credit'],
    ['02', 'Confirmation', 'SPX / QQQ / TLT / BTC / VIX'],
    ['03', 'Permission', 'add / hold / defend'],
    ['04', 'Execution', 'Decision Map + Price Zones'],
  ];
  return `<div class="reading-flow">${steps.map(([k, title, text]) => `<article><i>${esc(k)}</i><b>${esc(title)}</b><span>${esc(text)}</span></article>`).join('')}</div>`;
}

function renderDecisionBriefSection(state) {
  return `<section id="decision-brief-section" class="panel decision-brief-panel command-brief macro-reading-panel">
    <div class="section-head"><div><p class="eyebrow">Macro Reading <span class="compat-label">Market Decision Brief</span></p><h2>Regime, confirmation, and permission</h2></div><a class="button" href="outputs/market-decision-brief-state.json">Open brief state</a></div>
    <div class="macro-reading-intro">
      <div>
        <p class="command-kicker">Integrated market read</p>
        <p class="decision-brief-text">${esc(state.brief)}</p>
      </div>
      <aside class="macro-reading-note">
        <span>How to read this</span>
        <p>Macro Reading combines the cycle framework, confirmation signals, and portfolio permission into one operating posture before the Decision Map and Price Zone Radar translate it into execution.</p>
      </aside>
    </div>
    ${renderReadingFlow()}
    <div class="command-layout">
      <div class="command-primary">
        <p class="command-kicker">Signal interpretation</p>
        ${state.confirmation_read ? `<p class="confirmation-read strong">${esc(state.confirmation_read)}</p>` : '<p class="confirmation-read strong">Confirmation read pending.</p>'}
      </div>
      <aside class="command-metrics">${renderKeyMetrics(state)}</aside>
    </div>
    <div class="command-grid">${renderCommandTiles(state)}</div>
    <div class="macro-value-grid">${renderMacroValues(state)}</div>
    <div class="rule-strip">${renderRuleStrip(state)}</div>
  </section>`;
}

function renderDecisionBriefStyle() {
  return `<style>.decision-brief-panel{margin-top:0}.command-brief{background:linear-gradient(180deg,rgba(251,250,246,.24),rgba(251,250,246,.08));position:relative}.command-brief:before{content:"";position:absolute;inset:0 0 auto;height:1px;background:linear-gradient(90deg,transparent,rgba(36,35,31,.32),transparent)}.macro-reading-panel{overflow:hidden}.compat-label{display:inline-block;margin-left:8px;padding-left:8px;border-left:1px solid var(--rule);color:var(--muted);opacity:.72}.macro-reading-intro{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(260px,.65fr);gap:14px;align-items:stretch;margin-bottom:12px}.macro-reading-intro>div,.macro-reading-note{border:1px solid var(--rule);border-radius:24px;background:rgba(251,250,246,.42);padding:22px;box-shadow:0 18px 60px rgba(36,35,31,.045)}.macro-reading-note{display:flex;flex-direction:column;justify-content:flex-end;background:linear-gradient(180deg,rgba(251,250,246,.34),rgba(251,250,246,.14))}.macro-reading-note span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em}.macro-reading-note p{font-size:13px;line-height:1.45;color:rgba(36,35,31,.72);margin:10px 0 0}.reading-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:0 0 12px}.reading-flow article{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.22);padding:12px;min-height:86px}.reading-flow i{display:block;font-style:normal;color:var(--muted);font-size:10px;letter-spacing:.12em;margin-bottom:9px}.reading-flow b{display:block;font-size:15px;line-height:1.1;letter-spacing:-.02em}.reading-flow span{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:7px}.command-layout{display:grid;grid-template-columns:minmax(0,.9fr) minmax(300px,1.1fr);gap:12px;align-items:stretch}.command-primary{border:1px solid var(--rule);border-radius:22px;background:rgba(251,250,246,.30);padding:18px;box-shadow:0 18px 60px rgba(36,35,31,.035)}.command-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 12px}.decision-brief-text{font-size:clamp(23px,2.6vw,38px);line-height:1.12;letter-spacing:-.045em;max-width:1120px;margin:0;color:rgba(36,35,31,.9)}.confirmation-read{color:var(--muted);font-size:12px;line-height:1.45;margin:0}.confirmation-read.strong{font-size:15px;color:rgba(36,35,31,.82)}.command-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.command-metrics article,.command-tile,.macro-value-grid article,.rule-strip article{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.30);padding:13px}.command-metrics article{min-height:104px}.command-metrics span,.command-tile span,.macro-value-grid span,.rule-strip span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.095em}.command-metrics b{display:block;font-size:clamp(18px,1.9vw,30px);letter-spacing:-.045em;line-height:.98;margin-top:12px;font-weight:500}.command-metrics small{display:block;color:var(--muted);font-size:10px;line-height:1.25;margin-top:9px}.command-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:10px 0}.command-tile{min-height:150px}.command-tile b{display:block;font-size:14px;line-height:1.36;margin-top:10px;font-weight:500;color:rgba(36,35,31,.88)}.command-tile small{display:block;color:var(--muted);font-size:10px;line-height:1.35;margin-top:10px}.command-tile.action{border-color:rgba(47,111,78,.36)}.command-tile.risk{border-color:rgba(159,63,53,.32)}.command-tile.liquidity{border-color:rgba(174,124,44,.34)}.macro-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(154px,1fr));gap:8px;margin:10px 0}.macro-value-grid article.data-impaired{border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.08)}.macro-value-grid b{display:block;font-size:20px;margin-top:5px;font-weight:500;letter-spacing:-.02em}.macro-value-grid small{display:block;color:var(--muted);font-size:10px;margin-top:5px;line-height:1.25}.brief-badge{display:inline-block;font-size:8px;font-weight:700;padding:1px 4px;border-radius:999px;margin-left:3px;vertical-align:middle;letter-spacing:.08em}.brief-badge.real{background:rgba(47,111,78,.12);color:var(--green);border:1px solid rgba(47,111,78,.32)}.brief-badge.derived{background:rgba(64,95,159,.10);color:var(--blue);border:1px solid rgba(64,95,159,.28)}.brief-badge.est{background:rgba(174,124,44,.13);color:var(--warn);border:1px solid rgba(174,124,44,.32)}.brief-badge.proj{background:rgba(251,250,246,.10);color:var(--muted);border:1px solid var(--rule)}.brief-badge.missing,.brief-badge.stale{background:rgba(159,63,53,.16);color:var(--red);border:1px solid rgba(159,63,53,.42)}.rule-strip{display:grid;grid-template-columns:1fr 1.35fr 1.35fr;gap:8px;margin-top:10px}.rule-strip b{display:block;font-size:13px;line-height:1.35;margin-top:5px;font-weight:500}@media(max-width:1080px){.command-metrics{grid-template-columns:repeat(2,1fr)}.reading-flow{grid-template-columns:repeat(2,1fr)}}@media(max-width:980px){.macro-reading-intro,.command-layout,.command-grid,.rule-strip{grid-template-columns:1fr}.decision-brief-text{font-size:24px}}@media(max-width:620px){.command-metrics,.reading-flow{grid-template-columns:1fr}.macro-reading-intro>div,.macro-reading-note,.command-primary{padding:16px}.command-tile{min-height:auto}}</style>`;
}

module.exports = { renderDecisionBriefSection, renderDecisionBriefStyle, renderMacroValues, renderRuleStrip };
