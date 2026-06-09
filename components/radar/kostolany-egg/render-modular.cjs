function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Phase definitions — Kostolany Egg standard 7-phase cycle
const PHASE_DEFS = [
  ['A1', 'Capitulation',  'Forced selling; max pessimism; bottom zone'],
  ['B',  'Recovery',      'Prices stabilise; early buyers accumulate quietly'],
  ['C',  'Verification',  'Prices rise; sceptics still cautious; "is it real?"'],
  ['D',  'Expansion',     'Broad participation; clear uptrend; optimism grows'],
  ['E',  'Euphoria',      'Peak prices; max optimism; late buyers flood in'],
  ['F',  'Distribution',  'Smart money exits; volatility spikes; top zone'],
  ['A2', 'Reset',         'Prices roll over; cycle re-enters capitulation'],
];

// ── Ring diagram ──────────────────────────────────────────────────────────────
const RING = [
  { code: 'A1', angle: -90 },
  { code: 'B',  angle: -38 },
  { code: 'C',  angle:  12 },
  { code: 'D',  angle:  58 },
  { code: 'E',  angle: 122 },
  { code: 'F',  angle: 168 },
  { code: 'A2', angle: 218 },
];
const RCX = 108, RCY = 110, RRX = 78, RRY = 88;

function rPt(angle, rx, ry) {
  const rad = angle * Math.PI / 180;
  return [+(RCX + rx * Math.cos(rad)).toFixed(1), +(RCY + ry * Math.sin(rad)).toFixed(1)];
}
function rAnchor(angle) {
  const cos = Math.cos(angle * Math.PI / 180);
  if (cos > 0.3)  return 'start';
  if (cos < -0.3) return 'end';
  return 'middle';
}

function renderRingSvg(current) {
  const ellipse = `<ellipse cx="${RCX}" cy="${RCY}" rx="${RRX}" ry="${RRY}"
    fill="none" stroke="rgba(44,42,37,.12)" stroke-width="1.2" stroke-dasharray="5 7"/>`;

  // Small clockwise arc cue in upper-right quadrant
  const [ax0, ay0] = rPt(-75, RRX + 10, RRY + 10);
  const [ax1, ay1] = rPt(-30, RRX + 10, RRY + 10);
  const dirCue = `<path d="M ${ax0},${ay0} A ${RRX+10} ${RRY+10} 0 0 1 ${ax1},${ay1}"
    fill="none" stroke="rgba(44,42,37,.20)" stroke-width="1"
    marker-end="url(#rdirArrow)"/>`;

  const nodes = RING.map(({ code, angle }) => {
    const isCur = code === current;
    const [nx, ny] = rPt(angle, RRX, RRY);
    const loff = isCur ? 24 : 20;
    const [lx, ly] = rPt(angle, RRX + loff, RRY + loff);
    const anchor = rAnchor(angle);
    return [
      `<circle cx="${nx}" cy="${ny}" r="${isCur ? 10 : 6.5}"
        fill="${isCur ? 'rgba(47,111,78,.14)' : '#f6f4ee'}"
        stroke="${isCur ? 'rgba(47,111,78,.72)' : 'rgba(44,42,37,.22)'}"
        stroke-width="${isCur ? 2 : 1}"/>`,
      `<text x="${lx}" y="${+ly + 4}" text-anchor="${anchor}"
        font-size="${isCur ? 10 : 8}"
        font-weight="${isCur ? '700' : '400'}"
        fill="${isCur ? 'rgba(47,111,78,.82)' : 'rgba(44,42,37,.40)'}">${code}</text>`,
    ].join('\n');
  }).join('\n');

  return `<svg viewBox="0 -14 216 244" class="ke-ring-svg"
    aria-label="Kostolany cycle ring — current phase ${current}">
    <defs>
      <marker id="rdirArrow" markerWidth="5" markerHeight="5"
        refX="4" refY="2.5" orient="auto">
        <path d="M0,.8 L4.5,2.5 L0,4.2Z" fill="rgba(44,42,37,.22)"/>
      </marker>
    </defs>
    ${ellipse}
    ${dirCue}
    ${nodes}
  </svg>`;
}

