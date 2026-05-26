function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function arr(value) { return Array.isArray(value) ? value : []; }
function attrs(input = {}) { return Object.entries(input).filter(([,v]) => v !== undefined && v !== null && v !== false).map(([k,v]) => ` ${k}="${esc(v)}"`).join(''); }
function el(name, input, children = '') { return `<${name}${attrs(input)}>${children}</${name}>`; }
function leaf(name, input) { return `<${name}${attrs(input)}/>`; }
function tspan(x, dy, className, text) { return el('tspan', { x, dy, class: className }, esc(text)); }

function stance(value) {
  const x = String(value || '').toLowerCase();
  if (/favored|accumulate|overweight|increase/.test(x)) return ['Favored', 'stance-green'];
  if (/avoid|reduce|underweight|strict|research only/.test(x)) return ['Reduce', 'stance-red'];
  if (/wait|trim|cautious|no chase|pullback only/.test(x)) return ['Cautious', 'stance-red'];
  return ['Neutral', 'stance-neutral'];
}

function orderIndex(order, key) { const i = order.indexOf(key); return i < 0 ? 999 : i; }
function scoreAxis(state, id, fallback) { return Object.values(state.axis || {}).find(axis => String(axis.label || '').toLowerCase().includes(id)) || fallback; }
function axisTone(axis) { return Number(axis.score) < 50 ? 'bad' : Number(axis.score) > 70 ? 'good' : 'warn'; }

function renderMeter(label, axis) {
  const width = Math.max(0, Math.min(100, Number(axis.score) || 0));
  const tone = axisTone(axis);
  return `<article class="ke-axis-box ${tone}"><span>${esc(label)}</span><b>${esc(axis.score)} /100</b><div class="ke-axis-bar"><i style="width:${width}%"></i></div><p>${esc(axis.read || '')}</p></article>`;
}

function renderAllocationRows(items) {
  const assetOrder = ['Cash', 'Bonds / TLT', 'Gold', 'Oil / energy', 'SPX core', 'QQQ / growth', 'BTC / crypto beta', 'Small caps', 'New opportunities'];
  return arr(items).sort((a,b) => orderIndex(assetOrder, a.asset) - orderIndex(assetOrder, b.asset)).map(item => {
    const st = stance(`${item.posture || ''} ${item.tilt || ''}`);
    return `<article><span>${esc(item.asset)}</span><b class="${st[1]}">${esc(st[0])}</b></article>`;
  }).join('');
}

function renderEquityRows(items) {
  const eqOrder = ['Quality growth', 'AI / semis', 'Dividend / income', 'Defensive sectors', 'Healthcare', 'Utilities', 'Value', 'Cyclicals', 'Financials', 'Small caps', 'Speculative growth', 'Energy equities'];
  return arr(items).sort((a,b) => orderIndex(eqOrder, a.bucket) - orderIndex(eqOrder, b.bucket)).map(item => {
    const st = stance(`${item.posture || ''} ${item.tilt || ''}`);
    return `<article><span>${esc(item.bucket)}</span><b class="${st[1]}">${esc(st[0])}</b></article>`;
  }).join('');
}

const PHASE_NODES = [
  ['A1', 420, 118, 'Capitulation', 'Panic low'],
  ['A2', 270, 205, 'Reset', 'Policy turn'],
  ['B', 570, 205, 'Recovery', 'Liquidity'],
  ['C', 610, 330, 'Verification', 'Test'],
  ['D', 488, 485, 'Expansion', 'Beta'],
  ['E', 345, 485, 'Euphoria', 'Excess'],
  ['F', 230, 330, 'Distribution', 'Defense'],
];

const CALLOUTS = [
  { cls: 'ke-callout-defense', x: 142, y: 112, title: 'Defense', ticker: 'cash · TLT · gold' },
  { cls: 'ke-callout-growth', x: 738, y: 112, title: 'Recovery / growth', ticker: 'SPX · quality growth' },
  { cls: 'ke-callout-risk', x: 738, y: 518, title: 'Excess risk', ticker: 'small caps · crypto beta' },
  { cls: 'ke-callout-trim', x: 142, y: 518, title: 'Distribution', ticker: 'trim beta · raise cash' },
];

