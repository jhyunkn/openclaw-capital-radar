'use strict';

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const arr = v => Array.isArray(v) ? v : [];

function classificationMeta(cls) {
  switch (cls) {
    case 'NARRATIVE_AHEAD': return { label: 'Narrative ahead', cls: 'nr-narrative-ahead', desc: 'Price is ahead of fundamentals — the story has run past the data' };
    case 'DATA_AHEAD':      return { label: 'Data ahead',      cls: 'nr-data-ahead',      desc: 'Fundamentals ahead of price — the data is building an opportunity' };
    case 'ALIGNED':         return { label: 'Aligned',         cls: 'nr-aligned',         desc: 'Narrative and data agree — no significant divergence' };
    default:                return { label: cls,               cls: '',                   desc: '' };
  }
}

function renderThemeCard(theme) {
  const meta        = classificationMeta(theme.classification);
  const tickers     = arr(theme.relevantTickers).slice(0, 6);
  const tickerChips = tickers.map(t => `<span class="nr-ticker">${esc(t)}</span>`).join('');

  return `<article class="nr-theme-card ${esc(meta.cls)}">
    <header class="nr-card-head">
      <h3 class="nr-headline">${esc(theme.label)}</h3>
      <span class="nr-classification">${esc(meta.label)}</span>
    </header>
    <p class="nr-body">${esc(theme.counterRead)}</p>
    ${tickerChips ? `<div class="nr-tickers">${tickerChips}</div>` : ''}
    ${theme.watchFor ? `<div class="nr-watch"><span class="nr-watch-label">Watch</span><span class="nr-watch-text">${esc(theme.watchFor)}</span></div>` : ''}
  </article>`;
}

function renderNarrativeRealitySection(brief, options = {}) {
  if (!brief || !arr(brief.themes).length) return '';

  const themes     = arr(brief.themes);
  const cards      = themes.map(renderThemeCard).join('');

  const asOf = brief.generatedAt
    ? new Date(brief.generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : '';

  const classCount = cls => themes.filter(t => t.classification === cls).length;
  const narrAhead  = classCount('NARRATIVE_AHEAD');
  const dataAhead  = classCount('DATA_AHEAD');

  const moduleMode = options.module === true;
  const shellOpen = moduleMode
    ? '<div id="narrative-reality-module" class="nr-section nr-module">'
    : '<section id="narrative-reality-section" class="panel nr-section">';
  const shellClose = moduleMode ? '</div>' : '</section>';

  return `${shellOpen}
  <div class="nr-wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Narrative vs. Reality${asOf ? ` · ${esc(asOf)}` : ''}</p>
        <h2>Narrative gaps</h2>
      </div>
    </div>

    <div class="nr-theme-list">${cards}</div>
  </div>
${shellClose}`;
}

function renderNarrativeRealityStyle() {
  return `<style id="narrative-reality-style">
.nr-section{padding-top:28px}
.nr-module{margin-top:22px;border-top:1px solid rgba(201,191,173,.45);padding-top:22px}
.nr-wrap{width:min(1240px,calc(100% - 48px));margin:0 auto}
.nr-theme-list{display:flex;flex-direction:column;gap:20px;margin-top:24px}
.nr-theme-card{border:1px solid rgba(201,191,173,.45);border-left:4px solid transparent;border-radius:0;padding:22px 24px;background:#ffffff}
.nr-narrative-ahead{border-left-color:rgba(164,80,47,.65)}
.nr-data-ahead{border-left-color:rgba(47,111,78,.65)}
.nr-aligned{border-left-color:rgba(138,106,44,.5)}
.nr-card-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:12px}
.nr-headline{font-size:17px;font-weight:700;color:#24231f;letter-spacing:-.02em;line-height:1.3;margin:0}
.nr-classification{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:3px 9px;border-radius:999px;border:1px solid;white-space:nowrap;flex-shrink:0;margin-top:2px}
.nr-narrative-ahead .nr-classification{color:rgba(164,80,47,.9);border-color:rgba(164,80,47,.35);background:rgba(164,80,47,.06)}
.nr-data-ahead .nr-classification{color:var(--green,#2f6f4e);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.06)}
.nr-aligned .nr-classification{color:var(--warn,#8a6a2c);border-color:rgba(138,106,44,.35);background:rgba(138,106,44,.06)}
.nr-body{margin:0 0 14px;font-size:13.5px;line-height:1.65;color:rgba(36,35,31,.85);max-width:72ch}
.nr-tickers{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px}
.nr-ticker{font-size:10px;font-weight:700;padding:2px 8px;border-radius:999px;border:1px solid rgba(201,191,173,.55);background:#faf9f6;color:rgba(36,35,31,.6);letter-spacing:.04em;font-family:var(--mono,monospace)}
.nr-watch{display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:0;border:1px solid rgba(201,191,173,.4)}
.nr-narrative-ahead .nr-watch{background:rgba(164,80,47,.05);border-left:3px solid rgba(164,80,47,.5)}
.nr-data-ahead .nr-watch{background:rgba(47,111,78,.05);border-left:3px solid rgba(47,111,78,.5)}
.nr-aligned .nr-watch{background:rgba(138,106,44,.05);border-left:3px solid rgba(138,106,44,.45)}
.nr-watch-label{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:rgba(36,35,31,.5);white-space:nowrap;margin-top:2px}
.nr-watch-text{font-size:12.5px;line-height:1.55;color:rgba(36,35,31,.85)}
@media(max-width:760px){
  .nr-theme-card{padding:18px 16px}
  .nr-headline{font-size:15.5px}
  .nr-card-head{flex-direction:column;align-items:flex-start;gap:8px;margin-bottom:10px}
  .nr-body{font-size:13px;line-height:1.6}
  .nr-theme-list{gap:16px}
}
</style>`;
}

module.exports = { renderNarrativeRealitySection, renderNarrativeRealityStyle };
