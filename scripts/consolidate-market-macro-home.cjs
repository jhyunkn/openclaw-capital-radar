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

const ids = [
  'data-refresh-section',
  'kostolany-egg-section',
  'market-lens-section',
  'strategy-routing-section',
  'decision-brief-section',
  'operational-chart-section',
  'holdings-section',
  'opportunities-section',
];

const ranges = Object.fromEntries(ids.map(id => [id, findSection(html, id)]));
const missing = ids.filter(id => !ranges[id]);
if (missing.length) throw new Error(`Cannot consolidate market macro; missing sections: ${missing.join(', ')}`);

for (const range of Object.values(ranges).sort((a, b) => b.start - a.start)) html = removeRange(html, range);

const panes = [
  {
    id: 'macro-reading',
    label: 'Macro reading',
    kicker: 'Data driven & news-aware',
    title: 'What is the market saying before we touch positions?',
    body: 'Combines source freshness, macro-cycle phase, cross-asset movement, route permission, and the market brief into one reading.',
    content: [
      normalizeInnerSection(ranges['data-refresh-section'].html, 'trust'),
      normalizeInnerSection(ranges['kostolany-egg-section'].html, 'egg'),
      normalizeInnerSection(ranges['market-lens-section'].html, 'movement'),
      normalizeInnerSection(ranges['strategy-routing-section'].html, 'route'),
      normalizeInnerSection(ranges['decision-brief-section'].html, 'brief'),
    ].join('\n'),
  },
  {
    id: 'decision-map',
    label: 'Decision map',
    kicker: 'Chart-specific values',
    title: 'Where are the actual market levels?',
    body: 'SPX working chart, confirmation, risk lines, supports, resistance, and decision values used to keep the macro read grounded.',
    content: normalizeInnerSection(ranges['operational-chart-section'].html, 'decision-map'),
  },
  {
    id: 'holdings',
    label: 'Holdings',
    kicker: 'Portfolio translation',
    title: 'What does the macro read permit inside the existing book?',
    body: 'Current holdings translated into zones, action permission, blockers, and source authority.',
    content: normalizeInnerSection(ranges['holdings-section'].html, 'holdings'),
  },
  {
    id: 'opportunity-asymmetry',
    label: 'Opportunity asymmetry',
    kicker: 'New risk only if asymmetry clears',
    title: 'Which opportunities deserve research attention now?',
    body: 'New ideas filtered by evidence, asymmetric upside/downside, route permission, and current market regime.',
    content: normalizeInnerSection(ranges['opportunities-section'].html, 'opportunity-asymmetry'),
  },
];

const tabButtons = panes.map((pane, index) => `<button type="button" class="macro-tab${index === 0 ? ' active' : ''}" data-macro-tab="${pane.id}" aria-controls="macro-pane-${pane.id}" aria-selected="${index === 0 ? 'true' : 'false'}"><span>${esc(pane.kicker)}</span><b>${esc(pane.label)}</b></button>`).join('\n');
const tabPanes = panes.map((pane, index) => `<article id="macro-pane-${pane.id}" class="macro-pane${index === 0 ? ' active' : ''}" data-macro-pane="${pane.id}">
        <div class="macro-pane-head">
          <p class="eyebrow">${esc(pane.kicker)}</p>
          <h3>${esc(pane.title)}</h3>
          <p>${esc(pane.body)}</p>
        </div>
        <div class="macro-pane-content">${pane.content}</div>
      </article>`).join('\n');

const macroSection = `
    <section id="market-macro-section" class="panel market-macro-section">
      <div class="section-head market-macro-head">
        <div>
          <p class="eyebrow">Market macro command section</p>
          <h2>One read: sources, cycle, levels, portfolio, asymmetry.</h2>
        </div>
        <p class="market-macro-read">Trust, Egg, Movement, Route, and Brief now operate as one macro narrative instead of separate dashboard islands. The tabs move from market truth → chart values → holdings → new opportunity risk.</p>
      </div>
      <div class="macro-tabs" role="tablist" aria-label="Capital Radar macro sections">
        ${tabButtons}
      </div>
      <div class="macro-tab-panes">
        ${tabPanes}
      </div>
    </section>`;

const insertAt = (() => {
  const firstRemaining = html.search(/<section id="(market-section|system-health-section)"/);
  if (firstRemaining >= 0) return firstRemaining;
  const footer = html.indexOf('<footer');
  if (footer >= 0) return footer;
  const mainEnd = html.indexOf('</main>');
  return mainEnd >= 0 ? mainEnd : html.length;
})();
html = html.slice(0, insertAt) + macroSection + '\n    ' + html.slice(insertAt);