// HTML phase legend — listed below the ring, current phase highlighted
function renderPhaseLegend(current) {
  const items = PHASE_DEFS.map(([code, name, desc]) => {
    const isCur = code === current;
    const liClass = isCur ? ' class="ke-pk-cur"' : '';
    return `<li${liClass}><b>${esc(code)}</b><span>${esc(name)}</span></li>`;
  }).join('');
  return `<ul class="ke-phase-key">${items}</ul>`;
}

// ── Wave diagram ──────────────────────────────────────────────────────────────
// Both cycles now run the full A1→B→C→D→E→F sequence for consistency.
// Cycle 1: Oct'22 (A1) → Jan'23 (A2) → Jun'23 (B) → Oct'23 (C) → Dec'23 (D) → May'24 (E) → Sep'24 (F)
// Cycle 2: Feb'25 (A1) → Jun'25 (A2) → Dec'25 (B) → Jun'26 (C, current)
const WAVE = [
  [30,  192, 'A1', "Oct '22"],
  [90,  172, 'A2', "Jan '23"],
  [170, 108, 'B',  "Jun '23"],
  [212,  92, 'C',  "Oct '23"],   // verification pause before year-end expansion
  [252,  52, 'D',  "Dec '23"],
  [318,  40, 'E',  "May '24"],
  [374,  80, 'F',  "Sep '24"],
  [424, 196, 'A1', "Feb '25"],
  [468, 170, 'A2', "Jun '25"],
  [548, 110, 'B',  "Dec '25"],
  [626, 138, 'C',  "Jun '26"],   // ← current
];
const W = 700, WH = 234, WB = 208, WM = 126;

// Dates to display (sparse to avoid x-axis crowding):
// Oct'22, Jun'23, Dec'23, May'24, Feb'25, Dec'25, Jun'26
const SHOW_DATE = new Set([0, 2, 4, 5, 7, 9, 10]);

