const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json'))
  ? path.join(root, 'data', 'report-state.live.json')
  : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const { strategyFor } = require('./capital-radar-strategy-rules.cjs');
const outDir = path.join(root, 'pages');
fs.mkdirSync(outDir, { recursive: true });

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => typeof n === 'number' ? n.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'n/a';
const pct = n => typeof n === 'number' ? `${n >= 0 ? '+' : ''}${n.toFixed(2)}%` : 'n/a';
const tone = n => typeof n !== 'number' ? '' : n >= 0 ? 'good' : 'bad';
const signalTone = s => String(s || '').includes('EXIT') || String(s || '').includes('TRIM') ? 'bad' : String(s || '').includes('WATCH') || String(s || '').includes('INVEST') ? 'warn' : 'good';

const css = `
:root{--bg:#090907;--panel:#12110e;--panel2:#19170f;--ink:#f3ead8;--muted:#a79b86;--rule:#312b20;--gold:#d7a84c;--green:#5bd18f;--red:#ff756c;--blue:#7cb7ff}*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at top left,#242012 0,#090907 38%,#050504 100%);color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,Segoe UI,Arial,sans-serif}.page{max-width:1280px;margin:0 auto;padding:24px clamp(16px,3vw,44px) 60px}a{color:inherit}.topbar{display:flex;justify-content:space-between;gap:18px;align-items:center;border:1px solid rgba(215,168,76,.18);border-radius:18px;padding:12px 14px;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.12em;background:rgba(9,9,7,.78)}.topbar a{text-decoration:none;color:var(--gold);font-weight:900}.hero{display:grid;grid-template-columns:minmax(0,1.15fr) 360px;gap:28px;align-items:end;padding:48px 0 24px}.eyebrow{font-size:11px;font-weight:900;letter-spacing:.16em;text-transform:uppercase;color:var(--gold);margin:0 0 10px}h1{font:500 clamp(64px,9vw,132px)/.82 Georgia,serif;letter-spacing:-.08em;margin:0}h2{font:500 clamp(28px,3vw,46px)/1 Georgia,serif;letter-spacing:-.045em;margin:0 0 14px}h3{font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 8px}p,li{color:#d8cfbd;line-height:1.62}.lede{font-size:18px;color:#eadfc9;max-width:760px}.panel{background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));border:1px solid var(--rule);border-radius:22px;padding:22px;margin-bottom:18px}.stamp{background:#11100d;border:1px solid rgba(215,168,76,.28);border-radius:22px;padding:22px}.stamp strong{display:block;font:500 48px/1 Georgia,serif;color:var(--gold)}.stamp span{display:block;color:var(--muted);font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-top:9px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}.four{grid-template-columns:repeat(4,minmax(0,1fr))}.metric,.box{background:var(--panel);border:1px solid var(--rule);border-radius:17px;padding:16px}.metric span,.box span{display:block;color:var(--muted);font-size:11px;font-weight:900;letter-spacing:.12em;text-transform:uppercase}.metric strong{display:block;font-size:28px;margin-top:8px}.good{color:var(--green)}.bad{color:var(--red)}.warn{color:var(--gold)}.blue{color:var(--blue)}.breakdown{display:grid;gap:10px}.break-row{display:grid;grid-template-columns:120px 90px 1fr;gap:12px;align-items:start;border-top:1px solid var(--rule);padding-top:10px}.impact{font-weight:900}.force-list{display:grid;gap:12px}.force{border:1px solid var(--rule);background:var(--panel2);border-radius:16px;padding:14px}.force b{color:var(--ink)}.strategy-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.strategy-card{border:1px solid var(--rule);background:var(--panel2);border-radius:16px;padding:15px}.strategy-card strong{display:block;color:var(--gold);font-size:12px;text-transform:uppercase;letter-spacing:.1em;margin-bottom:8px}.source{color:var(--muted);font-size:12px}.footer{color:var(--muted);font-size:12px;border-top:1px solid var(--rule);padding-top:16px;margin-top:24px}@media(max-width:900px){.hero,.grid,.four,.strategy-grid{grid-template-columns:1fr}.break-row{grid-template-columns:1fr}}
`;

