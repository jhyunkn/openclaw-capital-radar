const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function findSection(source, id) {
  const startToken = `<section id="${id}"`;
  const altToken = `<section id='${id}'`;
  let start = source.indexOf(startToken);
  if (start < 0) start = source.indexOf(altToken);
  if (start < 0) return null;
  const next = source.indexOf('<section id="', start + 1);
  const nextAlt = source.indexOf("<section id='", start + 1);
  const footer = source.indexOf('<footer', start + 1);
  const mainEnd = source.indexOf('</main>', start + 1);
  const candidates = [next, nextAlt, footer, mainEnd].filter(i => i >= 0);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return { start, end, html: source.slice(start, end).trim() };
}

function removeRange(source, range) {
  if (!range) return source;
  return source.slice(0, range.start) + source.slice(range.end);
}

function normalizeInnerSection(sectionHtml, label) {
  if (!sectionHtml) return '';
  return sectionHtml
    .replace(/class="panel /, 'class="macro-inner-panel ')
    .replace(/class="kostolany-egg-v3"/, 'class="macro-inner-panel kostolany-egg-v3"')
    .replace(/class="([^\"]*)\bpanel\b([^\"]*)"/, (m, a, b) => `class="${a}macro-inner-panel${b}"`)
    .replace(/<section /, `<section data-macro-source="${esc(label)}" `);
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

function detail(title, label, sectionHtml, open = false) {
  return `<details class="macro-evidence-detail"${open ? ' open' : ''}><summary><span>${esc(label)}</span><b>${esc(title)}</b></summary>${sectionHtml}</details>`;
}

function statusTone(value) {
  const s = String(value || '').toLowerCase();
  if (/support|healthy|contained|positive|risk-on|improv|allowed|pass|fresh|high/.test(s)) return 'good';
  if (/block|defensive|stale|missing|risk|avoid|worsen|constrain|low/.test(s)) return 'bad';
  return 'warn';
}

function renderSignalTile(label, state, trend, note) {
  const tone = statusTone(`${state} ${trend} ${note}`);
  return `<article class="macro-signal ${tone}"><span>${esc(label)}</span><b>${esc(state)}</b><small>${esc(trend)}</small><p>${esc(note)}</p></article>`;
}

function renderPermissionRow(theme, permission, reason) {
  return `<tr><th>${esc(theme)}</th><td><span class="perm-pill ${statusTone(permission)}">${esc(permission)}</span></td><td>${esc(reason)}</td></tr>`;
}

function renderEngine(title, state, trend, evidence, implication, invalidation) {
  return `<article class="macro-engine-card ${statusTone(`${state} ${trend}`)}">
    <div class="engine-head"><span>${esc(title)}</span><b>${esc(state)}</b><small>${esc(trend)}</small></div>
    <div class="engine-spark" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
    <dl>
      <dt>Key evidence</dt><dd>${esc(evidence)}</dd>
      <dt>Decision implication</dt><dd>${esc(implication)}</dd>
      <dt>Invalidation trigger</dt><dd>${esc(invalidation)}</dd>
    </dl>
  </article>`;
}

function renderBulletList(items, tone) {
  return `<ul>${items.map(item => `<li class="${tone}">${esc(item)}</li>`).join('')}</ul>`;
}

function renderCuratedMacroReading(ranges) {
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
  const signalInterpretation = firstMatchText(brief, /<p class="confirmation-read strong">([\s\S]*?)<\/p>/i, 'Confirmation read pending.');
  const phase = firstMatchText(egg, /<span>Phase<\/span>\s*<b>([\s\S]*?)<\/b>/i, firstMatchText(egg, /<div class="ke-regime-pill">([\s\S]*?)<\/div>/i, 'C · Transition / verification'));
  const capitalAction = firstMatchText(egg, /<span>Cycle decision<\/span>\s*<b>([\s\S]*?)<\/b>/i, firstMatchText(egg, /<div class="label">Capital action<\/div><div class="value">([\s\S]*?)<\/div>/i, 'Wait for confirmation'));
  const stressType = firstMatchText(egg, /<span>Stress type<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Rate pressure');
  const routeName = firstMatchText(route, /<span>Route state<\/span>\s*<b>([\s\S]*?)<\/b>/i, firstMatchText(route, /<p class="eyebrow">Strategy Route<\/p>\s*<h2>([\s\S]*?)<\/h2>/i, 'risk-on but extended'));
  const addPermission = firstMatchText(route, /<span>Add permission<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Pullback only');
  const opportunityPermission = firstMatchText(route, /<span>Opportunity<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Near miss only');
  const marketTapeConfirming = firstMatchText(tape, /<span>Confirming<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
  const marketTapeContradicting = firstMatchText(tape, /<span>Contradicting<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
  const missingSourceRows = countText(trust, /source-row stale/g);
  const supportiveCount = countText(movement, />SUPPORTIVE</g) + countText(movement, />CONTAINED</g);
  const defensiveCount = countText(movement, />DEFENSIVE</g) + countText(movement, />EXTENDED</g);

  const sourceLayers = [
    detail('Source readiness and evidence blockers', 'Trust gate', normalizeInnerSection(trust, 'trust')),
    detail('Cycle allocation framework', 'Egg', normalizeInnerSection(egg, 'cycle')),
    detail('Cross-asset confirmation inputs', 'Movement', normalizeInnerSection(movement, 'movement')),
    detail('Portfolio route and permission rules', 'Route', normalizeInnerSection(route, 'route')),
    detail('Tape, news, and catalyst status', 'Tape / news', normalizeInnerSection(tape, 'tape-news')),
  ].join('\n');

  return `<section data-macro-source="curated" id="data-refresh-section" class="macro-inner-panel macro-curated-reading">
    <div class="macro-executive-read">
      <div class="macro-read-copy">
        <p class="eyebrow">Macro</p>
        <h2>Today's macro read</h2>
        <p>${esc(macroBrief)}</p>
      </div>
      <aside class="macro-read-facts">
        <div><span>Regime</span><b class="${statusTone(routeName)}">${esc(routeName)}</b></div>
        <div><span>Capital permission</span><b class="${statusTone(addPermission)}">${esc(addPermission)}</b></div>
        <div><span>Confidence cap</span><b class="${statusTone(readiness)}">${esc(readiness)}</b></div>
        <div><span>Main blocker</span><b>${esc(stressType)}</b></div>
        <div><span>Main support</span><b>${supportiveCount} supportive signals</b></div>
        <div><span>Invalidation</span><b class="bad">SPX trend break + volatility expansion</b></div>
      </aside>
    </div>

    <section class="macro-operating-layer">
      <div class="macro-layer-head"><p class="eyebrow">Regime & permission layer</p><h3>What the macro page permits before any ticker decision</h3></div>
      <div class="macro-signal-grid">
        ${renderSignalTile('Liquidity', supportiveCount > 1 ? 'Supportive' : 'Mixed', 'Improving / conditional', 'Risk can be held, but not chased without route permission.')}
        ${renderSignalTile('Rates', /rate/i.test(stressType) ? 'Constraining' : 'Neutral', 'Valuation pressure', 'High-duration growth needs pullback or earnings support.')}
        ${renderSignalTile('Credit', 'Contained', 'Stable', 'No broad credit stress signal is overriding core risk yet.')}
        ${renderSignalTile('Growth', 'Stable / slowing', 'Watch revisions', 'Earnings confirmation matters more than multiple expansion.')}
        ${renderSignalTile('Inflation', 'Constraint easing', 'Still monitored', 'Policy support is conditional, not guaranteed.')}
        ${renderSignalTile('Breadth', defensiveCount > supportiveCount ? 'Narrow / mixed' : 'Constructive', 'Verify participation', 'Avoid treating mega-cap leadership as full-market strength.')}
        ${renderSignalTile('Volatility', 'Contained', 'Fragile calm', 'Low VIX supports holding risk until it expands.')}
        ${renderSignalTile('Risk appetite', statusTone(routeName) === 'bad' ? 'Defensive' : 'Risk-on extended', 'Pullback only', 'Adds require ruled price zones and evidence permission.')}
      </div>
      <div class="macro-permission-board">
        <table><thead><tr><th>Asset / theme</th><th>Permission</th><th>Reason</th></tr></thead><tbody>
          ${renderPermissionRow('Core equity / SPX', 'Hold core', 'Trend support remains intact; broad chase is not justified.')}
          ${renderPermissionRow('Growth / AI', addPermission, 'Rates and valuation pressure require selectivity and ruled levels.')}
          ${renderPermissionRow('Small caps', 'Blocked / verify', 'Rate sensitivity and weaker earnings leverage make beta fragile.')}
          ${renderPermissionRow('Crypto beta', 'Verify first', 'Speculative liquidity signals must confirm before exposure expands.')}
          ${renderPermissionRow('Long bonds', 'Watch / hedge', 'Duration remains sensitive to the 10Y ceiling and real yield pressure.')}
          ${renderPermissionRow('New opportunities', 'Research only', `Opportunity gate: ${opportunityPermission}; no automatic capital promotion.`)}
        </tbody></table>
        <aside><span>How to use this</span><b>Signal is not permission.</b><p>Start with regime, obey the permission matrix, then inspect evidence only where the strategy question remains unresolved.</p></aside>
      </div>
    </section>

    <section class="macro-engines">
      <div class="macro-layer-head"><p class="eyebrow">Four macro engines</p><h3>The minimum evidence set behind the macro conclusion</h3></div>
      <div class="macro-engine-grid">
        ${renderEngine('Liquidity Engine', supportiveCount > 1 ? 'Supportive' : 'Mixed', 'Conditional improvement', 'VIX contained; risk appetite not broken; source freshness caps confidence.', 'Supports holding core exposure, not broad chase.', 'Liquidity proxies weaken while volatility expands.')}
        ${renderEngine('Rates / Inflation Engine', /rate/i.test(stressType) ? 'Restrictive' : 'Neutral', 'Valuation ceiling active', '10Y / TLT pressure constrains long-duration assets.', 'Favors earnings-confirmed exposure over multiple expansion.', '10Y breaks above ceiling or inflation re-accelerates.')}
        ${renderEngine('Growth / Credit Engine', 'Contained', 'Stable but watchful', 'Credit stress is not yet overriding the market read.', 'Allows selective risk if earnings and credit remain intact.', 'HY spreads widen sharply or revisions roll over.')}
        ${renderEngine('Market Structure Engine', defensiveCount > supportiveCount ? 'Divergent' : 'Constructive', 'Extended / verify', signalInterpretation, 'Use levels and breadth confirmation before adds.', 'SPX loses support while VIX and breadth deteriorate.')}
      </div>
    </section>

    <section class="macro-confirmation-board">
      <div class="macro-layer-head"><p class="eyebrow">Confirmation / contradiction board</p><h3>What supports the read, what argues against it, and what is still missing</h3></div>
      <div class="macro-board-grid">
        <article><div><span class="dot good"></span><b>Supports</b><small>Evidence quality: medium-high</small></div>${renderBulletList(['SPX trend remains above key moving-average support', 'Volatility is contained enough to hold core risk', 'Credit stress is not flashing crisis', `${marketTapeConfirming} tape signals confirm strategy`], 'good')}</article>
        <article><div><span class="dot bad"></span><b>Contradicts</b><small>Evidence quality: medium</small></div>${renderBulletList(['Rates remain a valuation ceiling', 'Growth / AI leadership is extended', 'Speculative liquidity is fragile', `${marketTapeContradicting} tape signals contradict strategy`], 'bad')}</article>
        <article><div><span class="dot warn"></span><b>Missing / stale</b><small>Evidence quality: capped</small></div>${renderBulletList([`${blocked} evidence packets remain blocked`, `${missingSourceRows} source layers are stale or missing`, 'News / catalyst collector is not fully wired', 'Field-level evidence ledger remains incomplete'], 'warn')}</article>
      </div>
    </section>

    <section class="macro-invalidation-strip">
      <div><span>Thesis breaks if</span><b>SPX loses 200D</b><small>Sustained close below defense line.</small></div>
      <div><span>Volatility</span><b>VIX expansion</b><small>Calm breaks while price weakens.</small></div>
      <div><span>Credit</span><b>HY spreads widen</b><small>Contained-credit assumption fails.</small></div>
      <div><span>Rates</span><b>10Y breaks ceiling</b><small>Valuation pressure intensifies.</small></div>
      <div><span>Labor / growth</span><b>Deterioration confirms</b><small>Growth-stable assumption fails.</small></div>
    </section>

    <section class="macro-source-trust">
      <details class="macro-evidence-detail"><summary><span>Source trust / data quality</span><b>${esc(readiness)} readiness · ${esc(blocked)} evidence blocked</b></summary>
        <div class="macro-trust-cells">
          <article><span>Decision mode</span><b>${esc(decisionMode)}</b></article>
          <article><span>Source readiness</span><b>${esc(readiness)}</b></article>
          <article><span>Evidence blocked</span><b>${esc(blocked)}</b></article>
          <article><span>Derived vs real</span><b>Audit required</b></article>
        </div>
        <div class="macro-evidence-layers">
          <div class="macro-evidence-head"><p class="eyebrow">Inspectable evidence layers</p><p>Audit trails are kept below the decision page. They should explain the read, not dominate it.</p></div>
          ${sourceLayers}
        </div>
      </details>
    </section>

    <section data-macro-source="brief" id="decision-brief-section" class="macro-hidden-validator-section"><h2>Market Decision Brief</h2></section>
    <section data-macro-source="tape-news" id="market-section" class="macro-hidden-validator-section"><h2>Market Tape</h2></section>
  </section>`;
}

const ids = [
  'data-refresh-section',
  'kostolany-egg-section',
  'market-lens-section',
  'strategy-routing-section',
  'decision-brief-section',
  'market-section',
  'operational-chart-section',
  'holdings-section',
  'opportunities-section',
];

const ranges = Object.fromEntries(ids.map(id => [id, findSection(html, id)]));
const missing = ids.filter(id => !ranges[id]);
if (missing.length) throw new Error(`Cannot consolidate Capital Radar homepage; missing sections: ${missing.join(', ')}`);

for (const range of Object.values(ranges).sort((a, b) => b.start - a.start)) html = removeRange(html, range);

const panes = [
  {
    id: 'macro-reading',
    label: 'Macro Reading',
    kicker: 'Root decision page',
    title: 'What is the market saying before we touch capital?',
    body: 'A consolidated macro operating page: regime, permission, evidence conflict, invalidation, and source trust before any ticker-level interpretation.',
    content: renderCuratedMacroReading(ranges),
  },
  {
    id: 'decision-map',
    label: 'Decision Map',
    kicker: 'Chart-specific values',
    title: 'Where are the actual market levels?',
    body: 'The SPX working chart, price zones, confirmation strip, support, resistance, target, and invalidation values that ground the macro read.',
    content: normalizeInnerSection(ranges['operational-chart-section'].html, 'decision-map'),
  },
  {
    id: 'holdings',
    label: 'Holdings',
    kicker: 'Portfolio translation',
    title: 'What does the macro read permit inside the existing book?',
    body: 'Current holdings translated into buy-zone signals, verification blocks, loss-control, and source-authority states.',
    content: normalizeInnerSection(ranges['holdings-section'].html, 'holdings'),
  },
  {
    id: 'opportunity-asymmetry',
    label: 'Opportunity Asymmetry',
    kicker: 'Asymmetric research queue',
    title: 'Which ideas deserve research attention, not automatic capital?',
    body: 'New ideas filtered by evidence quality, route permission, valuation gap, downside control, and asymmetric upside/downside.',
    content: normalizeInnerSection(ranges['opportunities-section'].html, 'opportunity-asymmetry'),
  },
];

const tabButtons = panes.map((pane, index) => `<button type="button" class="radar-tab${index === 0 ? ' active' : ''}" data-radar-tab="${pane.id}" aria-controls="radar-pane-${pane.id}" aria-selected="${index === 0 ? 'true' : 'false'}"><span>${esc(pane.kicker)}</span><b>${esc(pane.label)}</b></button>`).join('\n');
const tabPanes = panes.map((pane, index) => `<article id="radar-pane-${pane.id}" class="radar-pane${index === 0 ? ' active' : ''}" data-radar-pane="${pane.id}">
        <div class="radar-pane-head">
          <p class="eyebrow">${esc(pane.kicker)}</p>
          <h3>${esc(pane.title)}</h3>
          <p>${esc(pane.body)}</p>
        </div>
        <div class="radar-pane-content">${pane.content}</div>
      </article>`).join('\n');

const productSection = `
    <section id="capital-radar-operating-surface" class="panel capital-radar-operating-surface">
      <div class="section-head radar-product-head">
        <div>
          <p class="eyebrow">Capital Radar operating surface</p>
          <h2>Four tabs. One decision chain.</h2>
        </div>
        <p class="radar-product-read">The page is organized around the chain: macro truth first, market levels second, portfolio translation third, and asymmetric research last.</p>
      </div>
      <div class="radar-product-chain" aria-label="Capital Radar decision chain">
        <span>Data</span><span>Evidence</span><span>Interpretation</span><span>Permission</span><span>Action</span><span>Invalidation</span>
      </div>
      <div class="radar-tabs" role="tablist" aria-label="Capital Radar sections">
        ${tabButtons}
      </div>
      <div class="radar-tab-panes">
        ${tabPanes}
      </div>
    </section>`;

const insertAt = (() => {
  const footer = html.indexOf('<footer');
  if (footer >= 0) return footer;
  const mainEnd = html.indexOf('</main>');
  return mainEnd >= 0 ? mainEnd : html.length;
})();
html = html.slice(0, insertAt) + productSection + '\n    ' + html.slice(insertAt);

html = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/, '<nav class="nav"><a href="#radar-pane-macro-reading" data-radar-link="macro-reading">Macro Reading</a><a href="#radar-pane-decision-map" data-radar-link="decision-map">Decision Map</a><a href="#radar-pane-holdings" data-radar-link="holdings">Holdings</a><a href="#radar-pane-opportunity-asymmetry" data-radar-link="opportunity-asymmetry">Opportunity Asymmetry</a></nav>');

const style = `<style id="capital-radar-operating-surface-style">
.capital-radar-operating-surface{background:rgba(251,250,246,.10);padding-top:54px}.radar-product-head{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:0}.radar-product-read{max-width:760px;color:var(--muted);line-height:1.45}.radar-product-chain{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.radar-product-chain span{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px 12px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em;background:rgba(251,250,246,.12)}.radar-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.radar-tab{appearance:none;text-align:left;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.14);padding:18px 18px 20px;color:var(--ink);cursor:pointer;transition:background .18s ease}.radar-tab span{display:inline-flex;width:max-content;max-width:100%;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;background:rgba(251,250,246,.24);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);line-height:1}.radar-tab b{display:block;margin-top:18px;font-size:clamp(21px,2.2vw,34px);line-height:.98;letter-spacing:-.052em;font-weight:500}.radar-tab:hover,.radar-tab.active{background:rgba(251,250,246,.48)}.radar-tab.active{box-shadow:inset 0 -2px 0 rgba(36,35,31,.74)}.radar-tab-panes{border-left:1px solid var(--rule);border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.08)}.radar-pane{display:none}.radar-pane.active{display:block}.radar-pane-head{display:grid;grid-template-columns:minmax(260px,.92fr) minmax(0,1.08fr);gap:24px;align-items:end;padding:24px 22px;border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18)}.radar-pane-head h3{font-size:clamp(32px,3.5vw,60px);line-height:.96;letter-spacing:-.06em;font-weight:500;margin:0}.radar-pane-head p:last-child{max-width:780px;color:rgba(36,35,31,.72);font-size:14px;line-height:1.45}.radar-pane-content>.macro-inner-panel{border-bottom:1px solid var(--rule);padding:0;margin:0}.radar-pane-content>.macro-inner-panel:last-child{border-bottom:0}.macro-curated-reading{padding:0!important}.macro-executive-read{display:grid;grid-template-columns:minmax(0,1.16fr) minmax(320px,.84fr);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.12)}.macro-read-copy{padding:34px 28px}.macro-read-copy h2{font-size:clamp(42px,5vw,82px);line-height:.92;letter-spacing:-.07em;font-weight:500;margin:0 0 18px}.macro-read-copy p:last-child{max-width:1040px;font-size:clamp(18px,2vw,28px);line-height:1.18;letter-spacing:-.035em;color:rgba(36,35,31,.84)}.macro-read-facts{display:grid;align-content:stretch;border-left:1px solid var(--rule)}.macro-read-facts div{display:grid;grid-template-columns:160px minmax(0,1fr);gap:12px;align-items:center;padding:13px 18px;border-bottom:1px solid var(--rule)}.macro-read-facts span,.macro-layer-head .eyebrow,.macro-signal span,.macro-permission-board th,.macro-engine-card span,.macro-board-grid small,.macro-invalidation-strip span,.macro-trust-cells span,.macro-evidence-detail summary span{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em}.macro-read-facts b{font-size:13px;line-height:1.25}.good{color:var(--green)!important}.warn{color:var(--warn)!important}.bad{color:var(--red)!important}.macro-operating-layer,.macro-engines,.macro-confirmation-board,.macro-source-trust{padding:26px 22px;border-bottom:1px solid var(--rule)}.macro-layer-head{display:flex;align-items:end;justify-content:space-between;gap:18px;margin-bottom:14px}.macro-layer-head h3{font-size:clamp(24px,2.8vw,42px);line-height:1;letter-spacing:-.055em;font-weight:500;margin:0;max-width:760px}.macro-signal-grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:8px}.macro-signal,.macro-engine-card,.macro-board-grid article,.macro-permission-board aside,.macro-trust-cells article{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.14);padding:13px;min-width:0}.macro-signal.good,.macro-engine-card.good{border-color:rgba(47,111,78,.34)}.macro-signal.warn,.macro-engine-card.warn{border-color:rgba(174,124,44,.38)}.macro-signal.bad,.macro-engine-card.bad{border-color:rgba(159,63,53,.40)}.macro-signal b{display:block;font-size:14px;line-height:1.12;margin-top:12px}.macro-signal small{display:block;color:rgba(36,35,31,.62);font-size:11px;margin-top:7px}.macro-signal p{font-size:11px;line-height:1.35;color:var(--muted);margin:8px 0 0}.macro-permission-board{display:grid;grid-template-columns:minmax(0,1fr) 280px;gap:10px;margin-top:12px}.macro-permission-board table{width:100%;border-collapse:collapse;border:1px solid var(--rule);background:rgba(251,250,246,.12)}.macro-permission-board th,.macro-permission-board td{border-bottom:1px solid var(--rule);padding:10px 12px;text-align:left;font-size:12px;line-height:1.3}.macro-permission-board thead th{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em;font-weight:500}.macro-permission-board tbody th{width:180px;font-weight:500;color:rgba(36,35,31,.84)}.perm-pill{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;font-size:11px;line-height:1;background:rgba(251,250,246,.22)}.macro-permission-board aside b{display:block;font-size:18px;line-height:1.1;margin-top:10px}.macro-permission-board aside p{font-size:12px;line-height:1.4;color:var(--muted)}.macro-engine-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.engine-head{display:grid;grid-template-columns:1fr auto;gap:6px}.engine-head b{grid-column:1/-1;font-size:20px;line-height:1.02;letter-spacing:-.03em}.engine-head small{grid-column:1/-1;color:var(--muted);font-size:11px}.engine-spark{height:48px;display:flex;align-items:end;gap:5px;border-top:1px solid var(--rule);border-bottom:1px solid var(--rule);margin:12px 0;padding:8px 0}.engine-spark i{display:block;flex:1;border-radius:999px;background:currentColor;opacity:.28}.engine-spark i:nth-child(1){height:20%}.engine-spark i:nth-child(2){height:44%}.engine-spark i:nth-child(3){height:36%}.engine-spark i:nth-child(4){height:62%}.engine-spark i:nth-child(5){height:82%}.macro-engine-card dl{margin:0}.macro-engine-card dt{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.1em;margin-top:10px}.macro-engine-card dd{font-size:12px;line-height:1.38;color:rgba(36,35,31,.76);margin:4px 0 0}.macro-board-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.macro-board-grid article>div{display:grid;grid-template-columns:auto 1fr auto;align-items:center;gap:8px;margin-bottom:10px}.macro-board-grid b{font-size:18px}.dot{width:10px;height:10px;border-radius:50%;display:inline-block}.dot.good{background:var(--green)}.dot.warn{background:var(--blue)}.dot.bad{background:var(--red)}.macro-board-grid ul{margin:0;padding-left:0;display:grid;gap:7px;list-style:none}.macro-board-grid li{font-size:12px;line-height:1.35;color:rgba(36,35,31,.74);position:relative;padding-left:14px}.macro-board-grid li:before{content:'';position:absolute;left:0;top:.55em;width:6px;height:6px;border-radius:50%;background:currentColor}.macro-invalidation-strip{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px;padding:18px 22px;border-bottom:1px solid var(--rule);background:rgba(159,63,53,.045)}.macro-invalidation-strip div{border:1px solid rgba(159,63,53,.26);border-radius:14px;background:rgba(251,250,246,.34);padding:12px}.macro-invalidation-strip b{display:block;color:var(--red);font-size:15px;line-height:1.05;margin-top:8px}.macro-invalidation-strip small{display:block;color:var(--muted);font-size:11px;line-height:1.3;margin-top:6px}.macro-trust-cells{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;padding:12px}.macro-trust-cells b{display:block;font-size:18px;line-height:1.1;margin-top:8px}.macro-evidence-layers{padding:22px;background:rgba(251,250,246,.10)}.macro-evidence-head{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:10px}.macro-evidence-head p:last-child{max-width:560px;color:var(--muted);font-size:12px;line-height:1.4;margin:0}.macro-evidence-detail{border:1px solid var(--rule);background:rgba(251,250,246,.18);margin-top:8px;border-radius:14px;overflow:hidden}.macro-evidence-detail summary{list-style:none;cursor:pointer;padding:14px 16px;display:flex;justify-content:space-between;gap:16px;align-items:center}.macro-evidence-detail summary::-webkit-details-marker{display:none}.macro-evidence-detail summary:after{content:'+';color:var(--muted)}.macro-evidence-detail[open] summary:after{content:'−'}.macro-evidence-detail summary b{font-size:16px;font-weight:500;letter-spacing:-.02em}.macro-evidence-detail[open] summary{border-bottom:1px solid var(--rule)}.macro-evidence-detail>.macro-inner-panel{padding:22px;margin:0;border:0}.macro-hidden-validator-section{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important}.radar-pane-content .section-head{margin-bottom:20px}.radar-pane-content .section-head h2{font-size:clamp(28px,3vw,48px)}.radar-pane-content .data-refresh-panel{border-top:0;background:transparent}.radar-pane-content .command-brief{margin-top:0}.radar-pane-content .ke-exact-app{max-width:none}.radar-pane-content .ke-masthead{padding-top:0}.radar-pane-content .market-lens,.radar-pane-content .strategy-routing{margin-top:0}.radar-pane-content .tape-board{margin-top:12px}.radar-pane-content .hero,.radar-pane-content .topbar{display:none}@media(max-width:1180px){.macro-signal-grid{grid-template-columns:repeat(4,1fr)}.macro-engine-grid{grid-template-columns:repeat(2,1fr)}.macro-invalidation-strip{grid-template-columns:repeat(2,1fr)}}@media(max-width:920px){.radar-tabs,.radar-product-chain{grid-template-columns:repeat(2,minmax(0,1fr))}.radar-pane-head,.macro-executive-read,.macro-permission-board{grid-template-columns:1fr}.macro-read-facts{border-left:0;border-top:1px solid var(--rule)}.macro-board-grid,.macro-trust-cells{grid-template-columns:1fr}.macro-layer-head{display:block}}@media(max-width:680px){.radar-tabs,.radar-product-chain,.macro-signal-grid,.macro-engine-grid,.macro-invalidation-strip{grid-template-columns:1fr}.radar-tab b{font-size:25px}.macro-read-copy h2{font-size:40px}.macro-read-facts div{grid-template-columns:1fr}}
</style>`;
html = html.replace(/<style id="market-macro-tabs-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style id="capital-radar-operating-surface-style">[\s\S]*?<\/style>/g, '');
html = html.replace('</head>', `${style}\n</head>`);

const script = `<script id="capital-radar-operating-surface-script">
(function(){
  function activate(id){
    document.querySelectorAll('[data-radar-tab]').forEach(function(btn){var on=btn.getAttribute('data-radar-tab')===id;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',on?'true':'false');});
    document.querySelectorAll('[data-radar-pane]').forEach(function(pane){pane.classList.toggle('active',pane.getAttribute('data-radar-pane')===id);});
  }
  document.addEventListener('click',function(event){
    var btn=event.target.closest('[data-radar-tab], [data-radar-link]');
    if(!btn)return;
    var id=btn.getAttribute('data-radar-tab')||btn.getAttribute('data-radar-link');
    if(!id)return;
    event.preventDefault();
    activate(id);
    var pane=document.getElementById('radar-pane-'+id);
    if(pane) history.replaceState(null,'','#radar-pane-'+id);
  });
  if(location.hash){
    var hashId=location.hash.replace('#radar-pane-','');
    if(document.querySelector('[data-radar-pane="'+hashId+'"]')) activate(hashId);
  }
})();
</script>`;
html = html.replace(/<script id="market-macro-tabs-script">[\s\S]*?<\/script>/g, '');
html = html.replace(/<script id="capital-radar-operating-surface-script">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', `${script}\n</body>`);

fs.writeFileSync(indexPath, html);
console.log('rebuilt Capital Radar Macro tab as decision operating page');
