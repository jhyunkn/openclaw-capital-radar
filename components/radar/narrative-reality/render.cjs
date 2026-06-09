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
  const meta     = classificationMeta(theme.classification);
  const tickers  = arr(theme.relevantTickers).slice(0, 6);
  const tickerChips = tickers.map(t => `<span class="nr-ticker">${esc(t)}</span>`).join('');

  return `<article class="nr-theme-card ${esc(meta.cls)}">
    <div class="nr-card-head">
      <div class="nr-label-row">
        <span class="nr-theme-label">${esc(theme.label)}</span>
        <span class="nr-classification">${esc(meta.label)}</span>
      </div>
      ${tickerChips ? `<div class="nr-tickers">${tickerChips}</div>` : ''}
    </div>
    <div class="nr-columns">
      <div class="nr-col">
        <span class="nr-col-head">Market says</span>
        <p>${esc(theme.narrative)}</p>
      </div>
      <div class="nr-col">
        <span class="nr-col-head">Data shows</span>
        <p>${esc(theme.dataAnchor)}</p>
      </div>
      <div class="nr-col nr-col-counter">
        <span class="nr-col-head">Counter-read</span>
        <p>${esc(theme.counterRead)}</p>
      </div>
    </div>
    ${theme.watchFor ? `<div class="nr-watch"><span>Watch for</span><p>${esc(theme.watchFor)}</p></div>` : ''}
  </article>`;
}

function renderNarrativeRealitySection(brief) {
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

  return `<section id="narrative-reality-section" class="panel nr-section">
  <div class="nr-wrap">
    <div class="section-head">
      <div>
        <p class="eyebrow">Narrative vs. Reality${asOf ? ` · ${esc(asOf)}` : ''}</p>
        <h2>Market read</h2>
        <p class="nr-desc">Where the prevailing narrative diverges from what the data actually says. That gap is where capital either gets destroyed or positioned correctly.</p>
      </div>
    </div>

    <div class="nr-summary-strip">
      <article><span>Narrative ahead</span><b>${narrAhead}</b><small>Story priced beyond data</small></article>
      <article><span>Data ahead</span><b>${dataAhead}</b><small>Fundamentals building opportunity</small></article>
      <article><span>Strategy</span><b class="nr-posture-short">${esc(brief.strategyPosture.split('.')[0])}</b></article>
    </div>

    <div class="nr-theme-list">${cards}</div>

    <div class="nr-bottom-row">
      <div class="nr-wave">
        <span>Where the wave builds</span>
        <p>${esc(brief.whereWaveBuilds)}</p>
      </div>
      ${watchItems ? `<div class="nr-watchfor">
        <span>Change the posture if</span>
        <ul>${watchItems}</ul>
      </div>` : ''}
    </div>
  </div>
</section>`;
}

