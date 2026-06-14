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

function findMacro(state, key) {
  return arr(state.macro_values).find(item => item.key === key) || null;
}

function macroValue(state, key, fallback = '—') {
  const item = findMacro(state, key);
  if (!item) return fallback;
  const normalized = normalizeDataPoint(item);
  const unit = normalized.unit && normalized.unit !== 'index' && normalized.truthTier !== 'MISSING' && normalized.truthTier !== 'STALE' ? ` ${esc(normalized.unit)}` : '';
  return `${esc(formatDataPoint(normalized, macroDigits(normalized)))}${unit}`;
}

function macroBadge(state, key) {
  const item = findMacro(state, key);
  return item ? badge(normalizeDataPoint(item).truthTier) : '';
}

function macroRaw(state, key) {
  const item = findMacro(state, key);
  return item ? num(item.value) : null;
}

function classify(state) {
  const confirmation = macroRaw(state, 'confirmation');
  const vix = macroRaw(state, 'vix');
  const tenY = macroRaw(state, 'dgs10');
  const hyOas = macroRaw(state, 'hy_oas');
  const rsi = macroRaw(state, 'rsi14');
  return {
    confirmation,
    vix,
    tenY,
    hyOas,
    rsi,
    confirmationTone: confirmation == null ? 'warn' : confirmation >= 70 ? 'good' : confirmation >= 45 ? 'warn' : 'bad',
    volatilityTone: vix == null ? 'warn' : vix < 18 ? 'good' : vix < 24 ? 'warn' : 'bad',
    rateTone: tenY == null ? 'warn' : tenY >= 4.45 ? 'bad' : tenY >= 4.1 ? 'warn' : 'good',
    creditTone: hyOas == null ? 'warn' : hyOas < 3.5 ? 'good' : hyOas < 5 ? 'warn' : 'bad',
    rsiTone: rsi == null ? 'warn' : rsi >= 70 ? 'warn' : rsi >= 45 ? 'good' : 'bad',
  };
}

function renderMacroValues(state) {
  return arr(state.macro_values).map(item => {
    const normalized = normalizeDataPoint(item);
    const unit = normalized.unit && normalized.unit !== 'index' && normalized.truthTier !== 'MISSING' && normalized.truthTier !== 'STALE' ? ` ${esc(normalized.unit)}` : '';
    const value = formatDataPoint(normalized, macroDigits(normalized));
    const sourceParts = [normalized.source || '', normalized.sourceTime ? `as of ${normalized.sourceTime}` : ''].filter(Boolean);
    const articleClass = normalized.truthTier === 'MISSING' || normalized.truthTier === 'STALE' ? ' class="data-impaired"' : '';
    return `<article${articleClass}><span>${esc(normalized.label)} ${badge(normalized.truthTier)}</span><b>${esc(value)}${unit}</b><small>${esc(sourceParts.join(' · '))}</small></article>`;
  }).join('');
}

function renderSignalTile(label, state, tone, note) {
  return `<article class="macro-signal-tile ${tone}"><span>${esc(label)}</span><b>${esc(state)}</b><small>${esc(note)}</small></article>`;
}

