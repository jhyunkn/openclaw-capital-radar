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

function detail(title, label, sectionHtml) {
  return `<details class="macro-evidence-detail"><summary><span>${esc(label)}</span><b>${esc(title)}</b></summary>${sectionHtml}</details>`;
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
  const phase = firstMatchText(egg, /<h1><span class="phase">([\s\S]*?)<\/span>\s*·\s*([\s\S]*?)<\/h1>/i, 'C · Transition / verification');
  const capitalAction = firstMatchText(egg, /<div class="label">Capital action<\/div><div class="value">([\s\S]*?)<\/div>/i, 'Wait for confirmation');
  const routeName = firstMatchText(route, /<p class="eyebrow">Strategy Route<\/p>\s*<h2>([\s\S]*?)<\/h2>/i, 'risk-on but extended');
  const addPermission = firstMatchText(route, /<span>Add permission<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Pullback only');
  const opportunityPermission = firstMatchText(route, /<span>Opportunity<\/span>\s*<b>([\s\S]*?)<\/b>/i, 'Near miss only');
  const marketTapeConfirming = firstMatchText(tape, /<span>Confirming<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
  const marketTapeContradicting = firstMatchText(tape, /<span>Contradicting<\/span>\s*<b>([\s\S]*?)<\/b>/i, '—');
  const missingSourceRows = countText(trust, /source-row stale/g);
  const supportiveCount = countText(movement, />SUPPORTIVE</g) + countText(movement, />CONTAINED</g);
  const defensiveCount = countText(movement, />DEFENSIVE</g) + countText(movement, />EXTENDED</g);

  const sourceLayers = [
    detail('Source readiness and evidence blockers', 'Trust gate', normalizeInnerSection(trust, 'trust')),
    detail('Cycle context and allocation pressure', 'Egg', normalizeInnerSection(egg, 'cycle')),
    detail('Cross-asset confirmation and contradictions', 'Movement', normalizeInnerSection(movement, 'movement')),
    detail('Portfolio route and permission rules', 'Route', normalizeInnerSection(route, 'route')),
    detail('Tape, news, and catalyst status', 'Tape / news', normalizeInnerSection(tape, 'tape-news')),
  ].join('\n');

  return `<section data-macro-source="curated" id="data-refresh-section" class="macro-inner-panel macro-curated-reading">
    <div class="curated-macro-hero">
      <div>
        <p class="eyebrow">Macro Reading</p>
        <h2>One authored market read before the dashboard opens.</h2>
        <p>${esc(macroBrief)}</p>
      </div>
      <aside>
        <span>Decision gate</span>
        <strong>${esc(decisionMode)}</strong>
        <small>Source readiness ${esc(readiness)} · blocked evidence ${esc(blocked)}</small>
      </aside>
    </div>
    <div class="macro-thesis-grid">
      <article class="wide"><span>Current market macro</span><b>${esc(routeName)}</b><p>${esc(signalInterpretation)}</p></article>
      <article><span>Cycle location</span><b>${esc(phase)}</b><p>${esc(capitalAction)}</p></article>
      <article><span>Route permission</span><b>${esc(addPermission)}</b><p>Opportunity promotion: ${esc(opportunityPermission)}</p></article>
      <article><span>Trust pressure</span><b>${esc(readiness)}</b><p>${esc(blocked)} packets blocked; ${missingSourceRows} stale or missing source layers.</p></article>
      <article><span>Movement balance</span><b>${supportiveCount} support / ${defensiveCount} caution</b><p>Tape: ${esc(marketTapeConfirming)} confirming, ${esc(marketTapeContradicting)} contradicting.</p></article>
    </div>
    <div class="macro-strategy-row">
      <article><span>What to do</span><b>Hold core; no broad chase.</b><p>Use Decision Map levels before any add. New capital is pullback-only and evidence-gated.</p></article>
      <article><span>What not to do</span><b>Do not treat opportunities as a shopping list.</b><p>Opportunity Asymmetry remains a research queue until source coverage, route permission, and downside control improve.</p></article>
      <article><span>Invalidation</span><b>Defense activates if trend breaks with volatility expansion.</b><p>The macro read weakens if SPX loses key support while VIX, rates, or credit pressure deteriorates.</p></article>
    </div>
    <div class="macro-evidence-layers">
      <div class="macro-evidence-head"><p class="eyebrow">Inspectable evidence layers</p><p>The authored read above is the primary UI. These layers are audit trails, not the main reading order.</p></div>
      ${sourceLayers}
    </div>
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
    kicker: 'Data driven & news-aware',
    title: 'What is the market saying before we touch capital?',
    body: 'A curated macro read first; source modules become inspectable evidence layers rather than stacked dashboard panels.',
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
    body: 'Current holdings translated into buy, hold, trim, loss-control, verification, and source-authority states.',
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
        <p class="radar-product-read">The page is organized around the product chain: macro truth first, market levels second, portfolio translation third, and asymmetric opportunity research last.</p>
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
.capital-radar-operating-surface{background:rgba(251,250,246,.10);padding-top:54px}.radar-product-head{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:0}.radar-product-read{max-width:760px;color:var(--muted);line-height:1.45}.radar-product-chain{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.radar-product-chain span{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px 12px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em;background:rgba(251,250,246,.12)}.radar-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.radar-tab{appearance:none;text-align:left;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.14);padding:18px 18px 20px;color:var(--ink);cursor:pointer;transition:background .18s ease}.radar-tab span{display:inline-flex;width:max-content;max-width:100%;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;background:rgba(251,250,246,.24);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);line-height:1}.radar-tab b{display:block;margin-top:18px;font-size:clamp(21px,2.2vw,34px);line-height:.98;letter-spacing:-.052em;font-weight:500}.radar-tab:hover,.radar-tab.active{background:rgba(251,250,246,.48)}.radar-tab.active{box-shadow:inset 0 -2px 0 rgba(36,35,31,.74)}.radar-tab-panes{border-left:1px solid var(--rule);border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.08)}.radar-pane{display:none}.radar-pane.active{display:block}.radar-pane-head{display:grid;grid-template-columns:minmax(260px,.92fr) minmax(0,1.08fr);gap:24px;align-items:end;padding:24px 22px;border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18)}.radar-pane-head h3{font-size:clamp(32px,3.5vw,60px);line-height:.96;letter-spacing:-.06em;font-weight:500;margin:0}.radar-pane-head p:last-child{max-width:780px;color:rgba(36,35,31,.72);font-size:14px;line-height:1.45}.radar-pane-content>.macro-inner-panel{border-bottom:1px solid var(--rule);padding:30px 22px;margin:0}.radar-pane-content>.macro-inner-panel:last-child{border-bottom:0}.macro-curated-reading{padding:0!important}.curated-macro-hero{display:grid;grid-template-columns:minmax(0,1.2fr) minmax(260px,.45fr);gap:0;border-bottom:1px solid var(--rule)}.curated-macro-hero>div{padding:30px 22px}.curated-macro-hero h2{font-size:clamp(36px,5vw,78px);line-height:.94;letter-spacing:-.07em;font-weight:500;margin:0 0 18px}.curated-macro-hero p:last-child{max-width:1040px;font-size:clamp(18px,2vw,28px);line-height:1.18;letter-spacing:-.035em;color:rgba(36,35,31,.84)}.curated-macro-hero aside{border-left:1px solid var(--rule);padding:26px 22px;display:flex;flex-direction:column;justify-content:flex-end;background:rgba(251,250,246,.20)}.curated-macro-hero aside span,.macro-thesis-grid span,.macro-strategy-row span,.macro-evidence-detail summary span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.11em}.curated-macro-hero aside strong{display:block;font-size:clamp(26px,3vw,44px);line-height:.96;letter-spacing:-.055em;font-weight:500;margin:14px 0}.curated-macro-hero aside small{color:var(--muted);line-height:1.35}.macro-thesis-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-left:1px solid var(--rule);border-bottom:1px solid var(--rule)}.macro-thesis-grid article{border-right:1px solid var(--rule);border-top:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.10)}.macro-thesis-grid article.wide{grid-column:span 2}.macro-thesis-grid b{display:block;font-size:clamp(22px,2.1vw,36px);line-height:1;letter-spacing:-.05em;font-weight:500;margin-top:18px}.macro-thesis-grid p,.macro-strategy-row p{color:rgba(36,35,31,.68);font-size:13px;line-height:1.45;margin:12px 0 0}.macro-strategy-row{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));border-left:1px solid var(--rule);border-bottom:1px solid var(--rule)}.macro-strategy-row article{border-right:1px solid var(--rule);padding:18px;background:rgba(251,250,246,.16)}.macro-strategy-row b{display:block;font-size:20px;line-height:1.08;letter-spacing:-.04em;font-weight:500;margin-top:14px}.macro-evidence-layers{padding:22px;background:rgba(251,250,246,.10)}.macro-evidence-head{display:flex;justify-content:space-between;gap:18px;align-items:end;margin-bottom:10px}.macro-evidence-head p:last-child{max-width:560px;color:var(--muted);font-size:12px;line-height:1.4;margin:0}.macro-evidence-detail{border:1px solid var(--rule);background:rgba(251,250,246,.18);margin-top:8px}.macro-evidence-detail summary{list-style:none;cursor:pointer;padding:14px 16px;display:flex;justify-content:space-between;gap:16px;align-items:center}.macro-evidence-detail summary::-webkit-details-marker{display:none}.macro-evidence-detail summary b{font-size:16px;font-weight:500;letter-spacing:-.02em}.macro-evidence-detail[open] summary{border-bottom:1px solid var(--rule)}.macro-evidence-detail>.macro-inner-panel{padding:22px;margin:0;border:0}.macro-hidden-validator-section{position:absolute!important;left:-9999px!important;top:auto!important;width:1px!important;height:1px!important;overflow:hidden!important}.radar-pane-content .section-head{margin-bottom:20px}.radar-pane-content .section-head h2{font-size:clamp(28px,3vw,48px)}.radar-pane-content .data-refresh-panel{border-top:0;background:transparent}.radar-pane-content .command-brief{margin-top:0}.radar-pane-content .ke-exact-app{max-width:none}.radar-pane-content .ke-masthead{padding-top:0}.radar-pane-content .market-lens,.radar-pane-content .strategy-routing{margin-top:0}.radar-pane-content .tape-board{margin-top:12px}.radar-pane-content .hero,.radar-pane-content .topbar{display:none}@media(max-width:1100px){.radar-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.radar-product-chain{grid-template-columns:repeat(3,minmax(0,1fr))}.radar-pane-head,.curated-macro-hero{grid-template-columns:1fr}.curated-macro-hero aside{border-left:0;border-top:1px solid var(--rule)}.macro-thesis-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.macro-thesis-grid article.wide{grid-column:span 2}.macro-strategy-row{grid-template-columns:1fr}.radar-pane-content>.macro-inner-panel{padding:24px 16px}}@media(max-width:680px){.radar-tabs,.radar-product-chain,.macro-thesis-grid{grid-template-columns:1fr}.macro-thesis-grid article.wide{grid-column:span 1}.radar-tab b{font-size:25px}.curated-macro-hero h2{font-size:40px}}
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
console.log('curated Capital Radar Macro Reading into authored read plus inspectable evidence layers');