function renderNarrativeRealityStyle() {
  return `<style id="narrative-reality-style">
/* ── Section shell ──────────────────────────────────────────────────── */
.nr-section{padding-top:28px}
.nr-wrap{width:min(1240px,calc(100% - 48px));margin:0 auto}
.nr-desc{max-width:760px;color:var(--muted);font-size:13px;line-height:1.5;margin:5px 0 0}

/* ── Summary strip ──────────────────────────────────────────────────── */
.nr-summary-strip{display:flex;flex-wrap:wrap;gap:8px;margin:18px 0 20px}
.nr-summary-strip article{border:1px solid rgba(201,191,173,.45);border-radius:16px;padding:8px 16px;background:rgba(251,250,246,.22);display:flex;flex-direction:column;gap:3px;min-width:160px}
.nr-summary-strip span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)}
.nr-summary-strip b{font-size:18px;font-weight:700;letter-spacing:-.02em;color:rgba(36,35,31,.9)}
.nr-summary-strip small{font-size:10px;color:var(--muted)}
.nr-posture-short{font-size:13px!important;font-weight:600!important;letter-spacing:0!important;line-height:1.3}

/* ── Theme card list ────────────────────────────────────────────────── */
.nr-theme-list{display:flex;flex-direction:column;gap:10px}
.nr-theme-card{border:1px solid rgba(201,191,173,.4);border-left:3px solid transparent;border-radius:16px;padding:16px 18px;background:rgba(251,250,246,.1)}

/* Classification colors */
.nr-narrative-ahead{border-left-color:rgba(164,80,47,.6);background:rgba(164,80,47,.03)}
.nr-data-ahead{border-left-color:rgba(47,111,78,.6);background:rgba(47,111,78,.03)}
.nr-aligned{border-left-color:rgba(138,106,44,.45);background:rgba(138,106,44,.02)}

/* Card head */
.nr-card-head{margin-bottom:12px}
.nr-label-row{display:flex;align-items:baseline;gap:10px;margin-bottom:6px}
.nr-theme-label{font-size:15px;font-weight:700;color:rgba(36,35,31,.9);letter-spacing:-.01em}
.nr-classification{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;padding:2px 8px;border-radius:999px;border:1px solid}
.nr-narrative-ahead .nr-classification{color:rgba(164,80,47,.9);border-color:rgba(164,80,47,.35);background:rgba(164,80,47,.06)}
.nr-data-ahead .nr-classification{color:var(--green);border-color:rgba(47,111,78,.35);background:rgba(47,111,78,.06)}
.nr-aligned .nr-classification{color:var(--warn);border-color:rgba(138,106,44,.35);background:rgba(138,106,44,.06)}

/* Ticker chips */
.nr-tickers{display:flex;flex-wrap:wrap;gap:5px}
.nr-ticker{font-size:10px;font-weight:700;padding:2px 7px;border-radius:999px;border:1px solid rgba(201,191,173,.5);background:rgba(251,250,246,.18);color:rgba(36,35,31,.62);letter-spacing:.03em}

/* Three-column body */
.nr-columns{display:grid;grid-template-columns:1fr 1fr 1.2fr;gap:12px;margin-bottom:10px}
.nr-col{min-width:0}
.nr-col-head{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:5px}
.nr-col p{margin:0;font-size:12.5px;line-height:1.55;color:rgba(36,35,31,.78)}
.nr-col-counter p{font-size:12.5px;font-weight:500;color:rgba(36,35,31,.88)}
.nr-data-ahead .nr-col-counter p{color:rgba(47,111,78,.9)}
.nr-narrative-ahead .nr-col-counter p{color:rgba(164,80,47,.85)}

/* Watch for row */
.nr-watch{border-top:1px solid rgba(201,191,173,.25);padding-top:8px;display:flex;gap:10px;align-items:baseline}
.nr-watch>span{flex-shrink:0;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);min-width:58px}
.nr-watch>p{margin:0;font-size:11px;color:var(--muted);line-height:1.4}

/* Bottom row: wave + change-posture */
.nr-bottom-row{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:16px;padding-top:16px;border-top:1px solid rgba(201,191,173,.3)}
.nr-wave span,.nr-watchfor span{display:block;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:6px}
.nr-wave p{margin:0;font-size:13px;line-height:1.55;color:rgba(36,35,31,.85);font-weight:500}
.nr-watchfor ul{margin:0;padding-left:14px}
.nr-watchfor li{font-size:12px;color:rgba(36,35,31,.72);line-height:1.6}

/* Responsive */
@media(max-width:900px){
  .nr-columns{grid-template-columns:1fr 1fr}
  .nr-col-counter{grid-column:1/-1}
}
@media(max-width:600px){
  .nr-columns{grid-template-columns:1fr}
  .nr-bottom-row{grid-template-columns:1fr}
  .nr-summary-strip article{min-width:0;flex:1}
}
</style>`;
}

module.exports = { renderNarrativeRealitySection, renderNarrativeRealityStyle };
