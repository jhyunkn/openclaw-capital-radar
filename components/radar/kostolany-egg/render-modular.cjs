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

function renderMeter(label, axis) {
  const bad = Number(axis.score) < 50;
  const width = Math.max(0, Math.min(100, Number(axis.score) || 0));
  return `<div class="ke-score"><div class="row"><span>${esc(label)}</span><span class="value ${bad ? 'red' : ''}">${esc(axis.score)} <small>/100</small></span></div><div class="bar"><div class="fill ${bad ? 'red' : ''}" style="width:${width}%"></div></div><div class="ke-score-note">${esc(axis.read || '')}</div></div>`;
}

function renderAllocationRows(items) {
  const assetOrder = ['Cash', 'Bonds / TLT', 'Gold', 'Oil / energy', 'SPX core', 'QQQ / growth', 'BTC / crypto beta', 'Small caps', 'New opportunities'];
  return arr(items).sort((a,b) => orderIndex(assetOrder, a.asset) - orderIndex(assetOrder, b.asset)).map(item => {
    const st = stance(`${item.posture || ''} ${item.tilt || ''}`);
    return `<tr><td>${esc(item.asset)}</td><td class="${st[1]}">${esc(st[0])}</td></tr>`;
  }).join('');
}

function renderEquityRows(items) {
  const eqOrder = ['Quality growth', 'AI / semis', 'Dividend / income', 'Defensive sectors', 'Healthcare', 'Utilities', 'Value', 'Cyclicals', 'Financials', 'Small caps', 'Speculative growth', 'Energy equities'];
  const sorted = arr(items).sort((a,b) => orderIndex(eqOrder, a.bucket) - orderIndex(eqOrder, b.bucket));
  const half = Math.ceil(sorted.length / 2);
  return Array.from({ length: half }).map((_, i) => {
    const a = sorted[i];
    const b = sorted[i + half];
    const ca = a ? stance(`${a.posture || ''} ${a.tilt || ''}`) : ['', ''];
    const cb = b ? stance(`${b.posture || ''} ${b.tilt || ''}`) : ['', ''];
    return `<tr>${a ? `<td>${esc(a.bucket)}</td><td class="${ca[1]}">${esc(ca[0])}</td>` : '<td></td><td></td>'}${b ? `<td>${esc(b.bucket)}</td><td class="${cb[1]}">${esc(cb[0])}</td>` : '<td></td><td></td>'}</tr>`;
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
  const frame = [
    leaf('rect', { x: 0, y: 0, width: 900, height: 640, fill: 'transparent' }),
    leaf('ellipse', { cx: 420, cy: 318, rx: 226, ry: 252, class: 'ke-svg-shell' }),
    leaf('line', { x1: 420, y1: 88, x2: 420, y2: 548, class: 'ke-svg-axis' }),
    leaf('line', { x1: 180, y1: 318, x2: 660, y2: 318, class: 'ke-svg-axis' }),
    el('text', { x: 420, y: 42, class: 'ke-svg-soft ke-svg-center' }, 'More defensive / liquidity preference'),
    el('text', { x: 420, y: 604, class: 'ke-svg-soft ke-svg-center' }, 'More aggressive / beta exposure'),
    el('text', { x: 58, y: 306, class: 'ke-svg-axis-title' }, 'Risk-off'),
    el('text', { x: 58, y: 334, class: 'ke-svg-axis-note' }, 'preserve capital'),
    el('text', { x: 704, y: 306, class: 'ke-svg-axis-title' }, 'Risk-on'),
    el('text', { x: 704, y: 334, class: 'ke-svg-axis-note' }, 'seek return'),
  ].join('');
  const flows = [
    'M300 152 Q355 108 410 104', 'M470 104 Q548 125 594 188', 'M620 252 Q648 294 642 330', 'M626 394 Q596 470 528 502', 'M438 538 Q368 540 315 506', 'M264 468 Q212 412 205 350', 'M206 284 Q222 220 282 172'
  ].map((d, i) => leaf('path', { d, class: i === 2 ? 'ke-svg-active-flow' : 'ke-svg-flow', 'marker-end': 'url(#keExactArrow)' })).join('');
  const callouts = CALLOUTS.map(renderCallout).join('');
  const nodes = PHASE_NODES.map(node => renderPhaseNode(current, node)).join('');
  return el('svg', { class: 'ke-cycle-map-v4', viewBox: '0 0 900 640', 'aria-label': 'Kostolany Egg allocation cycle' }, marker + frame + callouts + flows + nodes);
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
  return `<section id="kostolany-egg-section" class="kostolany-egg-v3"><div class="ke-exact-app"><section class="ke-masthead"><div class="ke-hero"><p class="ke-eyebrow">Kostolany Egg · Macro Allocation Map</p><h1><span class="phase">${esc(state.phase_code)}</span> · ${esc(state.macro_phase)}</h1><div class="ke-chips"><div class="ke-chip"><span>Action</span><strong>${esc(state.capital_action)}</strong></div><div class="ke-chip"><span>Stress</span><strong>${esc(state.stress_type)}</strong></div><div class="ke-chip"><span>Confidence</span><strong><span class="ok">${esc(state.phase_confidence)}</span> /100</strong></div></div></div><div class="ke-operational"><span class="ke-dot"></span>Operational render<br>${asOf} UTC</div></section><section class="ke-grid-top"><article class="ke-card"><div class="ke-egg-wrap"><div class="ke-egg-caption">Kostolany Egg · Allocation Cycle</div>${renderEggSvg(current)}</div></article><article class="ke-card ke-current-read"><h3>Current Read</h3><div class="ke-read-box"><div class="label">Market meaning</div><div class="value">${esc(state.phase_market_meaning)}</div></div><div class="ke-read-box"><div class="label">Capital action</div><div class="value">${esc(state.capital_action)}</div></div><div class="ke-read-box"><div class="label">Invalidation</div><div class="value">${esc(state.invalidation)}</div></div>${renderMeter('Monetary score', axes.mon)}${renderMeter('Liquidity score', axes.liq)}${renderMeter('Psychology score', axes.psy)}${renderMeter('Structure score', axes.str)}${renderMeter('Valuation score', axes.val)}<div class="ke-score-note">Scores reflect relative macro conditions vs history.</div></article></section><section class="ke-grid-mid"><article class="ke-card"><h3>Broad Allocation Guide</h3><table><thead><tr><th>Asset</th><th>Stance</th></tr></thead><tbody>${broadRows}</tbody></table></article><article class="ke-card"><h3>Equity Rotation Guide</h3><table><thead><tr><th>Sector / Theme</th><th>Stance</th><th>Sector / Theme</th><th>Stance</th></tr></thead><tbody>${equityRows}</tbody></table></article></section><section class="ke-mini-grid"><article class="ke-card"><h3>Market Context · SPX Daily</h3><div class="ke-market-head"><span class="price">Price 5,850</span><span class="change">-0.51%</span></div></article><article class="ke-card ke-keylevels"><h3>Key Levels</h3><div class="kv red"><span>Resistance</span><b>6,200 / 6,500</b></div><div class="kv"><span>Pivot</span><b>5,900</b></div><div class="kv green"><span>Support</span><b>5,650 / 5,300</b></div></article><article class="ke-card ke-regime"><h3>Regime Signal</h3><div class="ke-regime-pill">${esc(state.phase_label || state.phase_code)}</div><div class="ke-phase-dots">${['A1','A2','B','C','D','E','F'].map(c => `<div class="${c === current ? 'active' : ''}"><i></i>${c}</div>`).join('')}</div></article></section><div class="ke-footnote"><span class="ke-info">i</span> This is a macro allocation framework, not a prediction. Use with risk management and scenario planning.</div></div></section>`;
}

module.exports = { renderKostolanyEggSection };