function renderCallout(item) {
  return el('g', { class: `ke-callout ${item.cls}` }, el('text', { x: item.x, y: item.y, 'text-anchor': 'middle', class: 'egg-quadrant-label' }, tspan(item.x, 0, 'egg-quadrant-title', item.title) + tspan(item.x, '1.4em', 'egg-quadrant-ticker', item.ticker)));
}

function renderPhaseNode(current, node) {
  const [code, x, y, label, note] = node;
  const cls = `ke-svg-node${code === current ? ' current' : ''}`;
  return el('g', { class: cls, transform: `translate(${x} ${y})` }, leaf('circle', { r: code === current ? 54 : 46 }) + el('text', { class: 'code', y: -10 }, esc(code)) + el('text', { class: 'label', y: 12 }, esc(label)) + el('text', { class: 'note', y: 30 }, esc(note)));
}

function renderEggSvg(current) {
  const marker = el('defs', {}, el('marker', { id: 'keExactArrow', markerWidth: 10, markerHeight: 10, refX: 6, refY: 3, orient: 'auto' }, el('path', { d: 'M0,0 L6,3 L0,6 Z', fill: '#949089' })));
  const frame = [leaf('rect', { x: 0, y: 0, width: 900, height: 640, fill: 'transparent' }), leaf('ellipse', { cx: 420, cy: 318, rx: 226, ry: 252, class: 'ke-svg-shell' }), leaf('line', { x1: 420, y1: 88, x2: 420, y2: 548, class: 'ke-svg-axis' }), leaf('line', { x1: 180, y1: 318, x2: 660, y2: 318, class: 'ke-svg-axis' }), el('text', { x: 420, y: 42, class: 'ke-svg-soft ke-svg-center' }, 'More defensive / liquidity preference'), el('text', { x: 420, y: 604, class: 'ke-svg-soft ke-svg-center' }, 'More aggressive / beta exposure'), el('text', { x: 58, y: 306, class: 'ke-svg-axis-title' }, 'Risk-off'), el('text', { x: 58, y: 334, class: 'ke-svg-axis-note' }, 'preserve capital'), el('text', { x: 704, y: 306, class: 'ke-svg-axis-title' }, 'Risk-on'), el('text', { x: 704, y: 334, class: 'ke-svg-axis-note' }, 'seek return')].join('');
  const flows = ['M300 152 Q355 108 410 104', 'M470 104 Q548 125 594 188', 'M620 252 Q648 294 642 330', 'M626 394 Q596 470 528 502', 'M438 538 Q368 540 315 506', 'M264 468 Q212 412 205 350', 'M206 284 Q222 220 282 172'].map((d, i) => leaf('path', { d, class: i === 2 ? 'ke-svg-active-flow' : 'ke-svg-flow', 'marker-end': 'url(#keExactArrow)' })).join('');
  return el('svg', { class: 'ke-cycle-map-v4', viewBox: '0 0 900 640', 'aria-label': 'Kostolany Egg allocation cycle' }, marker + frame + CALLOUTS.map(renderCallout).join('') + flows + PHASE_NODES.map(node => renderPhaseNode(current, node)).join(''));
}

function renderAxisSummary(axes) {
  const rows = [
    ['Monetary', axes.mon],
    ['Liquidity', axes.liq],
    ['Psychology', axes.psy],
    ['Structure', axes.str],
    ['Valuation', axes.val],
  ];
  return `<div class="ke-axis-board">${rows.map(([label, axis]) => renderMeter(label, axis)).join('')}</div>`;
}

