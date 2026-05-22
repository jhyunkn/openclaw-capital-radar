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

function icon(key) {
  const s = String(key || '').toLowerCase();
  if (/cash/.test(s)) return '$';
  if (/bond|tlt/.test(s)) return '△';
  if (/gold/.test(s)) return '◆';
  if (/oil|energy/.test(s)) return '◒';
  if (/spx/.test(s)) return '◇';
  if (/qqq|growth|ai|semi/.test(s)) return '◈';
  if (/btc|crypto/.test(s)) return '₿';
  if (/small/.test(s)) return '⬡';
  if (/defensive|healthcare|utilities|dividend/.test(s)) return '◌';
  if (/value|financial|cyclical/.test(s)) return '▧';
  return '•';
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
      return `<tr><td><i>${esc(icon(item.asset))}</i>${esc(item.asset)}</td><td class="${st[1]}">${esc(st[0])}</td></tr>`;
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
    return `<tr>${a ? `<td><i>${esc(icon(a.bucket))}</i>${esc(a.bucket)}</td><td class="${ca[1]}">${esc(ca[0])}</td>` : '<td></td><td></td>'}${b ? `<td><i>${esc(icon(b.bucket))}</i>${esc(b.bucket)}</td><td class="${cb[1]}">${esc(cb[0])}</td>` : '<td></td><td></td>'}</tr>`;
  }).join('');
}