function buildCurve(pts) {
  let d = `M ${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1];
    const cp = (x1 - x0) / 3;
    d += ` C ${+(x0+cp).toFixed(1)},${y0} ${+(x1-cp).toFixed(1)},${y1} ${x1},${y1}`;
  }
  return d;
}

function renderWaveSvg(current) {
  const [ex, ey] = [WAVE[WAVE.length - 1][0], WAVE[WAVE.length - 1][1]];
  const histPath = buildCurve(WAVE.map(p => [p[0], p[1]]));
  const px = ex + 52, py = ey - 48;
  const projPath = `M ${ex},${ey} C ${ex+18},${ey-16} ${ex+36},${py+12} ${px},${py}`;

  const L = [];

  // Background fill under curve
  L.push(`<path d="${histPath} L${ex},${WB} L30,${WB} Z"
    fill="rgba(44,42,37,.022)" stroke="none"/>`);

  // Horizontal midline dividing risk-on / risk-off
  L.push(`<line x1="8" y1="${WM}" x2="${W-6}" y2="${WM}"
    stroke="rgba(44,42,37,.07)" stroke-width="1" stroke-dasharray="3 9"/>`);
  L.push(`<text x="10" y="${WM-5}" font-size="7.5" letter-spacing=".08em"
    fill="rgba(44,42,37,.20)">RISK-ON</text>`);
  L.push(`<text x="${W-8}" y="${WM-5}" text-anchor="end" font-size="7.5"
    letter-spacing=".08em" fill="rgba(44,42,37,.20)">RISK-OFF</text>`);

  // Wave lines
  L.push(`<path d="${histPath}" fill="none"
    stroke="rgba(44,42,37,.65)" stroke-width="2"
    stroke-linejoin="round" stroke-linecap="round"/>`);
  L.push(`<path d="${projPath}" fill="none"
    stroke="rgba(44,42,37,.26)" stroke-width="1.5" stroke-dasharray="5 4"
    stroke-linecap="round" marker-end="url(#wvArrow)"/>`);

  // Historical dots
  WAVE.slice(0, -1).forEach(([x, y]) => {
    L.push(`<circle cx="${x}" cy="${y}" r="3.5"
      fill="#f5f3ed" stroke="rgba(44,42,37,.32)" stroke-width="1.2"/>`);
  });

  // Current position — green halo
  L.push(`<circle cx="${ex}" cy="${ey}" r="9"
    fill="rgba(47,111,78,.10)" stroke="rgba(47,111,78,.55)" stroke-width="1.5"/>`);
  L.push(`<circle cx="${ex}" cy="${ey}" r="4.5"
    fill="rgba(47,111,78,.80)" stroke="none"/>`);

  // Phase code labels — all above their dot at y-14, min y=16
  WAVE.forEach(([x, y, code], i) => {
    const isCur = i === WAVE.length - 1;
    const ly = Math.max(16, y - 14);
    L.push(`<text x="${x}" y="${ly}" text-anchor="middle"
      font-size="${isCur ? 10 : 8.5}"
      font-weight="${isCur ? '700' : '500'}"
      fill="${isCur ? 'rgba(47,111,78,.80)' : 'rgba(44,42,37,.44)'}">${code}</text>`);
  });

  // Baseline ticks
  WAVE.forEach(([x]) => {
    L.push(`<line x1="${x}" y1="${WB-1}" x2="${x}" y2="${WB+3}"
      stroke="rgba(44,42,37,.16)" stroke-width="1"/>`);
  });

  // Date labels (sparse)
  WAVE.forEach(([x, , , date], i) => {
    if (!SHOW_DATE.has(i)) return;
    const isCur = i === WAVE.length - 1;
    L.push(`<text x="${x}" y="${WB+14}" text-anchor="middle" font-size="8.5"
      fill="${isCur ? 'rgba(47,111,78,.60)' : 'rgba(44,42,37,.35)'}">${date}</text>`);
  });

  // Projected label
  L.push(`<text x="${px}" y="${WB+14}" text-anchor="middle"
    font-size="8" fill="rgba(44,42,37,.20)" font-style="italic">→ D</text>`);

  return `<svg viewBox="0 0 ${W} ${WH}" class="ke-wave-svg"
    aria-label="Kostolany cycle wave — current phase ${current}">
    <defs>
      <marker id="wvArrow" markerWidth="7" markerHeight="7"
        refX="5" refY="3.5" orient="auto">
        <path d="M0,1 L6,3.5 L0,6Z" fill="rgba(44,42,37,.28)"/>
      </marker>
    </defs>
    ${L.join('\n    ')}
  </svg>`;
}

// HTML phase strip — one line below the wave explaining all codes; current bold
function renderPhaseStrip(current) {
  return PHASE_DEFS.map(([code, name]) => {
    const isCur = code === current;
    return isCur
      ? `<strong>${esc(code)} ${esc(name)}</strong>`
      : `<span>${esc(code)} ${esc(name)}</span>`;
  }).join('<i> · </i>');
}

// ── Section ───────────────────────────────────────────────────────────────────
function renderKostolanyEggSection(state) {
  const current = state.phase_code || 'C';
  const asOf = esc(new Date(state.as_of || Date.now()).toISOString().slice(0, 10));

  return `<section id="kostolany-egg-section" class="ke-section">
    <div class="ke-wrap">
      <div class="ke-bar">
        <span class="ke-eyebrow">Kostolany Egg · Macro Cycle</span>
        <span class="ke-asof">${asOf}</span>
      </div>
      <div class="ke-instrument">

        <div class="ke-ring-col">
          ${renderRingSvg(current)}
          ${renderPhaseLegend(current)}
        </div>

        <div class="ke-divider"></div>

        <div class="ke-wave-col">
          ${renderWaveSvg(current)}
          <p class="ke-phase-strip">${renderPhaseStrip(current)}</p>
        </div>

        <div class="ke-divider"></div>

        <div class="ke-data-col">
          <div class="ke-data-item">
            <span>Phase</span>
            <b>${esc(current)} · ${esc(state.macro_phase || 'Verification')}</b>
          </div>
          <div class="ke-data-item">
            <span>Action</span>
            <b class="ke-action">${esc(state.capital_action || '—')}</b>
          </div>
          <div class="ke-data-item">
            <span>Stress type</span>
            <b>${esc(state.stress_type || '—')}</b>
          </div>
          <div class="ke-data-item">
            <span>Invalidation</span>
            <b>${esc(state.invalidation || '—')}</b>
          </div>
          <div class="ke-data-item">
            <span>Confidence</span>
            <b>${esc(state.phase_confidence || '—')} /100</b>
          </div>
        </div>

      </div>
    </div>
  </section>`;
}

module.exports = { renderKostolanyEggSection };