function renderStrategySummary(state) {
  return `<div class="ke-strategy-board">
    <article class="ke-strategy-primary"><span>Cycle decision</span><b>${esc(state.capital_action)}</b><p>${esc(state.phase_market_meaning)}. Egg defines allocation bias. Movement confirms the tape. Route decides permission.</p></article>
    <article><span>Phase</span><b>${esc(state.phase_code)} · ${esc(state.macro_phase)}</b><small>Cycle location, not a prediction.</small></article>
    <article><span>Stress type</span><b>${esc(state.stress_type)}</b><small>Primary constraint on risk-taking.</small></article>
    <article><span>Invalidation</span><b>${esc(state.invalidation)}</b><small>What breaks the phase read.</small></article>
  </div>`;
}

function renderPhaseRail(current) {
  return `<div class="ke-phase-rail">${['A1','A2','B','C','D','E','F'].map(c => `<article class="${c === current ? 'active' : ''}"><span>${c}</span><b>${c === current ? 'Current' : 'Watch'}</b></article>`).join('')}</div>`;
}

function renderKostolanyEggSection(state) {
  const current = state.phase_code || 'C';
  const broadRows = renderAllocationRows(state.broad_asset_posture);
  const equityRows = renderEquityRows(state.equity_subcategory_posture);
  const axes = {
    mon: scoreAxis(state, 'monetary', { label: 'Monetary', score: 50, read: 'mixed' }),
    liq: scoreAxis(state, 'liquidity', { label: 'Liquidity', score: 50, read: 'mixed' }),
    psy: scoreAxis(state, 'psychology', { label: 'Psychology', score: 50, read: 'mixed' }),
    str: scoreAxis(state, 'structure', { label: 'Structure', score: 50, read: 'mixed' }),
    val: scoreAxis(state, 'valuation', { label: 'Valuation', score: 50, read: 'mixed' }),
  };
  const asOf = esc(new Date(state.as_of || Date.now()).toISOString().slice(0, 16).replace('T', ' '));
  return `<section id="kostolany-egg-section" class="kostolany-egg-v3 egg-strategy-instrument">
    <div class="ke-exact-app">
      <section class="ke-masthead">
        <div class="ke-hero"><p class="ke-eyebrow">Egg</p><h1>Kostolany Egg Diagram</h1><p class="ke-cycle-sub">Cycle allocation instrument: phase, allocation bias, stress type, and invalidation before any ticker-level decision.</p></div>
        <div class="ke-operational"><span class="ke-dot"></span>Operational render<br>${asOf} UTC</div>
      </section>
      <section class="ke-cycle-stage">
        <article class="ke-cycle-map-card"><div class="ke-egg-caption">Where are we in the cycle?</div>${renderEggSvg(current)}</article>
        <article class="ke-current-read"><h3>What this phase tells us</h3><div class="ke-read-box"><div class="label">Market meaning</div><div class="value">${esc(state.phase_market_meaning)}</div></div><div class="ke-read-box"><div class="label">Capital action</div><div class="value">${esc(state.capital_action)}</div></div><div class="ke-read-box"><div class="label">Invalidation</div><div class="value">${esc(state.invalidation)}</div></div></article>
      </section>
      ${renderStrategySummary(state)}
      ${renderAxisSummary(axes)}
      ${renderPhaseRail(current)}
      <section class="ke-allocation-row">
        <article class="ke-card"><h3>Broad allocation guide</h3><div class="ke-rect-grid">${broadRows}</div></article>
        <article class="ke-card"><h3>Equity rotation guide</h3><div class="ke-rect-grid ke-rect-grid-wide">${equityRows}</div></article>
      </section>
      <section class="ke-decision-use">
        <article><span>Route handoff</span><b>Bias is not permission.</b><p>Egg tells Route whether the cycle favors defense, verification, accumulation, expansion, or distribution.</p></article>
        <article><span>Decision use</span><b>Size the posture.</b><p>Use Egg for allocation bias, Movement for tape confirmation, and Route for capital permission.</p></article>
      </section>
      <div class="ke-footnote"><span class="ke-info">i</span> This macro allocation framework is not a prediction. It defines bias, constraints, and invalidation for downstream strategy.</div>
    </div>
  </section>`;
}

module.exports = { renderKostolanyEggSection };
