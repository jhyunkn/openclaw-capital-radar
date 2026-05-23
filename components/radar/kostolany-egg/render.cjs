function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function arr(value) {
  return Array.isArray(value) ? value : [];
}

function stance(value) {
  const x = String(value || '').toLowerCase();
  if (/favored|accumulate|overweight|increase/.test(x)) return ['Favored', 'stance-green'];
  if (/avoid|reduce|underweight|strict|research only/.test(x)) return ['Reduce', 'stance-red'];
  if (/wait|trim|cautious|no chase|pullback only/.test(x)) return ['Cautious', 'stance-red'];
  return ['Neutral', 'stance-neutral'];
}

function orderIndex(order, key) {
  const i = order.indexOf(key);
  return i < 0 ? 999 : i;
}

function scoreAxis(state, id, fallback) {
  return Object.values(state.axis || {}).find(axis => String(axis.label || '').toLowerCase().includes(id)) || fallback;
}

function renderMeter(label, axis) {
  const bad = Number(axis.score) < 50;
  const width = Math.max(0, Math.min(100, Number(axis.score) || 0));
  return `<div class="ke-score"><div class="row"><span>${esc(label)}</span><span class="value ${bad ? 'red' : ''}">${esc(axis.score)} <small>/100</small></span></div><div class="bar"><div class="fill ${bad ? 'red' : ''}" style="width:${width}%"></div></div><div class="ke-score-note">${esc(axis.read || '')}</div></div>`;
}

function renderAllocationRows(items) {
  const assetOrder = ['Cash', 'Bonds / TLT', 'Gold', 'Oil / energy', 'SPX core', 'QQQ / growth', 'BTC / crypto beta', 'Small caps', 'New opportunities'];
  return arr(items)
    .sort((a, b) => orderIndex(assetOrder, a.asset) - orderIndex(assetOrder, b.asset))
    .map(item => {
      const st = stance(`${item.posture || ''} ${item.tilt || ''}`);
      return `<tr><td>${esc(item.asset)}</td><td class="${st[1]}">${esc(st[0])}</td></tr>`;
    })
    .join('');
}

function renderEquityRows(items) {
  const eqOrder = ['Quality growth', 'AI / semis', 'Dividend / income', 'Defensive sectors', 'Healthcare', 'Utilities', 'Value', 'Cyclicals', 'Financials', 'Small caps', 'Speculative growth', 'Energy equities'];
  const sorted = arr(items).sort((a, b) => orderIndex(eqOrder, a.bucket) - orderIndex(eqOrder, b.bucket));
  const half = Math.ceil(sorted.length / 2);
  return Array.from({ length: half }).map((_, i) => {
    const a = sorted[i];
    const b = sorted[i + half];
    const ca = a ? stance(`${a.posture || ''} ${a.tilt || ''}`) : ['', ''];
    const cb = b ? stance(`${b.posture || ''} ${b.tilt || ''}`) : ['', ''];
    return `<tr>${a ? `<td>${esc(a.bucket)}</td><td class="${ca[1]}">${esc(ca[0])}</td>` : '<td></td><td></td>'}${b ? `<td>${esc(b.bucket)}</td><td class="${cb[1]}">${esc(cb[0])}</td>` : '<td></td><td></td>'}</tr>`;
  }).join('');
}

