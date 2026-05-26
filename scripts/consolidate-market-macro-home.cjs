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
    body: 'A single macro read built from source trust, cycle phase, cross-asset movement, route permission, market brief, and tape/news-catalyst status.',
    content: [
      normalizeInnerSection(ranges['data-refresh-section'].html, 'trust'),
      normalizeInnerSection(ranges['decision-brief-section'].html, 'brief'),
      normalizeInnerSection(ranges['kostolany-egg-section'].html, 'cycle'),
      normalizeInnerSection(ranges['market-lens-section'].html, 'movement'),
      normalizeInnerSection(ranges['strategy-routing-section'].html, 'route'),
      normalizeInnerSection(ranges['market-section'].html, 'tape-news'),
    ].join('\n'),
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
.capital-radar-operating-surface{background:rgba(251,250,246,.10);padding-top:54px}.radar-product-head{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:0}.radar-product-read{max-width:760px;color:var(--muted);line-height:1.45}.radar-product-chain{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:22px}.radar-product-chain span{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:10px 12px;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.12em;background:rgba(251,250,246,.12)}.radar-tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.radar-tab{appearance:none;text-align:left;border:0;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.14);padding:18px 18px 20px;color:var(--ink);cursor:pointer;transition:background .18s ease}.radar-tab span{display:inline-flex;width:max-content;max-width:100%;border:1px solid var(--rule);border-radius:999px;padding:6px 9px;background:rgba(251,250,246,.24);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);line-height:1}.radar-tab b{display:block;margin-top:18px;font-size:clamp(21px,2.2vw,34px);line-height:.98;letter-spacing:-.052em;font-weight:500}.radar-tab:hover,.radar-tab.active{background:rgba(251,250,246,.48)}.radar-tab.active{box-shadow:inset 0 -2px 0 rgba(36,35,31,.74)}.radar-tab-panes{border-left:1px solid var(--rule);border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.08)}.radar-pane{display:none}.radar-pane.active{display:block}.radar-pane-head{display:grid;grid-template-columns:minmax(260px,.92fr) minmax(0,1.08fr);gap:24px;align-items:end;padding:24px 22px;border-bottom:1px solid var(--rule);background:rgba(251,250,246,.18)}.radar-pane-head h3{font-size:clamp(32px,3.5vw,60px);line-height:.96;letter-spacing:-.06em;font-weight:500;margin:0}.radar-pane-head p:last-child{max-width:780px;color:rgba(36,35,31,.72);font-size:14px;line-height:1.45}.radar-pane-content>.macro-inner-panel{border-bottom:1px solid var(--rule);padding:30px 22px;margin:0}.radar-pane-content>.macro-inner-panel:last-child{border-bottom:0}.radar-pane-content .section-head{margin-bottom:20px}.radar-pane-content .section-head h2{font-size:clamp(28px,3vw,48px)}.radar-pane-content .data-refresh-panel{border-top:0;background:transparent}.radar-pane-content .command-brief{margin-top:0}.radar-pane-content .ke-exact-app{max-width:none}.radar-pane-content .ke-masthead{padding-top:0}.radar-pane-content .market-lens,.radar-pane-content .strategy-routing{margin-top:0}.radar-pane-content .tape-board{margin-top:12px}.radar-pane-content .hero,.radar-pane-content .topbar{display:none}@media(max-width:1100px){.radar-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}.radar-product-chain{grid-template-columns:repeat(3,minmax(0,1fr))}.radar-pane-head{grid-template-columns:1fr}.radar-pane-content>.macro-inner-panel{padding:24px 16px}}@media(max-width:680px){.radar-tabs,.radar-product-chain{grid-template-columns:1fr}.radar-tab b{font-size:25px}}
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
console.log('consolidated Capital Radar homepage into four decision tabs: Macro Reading, Decision Map, Holdings, Opportunity Asymmetry');