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
  const phaseNodes = [
    ['A1', 420, 118, 'Capitulation', 'Panic low'],
    ['A2', 270, 205, 'Reset', 'Policy turn'],
    ['B', 570, 205, 'Recovery', 'Liquidity'],
    ['C', 610, 330, 'Verification', 'Test'],
    ['D', 488, 485, 'Expansion', 'Beta'],
    ['E', 345, 485, 'Euphoria', 'Excess'],
    ['F', 230, 330, 'Distribution', 'Defense'],
  ];
  const nodeMarkup = phaseNodes.map(([code, x, y, label, note]) => `<g class="ke-svg-node${is(code)}" transform="translate(${x} ${y})"><circle r="${code === current ? 54 : 46}"/><text class="code" y="-10">${code}</text><text class="label" y="12">${label}</text><text class="note" y="30">${note}</text></g>`).join('');
  return `<svg class="ke-cycle-map-v4" viewBox="0 0 900 640" aria-label="Kostolany Egg allocation cycle"><defs><marker id="keExactArrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="#949089"/></marker></defs><rect x="0" y="0" width="900" height="640" fill="transparent"/><ellipse cx="420" cy="318" rx="226" ry="252" class="ke-svg-shell"/><line x1="420" y1="88" x2="420" y2="548" class="ke-svg-axis"/><line x1="180" y1="318" x2="660" y2="318" class="ke-svg-axis"/><text x="420" y="42" class="ke-svg-soft ke-svg-center">More defensive / liquidity preference</text><text x="420" y="604" class="ke-svg-soft ke-svg-center">More aggressive / beta exposure</text><text x="58" y="306" class="ke-svg-axis-title">Risk-off</text><text x="58" y="334" class="ke-svg-axis-note">preserve capital</text><text x="704" y="306" class="ke-svg-axis-title">Risk-on</text><text x="704" y="334" class="ke-svg-axis-note">seek return</text><g class="ke-callout ke-callout-defense"><text x="82" y="110">Defense</text><text x="82" y="132">cash · TLT · gold</text><text x="82" y="154">utilities · healthcare</text></g><g class="ke-callout ke-callout-growth"><text x="682" y="112">Recovery / growth</text><text x="682" y="134">SPX · quality growth</text><text x="682" y="156">AI leaders · cyclicals</text></g><g class="ke-callout ke-callout-risk"><text x="682" y="518">Excess risk</text><text x="682" y="540">small caps · crypto beta</text><text x="682" y="562">speculative growth</text></g><g class="ke-callout ke-callout-trim"><text x="82" y="518">Distribution</text><text x="82" y="540">trim beta · raise cash</text><text x="82" y="562">protect gains</text></g><path d="M300 152 Q355 108 410 104" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M470 104 Q548 125 594 188" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M620 252 Q648 294 642 330" class="ke-svg-active-flow" marker-end="url(#keExactArrow)"/><path d="M626 394 Q596 470 528 502" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M438 538 Q368 540 315 506" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M264 468 Q212 412 205 350" class="ke-svg-flow" marker-end="url(#keExactArrow)"/><path d="M206 284 Q222 220 282 172" class="ke-svg-flow" marker-end="url(#keExactArrow)"/>${nodeMarkup}</svg>`;
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

  return `<section id="kostolany-egg-section" class="kostolany-egg-v3"><div class="ke-exact-app"><header class="ke-topbar"><div class="ke-brand"><span class="ke-logo"></span>OpenClaw Capital Radar</div><nav class="ke-nav"><a href="#">Overview</a><a href="#kostolany-egg-section" class="active">Egg / Cycle</a><a href="#trust-section">Trust</a><a href="#strategy-routing-section">Routes</a><a href="#market-lens-section">Lens</a><a href="#operational-chart-section">Decision Chart</a><a href="#decision-brief-section">Brief</a></nav></header><section class="ke-masthead"><div class="ke-hero"><p class="ke-eyebrow">Kostolany Egg · Macro Allocation Map</p><h1><span class="phase">${esc(state.phase_code)}</span> · ${esc(state.macro_phase)}</h1><div class="ke-chips"><div class="ke-chip"><span>Action</span><strong>${esc(state.capital_action)}</strong></div><div class="ke-chip"><span>Stress</span><strong>${esc(state.stress_type)}</strong></div><div class="ke-chip"><span>Confidence</span><strong><span class="ok">${esc(state.phase_confidence)}</span> /100</strong></div></div></div><div class="ke-operational"><span class="ke-dot"></span>Operational render<br>${asOf} UTC</div></section><section class="ke-grid-top"><article class="ke-card"><div class="ke-egg-wrap"><div class="ke-egg-caption">Kostolany Egg · Allocation Cycle</div>${renderEggSvg(current)}</div></article><article class="ke-card ke-current-read"><h3>Current Read</h3><div class="ke-read-box"><div class="label">Market meaning</div><div class="value">${esc(state.phase_market_meaning)}</div></div><div class="ke-read-box"><div class="label">Capital action</div><div class="value">${esc(state.capital_action)}</div></div><div class="ke-read-box"><div class="label">Invalidation</div><div class="value">${esc(state.invalidation)}</div></div>${renderMeter('Monetary score', axes.mon)}${renderMeter('Liquidity score', axes.liq)}${renderMeter('Psychology score', axes.psy)}${renderMeter('Structure score', axes.str)}${renderMeter('Valuation score', axes.val)}<div class="ke-score-note">Scores reflect relative macro conditions vs history.</div></article></section><section class="ke-grid-mid"><article class="ke-card"><h3>Broad Allocation Guide</h3><table><thead><tr><th>Asset</th><th>Stance</th></tr></thead><tbody>${broadRows}</tbody></table></article><article class="ke-card"><h3>Equity Rotation Guide</h3><table><thead><tr><th>Sector / Theme</th><th>Stance</th><th>Sector / Theme</th><th>Stance</th></tr></thead><tbody>${equityRows}</tbody></table></article></section><section class="ke-mini-grid"><article class="ke-card"><h3>Market Context · SPX Daily</h3><div class="ke-market-head"><span class="price">Price 5,850</span><span class="change">-0.51%</span></div><svg viewBox="0 0 740 220" aria-label="SPX context chart"><path d="M18 130 L52 122 L86 116 L120 108 L154 102 L188 96 L222 88 L256 92 L290 84 L324 90 L358 82 L392 86 L426 106 L460 118 L494 104 L528 172 L562 132 L596 104 L630 76 L664 80 L700 62" fill="none" stroke="#8f8b83" stroke-width="2" stroke-dasharray="4 4"/><path d="M20 145 L44 138 L68 132 L92 136 L116 124 L140 118 L164 126 L188 116 L212 120 L236 112 L260 106 L284 118 L308 110 L332 102 L356 112 L380 104 L404 142 L428 156 L452 166 L476 150 L500 196 L524 134 L548 164 L572 122 L596 118 L620 104 L644 86 L668 72 L692 82" stroke="#1f8f4d" stroke-width="3" fill="none"/><path d="M692 82 L716 88" stroke="#c9463b" stroke-width="3" fill="none"/></svg></article><article class="ke-card ke-keylevels"><h3>Key Levels</h3><div class="kv red"><span>Resistance</span><b>6,200 / 6,500</b></div><div class="kv"><span>Pivot</span><b>5,900</b></div><div class="kv green"><span>Support</span><b>5,650 / 5,300</b></div></article><article class="ke-card ke-regime"><h3>Regime Signal</h3><div class="ke-regime-pill">${esc(state.phase_label || state.phase_code)}</div><div class="ke-phase-dots">${['A1','A2','B','C','D','E','F'].map(c => `<div class="${c === current ? 'active' : ''}"><i></i>${c}</div>`).join('')}</div></article></section><div class="ke-footnote"><span class="ke-info">i</span> This is a macro allocation framework, not a prediction. Use with risk management and scenario planning.</div></div></section>`;
}