function renderEggSvg(current) {
  const is = code => code === current ? ' current' : '';
  return `<svg viewBox="0 0 820 620" aria-label="Kostolany Egg"><defs><marker id="keExactArrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#949089"/></marker></defs><ellipse cx="410" cy="310" rx="220" ry="250" class="ke-svg-shell"/><line x1="410" y1="86" x2="410" y2="534" class="ke-svg-axis"/><line x1="188" y1="310" x2="632" y2="310" class="ke-svg-axis"/><text x="410" y="42" class="ke-svg-soft ke-svg-center">More defensive</text><text x="410" y="590" class="ke-svg-soft ke-svg-center">More aggressive</text><text x="68" y="300" class="ke-svg-axis-title">Risk-off</text><text x="68" y="330" class="ke-svg-axis-note">Defensive</text><text x="682" y="300" class="ke-svg-axis-title">Risk-on</text><text x="682" y="330" class="ke-svg-axis-note">Expansive</text><path d="M286 166 Q342 112 410 112" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M478 112 Q560 135 606 220" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M608 400 Q558 500 470 520" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M350 520 Q250 490 208 392" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M205 225 Q235 155 305 128" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M604 235 Q630 275 626 315" class="ke-svg-active-flow" marker-end="url(#keExactArrow)"/><g class="ke-svg-node${is('A1')}" transform="translate(410 130)"><circle r="48"/><text class="code" y="-10">A1</text><text class="label" y="13">Capitulation</text><text class="note" y="31">Early cycle</text></g><g class="ke-svg-node${is('A2')}" transform="translate(260 220)"><circle r="48"/><text class="code" y="-10">A2</text><text class="label" y="13">Reset</text><text class="note" y="31">Policy pivot</text></g><g class="ke-svg-node${is('B')}" transform="translate(560 220)"><circle r="48"/><text class="code" y="-10">B</text><text class="label" y="13">Expansion</text><text class="note" y="31">Momentum</text></g><g class="ke-svg-node${is('F')}" transform="translate(252 318)"><circle r="48"/><text class="code" y="-10">F</text><text class="label" y="13">Recovery</text><text class="note" y="31">Rebuild</text></g><g class="ke-svg-node${is('E')}" transform="translate(305 450)"><circle r="48"/><text class="code" y="-10">E</text><text class="label" y="13">Contraction</text><text class="note" y="31">Stress</text></g><g class="ke-svg-node${is('D')}" transform="translate(410 505)"><circle r="48"/><text class="code" y="-10">D</text><text class="label" y="13">Late cycle</text><text class="note" y="31">Excess</text></g><g class="ke-svg-node${is('C')}" transform="translate(600 340)"><circle r="56"/><text class="code" y="-12">C</text><text class="label" y="12">Verification</text><text class="note" y="32">Transition</text></g></svg>`;
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

  return `<section id="kostolany-egg-section" class="kostolany-egg-v3"><div class="ke-exact-app"><header class="ke-topbar"><div class="ke-brand"><span class="ke-logo"></span>OpenClaw Capital Radar</div><nav class="ke-nav"><a href="#">Overview</a><a href="#kostolany-egg-section" class="active">Egg / Cycle</a><a href="#trust-section">Trust</a><a href="#strategy-routing-section">Routes</a><a href="#market-lens-section">Lens</a><a href="#operational-chart-section">Decision Chart</a><a href="#decision-brief-section">Brief</a></nav></header><section class="ke-masthead"><div class="ke-hero"><p class="ke-eyebrow">Kostolany Egg · Macro Allocation Map</p><h1><span class="phase">${esc(state.phase_code)}</span> · ${esc(state.macro_phase)}</h1><div class="ke-chips"><div class="ke-chip"><span>Action</span><strong>${esc(state.capital_action)}</strong></div><div class="ke-chip"><span>Stress</span><strong>${esc(state.stress_type)}</strong></div><div class="ke-chip"><span>Confidence</span><strong><span class="ok">${esc(state.phase_confidence)}</span> /100</strong></div></div></div><div class="ke-operational"><span class="ke-dot"></span>Operational render<br>${asOf} UTC</div></section><section class="ke-grid-top"><article class="ke-card"><div class="ke-egg-wrap"><div class="ke-egg-caption">Kostolany Egg · Macro Cycle</div>${renderEggSvg(current)}</div></article><article class="ke-card ke-current-read"><h3>Current Read</h3><div class="ke-read-box"><div class="label">Market meaning</div><div class="value">${esc(state.phase_market_meaning)}</div></div><div class="ke-read-box"><div class="label">Capital action</div><div class="value">${esc(state.capital_action)}</div></div><div class="ke-read-box"><div class="label">Invalidation</div><div class="value">${esc(state.invalidation)}</div></div>${renderMeter('Monetary score', axes.mon)}${renderMeter('Liquidity score', axes.liq)}${renderMeter('Psychology score', axes.psy)}${renderMeter('Structure score', axes.str)}${renderMeter('Valuation score', axes.val)}<div class="ke-score-note">Scores reflect relative macro conditions vs history.</div></article></section><section class="ke-grid-mid"><article class="ke-card"><h3>Broad Allocation Guide</h3><table><thead><tr><th>Asset</th><th>Stance</th></tr></thead><tbody>${broadRows}</tbody></table></article><article class="ke-card"><h3>Equity Rotation Guide</h3><table><thead><tr><th>Sector / Theme</th><th>Stance</th><th>Sector / Theme</th><th>Stance</th></tr></thead><tbody>${equityRows}</tbody></table></article></section><section class="ke-mini-grid"><article class="ke-card"><h3>Market Context · SPX Daily</h3><div class="ke-market-head"><span class="price">Price 5,850</span><span class="change">-0.51%</span></div><svg viewBox="0 0 740 220" aria-label="SPX context chart"><path d="M18 130 L52 122 L86 116 L120 108 L154 102 L188 96 L222 88 L256 92 L290 84 L324 90 L358 82 L392 86 L426 106 L460 118 L494 104 L528 172 L562 132 L596 104 L630 76 L664 80 L700 62" fill="none" stroke="#8f8b83" stroke-width="2" stroke-dasharray="4 4"/><path d="M20 145 L44 138 L68 132 L92 136 L116 124 L140 118 L164 126 L188 116 L212 120 L236 112 L260 106 L284 118 L308 110 L332 102 L356 112 L380 104 L404 142 L428 156 L452 166 L476 150 L500 196 L524 134 L548 164 L572 122 L596 118 L620 104 L644 86 L668 72 L692 82" stroke="#1f8f4d" stroke-width="3" fill="none"/><path d="M692 82 L716 88" stroke="#c9463b" stroke-width="3" fill="none"/></svg></article><article class="ke-card ke-keylevels"><h3>Key Levels</h3><div class="kv red"><span>Resistance</span><b>6,200 / 6,500</b></div><div class="kv"><span>Pivot</span><b>5,900</b></div><div class="kv green"><span>Support</span><b>5,650 / 5,300</b></div></article><article class="ke-card ke-regime"><h3>Regime Signal</h3><div class="ke-regime-pill">${esc(state.phase_label || state.phase_code)}</div><div class="ke-phase-dots">${['A1','A2','B','C','D','E','F'].map(c => `<div class="${c === current ? 'active' : ''}"><i></i>${c}</div>`).join('')}</div></article></section><div class="ke-footnote"><span class="ke-info">i</span> This is a macro allocation framework, not a prediction. Use with risk management and scenario planning.</div></div></section>`;
}

module.exports = { renderKostolanyEggSection };
