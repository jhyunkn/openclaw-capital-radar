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
  const watchSnip   = theme.watchFor ? theme.watchFor.split('.')[0] : '';

  return `<article class="nr-theme-card ${esc(meta.cls)}">
    <div class="nr-card-head">
      <div class="nr-label-row">
        <span class="nr-theme-label">${esc(theme.label)}</span>
        <span class="nr-classification">${esc(meta.label)}</span>
        ${tickerChips ? `<div class="nr-tickers">${tickerChips}</div>` : ''}
      </div>
    </div>
    <p class="nr-counter">${esc(theme.counterRead)}</p>
    ${watchSnip ? `<p class="nr-watch-inline"><span>Watch</span> ${esc(watchSnip)}</p>` : ''}
  </article>`;
}

function renderNarrativeRealitySection(brief, options = {}) {
  if (!brief || !arr(brief.themes).length) return '';

  const themes     = arr(brief.themes);
  const cards      = themes.map(renderThemeCard).join('');
  const watchItems = arr(brief.watchFor).map(w => `<li>${esc(w)}</li>`).join('');

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
.nr-theme-list{display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-top:20px}
.nr-theme-card{border:1px solid rgba(201,191,173,.4);border-left:3px solid transparent;border-radius:0;padding:14px 16px;background:rgba(251,250,246,.1)}
.nr-narrative-ahead{border-left-color:rgba(164,80,47,.6);background:rgba(164,80,47,.03)}
.nr-data-ahead{border-left-color:rgba(47,111,78,.6);background:rgba(47,111,78,.03)}
.nr-aligned{border-left-color:rgba(138,106,44,.45);background:rgba(138,106,44,.02)}
.nr-card-head{margin-bottom:8px}
.nr-label-row{display:flex;align-items:center;flex-wrap:wrap;gap:7px}
.nr-theme-label{font-size:13px;font-weight:700;color:rgba(36,35,31,.9);letter-spacing:-.01em}
.nr-classification{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:2px 7px;border-radius:999px;border:1px solid}
.nr-narrative-ahead .nr-classification{color:rgba(164,80,47,.9);border-color:rgba(164,80,47,.35);background:rgba(164,80,47,.06)}
.nr-data-ahead .nr-classification{color:var(--green);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.06)}
.nr-aligned .nr-classification{color:var(--warn);border-color:rgba(138,106,44,.35);background:rgba(138,106,44,.06)}
.nr-tickers{display:flex;flex-wrap:wrap;gap:4px}
.nr-ticker{font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;border:1px solid rgba(201,191,173,.5);background:rgba(251,250,246,.18);color:rgba(36,35,31,.55);letter-spacing:.03em}
.nr-counter{margin:0 0 6px;font-size:12.5px;line-height:1.5;color:rgba(36,35,31,.8)}
.nr-data-ahead .nr-counter{color:rgba(47,111,78,.88)}
.nr-narrative-ahead .nr-counter{color:rgba(164,80,47,.82)}
.nr-watch-inline{margin:0;font-size:11px;color:var(--muted);line-height:1.4}
.nr-watch-inline span{font-weight:700;text-transform:uppercase;letter-spacing:.07em;font-size:9px;margin-right:5px}
@media(max-width:760px){.nr-theme-list{grid-template-columns:1fr}}
</style>`;
}

module.exports = { renderNarrativeRealitySection, renderNarrativeRealityStyle };