html = html.replace(/<nav class="nav">[\s\S]*?<\/nav>/, '<nav class="nav"><a href="#macro-pane-macro-reading" data-macro-link="macro-reading">Macro reading</a><a href="#macro-pane-decision-map" data-macro-link="decision-map">Decision map</a><a href="#macro-pane-holdings" data-macro-link="holdings">Holdings</a><a href="#macro-pane-opportunity-asymmetry" data-macro-link="opportunity-asymmetry">Opportunity asymmetry</a></nav>');

const style = `<style id="market-macro-tabs-style">
.market-macro-section{background:rgba(251,250,246,.12);padding-top:54px}.market-macro-head{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:0}.market-macro-read{max-width:720px;color:var(--muted);line-height:1.45}.macro-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:24px}.macro-tab{appearance:none;text-align:left;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.16);padding:16px 16px 18px;color:var(--ink);cursor:pointer;transition:background .18s ease}.macro-tab span{display:inline-flex;width:max-content;max-width:100%;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;background:rgba(251,250,246,.22);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);line-height:1}.macro-tab b{display:block;margin-top:14px;font-size:clamp(20px,2vw,32px);line-height:1;letter-spacing:-.045em;font-weight:500}.macro-tab:hover,.macro-tab.active{background:rgba(251,250,246,.48)}.macro-tab.active{box-shadow:inset 0 -2px 0 rgba(36,35,31,.72)}.macro-tab-panes{border-left:1px solid var(--rule);border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.10)}.macro-pane{display:none}.macro-pane.active{display:block}.macro-pane-head{display:grid;grid-template-columns:minmax(260px,.9fr) minmax(0,1.1fr);gap:24px;align-items:end;padding:22px;border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18)}.macro-pane-head h3{font-size:clamp(30px,3.2vw,56px);line-height:.98;letter-spacing:-.055em;font-weight:500;margin:0}.macro-pane-head p:last-child{max-width:760px;color:rgba(36,35,31,.72);font-size:14px}.macro-pane-content>.macro-inner-panel{border-bottom:1px solid var(--rule);padding:28px 22px;margin:0}.macro-pane-content>.macro-inner-panel:last-child{border-bottom:0}.macro-pane-content .section-head{margin-bottom:20px}.macro-pane-content .section-head h2{font-size:clamp(28px,3vw,48px)}.macro-pane-content .ke-exact-app{max-width:none}.macro-pane-content .ke-masthead{padding-top:0}.macro-pane-content .data-refresh-panel{border-top:0;background:transparent}.macro-pane-content .hero{display:none}.macro-pane-content .topbar{display:none}@media(max-width:1100px){.macro-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.macro-pane-head{grid-template-columns:1fr}.macro-pane-content>.macro-inner-panel{padding:24px 16px}}@media(max-width:680px){.macro-tabs{grid-template-columns:1fr}.macro-tab b{font-size:24px}}
</style>`;
html = html.replace(/<style id="market-macro-tabs-style">[\s\S]*?<\/style>/g, '');
html = html.replace('</head>', `${style}\n</head>`);

const script = `<script id="market-macro-tabs-script">
(function(){
  function activate(id){
    document.querySelectorAll('[data-macro-tab]').forEach(function(btn){var on=btn.getAttribute('data-macro-tab')===id;btn.classList.toggle('active',on);btn.setAttribute('aria-selected',on?'true':'false');});
    document.querySelectorAll('[data-macro-pane]').forEach(function(pane){pane.classList.toggle('active',pane.getAttribute('data-macro-pane')===id);});
  }
  document.addEventListener('click',function(event){
    var btn=event.target.closest('[data-macro-tab], [data-macro-link]');
    if(!btn)return;
    var id=btn.getAttribute('data-macro-tab')||btn.getAttribute('data-macro-link');
    if(!id)return;
    activate(id);
  });
  if(location.hash){
    var pane=document.querySelector(location.hash+'[data-macro-pane], '+location.hash+' [data-macro-pane]');
    if(pane)activate(pane.getAttribute('data-macro-pane'));
  }
})();
</script>`;
html = html.replace(/<script id="market-macro-tabs-script">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', `${script}\n</body>`);

fs.writeFileSync(indexPath, html);
console.log('consolidated Trust/Egg/Movement/Route/Brief, Decision Map, Holdings, and Opportunities into one macro tab section');