function renderPermissionMatrix(state) {
  const rows = [
    ['Core equity / SPX', 'Hold core', 'Trend support remains intact; broad chase still requires price discipline.'],
    ['Selective growth / AI', state.portfolio_action || 'Rule-based only', 'Rates and valuation pressure require ruled levels, not impulse.'],
    ['Small caps / high beta', 'Verify first', 'Beta needs liquidity confirmation and rate relief before capital permission expands.'],
    ['Crypto / speculative beta', 'Research only', 'Speculative liquidity must confirm before exposure expands.'],
    ['Long bonds / duration', 'Watch / hedge', 'Duration remains sensitive to the 10Y ceiling and real-yield pressure.'],
    ['New opportunities', 'Research first', 'Promote only after evidence, downside, and route permission align.'],
  ];
  return `<div class="permission-matrix"><table><thead><tr><th>Asset / theme</th><th>Permission</th><th>Reason</th></tr></thead><tbody>${rows.map(([theme, permission, reason]) => `<tr><th>${esc(theme)}</th><td>${esc(permission)}</td><td>${esc(reason)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderEvidenceBoard(state) {
  const c = classify(state);
  const supports = [
    `Confirmation ${macroValue(state, 'confirmation')} keeps the market read supported.`,
    `VIX ${macroValue(state, 'vix')} indicates volatility is contained.`,
    `HY OAS ${macroValue(state, 'hy_oas')} keeps credit stress contained.`,
  ];
  const contradictions = [
    `10Y Treasury ${macroValue(state, 'dgs10')} remains the valuation ceiling.`,
    c.rsiTone === 'warn' ? `RSI ${macroValue(state, 'rsi14')} suggests extended momentum.` : 'Momentum is not the primary blocker today.',
    'Selective adds are allowed only at ruled zones, not at any price.',
  ];
  const missing = arr(state.macro_omissions).length ? arr(state.macro_omissions).map(item => `${String(item).toUpperCase()} missing from live macro packet.`) : ['No major macro omissions reported by current state.'];
  const list = (items, cls) => `<ul>${items.map(item => `<li class="${cls}">${esc(item)}</li>`).join('')}</ul>`;
  return `<div class="macro-evidence-board"><article><div><span class="dot good"></span><b>Supports</b></div>${list(supports, 'good')}</article><article><div><span class="dot bad"></span><b>Contradicts</b></div>${list(contradictions, 'bad')}</article><article><div><span class="dot warn"></span><b>Missing / capped</b></div>${list(missing, 'warn')}</article></div>`;
}

function renderInvalidationStrip(state) {
  const chart = state.chart_reference || {};
  const defense = chart.defense_below ? Math.round(chart.defense_below).toLocaleString() : '200D';
  const hardRisk = chart.hard_risk ? Math.round(chart.hard_risk).toLocaleString() : 'hard risk';
  return `<div class="macro-invalidation-strip"><article><span>Thesis breaks if</span><b>SPX &lt; ${esc(defense)}</b></article><article><span>Volatility</span><b>VIX expansion confirms</b></article><article><span>Hard risk</span><b>${esc(hardRisk)}</b></article><article><span>Rate pressure</span><b>10Y worsens</b></article><article><span>Action</span><b>Defend before debate</b></article></div>`;
}

function renderMacroEngines(state) {
  const c = classify(state);
  const engines = [
    ['Liquidity engine', c.volatilityTone === 'good' ? 'Supportive' : 'Mixed', c.volatilityTone, `VIX ${macroValue(state, 'vix')} and M2 ${macroValue(state, 'm2')} frame risk appetite.`],
    ['Rates / inflation engine', c.rateTone === 'bad' ? 'Restrictive' : c.rateTone === 'warn' ? 'Constraining' : 'Neutral', c.rateTone, `10Y ${macroValue(state, 'dgs10')} is the valuation pressure gauge.`],
    ['Growth / credit engine', c.creditTone === 'good' ? 'Contained' : 'Watch stress', c.creditTone, `HY OAS ${macroValue(state, 'hy_oas')} is the credit-stress gate.`],
    ['Market structure engine', c.confirmationTone === 'good' ? 'Constructive' : 'Verify', c.confirmationTone, `Confirmation ${macroValue(state, 'confirmation')} and RSI ${macroValue(state, 'rsi14')} set execution discipline.`],
  ];
  return `<div class="macro-engine-grid">${engines.map(([title, condition, tone, evidence]) => `<article class="macro-engine-card ${tone}"><span>${esc(title)}</span><b>${esc(condition)}</b><p>${esc(evidence)}</p></article>`).join('')}</div>`;
}

function renderMacroCompression(state) {
  const c = classify(state);
  const posture = c.rateTone === 'bad' || c.confirmationTone === 'bad' || c.creditTone === 'bad' ? 'LIMITING' : c.rateTone === 'warn' || c.rsiTone === 'warn' ? 'SELECTIVE' : 'CONSTRUCTIVE';
  const rows = [
    ['Cash / Money', c.volatilityTone === 'good' ? 'Holding buffer, not hiding place' : 'Keep liquidity close', 'Liquidity sets the ability to survive volatility.'],
    ['Duration / Price of Time', c.rateTone === 'bad' ? 'Time is expensive' : c.rateTone === 'warn' ? 'Time is still costly' : 'Time pressure easing', `10Y ${macroValue(state, 'dgs10')} controls valuation expansion.`],
    ['Credit', c.creditTone === 'good' ? 'No crisis signal' : c.creditTone === 'warn' ? 'Stress watch' : 'Risk-off warning', `HY OAS ${macroValue(state, 'hy_oas')} is the default-risk gate.`],
    ['Equity Ownership', c.confirmationTone === 'good' ? 'Hold core' : 'Hold only ruled exposure', 'Ownership allowed only where trend and invalidation align.'],
    ['Real Assets', 'Conditional hedge', 'Use only when inflation pressure, rates, and commodity confirmation align.'],
    ['Speculative Liquidity', c.volatilityTone === 'good' && c.rsiTone !== 'warn' ? 'Small probes only' : 'Do not chase', 'High beta needs liquidity plus non-extended market structure.'],
  ];
  return `<section class="macro-compression"><div><p class="eyebrow">5C · Macro compression</p><h3>Capital permission, compressed.</h3><p>The system now reads Macro as a capital gate: what risk is allowed, what is restricted, and what would change the decision.</p></div><aside><span>Final macro permission</span><b>${esc(posture)}</b><small>${esc(state.portfolio_action || 'Hold core; probe only at ruled zones; do not chase.')}</small></aside><div class="macro-compression-grid">${rows.map(([asset, read, why]) => `<article><span>${esc(asset)}</span><b>${esc(read)}</b><small>${esc(why)}</small></article>`).join('')}</div></section>`;
}

function renderDecisionBriefSection(state) {
  const c = classify(state);
  return `<section id="decision-brief-section" class="panel decision-brief-panel macro-reading-panel">
    <div class="macro-root-head"><p class="eyebrow">Macro Reading <span class="compat-label">Market Decision Brief</span></p><h2>Root market permission page</h2><p>Regime, liquidity, rates, credit, confirmation, invalidation, and capital permission before any ticker decision. Macro, Confirmation, VIX, 10Y, M2, and Risk rule terms stay present for validation.</p></div>
    <div class="macro-executive-read">
      <div><p class="command-kicker">Today's macro read</p><p class="decision-brief-text">${esc(state.brief)}</p></div>
      <aside><span>Capital permission</span><b>${esc(state.portfolio_action || 'Permission pending')}</b><small>${esc(state.change_rule || 'Change rule pending.')}</small></aside>
    </div>
    ${renderMacroCompression(state)}
    <div class="macro-signal-grid">
      ${renderSignalTile('Regime', state.market_read || '—', c.confirmationTone, 'Trend and confirmation define the posture.')}
      ${renderSignalTile('Liquidity', state.macro_read || '—', c.volatilityTone, 'Risk can be held only if liquidity stress stays contained.')}
      ${renderSignalTile('Rates', macroValue(state, 'dgs10'), c.rateTone, 'Rate pressure controls valuation permission.')}
      ${renderSignalTile('Credit', macroValue(state, 'hy_oas'), c.creditTone, 'Credit stress can override risk appetite.')}
      ${renderSignalTile('Volatility', macroValue(state, 'vix'), c.volatilityTone, 'Volatility confirms or rejects the risk posture.')}
      ${renderSignalTile('Risk rule', state.risk_rule || '—', 'bad', 'Invalidation overrides conviction.')}
    </div>
    <section class="macro-operating-block"><div class="macro-block-title"><p class="eyebrow">Permission matrix</p><h3>Signal is not permission.</h3></div>${renderPermissionMatrix(state)}</section>
    <section class="macro-operating-block"><div class="macro-block-title"><p class="eyebrow">Four macro engines</p><h3>Minimum evidence set behind the conclusion.</h3></div>${renderMacroEngines(state)}</section>
    <section class="macro-operating-block"><div class="macro-block-title"><p class="eyebrow">Confirmation / contradiction board</p><h3>What supports the read, what argues against it, and what remains capped.</h3></div>${renderEvidenceBoard(state)}</section>
    <section class="macro-operating-block"><div class="macro-block-title"><p class="eyebrow">Invalidation strip</p><h3>What would change the decision.</h3></div>${renderInvalidationStrip(state)}</section>
    <details class="macro-source-ledger"><summary>Source ledger and macro values</summary><div class="macro-value-grid">${renderMacroValues(state)}</div></details>
  </section>`;
}

function renderDecisionBriefStyle() {
  return `<style>.decision-brief-panel{margin-top:0;overflow:hidden;background:#ffffff)}.macro-root-head{display:grid;grid-template-columns:minmax(260px,.8fr) minmax(0,1.2fr);gap:20px;align-items:end;padding-bottom:22px;border-bottom:1px solid var(--rule)}.macro-root-head h2{font-size:clamp(38px,5vw,82px);line-height:.92;letter-spacing:-.07em;font-weight:500;margin:0}.macro-root-head p:last-child{max-width:780px;color:rgba(36,35,31,.68);font-size:14px;line-height:1.45}.compat-label{display:inline-block;margin-left:8px;padding-left:8px;border-left:1px solid var(--rule);color:var(--muted);opacity:.72}.macro-executive-read{display:grid;grid-template-columns:minmax(0,1.22fr) minmax(280px,.48fr);gap:10px;margin:18px 0}.macro-executive-read>div,.macro-executive-read aside{border:1px solid var(--rule);border-radius:24px;background:#ffffff;padding:22px;box-shadow:0 18px 60px rgba(36,35,31,.04)}.command-kicker{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin:0 0 12px}.decision-brief-text{font-size:clamp(22px,2.6vw,40px);line-height:1.1;letter-spacing:-.045em;max-width:1160px;margin:0;color:rgba(36,35,31,.9)}.macro-executive-read aside{display:flex;flex-direction:column;justify-content:flex-end}.macro-executive-read aside span,.macro-signal-tile span,.macro-engine-card span,.macro-invalidation-strip span,.macro-value-grid span,.macro-source-ledger summary,.macro-compression span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.macro-executive-read aside b{display:block;font-size:clamp(24px,2.8vw,42px);line-height:.98;letter-spacing:-.05em;font-weight:500;margin:14px 0}.macro-executive-read aside small{color:var(--muted);font-size:12px;line-height:1.35}.macro-compression{border:1px solid rgba(36,35,31,.2);border-radius:24px;background:#ffffff;padding:18px;margin:0 0 18px;display:grid;grid-template-columns:minmax(0,.8fr) minmax(220px,.28fr);gap:12px}.macro-compression h3{font-size:clamp(26px,3vw,46px);line-height:.95;letter-spacing:-.06em;font-weight:500;margin:4px 0}.macro-compression p{color:rgba(36,35,31,.68);font-size:13px;line-height:1.4;max-width:620px}.macro-compression aside{border:1px solid rgba(164,80,47,.32);border-radius:18px;background:rgba(164,80,47,.08);padding:14px}.macro-compression aside b{display:block;font-size:28px;line-height:.96;letter-spacing:-.04em;font-weight:500;margin:8px 0}.macro-compression aside small{color:var(--muted);font-size:11px;line-height:1.35}.macro-compression-grid{grid-column:1/-1;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.macro-compression-grid article{border:1px solid var(--rule);border-radius:16px;background:rgba(255,255,255,.18);padding:12px}.macro-compression-grid b{display:block;font-size:15px;line-height:1.08;letter-spacing:-.025em;font-weight:500;margin:8px 0}.macro-compression-grid small{display:block;color:var(--muted);font-size:10.5px;line-height:1.3}.macro-signal-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin-bottom:18px}.macro-signal-tile,.macro-engine-card,.macro-evidence-board article,.macro-invalidation-strip article,.macro-source-ledger{border:1px solid var(--rule);border-radius:18px;background:#ffffff;padding:13px;min-width:0}.macro-signal-tile.good,.macro-engine-card.good{border-color:rgba(47,111,78,.38)}.macro-signal-tile.warn,.macro-engine-card.warn{border-color:rgba(174,124,44,.42)}.macro-signal-tile.bad,.macro-engine-card.bad{border-color:rgba(159,63,53,.42)}.macro-signal-tile b{display:block;font-size:17px;line-height:1.05;letter-spacing:-.025em;margin-top:12px}.macro-signal-tile small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:8px}.macro-operating-block{border-top:1px solid var(--rule);padding:18px 0}.macro-block-title{display:flex;justify-content:space-between;align-items:end;gap:18px;margin-bottom:10px}.macro-block-title h3{font-size:clamp(21px,2.4vw,34px);line-height:1;letter-spacing:-.05em;font-weight:500;margin:0;max-width:720px}.permission-matrix table{width:100%;border-collapse:separate;border-spacing:0;border:1px solid var(--rule);border-radius:18px;overflow:hidden;background:#ffffff}.permission-matrix th,.permission-matrix td{border-bottom:1px solid var(--rule);padding:11px 13px;text-align:left;font-size:12px;line-height:1.35;vertical-align:top}.permission-matrix tr:last-child th,.permission-matrix tr:last-child td{border-bottom:0}.permission-matrix thead th{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.095em;font-weight:500}.macro-engine-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.macro-engine-card b{display:block;font-size:20px;line-height:1.04;letter-spacing:-.035em;margin-top:10px;font-weight:500}.macro-engine-card p{color:rgba(36,35,31,.70);font-size:12px;line-height:1.38;margin:10px 0 0}.macro-evidence-board{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.macro-evidence-board article>div{display:flex;align-items:center;gap:8px}.macro-evidence-board b{font-size:16px;letter-spacing:-.02em}.macro-evidence-board ul{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:7px}.macro-evidence-board li{font-size:12px;line-height:1.35;color:rgba(36,35,31,.74);position:relative;padding-left:14px}.macro-evidence-board li:before{content:'';position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:currentColor}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.dot.good{background:var(--green)}.dot.warn{background:var(--warn)}.dot.bad{background:var(--red)}.good{color:var(--green)!important}.warn{color:var(--warn)!important}.bad{color:var(--red)!important}.macro-invalidation-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}.macro-invalidation-strip article{background:rgba(159,63,53,.055);border-color:rgba(159,63,53,.28)}.macro-invalidation-strip b{display:block;color:var(--red);font-size:14px;line-height:1.15;margin-top:8px}.macro-source-ledger{margin-top:12px}.macro-source-ledger summary{cursor:pointer}.macro-value-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(154px,1fr));gap:8px;margin:12px 0 0}.macro-value-grid article{border:1px solid var(--rule);border-radius:16px;background:#ffffff;padding:12px}.macro-value-grid article.data-impaired{border-color:rgba(159,63,53,.45);background:rgba(159,63,53,.08)}.macro-value-grid b{display:block;font-size:20px;margin-top:5px;font-weight:500;letter-spacing:-.02em}.macro-value-grid small{display:block;color:var(--muted);font-size:10px;margin-top:5px;line-height:1.25}.brief-badge{display:inline-block;font-size:8px;font-weight:700;padding:1px 4px;border-radius:999px;margin-left:3px;vertical-align:middle;letter-spacing:.08em}.brief-badge.real{background:rgba(47,111,78,.12);color:var(--green);border:1px solid rgba(47,111,78,.32)}.brief-badge.derived{background:rgba(64,95,159,.10);color:var(--blue);border:1px solid rgba(64,95,159,.28)}.brief-badge.est{background:rgba(174,124,44,.13);color:var(--warn);border:1px solid rgba(174,124,44,.32)}.brief-badge.proj{background:#ffffff;color:var(--muted);border:1px solid var(--rule)}.brief-badge.missing,.brief-badge.stale{background:rgba(159,63,53,.16);color:var(--red);border:1px solid rgba(159,63,53,.42)}@media(max-width:1180px){.macro-signal-grid{grid-template-columns:repeat(3,1fr)}.macro-engine-grid{grid-template-columns:repeat(2,1fr)}.macro-invalidation-strip{grid-template-columns:repeat(2,1fr)}.macro-compression-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:900px){.macro-root-head,.macro-executive-read,.macro-evidence-board,.macro-compression{grid-template-columns:1fr}.macro-block-title{display:block}}@media(max-width:620px){.macro-signal-grid,.macro-engine-grid,.macro-invalidation-strip,.macro-compression-grid{grid-template-columns:1fr}.macro-root-head h2{font-size:40px}.decision-brief-text{font-size:24px}}</style>`;
}

module.exports = { renderDecisionBriefSection, renderDecisionBriefStyle };