function spark(values = []) {
  if (!values.length) return '';
  const min = Math.min(...values), max = Math.max(...values), span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1 || 1)) * 100},${46 - ((v - min) / span) * 40 + 3}`).join(' ');
  return `<svg viewBox="0 0 100 52" preserveAspectRatio="none" style="width:100%;height:90px;margin-top:16px"><polyline points="${pts}" fill="none" stroke="#d7a84c" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="0" y1="48" x2="100" y2="48" stroke="#312b20"/></svg>`;
}

function pageFor(h) {
  const signal = h.computedSignal || h.signal;
  const rule = strategyFor(h.ticker);
  const affectedForces = (state.strategy?.marketForces || []).filter(f => (f.affected || []).includes(h.ticker));
  const breakdown = h.ratingBreakdown || [];
  const dataSupport = [
    `Live price: $${fmt(h.livePrice)} as of ${h.priceAsOf || 'n/a'}`,
    `Recent performance: day ${pct(h.dayChangePct)}, 5D ${pct(h.perf5dPct)}, 1M ${pct(h.perf1mPct)}, 3M ${pct(h.perf3mPct)}`,
    `Portfolio weight: ${fmt(h.portfolioWeightPct)}%; market value: $${fmt(h.marketValue)}`,
    `Source: ${h.liveDataSource || 'n/a'}`
  ];
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(h.ticker)} · Capital Radar holding page</title><style>${css}</style></head><body><main class="page">
    <div class="topbar"><a href="../index.html">← Capital Radar</a><div>${esc(state.meta?.reportDate || '')} · dedicated holding rating</div></div>
    <header class="hero"><div><p class="eyebrow">Holding detail · rating evidence</p><h1>${esc(h.ticker)}</h1><p class="lede">${esc(h.role || h.exposureBucket || 'Holding')}. This page explains why the position is rated this way, what data supports the score, and what would change the decision.</p></div><aside class="stamp"><strong>${esc(h.healthScore ?? 'n/a')}</strong><span>Health score<br>Signal: ${esc(signal)}<br>${esc(h.health || '')}</span></aside></header>
    <section class="grid four">
      <article class="metric"><span>Price</span><strong>$${fmt(h.livePrice)}</strong></article>
      <article class="metric"><span>Day / 1M</span><strong><span class="${tone(h.dayChangePct)}">${pct(h.dayChangePct)}</span> / <span class="${tone(h.perf1mPct)}">${pct(h.perf1mPct)}</span></strong></article>
      <article class="metric"><span>Weight</span><strong>${fmt(h.portfolioWeightPct)}%</strong></article>
      <article class="metric"><span>Signal</span><strong class="${signalTone(signal)}">${esc(signal)}</strong></article>
    </section>
    <section class="panel"><p class="eyebrow">Price context</p><h2>Recent movement</h2>${spark(h.sparkline)}<p class="source">${esc(dataSupport.join(' · '))}</p></section>
    <section class="panel"><p class="eyebrow">Commitment strategy</p><h2>What to do, and when</h2><div class="strategy-grid">
      <article class="strategy-card"><strong>Hold until</strong><p>${esc(rule.holdUntil)}</p></article>
      <article class="strategy-card"><strong>Add / buy more when</strong><p>${esc(rule.addWhen)}</p></article>
      <article class="strategy-card"><strong>Trim when</strong><p>${esc(rule.trimWhen)}</p></article>
      <article class="strategy-card"><strong>Exit / reduce when</strong><p>${esc(rule.exitWhen)}</p></article>
      <article class="strategy-card"><strong>Invalidation</strong><p>${esc(rule.invalidation)}</p></article>
      <article class="strategy-card"><strong>Review cadence</strong><p>${esc(rule.review)}</p></article>
    </div></section>
    <section class="grid">
      <article class="panel"><p class="eyebrow">Thesis</p><h2>Why this position exists</h2><p>${esc(h.thesis || h.actionRationale || 'No thesis loaded.')}</p><h3 style="margin-top:18px">Watch</h3><p>${esc(h.watch || 'No watch item loaded.')}</p></article>
      <article class="panel"><p class="eyebrow">Decision logic</p><h2>Current action rationale</h2><p>${esc(h.actionRationale || 'No rationale loaded.')}</p><h3 style="margin-top:18px">Exposure bucket</h3><p>${esc(h.exposureBucket || 'n/a')}</p></article>
    </section>
    <section class="panel"><p class="eyebrow">Rating breakdown</p><h2>How the score was calculated</h2><div class="breakdown">${breakdown.map(b => `<div class="break-row"><b>${esc(b.label)}</b><span class="impact ${b.impact >= 0 ? 'good' : 'bad'}">${b.impact >= 0 ? '+' : ''}${esc(b.impact)}</span><p>${esc(b.note)}</p></div>`).join('') || '<p>No rating breakdown loaded.</p>'}</div></section>
    <section class="panel"><p class="eyebrow">Market forces affecting this holding</p><h2>What outside conditions matter</h2><div class="force-list">${affectedForces.map(f => `<article class="force"><h3>${esc(f.name)} · ${esc(f.direction)}</h3><p>${esc(f.interpretation)}</p><p class="source">${esc((f.evidence || []).join(' · '))}</p></article>`).join('') || '<p>No active market force mapped to this holding.</p>'}</div></section>
    <section class="panel"><p class="eyebrow">What would change the rating</p><h2>Review triggers</h2><ul><li>Thesis evidence weakens or material news contradicts the position role.</li><li>Short-term drawdown combines with worsening market-force context.</li><li>Weight becomes too large relative to confidence and downside clarity.</li><li>For levered/speculative products: decay, liquidity, or correlation risk rises faster than upside asymmetry.</li></ul></section>
    <footer class="footer">Generated from ${esc(path.relative(root, statePath))}. Public market/rates research support only; not automatic brokerage action.</footer>
  </main></body></html>`;
}

for (const h of state.holdings || []) {
  fs.writeFileSync(path.join(outDir, `${String(h.ticker).toLowerCase()}.html`), pageFor(h));
}
console.log(`generated ${state.holdings?.length || 0} holding detail pages from ${path.relative(root, statePath)}`);