function renderKostolanyEggModule(state = {}) {
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
  const confidence = Number(state.phase_confidence || 0);

  return `<div id="kostolany-egg-module" class="kostolany-egg-v3 ke-embedded-module" aria-labelledby="kostolany-egg-module-title"><div class="ke-module-head"><div><p class="ke-module-eyebrow">Kostolany Egg &middot; allocation cycle</p><h3 id="kostolany-egg-module-title">${esc(state.phase_code || current)} &middot; ${esc(state.macro_phase || state.phase_label || 'Macro cycle')}</h3><p>${esc(state.phase_market_meaning || 'Maps the current macro phase into portfolio posture without adding a separate homepage section.')}</p></div><div class="ke-module-badge"><span>Confidence</span><strong>${Number.isFinite(confidence) ? confidence : esc(state.phase_confidence)} /100</strong></div></div><div class="ke-module-grid"><article class="ke-card ke-cycle-card"><div class="ke-egg-caption">Kostolany Egg allocation map</div>${renderEggSvg(current)}</article><article class="ke-card ke-current-read"><h4>Current Read</h4><div class="ke-read-box"><div class="label">Capital action</div><div class="value">${esc(state.capital_action || 'Wait for confirmation')}</div></div><div class="ke-read-box"><div class="label">Stress type</div><div class="value">${esc(state.stress_type || 'Mixed')}</div></div><div class="ke-read-box"><div class="label">Invalidation</div><div class="value">${esc(state.invalidation || 'Requires refreshed macro evidence')}</div></div>${renderMeter('Monetary', axes.mon)}${renderMeter('Liquidity', axes.liq)}${renderMeter('Psychology', axes.psy)}${renderMeter('Structure', axes.str)}${renderMeter('Valuation', axes.val)}</article></div><div class="ke-module-rotation"><article class="ke-card"><h4>Broad Allocation Guide</h4><table><thead><tr><th>Asset</th><th>Stance</th></tr></thead><tbody>${broadRows}</tbody></table></article><article class="ke-card"><h4>Equity Rotation Guide</h4><table><thead><tr><th>Sector / Theme</th><th>Stance</th><th>Sector / Theme</th><th>Stance</th></tr></thead><tbody>${equityRows}</tbody></table></article></div><p class="ke-module-footnote">Framework view only. It supports scenario planning; it is not a price prediction or a standalone buy/sell signal.</p></div>`;
}

