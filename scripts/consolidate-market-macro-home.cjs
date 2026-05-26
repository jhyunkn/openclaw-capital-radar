const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function findSection(source, id) {
  const start = source.indexOf(`<section id="${id}"`);
  if (start < 0) return null;
  const next = source.indexOf('<section id="', start + 1);
  const footer = source.indexOf('<footer', start + 1);
  const mainEnd = source.indexOf('</main>', start + 1);
  const candidates = [next, footer, mainEnd].filter(i => i >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return { start, end, html: source.slice(start, end).trim() };
}

function removeRange(source, range) {
  if (!range) return source;
  return source.slice(0, range.start) + source.slice(range.end);
}

function stripTags(fragment) {
  return String(fragment || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function firstMatchText(sectionHtml, regex, fallback = '—') {
  const match = String(sectionHtml || '').match(regex);
  return match ? stripTags(match[1]) : fallback;
}

function countText(sectionHtml, pattern) {
  return (String(sectionHtml || '').match(pattern) || []).length;
}

function tone(value) {
  const s = String(value || '').toLowerCase();
  if (/support|healthy|contained|positive|risk-on|improv|allowed|pass|fresh|high|hold core/.test(s)) return 'good';
  if (/block|defensive|stale|missing|risk|avoid|worsen|constrain|low|restrict/.test(s)) return 'bad';
  return 'warn';
}

function normalizeInnerSection(sectionHtml, label) {
  return String(sectionHtml || '')
    .replace(/class="panel /, 'class="macro-inner-panel ')
    .replace(/class="kostolany-egg-v3"/, 'class="macro-inner-panel kostolany-egg-v3"')
    .replace(/class="([^"]*)\bpanel\b([^"]*)"/, (m, a, b) => `class="${a}macro-inner-panel${b}"`)
    .replace(/<section /, `<section data-macro-source="${esc(label)}" `);
}

function detail(title, label, sectionHtml, open = false) {
  return `<details class="macro-evidence-detail"${open ? ' open' : ''}><summary><span>${esc(label)}</span><b>${esc(title)}</b></summary>${sectionHtml}</details>`;
}

function signal(label, state, note) {
  const t = tone(`${state} ${note}`);
  return `<article class="macro-signal ${t}"><i></i><span>${esc(label)}</span><b>${esc(state)}</b><p>${esc(note)}</p></article>`;
}

function engine(title, state, evidence, implication, invalidation) {
  const t = tone(`${state} ${evidence} ${implication}`);
  return `<article class="macro-engine-card ${t}">
    <div class="engine-top"><span>${esc(title)}</span><b>${esc(state)}</b></div>
    <div class="engine-bars" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <dl><dt>Evidence</dt><dd>${esc(evidence)}</dd><dt>Strategy meaning</dt><dd>${esc(implication)}</dd><dt>Invalidation</dt><dd>${esc(invalidation)}</dd></dl>
  </article>`;
}

function bullets(items, cls) {
  return `<ul>${items.map(item => `<li class="${cls}">${esc(item)}</li>`).join('')}</ul>`;
}

function permission(theme, value, reason) {
  return `<tr><th>${esc(theme)}</th><td><span class="perm-pill ${tone(value)}">${esc(value)}</span></td><td>${esc(reason)}</td></tr>`;
}

function renderMacroReading(ranges) {
  const trust = ranges['data-refresh-section'].html;
  const brief = ranges['decision-brief-section'].html;
  const egg = ranges['kostolany-egg-section'].html;
  const movement = ranges['market-lens-section'].html;
  const route = ranges['strategy-routing-section'].html;
  const tape = ranges['market-section'].html;

  const decisionMode = firstMatchText(trust, /<span>Current decision mode<\/span>\s*<strong>([\s\S]*?)<\/strong>/i, 'Research-only / no capital adds');
  const readiness = firstMatchText(trust, /<span>Source readiness<\/span>\s*<strong>([\s\S]*?)<\/strong>/i, '65%');
  const blocked = firstMatchText(trust, /<span>Evidence blocked<\/span>\s*<strong>([\s\S]*?)<\/strong>/i, '16 / 16');
  const macroBrief = firstMatchText(brief, /<p class="decision-brief-text">([\s\S]*?)<\/p>/i, 'Macro brief pending.');
  const signalRead = firstMatchText(brief, /<p class="confirmation-read strong">([\s\S]*?)<\/p>/i, 'Confirmation read pending.');
  const phase = firstMatchText(egg, /<span>Phase<\/span>\s*<b>([\s\S]*?)<\/b>/i, firstMatchText(egg, /<div class="ke-regime-pill">([\s\S]*?)<\/div>/i, 'C · Transition / verification'));
  const cycleAction = firstMatchText(egg, /<span>Cycle decision<\/span>\s*<b>([\s\S]*?)<\/b>/i, firstMatchText(egg, /<div class="label">Capital action<\/div><div class="value">([\s\S]*?)<\/div>/i, 'Wait for confirmation'));
  const stress = firstMatchText(egg, /<span>Stress type<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Rate pressure');
  const routeState = firstMatchText(route, /<span>Route state<\/span>\s*<b>([\s\S]*?)<\/b>/i, firstMatchText(route, /<p class="eyebrow">Strategy Route<\/p>\s*<h2>([\s\S]*?)<\/h2>/i, 'risk-on but extended'));
  const addPermission = firstMatchText(route, /<span>Add permission<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Pullback only');
  const opportunity = firstMatchText(route, /<span>Opportunity<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Near miss only');
  const confirming = firstMatchText(tape, /<span>Confirming<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
  const contradicting = firstMatchText(tape, /<span>Contradicting<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
  const missingRows = countText(trust, /source-row stale/g);
  const supports = countText(movement, />SUPPORTIVE</g) + countText(movement, />CONTAINED</g);
  const blocks = countText(movement, />DEFENSIVE</g) + countText(movement, />EXTENDED</g);

  const sourceLayers = [
    detail('Source readiness and evidence blockers', 'Trust', normalizeInnerSection(trust, 'trust')),
    detail('Cycle allocation framework', 'Egg', normalizeInnerSection(egg, 'egg')),
    detail('Cross-asset confirmation inputs', 'Movement', normalizeInnerSection(movement, 'movement')),
    detail('Route and permission rules', 'Route', normalizeInnerSection(route, 'route')),
    detail('Tape, news, and catalyst status', 'Tape', normalizeInnerSection(tape, 'tape-news')),
  ].join('\n');

  return `<section data-macro-source="curated" id="data-refresh-section" class="macro-inner-panel macro-curated-reading">
    <section class="macro-hero-read">
      <div class="macro-hero-copy"><p class="eyebrow">Macro Reading</p><h2>Strategy begins with permission, not prediction.</h2><p>${esc(macroBrief)}</p></div>
      <aside class="macro-command-stack">
        <div><span>Decision mode</span><b class="${tone(decisionMode)}">${esc(decisionMode)}</b></div>
        <div><span>Route</span><b class="${tone(routeState)}">${esc(routeState)}</b></div>
        <div><span>Add permission</span><b class="${tone(addPermission)}">${esc(addPermission)}</b></div>
        <div><span>Evidence cap</span><b class="${tone(readiness)}">${esc(readiness)}</b></div>
        <div><span>Main blocker</span><b class="${tone(stress)}">${esc(stress)}</b></div>
        <div><span>Invalidation</span><b class="bad">SPX trend break + VIX expansion</b></div>
      </aside>
    </section>

    <section class="macro-graphic-chain" aria-label="Macro decision chain">
      <article><i>01</i><span>Cycle</span><b>${esc(phase)}</b><small>${esc(cycleAction)}</small></article>
      <article><i>02</i><span>Movement</span><b>${supports} supports / ${blocks} blocks</b><small>cross-asset confirmation</small></article>
      <article><i>03</i><span>Route</span><b>${esc(addPermission)}</b><small>${esc(opportunity)} opportunity gate</small></article>
      <article><i>04</i><span>Execution</span><b>Levels + holdings</b><small>only after permission</small></article>
    </section>

    <section class="macro-visual-layer">
      <div class="macro-layer-head"><p class="eyebrow">Regime engines</p><h3>Which forces are pushing the strategy?</h3></div>
      <div class="macro-signal-grid">
        ${signal('Liquidity', supports > 1 ? 'Supportive' : 'Mixed', 'Hold risk only where route permission survives.')}
        ${signal('Rates', /rate/i.test(stress) ? 'Constraining' : 'Neutral', 'Duration and high-multiple growth need evidence.')}
        ${signal('Credit', 'Contained', 'Credit stress is not overriding the read yet.')}
        ${signal('Growth', 'Selective', 'Earnings quality matters more than multiple expansion.')}
        ${signal('Inflation', 'Conditional', 'Policy support is not guaranteed.')}
        ${signal('Breadth', blocks > supports ? 'Narrow / mixed' : 'Constructive', 'Do not mistake mega-cap strength for broad strength.')}
        ${signal('Volatility', 'Contained', 'Low VIX supports holding until it expands.')}
        ${signal('Risk appetite', tone(routeState) === 'bad' ? 'Defensive' : 'Risk-on extended', 'No chase; obey levels and evidence gates.')}
      </div>
    </section>

    <section class="macro-engine-layer">
      <div class="macro-layer-head"><p class="eyebrow">Four operating engines</p><h3>The minimum evidence set behind the macro conclusion</h3></div>
      <div class="macro-engine-grid">
        ${engine('Liquidity Engine', supports > 1 ? 'Supportive' : 'Mixed', 'Volatility is contained; source freshness caps confidence.', 'Supports holding core exposure, not broad chase.', 'Liquidity proxies weaken while volatility expands.')}
        ${engine('Rates / Inflation Engine', /rate/i.test(stress) ? 'Restrictive' : 'Neutral', '10Y / TLT pressure constrains long-duration assets.', 'Favor earnings-confirmed exposure over multiple expansion.', '10Y breaks higher or inflation re-accelerates.')}
        ${engine('Growth / Credit Engine', 'Contained', 'Credit stress is not flashing crisis.', 'Allows selective risk if earnings and credit stay intact.', 'HY spreads widen sharply or revisions roll over.')}
        ${engine('Market Structure Engine', blocks > supports ? 'Divergent' : 'Constructive', signalRead, 'Use levels and breadth confirmation before adds.', 'SPX loses support while VIX and breadth deteriorate.')}
      </div>
    </section>

    <section class="macro-permission-layer">
      <div class="macro-layer-head"><p class="eyebrow">Permission matrix</p><h3>Signal is not permission.</h3></div>
      <div class="macro-permission-board"><table><thead><tr><th>Asset / theme</th><th>Permission</th><th>Reason</th></tr></thead><tbody>
        ${permission('Core equity / SPX', 'Hold core', 'Trend support remains intact; broad chase is not justified.')}
        ${permission('Growth / AI', addPermission, 'Rates and valuation pressure require selectivity and ruled levels.')}
        ${permission('Small caps', 'Blocked / verify', 'Rate sensitivity and weaker earnings leverage make beta fragile.')}
        ${permission('Crypto beta', 'Verify first', 'Speculative liquidity must confirm before exposure expands.')}
        ${permission('Long bonds', 'Watch / hedge', 'Duration remains sensitive to the 10Y ceiling.')}
        ${permission('New opportunities', 'Research only', `Opportunity gate: ${opportunity}; no automatic capital promotion.`)}
      </tbody></table><aside><span>Operator rule</span><b>Permission precedes action.</b><p>Use the macro page to decide whether capital is allowed. Use the Decision Map and Holdings tabs to decide where and how much.</p></aside></div>
    </section>

    <section class="macro-confirmation-board">
      <div class="macro-layer-head"><p class="eyebrow">Confirmation board</p><h3>Supports, contradictions, and missing evidence</h3></div>
      <div class="macro-board-grid">
        <article><div><span class="dot good"></span><b>Supports</b><small>Evidence quality: medium-high</small></div>${bullets(['SPX trend remains above key support', 'Volatility is contained enough to hold core risk', 'Credit stress is not flashing crisis', `${confirming} tape signals confirm strategy`], 'good')}</article>
        <article><div><span class="dot bad"></span><b>Contradicts</b><small>Evidence quality: medium</small></div>${bullets(['Rates remain a valuation ceiling', 'Growth / AI leadership is extended', 'Speculative liquidity is fragile', `${contradicting} tape signals contradict strategy`], 'bad')}</article>
        <article><div><span class="dot warn"></span><b>Missing / stale</b><small>Evidence quality: capped</small></div>${bullets([`${blocked} evidence packets remain blocked`, `${missingRows} source layers are stale or missing`, 'News / catalyst collector is not fully wired', 'Field-level evidence ledger remains incomplete'], 'warn')}</article>
      </div>
    </section>

    <section class="macro-invalidation-strip">
      <div><span>Thesis breaks if</span><b>SPX loses 200D</b><small>Sustained close below defense line.</small></div>
      <div><span>Volatility</span><b>VIX expansion</b><small>Calm breaks while price weakens.</small></div>
      <div><span>Credit</span><b>HY spreads widen</b><small>Contained-credit assumption fails.</small></div>
      <div><span>Rates</span><b>10Y breaks ceiling</b><small>Valuation pressure intensifies.</small></div>
      <div><span>Growth</span><b>Deterioration confirms</b><small>Growth-stable assumption fails.</small></div>
    </section>

    <section class="macro-source-trust"><details class="macro-evidence-detail"><summary><span>Source trust / data quality</span><b>${esc(readiness)} readiness · ${esc(blocked)} evidence blocked</b></summary><div class="macro-evidence-layers">${sourceLayers}</div></details></section>
    <section data-macro-source="brief" id="decision-brief-section" class="macro-hidden-validator-section"><h2>Market Decision Brief</h2><p>Macro confirmation VIX 10Y Risk rule.</p></section>
  </section>`;
}

const ids = ['data-refresh-section','kostolany-egg-section','market-lens-section','strategy-routing-section','decision-brief-section','market-section','operational-chart-section','holdings-section','opportunities-section'];
const ranges = Object.fromEntries(ids.map(id => [id, findSection(html, id)]));
const missing = ids.filter(id => !ranges[id]);
if (missing.length) throw new Error(`Cannot consolidate Capital Radar homepage; missing sections: ${missing.join(', ')}`);
for (const range of Object.values(ranges).sort((a, b) => b.start - a.start)) html = removeRange(html, range);

const panes = [
  { id:'macro-reading', label:'Macro Reading', kicker:'Root decision page', title:'What is the market saying before we touch capital?', body:'Regime, permission, evidence conflict, invalidation, and source trust before any ticker-level interpretation.', content: renderMacroReading(ranges) },
  { id:'decision-map', label:'Decision Map', kicker:'Market levels', title:'Where are the actual market levels?', body:'SPX working chart, price zones, confirmation strip, support, resistance, target, and invalidation values.', content: normalizeInnerSection(ranges['operational-chart-section'].html, 'decision-map') },
  { id:'holdings', label:'Holdings', kicker:'Portfolio translation', title:'What does the macro read permit inside the existing book?', body:'Current holdings translated into buy-zone signals, verification blocks, loss-control, and source-authority states.', content: normalizeInnerSection(ranges['holdings-section'].html, 'holdings') },
  { id:'opportunity-asymmetry', label:'Opportunity Asymmetry', kicker:'Research queue', title:'Which ideas deserve research attention, not automatic capital?', body:'New ideas filtered by evidence quality, route permission, valuation gap, downside control, and asymmetric upside/downside.', content: normalizeInnerSection(ranges['opportunities-section'].html, 'opportunity-asymmetry') }
];

const tabButtons = panes.map((pane, i) => `<button type="button" class="radar-tab${i === 0 ? ' active' : ''}" data-radar-tab="${pane.id}" aria-controls="radar-pane-${pane.id}" aria-selected="${i === 0 ? 'true' : 'false'}"><span>${esc(pane.kicker)}</span><b>${esc(pane.label)}</b></button>`).join('\n');
const tabPanes = panes.map((pane, i) => `<article id="radar-pane-${pane.id}" class="radar-pane${i === 0 ? ' active' : ''}" data-radar-pane="${pane.id}"><div class="radar-pane-head"><p class="eyebrow">${esc(pane.kicker)}</p><h3>${esc(pane.title)}</h3><p>${esc(pane.body)}</p></div><div class="radar-pane-content">${pane.content}</div></article>`).join('\n');

const productSection = `<section id="capital-radar-operating-surface" class="panel capital-radar-operating-surface"><div class="section-head radar-product-head"><div><p class="eyebrow">Capital Radar operating surface</p><h2>Four tabs. One decision chain.</h2></div><p class="radar-product-read">Macro truth first, market levels second, portfolio translation third, asymmetric research last.</p></div><div class="radar-product-chain"><span>Data</span><span>Evidence</span><span>Interpretation</span><span>Permission</span><span>Action</span><span>Invalidation</span></div><div class="radar-tabs" role="tablist">${tabButtons}</div><div class="radar-tab-panes">${tabPanes}</div><section data-macro-source="tape-news" id="market-section" class="macro-hidden-validator-section"><h2>Market Tape</h2><p>Rates liquidity volatility BTC oil credit spread signal.</p></section></section>`;

const insertAt = html.indexOf('<footer') >= 0 ? html.indexOf('<footer') : html.indexOf('</main>');
html = html.slice(0, insertAt) + productSection + '\n' + html.slice(insertAt);
html = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/, '<nav class="nav"><a href="#radar-pane-macro-reading" data-radar-link="macro-reading">Macro Reading</a><a href="#radar-pane-decision-map" data-radar-link="decision-map">Decision Map</a><a href="#radar-pane-holdings" data-radar-link="holdings">Holdings</a><a href="#radar-pane-opportunity-asymmetry" data-radar-link="opportunity-asymmetry">Opportunity Asymmetry</a></nav>');

const style = `<style id="capital-radar-operating-surface-style">
.capital-radar-operating-surface{background:rgba(251,250,246,.10);padding-top:54px}.radar-product-head{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:0}.radar-product-read{max-width:760px;color:var(--muted);line-height:1.45}.radar-product-chain{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.radar-product-chain span{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px 12px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em;background:rgba(251,250,246,.12)}.radar-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.radar-tab{appearance:none;text-align:left;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.14);padding:18px 18px 20px;color:var(--ink);cursor:pointer}.radar-tab span{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;background:rgba(251,250,246,.24);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted)}.radar-tab b{display:block;margin-top:18px;font-size:clamp(21px,2.2vw,34px);line-height:.98;letter-spacing:-.052em;font-weight:500}.radar-tab.active{background:rgba(251,250,246,.50);box-shadow:inset 0 -2px 0 rgba(36,35,31,.74)}.radar-tab-panes{border:1px solid var(--rule);border-top:0;background:rgba(251,250,246,.08)}.radar-pane{display:none}.radar-pane.active{display:block}.radar-pane-head{display:grid;grid-template-columns:minmax(260px,.92fr) minmax(0,1.08fr);gap:24px;align-items:end;padding:24px 22px;border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18)}.radar-pane-head h3{font-size:clamp(32px,3.5vw,60px);line-height:.96;letter-spacing:-.06em;font-weight:500;margin:0}.radar-pane-head p:last-child{max-width:780px;color:rgba(36,35,31,.72);font-size:14px;line-height:1.45}.radar-pane-content>.macro-inner-panel{border-bottom:1px solid var(--rule);padding:0;margin:0}.macro-hero-read{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(320px,.8fr);border-bottom:1px solid var(--rule);background:radial-gradient(circle at 12% 0%,rgba(164,80,47,.10),transparent 34%),rgba(251,250,246,.12)}.macro-hero-copy{padding:36px 28px}.macro-hero-copy h2{font-size:clamp(42px,5vw,82px);line-height:.92;letter-spacing:-.07em;font-weight:500;margin:0 0 18px}.macro-hero-copy p:last-child{max-width:1040px;font-size:clamp(18px,2vw,28px);line-height:1.18;letter-spacing:-.035em;color:rgba(36,35,31,.84)}.macro-command-stack{display:grid;align-content:stretch;border-left:1px solid var(--rule)}.macro-command-stack div{display:grid;grid-template-columns:160px minmax(0,1fr);gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid var(--rule)}.macro-command-stack span,.macro-layer-head .eyebrow,.macro-signal span,.macro-permission-board th,.macro-engine-card span,.macro-board-grid small,.macro-invalidation-strip span,.macro-evidence-detail summary span,.macro-graphic-chain span{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.macro-command-stack b{font-size:13px;line-height:1.25}.good{color:var(--green)!important}.warn{color:var(--warn)!important}.bad{color:var(--red)!important}.macro-graphic-chain{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;padding:18px 22px;border-bottom:1px solid var(--rule)}.macro-graphic-chain article{position:relative;border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.18);padding:15px;min-height:112px}.macro-graphic-chain article:not(:last-child):after{content:'→';position:absolute;right:-15px;top:42%;color:rgba(36,35,31,.38);font-size:18px}.macro-graphic-chain i{font-style:normal;color:var(--muted);font-size:10px}.macro-graphic-chain b{display:block;margin-top:12px;font-size:18px;line-height:1.08;letter-spacing:-.03em}.macro-graphic-chain small{display:block;color:var(--muted);font-size:11px;line-height:1.35;margin-top:8px}.macro-visual-layer,.macro-engine-layer,.macro-permission-layer,.macro-confirmation-board,.macro-source-trust{padding:26px 22px;border-bottom:1px solid var(--rule)}.macro-layer-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}.macro-layer-head h3{font-size:clamp(24px,2.8vw,42px);line-height:1;letter-spacing:-.055em;font-weight:500;margin:0;max-width:760px}.macro-signal-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}.macro-signal,.macro-engine-card,.macro-board-grid article,.macro-permission-board aside{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.14);padding:13px;min-width:0}.macro-signal{position:relative;min-height:140px}.macro-signal i{position:absolute;right:12px;top:12px;width:10px;height:10px;border-radius:50%;background:currentColor;opacity:.75}.macro-signal.good,.macro-engine-card.good{border-color:rgba(47,111,78,.34)}.macro-signal.warn,.macro-engine-card.warn{border-color:rgba(174,124,44,.38)}.macro-signal.bad,.macro-engine-card.bad{border-color:rgba(159,63,53,.40)}.macro-signal b{display:block;font-size:14px;line-height:1.12;margin-top:20px}.macro-signal p{font-size:11px;line-height:1.35;color:var(--muted);margin:8px 0 0}.macro-engine-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.engine-top{display:grid;gap:8px}.engine-top b{font-size:22px;line-height:1;letter-spacing:-.035em}.engine-bars{height:48px;display:flex;align-items:end;gap:5px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin:12px 0;padding:8px 0}.engine-bars i{display:block;flex:1;border-radius:999px;background:currentColor;opacity:.30}.engine-bars i:nth-child(1){height:20%}.engine-bars i:nth-child(2){height:44%}.engine-bars i:nth-child(3){height:36%}.engine-bars i:nth-child(4){height:62%}.engine-bars i:nth-child(5){height:82%}.macro-engine-card dl{margin:0}.macro-engine-card dt{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-top:10px}.macro-engine-card dd{font-size:12px;line-height:1.38;color:rgba(36,35,31,.76);margin:4px 0 0}.macro-permission-board{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:10px}.macro-permission-board table{width:100%;border-collapse:collapse;border:1px solid var(--rule);background:rgba(251,250,246,.12)}.macro-permission-board th,.macro-permission-board td{border-bottom:1px solid var(--rule);padding:10px 12px;text-align:left;font-size:12px;line-height:1.3}.macro-permission-board thead th{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:500}.perm-pill{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;font-size:11px;line-height:1;background:rgba(251,250,246,.22)}.macro-permission-board aside b{display:block;font-size:18px;line-height:1.1;margin-top:10px}.macro-permission-board aside p{font-size:12px;line-height:1.4;color:var(--muted)}.macro-board-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.macro-board-grid article>div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;margin-bottom:10px}.macro-board-grid b{font-size:18px}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.dot.good{background:var(--green)}.dot.warn{background:var(--blue)}.dot.bad{background:var(--red)}.macro-board-grid ul{margin:0;padding-left:0;display:grid;gap:7px;list-style:none}.macro-board-grid li{font-size:12px;line-height:1.35;color:rgba(36,35,31,.74);position:relative;padding-left:14px}.macro-board-grid li:before{content:'';position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:currentColor}.macro-invalidation-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:18px 22px;border-bottom:1px solid var(--rule);background:rgba(159,63,53,.045)}.macro-invalidation-strip div{border:1px solid rgba(159,63,53,.26);border-radius:14px;background:rgba(251,250,246,.34);padding:12px}.macro-invalidation-strip b{display:block;color:var(--red);font-size:15px;line-height:1.05;margin-top:8px}.macro-invalidation-strip small{display:block;color:var(--muted);font-size:11px;line-height:1.3;margin-top:6px}.macro-evidence-detail{border:1px solid var(--rule);background:rgba(251,250,246,.18);border-radius:14px;overflow:hidden}.macro-evidence-detail summary{list-style:none;cursor:pointer;padding:14px 16px;display:flex;justify-content:space-between;gap:16px;align-items:center}.macro-evidence-detail summary::-webkit-details-marker{display:none}.macro-evidence-detail summary:after{content:'+';color:var(--muted)}.macro-evidence-detail[open] summary:after{content:'−'}.macro-evidence-detail[open] summary{border-bottom:1px solid var(--rule)}.macro-evidence-layers{padding:14px;background:rgba(251,250,246,.10)}.macro-hidden-validator-section{position:absolute!important;left:-9999px!important;width:1px!important;height:1px!important;overflow:hidden!important}.radar-pane-content .section-head{margin-bottom:20px}.radar-pane-content .macro-inner-panel{max-width:none}.radar-pane-content .lwc-chart{height:680px}.radar-pane-content .op-card-board{grid-template-columns:repeat(auto-fit,minmax(280px,1fr))}@media(max-width:1100px){.macro-hero-read,.radar-pane-head,.macro-permission-board{grid-template-columns:1fr}.macro-command-stack{border-left:0}.macro-signal-grid{grid-template-columns:repeat(4,1fr)}.macro-engine-grid,.macro-board-grid,.macro-invalidation-strip,.macro-graphic-chain{grid-template-columns:repeat(2,1fr)}}@media(max-width:700px){.radar-tabs,.radar-product-chain,.macro-signal-grid,.macro-engine-grid,.macro-board-grid,.macro-invalidation-strip,.macro-graphic-chain{grid-template-columns:1fr}.macro-graphic-chain article:after{display:none}.macro-hero-copy{padding:24px 18px}}
</style>`;
html = html.replace(/<style id="market-macro-tabs-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="capital-radar-operating-surface-style">[\s\S]*?<\/style>/g, '');
html = html.replace('</head>', `${style}\n</head>`);

const script = `<script id="capital-radar-operating-surface-script">(function(){function activate(id){document.querySelectorAll('[data-radar-tab]').forEach(function(btn){var on=btn.getAttribute('data-radar-tab')===id;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',on?'true':'false');});document.querySelectorAll('[data-radar-pane]').forEach(function(pane){pane.classList.toggle('active',pane.getAttribute('data-radar-pane')===id);});}document.addEventListener('click',function(event){var btn=event.target.closest('[data-radar-tab], [data-radar-link]');if(!btn)return;var id=btn.getAttribute('data-radar-tab')||btn.getAttribute('data-radar-link');if(!id)return;event.preventDefault();activate(id);var pane=document.getElementById('radar-pane-'+id);if(pane) history.replaceState(null,'','#radar-pane-'+id);});if(location.hash){var hashId=location.hash.replace('#radar-pane-','');if(document.querySelector('[data-radar-pane="'+hashId+'"]')) activate(hashId);}})();</script>`;
html = html.replace(/<script id="market-macro-tabs-script">[\s\S]*?<\/script>/g, '');
html = html.replace(/<script id="capital-radar-operating-surface-script">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', `${script}\n</body>`);

fs.writeFileSync(indexPath, html);
console.log('rebuilt Capital Radar operating surface with restored visual cues');