function renderKostolanyEggSection(state) {
  const current = state.phase_code || 'C';
  const is = code => code === current ? ' current' : '';
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

  return `<section id="kostolany-egg-section" class="kostolany-egg-v3"><div class="ke-exact-app"><header class="ke-topbar"><div class="ke-brand"><span class="ke-logo"></span>OpenClaw Capital Radar</div><nav class="ke-nav"><a href="#">Overview</a><a href="#kostolany-egg-section" class="active">Egg / Cycle</a><a href="#trust-section">Trust</a><a href="#strategy-routing-section">Routes</a><a href="#market-lens-section">Lens</a><a href="#operational-chart-section">Decision Chart</a><a href="#decision-brief-section">Brief</a><a href="#">☾</a><a href="#">☰</a></nav></header><section class="ke-masthead"><div class="ke-hero"><p class="ke-eyebrow">Kostolany Egg · Macro Allocation Map</p><h1><span class="phase">${esc(state.phase_code)}</span> · ${esc(state.macro_phase)}</h1><div class="ke-chips"><div class="ke-chip">⌛ <strong>${esc(state.capital_action)}</strong></div><div class="ke-chip">〰 <strong>${esc(state.stress_type)}</strong></div><div class="ke-chip">🛡 <strong>Confidence <span class="ok">${esc(state.phase_confidence)}</span> /100</strong></div></div></div><div class="ke-operational"><span class="ke-dot"></span>Operational render<br>${asOf} UTC</div></section><section class="ke-grid-top"><article class="ke-card"><div class="ke-egg-wrap"><div class="ke-egg-caption">KOSTOLANY EGG – MACRO CYCLE</div><p class="ke-egg-subcaption">More defensive</p><svg viewBox="0 0 720 620" aria-label="Kostolany Egg"><defs><marker id="keExactArrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#949089"/></marker></defs><ellipse cx="360" cy="300" rx="220" ry="265" class="ke-svg-shell"/><line x1="360" y1="80" x2="360" y2="520" class="ke-svg-axis"/><line x1="160" y1="300" x2="560" y2="300" class="ke-svg-axis"/><text x="52" y="294" class="ke-svg-axis-title">RISK-OFF</text><text x="54" y="324" class="ke-svg-axis-note">Defensive</text><text x="575" y="294" class="ke-svg-axis-title">RISK-ON</text><text x="576" y="324" class="ke-svg-axis-note">Expansive</text><text x="290" y="22" class="ke-svg-soft">More defensive</text><text x="307" y="585" class="ke-svg-soft">More aggressive</text><path d="M265 108 Q318 82 360 88" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M410 98 Q494 117 530 210" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M531 384 Q494 476 408 504" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M313 506 Q225 481 190 390" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M190 208 Q225 124 283 100" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M494 205 Q520 255 515 302" class="ke-svg-active-flow" marker-end="url(#keExactArrow)"/><g class="ke-svg-node${is('A1')}" transform="translate(360 110)"><circle r="52"/><text class="code" y="-10">A1</text><text class="label" y="14">CAPITULATION</text><text class="note" y="34">Early cycle</text></g><g class="ke-svg-node${is('A2')}" transform="translate(205 185)"><circle r="52"/><text class="code" y="-10">A2</text><text class="label" y="14">RESET</text><text class="note" y="34">Policy pivot</text></g><g class="ke-svg-node${is('B')}" transform="translate(498 205)"><circle r="52"/><text class="code" y="-10">B</text><text class="label" y="14">EXPANSION</text><text class="note" y="34">Momentum</text></g><g class="ke-svg-node${is('F')}" transform="translate(232 305)"><circle r="52"/><text class="code" y="-10">F</text><text class="label" y="14">RECOVERY</text><text class="note" y="34">Rebuild</text></g><g class="ke-svg-node${is('E')}" transform="translate(272 430)"><circle r="52"/><text class="code" y="-10">E</text><text class="label" y="14">CONTRACTION</text><text class="note" y="34">Stress</text></g><g class="ke-svg-node${is('D')}" transform="translate(360 495)"><circle r="52"/><text class="code" y="-10">D</text><text class="label" y="14">LATE CYCLE</text><text class="note" y="34">Excess</text></g><g class="ke-svg-node${is('C')}" transform="translate(520 325)"><circle r="58"/><text class="code" y="-12">C</text><text class="label" y="12">VERIFICATION</text><text class="note" y="32">Transition</text></g></svg></div></article><article class="ke-card ke-current-read"><h3>CURRENT READ</h3><div class="ke-read-box"><div class="label">Market meaning</div><div class="value">${esc(state.phase_market_meaning)}</div></div><div class="ke-read-box"><div class="label">Capital action</div><div class="value">${esc(state.capital_action)}</div></div><div class="ke-read-box"><div class="label">Invalidation</div><div class="value">${esc(state.invalidation)}</div></div>${renderMeter('Monetary score', axes.mon)}${renderMeter('Liquidity score', axes.liq)}${renderMeter('Psychology score', axes.psy)}${renderMeter('Structure score', axes.str)}${renderMeter('Valuation score', axes.val)}<div class="ke-score-note">Scores reflect relative macro conditions vs history.</div></article></section><section class="ke-grid-mid"><article class="ke-card"><h3>BROAD ALLOCATION GUIDE</h3><table><thead><tr><th>Asset</th><th>Stance</th></tr></thead><tbody>${broadRows}</tbody></table></article><article class="ke-card"><h3>EQUITY ROTATION GUIDE</h3><table><thead><tr><th>Sector / Theme</th><th>Stance</th><th>Sector / Theme</th><th>Stance</th></tr></thead><tbody>${equityRows}</tbody></table></article></section><section class="ke-mini-grid"><article class="ke-card"><h3>MARKET CONTEXT · SPX (Daily)</h3><div class="ke-market-head"><span class="price">Price 5,850</span><span class="change">-0.51%</span></div><svg viewBox="0 0 740 220" aria-label="SPX context chart"><path d="M18 130 L52 122 L86 116 L120 108 L154 102 L188 96 L222 88 L256 92 L290 84 L324 90 L358 82 L392 86 L426 106 L460 118 L494 104 L528 172 L562 132 L596 104 L630 76 L664 80 L700 62" fill="none" stroke="#8f8b83" stroke-width="2" stroke-dasharray="4 4"/><path d="M20 145 L44 138 L68 132 L92 136 L116 124 L140 118 L164 126 L188 116 L212 120 L236 112 L260 106 L284 118 L308 110 L332 102 L356 112 L380 104 L404 142 L428 156 L452 166 L476 150 L500 196 L524 134 L548 164 L572 122 L596 118 L620 104 L644 86 L668 72 L692 82" stroke="#1f8f4d" stroke-width="3" fill="none"/><path d="M692 82 L716 88" stroke="#c9463b" stroke-width="3" fill="none"/></svg></article><article class="ke-card ke-keylevels"><h3>KEY LEVELS</h3><div class="kv red"><span>Resistance</span><b>6,200 / 6,500</b></div><div class="kv"><span>Pivot</span><b>5,900</b></div><div class="kv green"><span>Support</span><b>5,650 / 5,300</b></div></article><article class="ke-card ke-regime"><h3>REGIME SIGNAL</h3><div class="ke-regime-pill">${esc(state.phase_label || state.phase_code)}</div><div class="ke-phase-dots">${['A1','A2','B','C','D','E','F'].map(c => `<div class="${c === current ? 'active' : ''}"><i></i>${c}</div>`).join('')}</div></article></section><div class="ke-footnote"><span class="ke-info">i</span> This is a macro allocation framework, not a prediction. Use with risk management and scenario planning.</div></div></section>`;
}

module.exports = { renderKostolanyEggSection };