function renderKostolanyEggModuleStyle() {
  return `<style id="kostolany-egg-module-style">
#kostolany-egg-module{margin-top:22px;border:1px solid rgba(42,38,32,.13);border-radius:8px;background:#fbfaf7;color:#201d19;padding:20px;box-shadow:0 14px 36px rgba(30,27,22,.08)}
#kostolany-egg-module .ke-module-head{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:18px;align-items:start;margin-bottom:18px}
#kostolany-egg-module .ke-module-eyebrow{margin:0 0 6px;color:#6e675d;font-size:12px;text-transform:uppercase;letter-spacing:.08em}
#kostolany-egg-module h3,#kostolany-egg-module h4{margin:0;color:#201d19;letter-spacing:0}
#kostolany-egg-module h3{font-size:24px;line-height:1.12}
#kostolany-egg-module h4{font-size:15px;line-height:1.2}
#kostolany-egg-module p{margin:7px 0 0;color:#5f584e;line-height:1.45}
#kostolany-egg-module .ke-module-badge{min-width:124px;border:1px solid rgba(42,38,32,.12);border-radius:8px;background:#fff;padding:10px 12px;text-align:right}
#kostolany-egg-module .ke-module-badge span{display:block;color:#746d63;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
#kostolany-egg-module .ke-module-badge strong{display:block;margin-top:4px;font-size:18px}
#kostolany-egg-module .ke-module-grid{display:grid;grid-template-columns:minmax(0,1.35fr) minmax(280px,.65fr);gap:14px;align-items:stretch}
#kostolany-egg-module .ke-module-rotation{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:14px}
#kostolany-egg-module .ke-card{border:1px solid rgba(42,38,32,.12);border-radius:8px;background:#fff;padding:14px;min-width:0}
#kostolany-egg-module .ke-cycle-card{overflow:hidden}
#kostolany-egg-module .ke-egg-caption{font-size:12px;color:#746d63;margin-bottom:8px}
#kostolany-egg-module .ke-cycle-map-v4{display:block;width:100%;height:auto;min-height:320px}
#kostolany-egg-module .ke-svg-shell{fill:#f5f0e7;stroke:#2f2a24;stroke-width:2}
#kostolany-egg-module .ke-svg-axis{stroke:#d0c6b7;stroke-width:1.5}
#kostolany-egg-module .ke-svg-flow{fill:none;stroke:#949089;stroke-width:2.5}
#kostolany-egg-module .ke-svg-active-flow{fill:none;stroke:#208857;stroke-width:4}
#kostolany-egg-module .ke-svg-soft{fill:#7a7267;font-size:18px}
#kostolany-egg-module .ke-svg-center{text-anchor:middle}
#kostolany-egg-module .ke-svg-axis-title{fill:#3c352e;font-size:22px;font-weight:700}
#kostolany-egg-module .ke-svg-axis-note{fill:#756d63;font-size:16px}
#kostolany-egg-module .ke-callout text{fill:#5f584e;font-size:15px}
#kostolany-egg-module .ke-svg-node circle{fill:#fffaf0;stroke:#776f64;stroke-width:2}
#kostolany-egg-module .ke-svg-node.current circle{fill:#e8f5ec;stroke:#208857;stroke-width:4}
#kostolany-egg-module .ke-svg-node text{text-anchor:middle;fill:#29241f}
#kostolany-egg-module .ke-svg-node .code{font-size:22px;font-weight:800}
#kostolany-egg-module .ke-svg-node .label{font-size:14px;font-weight:700}
#kostolany-egg-module .ke-svg-node .note{fill:#70675d;font-size:12px}
#kostolany-egg-module .ke-read-box{border-bottom:1px solid rgba(42,38,32,.09);padding:10px 0}
#kostolany-egg-module .ke-read-box .label{color:#746d63;font-size:11px;text-transform:uppercase;letter-spacing:.08em}
#kostolany-egg-module .ke-read-box .value{margin-top:4px;color:#27231e;font-size:13px;line-height:1.35}
#kostolany-egg-module .ke-score{margin-top:11px}
#kostolany-egg-module .ke-score .row{display:flex;justify-content:space-between;gap:10px;color:#3b352e;font-size:12px}
#kostolany-egg-module .ke-score .value{font-weight:800}
#kostolany-egg-module .ke-score .value.red{color:#b64336}
#kostolany-egg-module .ke-score .bar{height:7px;border-radius:999px;background:#ffffff;overflow:hidden;margin-top:5px}
#kostolany-egg-module .ke-score .fill{height:100%;background:#208857}
#kostolany-egg-module .ke-score .fill.red{background:#b64336}
#kostolany-egg-module .ke-score-note{margin-top:4px;color:#756d63;font-size:11px;line-height:1.35}
#kostolany-egg-module table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
#kostolany-egg-module th,#kostolany-egg-module td{border-top:1px solid rgba(42,38,32,.1);padding:8px 6px;text-align:left;vertical-align:top}
#kostolany-egg-module th{color:#746d63;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
#kostolany-egg-module .stance-green{color:#167a47;font-weight:800}
#kostolany-egg-module .stance-red{color:#a93a30;font-weight:800}
#kostolany-egg-module .stance-neutral{color:#6a6258;font-weight:800}
#kostolany-egg-module .ke-module-footnote{font-size:12px;color:#746d63}
@media (max-width:900px){#kostolany-egg-module .ke-module-head,#kostolany-egg-module .ke-module-grid,#kostolany-egg-module .ke-module-rotation{grid-template-columns:1fr}#kostolany-egg-module .ke-module-badge{text-align:left}#kostolany-egg-module{padding:16px}#kostolany-egg-module .ke-cycle-map-v4{min-height:260px}}
</style>`;
}

module.exports = { renderKostolanyEggSection, renderKostolanyEggModule, renderKostolanyEggModuleStyle };
