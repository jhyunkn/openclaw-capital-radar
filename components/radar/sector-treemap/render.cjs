function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// S&P 500 approximate sector weights (as of mid-2026)
// stance: 'favor' | 'watch' | 'reduce'
const SECTORS = [
  // Row 0: large — weight total 55.1%
  { name: 'Technology',      pct: 30.5, row: 0, stance: 'watch',  note: 'Pullback only',      tickers: ['MSFT', 'MU', 'ENTG'] },
  { name: 'Financials',      pct: 12.8, row: 0, stance: 'watch',  note: 'Watch',               tickers: ['MA', 'BMNR'] },
  { name: 'Healthcare',      pct: 11.8, row: 0, stance: 'favor',  note: 'Hold quality',        tickers: [] },
  // Row 1: medium — weight total 27.7%
  { name: 'Cons. Disc.',     pct:  9.9, row: 1, stance: 'reduce', note: 'Cyclicals / wait',    tickers: ['AMZN', 'NFLX'] },
  { name: 'Industrials',     pct:  8.9, row: 1, stance: 'watch',  note: 'Selective',           tickers: ['BWXT'] },
  { name: 'Comm. Svcs',      pct:  8.9, row: 1, stance: 'watch',  note: 'Quality only',        tickers: ['META'] },
  // Row 2: small — weight total 17.3%
  { name: 'Cons. Staples',   pct:  5.9, row: 2, stance: 'favor',  note: 'Accumulate lightly',  tickers: [] },
  { name: 'Energy',          pct:  3.9, row: 2, stance: 'watch',  note: 'Conditional',         tickers: ['CEG', 'LEU'] },
  { name: 'Materials',       pct:  2.5, row: 2, stance: 'watch',  note: 'Neutral',             tickers: [] },
  { name: 'Real Estate',     pct:  2.5, row: 2, stance: 'reduce', note: 'Rate sensitive',      tickers: [] },
  { name: 'Utilities',       pct:  2.5, row: 2, stance: 'watch',  note: 'Hold / watch',        tickers: [] },
];

const ROW_CONFIG = [
  { totalPct: 55.1, y: 0,   h: 210 },
  { totalPct: 27.7, y: 210, h: 105 },
  { totalPct: 17.3, y: 315, h:  65 },
];

const SVG_W = 920;

function computeRects() {
  const rects = [];
  for (let rowIdx = 0; rowIdx < 3; rowIdx++) {
    const { totalPct, y, h } = ROW_CONFIG[rowIdx];
    const rowSectors = SECTORS.filter(s => s.row === rowIdx);
    let curX = 0;
    rowSectors.forEach((s, i) => {
      const isLast = i === rowSectors.length - 1;
      const w = isLast ? SVG_W - curX : Math.round(SVG_W * s.pct / totalPct);
      rects.push({ ...s, x: curX, y, w, h });
      curX += w;
    });
  }
  return rects;
}

const STANCE_COLORS = {
  favor:  { fill: 'rgba(47,111,78,.14)',  stroke: 'rgba(47,111,78,.40)',  label: '#1f6b3a', badge: 'rgba(47,111,78,.18)',  badgeText: '#1a5c31' },
  watch:  { fill: 'rgba(174,124,44,.10)', stroke: 'rgba(174,124,44,.34)', label: '#7a5412', badge: 'rgba(174,124,44,.16)', badgeText: '#6b480d' },
  reduce: { fill: 'rgba(159,63,53,.11)',  stroke: 'rgba(159,63,53,.38)',  label: '#8a2f25', badge: 'rgba(159,63,53,.18)', badgeText: '#7a2920' },
};

const STANCE_LABELS = { favor: 'FAVOR', watch: 'WATCH', reduce: 'REDUCE' };

function renderRect(r) {
  const c = STANCE_COLORS[r.stance] || STANCE_COLORS.watch;
  const pad = 10;
  const innerW = r.w - pad * 2;

  // Name sizing: larger blocks get bigger font
  const nameFontSize = r.h >= 160 ? 18 : r.h >= 90 ? 14 : 11;
  const pctFontSize  = r.h >= 160 ? 13 : r.h >= 90 ? 11 : 9.5;
  const noteFontSize = r.h >= 160 ? 11 : 10;
  const tickerFontSize = r.h >= 160 ? 11 : 10;
  const stanceFontSize = r.h >= 160 ? 10 : 9;

  const nameY   = r.y + pad + nameFontSize;
  const pctY    = nameY + pctFontSize + 4;
  const noteY   = pctY + noteFontSize + 6;
  const stanceY = r.y + r.h - pad - (r.tickers.length > 0 ? tickerFontSize + 8 : 0);
  const tickerY = stanceY + tickerFontSize + 2;

  // Clip name if block is narrow
  const nameDisplay = r.w < 80 ? r.name.split(' ')[0] : r.name;
  const showNote = r.h >= 90 && r.w >= 100;
  const showTickers = r.tickers.length > 0 && r.w >= 80 && r.h >= 70;
  const showStance = r.w >= 60;

  const tickerStr = r.tickers.slice(0, 3).join(' · ');

  return `<g class="st-block st-${r.stance}">
    <rect x="${r.x}" y="${r.y}" width="${r.w}" height="${r.h}" rx="0" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1"/>
    <text x="${r.x + pad}" y="${nameY}" font-size="${nameFontSize}" font-weight="600" fill="${c.label}" clip-path="url(#clip-${r.x}-${r.y})">${esc(nameDisplay)}</text>
    <text x="${r.x + pad}" y="${pctY}" font-size="${pctFontSize}" fill="rgba(44,42,37,.42)">${r.pct}%</text>
    ${showNote ? `<text x="${r.x + pad}" y="${noteY}" font-size="${noteFontSize}" fill="rgba(44,42,37,.38)" font-style="italic">${esc(r.note)}</text>` : ''}
    ${showStance ? `<text x="${r.x + r.w - pad}" y="${stanceY}" font-size="${stanceFontSize}" text-anchor="end" fill="${c.badgeText}" font-weight="700" letter-spacing=".06em">${STANCE_LABELS[r.stance]}</text>` : ''}
    ${showTickers ? `<text x="${r.x + pad}" y="${tickerY}" font-size="${tickerFontSize}" fill="${c.label}" opacity=".75">${esc(tickerStr)}</text>` : ''}
  </g>`;
}

function renderSectorTreemap(state) {
  const rects = computeRects();
  const totalH = 380;

  // Legend
  const legend = Object.entries(STANCE_LABELS).map(([key, label], i) => {
    const c = STANCE_COLORS[key];
    const lx = 10 + i * 110;
    return `<g transform="translate(${lx}, 4)">
      <rect width="12" height="12" rx="3" fill="${c.fill}" stroke="${c.stroke}" stroke-width="1.2"/>
      <text x="17" y="10.5" font-size="10" font-weight="600" fill="rgba(44,42,37,.60)" letter-spacing=".06em">${label}</text>
    </g>`;
  }).join('');

  const phaseNote = esc((state && state.phase_code) ? `Phase ${state.phase_code} · ${state.macro_phase || 'Cycle'}` : 'Phase C · Verification');

  return `<section id="sector-treemap-section" class="sector-treemap-v1">
    <div class="st-wrap">
      <div class="st-header">
        <div>
          <p class="st-eyebrow">S&amp;P 500 Sector Map</p>
          <h2 class="st-title">Sector treemap · ${phaseNote}</h2>
          <p class="st-sub">Sized by approximate market cap weight. Colored by allocation stance from Kostolany cycle read.</p>
        </div>
        <div class="st-legend-wrap">
          <svg width="340" height="20" class="st-legend-svg">${legend}</svg>
          <p class="st-legend-note">Weights are static S&amp;P 500 approximations, not live market cap data.</p>
        </div>
      </div>
      <div class="st-map-wrap">
        <svg viewBox="0 0 ${SVG_W} ${totalH}" class="st-map-svg" aria-label="S&P 500 sector treemap by allocation stance">
          ${rects.map(renderRect).join('\n          ')}
        </svg>
      </div>
    </div>
  </section>`;
}

module.exports = { renderSectorTreemap };
