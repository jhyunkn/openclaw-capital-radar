'use strict';
// Unified macro section — 3-zone layout designed for instant economic comprehension.
// Zone 1: Regime banner (5-second read) — what is the economy doing, plain English
// Zone 2: Economy scorecard (30-second read) — 10 traffic-light signals
// Zone 3: Cycle position + sector heat map (2-minute read)
// Tier 2 (collapsed): full decision brief + historical analogs

const fs   = require('fs');
const path = require('path');

const root          = path.join(__dirname, '..');
const requestedPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath     = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const read = (rel, fb = {}) => {
  const p = path.join(root, rel);
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fb; }
};

const egg        = read('outputs/kostolany-egg-state.json');
const brief      = read('outputs/market-decision-brief-state.json');
const config     = read('outputs/macro-configuration-state.json');
const analogs    = read('outputs/macro-historical-analog-state.json');
const portfolio  = read('outputs/macro-portfolio-translation-state.json');
const cycle      = read('outputs/macro-cycle-state.json');

const esc  = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const num  = v => { const n = Number(v); return Number.isFinite(n) ? n : null; };
const pct  = (v, d=2) => { const n=num(v); return n == null ? '—' : `${n>0?'+':''}${n.toFixed(d)}%`; };
const fmt  = (v, unit) => {
  const n = num(v);
  if (n == null) return '—';
  if (unit === 'index') return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (unit === '%') return n.toFixed(2) + '%';
  if (unit === 'spread') return n.toFixed(2);
  if (unit === 'vol') return n.toFixed(1);
  return String(n);
};

// ── Traffic light logic ──────────────────────────────────────────────────────

// Returns { color: 'green'|'amber'|'red', dot: '●', label, value, trend }
function axisSignal(axis) {
  if (!axis) return null;
  const id    = String(axis.id || '').toLowerCase();
  const score = num(axis.score) ?? 50;
  const dir   = String(axis.direction || '').toLowerCase();
  const trend = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';

  // Each axis has a different polarity: high money = bad, high credit = bad,
  // high risk appetite = good, high liquidity = good
  let color;
  if (id === 'money' || id === 'funding' || id === 'physical' || id === 'physical_constraint') {
    color = score >= 75 ? 'red' : score >= 55 ? 'amber' : 'green';
  } else if (id === 'credit') {
    color = score >= 60 ? 'red' : score >= 45 ? 'amber' : 'green';
  } else if (id === 'liquidity') {
    color = score >= 60 ? 'green' : score >= 40 ? 'amber' : 'red';
  } else if (id === 'risk' || id === 'risk_appetite') {
    // 40–75 = healthy selective, >75 = euphoric (amber), <35 = risk-off (red)
    color = score > 75 ? 'amber' : score >= 35 ? 'green' : 'red';
  } else {
    color = score >= 65 ? 'green' : score >= 45 ? 'amber' : 'red';
  }

  return { color, trend, label: esc(axis.state), value: esc(axis.label) };
}

function marketSignal(key, value, chart) {
  const n = num(value);
  let color, label, display, trend = '→';

  if (key === 'spx') {
    const ma50  = num(chart?.ma50);
    const ma200 = num(chart?.ma200);
    const aboveBoth = ma50 && ma200 && n > ma50 && n > ma200;
    const aboveOne  = (ma50 && n > ma50) || (ma200 && n > ma200);
    color   = aboveBoth ? 'green' : aboveOne ? 'amber' : 'red';
    label   = aboveBoth ? 'Above 50D & 200D' : aboveOne ? 'Above one MA' : 'Below MAs';
    display = n ? n.toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
    trend   = aboveBoth ? '↑' : aboveOne ? '→' : '↓';
  } else if (key === 'vix') {
    color   = n < 15 ? 'green' : n < 22 ? 'amber' : 'red';
    label   = n < 15 ? 'Calm' : n < 22 ? 'Watchful' : 'Elevated';
    display = n ? n.toFixed(1) : '—';
    trend   = n < 18 ? '→' : '↑';
  } else if (key === 'dgs10') {
    color   = n < 3.5 ? 'green' : n < 4.5 ? 'amber' : 'red';
    label   = n < 3.5 ? 'Low · supportive' : n < 4.5 ? 'Moderate · watch' : 'High · headwind';
    display = n ? n.toFixed(2) + '%' : '—';
    trend   = n > 4.5 ? '↑' : '→';
  } else if (key === 'hy_oas') {
    color   = n < 3.2 ? 'green' : n < 4.5 ? 'amber' : 'red';
    label   = n < 3.2 ? 'Tight · risk-on' : n < 4.5 ? 'Widening · watch' : 'Stressed';
    display = n ? n.toFixed(2) : '—';
    trend   = n > 3.5 ? '↑' : '↓';
  } else if (key === 'confirmation') {
    color   = n >= 75 ? 'green' : n >= 55 ? 'amber' : 'red';
    label   = n >= 75 ? 'Confirmed' : n >= 55 ? 'Mixed' : 'Failing';
    display = n ? Math.round(n) + '/100' : '—';
    trend   = n >= 75 ? '↑' : '→';
  } else if (key === 'rsi14') {
    color   = n > 75 ? 'red' : n > 65 ? 'amber' : n >= 35 ? 'green' : 'red';
    label   = n > 75 ? 'Overbought' : n > 65 ? 'Extended' : n >= 35 ? 'Healthy' : 'Oversold';
    display = n ? n.toFixed(1) : '—';
    trend   = n > 65 ? '↑' : '→';
  } else {
    color = 'amber'; label = '—'; display = String(value ?? '—');
  }

  return { color, label, display, trend };
}

// ── Derive scorecard signals ──────────────────────────────────────────────────

const mvMap  = Object.fromEntries((brief.macro_values || []).map(m => [m.key, m]));
const axMap  = Object.fromEntries((config.axes || []).map(a => [a.id, a]));
const chart  = brief.chart_reference || {};

const scorecard = [
  // Growth / Tape
  { group: 'Tape', name: 'S&P 500',     ...marketSignal('spx', mvMap.spx?.value, chart) },
  { group: 'Tape', name: 'Confirmation', ...marketSignal('confirmation', mvMap.confirmation?.value, chart) },
  // Sentiment
  { group: 'Sentiment', name: 'VIX',    ...marketSignal('vix', mvMap.vix?.value, chart) },
  { group: 'Sentiment', name: 'RSI 14', ...marketSignal('rsi14', mvMap.rsi14?.value, chart) },
  // Money / Rates
  { group: 'Money', name: 'Fed / Money', ...axisSignal({ ...axMap.money, state: axMap.money?.state || 'Restrictive', label: 'Fed / Money' }) },
  { group: 'Money', name: '10Y Yield',   ...marketSignal('dgs10', mvMap.dgs10?.value, chart) },
  // Credit / Liquidity
  { group: 'Credit', name: 'HY Credit', ...marketSignal('hy_oas', mvMap.hy_oas?.value, chart) },
  { group: 'Credit', name: 'Credit Stress', ...axisSignal({ ...axMap.credit, label: 'Credit Stress' }) },
  // Liquidity / Funding
  { group: 'Flow', name: 'Liquidity',   ...axisSignal({ ...axMap.liquidity, label: 'Liquidity' }) },
  { group: 'Flow', name: 'Physical',    ...axisSignal({ ...axMap.physical_constraint || axMap.physical, label: 'Physical Economy' }) },
];

const greens = scorecard.filter(s => s.color === 'green').length;
const ambers = scorecard.filter(s => s.color === 'amber').length;
const reds   = scorecard.filter(s => s.color === 'red').length;

function scoreSummaryLabel(g, a, r) {
  if (r >= 5) return 'Risk-off conditions — reduce exposure';
  if (r >= 3 && a >= 3) return 'Mixed signals — hold quality, no new adds';
  if (g >= 6) return 'Broadly supportive — selective adds allowed';
  return 'Risk-on with restrictive money — hold core, add on rules only';
}

// ── Zone 1: Regime banner ────────────────────────────────────────────────────

const phaseCode  = esc(egg.phase_code || 'C');
const phaseName  = esc(egg.phase_label || egg.macro_phase || 'Verification');
const confidence = num(egg.phase_confidence) ?? 0;
const action     = esc(egg.center_action || '—');
const stressType = esc(egg.stress_type || '—');

// Top 3 status pills derived from scorecard
const pillData = [
  { key: 'spx',         name: 'Tape' },
  { key: 'confirmation',name: 'Confirmation' },
  { key: 'dgs10',       name: '10Y Rates' },
];
const pills = pillData.map(p => {
  const s = scorecard.find(x => x.name === (p.key === 'spx' ? 'S&P 500' : p.key === 'confirmation' ? 'Confirmation' : '10Y Yield'));
  if (!s) return '';
  return `<div class="mu-pill mu-pill-${s.color}"><i></i><span>${esc(p.name)}</span><b>${s.label} ${s.trend}</b></div>`;
}).join('');

// Plain English narrative: compose from brief fields
const marketRead  = brief.market_read || '';
const macroRead   = brief.macro_read || '';
const topAnalog   = (analogs.analogs || [])[0] || {};
const analogNote  = topAnalog.period ? `Closest match: ${topAnalog.period} (${topAnalog.similarity}% similarity).` : '';
const narrative   = [marketRead, macroRead, analogNote].filter(Boolean).join(' ');

const diagLabel   = esc(config.diagnosis?.label || '—');
const changeRule  = esc(brief.change_rule || '—');
const riskRule    = esc(brief.risk_rule || '—');

// ── Zone 2: Scorecard HTML ────────────────────────────────────────────────────

const GROUPS = ['Tape', 'Sentiment', 'Money', 'Credit', 'Flow'];
const GROUP_LABELS = { Tape: 'Price Tape', Sentiment: 'Sentiment', Money: 'Money · Rates', Credit: 'Credit', Flow: 'Liquidity · Real' };

const scorecardHtml = GROUPS.map(g => {
  const signals = scorecard.filter(s => s.group === g);
  const rows = signals.map(s => `
    <div class="mu-sig mu-sig-${s.color}">
      <div class="mu-sig-top">
        <span class="mu-sig-name">${esc(s.name)}</span>
        <b class="mu-sig-label">${s.label} ${s.trend}</b>
      </div>
      <div class="mu-sig-val">${s.display}</div>
    </div>`).join('');
  return `<div class="mu-sc-group">
    <div class="mu-sc-group-label">${esc(GROUP_LABELS[g] || g)}</div>
    ${rows}
  </div>`;
}).join('');

const summaryText = `${greens} green · ${ambers} amber · ${reds} red — ${scoreSummaryLabel(greens, ambers, reds)}`;

// ── Zone 3a: Cycle sine wave SVG ──────────────────────────────────────────────

const phases = Array.isArray(egg.phases) ? egg.phases : [];

// Phase positions along the sine wave [x, y, labelSide]
const PHASE_POS = [
  { code: 'A1', x: 42,  y: 148, side: 'below', sectorNote: 'Bonds · Gold · Cash' },
  { code: 'A2', x: 118, y: 112, side: 'below', sectorNote: 'Accumulate slowly' },
  { code: 'B',  x: 228, y: 52,  side: 'above', sectorNote: 'Tech · Discretionary' },
  { code: 'C',  x: 348, y: 36,  side: 'above', sectorNote: 'Quality · Healthcare' },
  { code: 'D',  x: 460, y: 52,  side: 'above', sectorNote: 'Cyclicals · Energy' },
  { code: 'E',  x: 560, y: 100, side: 'below', sectorNote: 'Trim beta · raise cash' },
  { code: 'F',  x: 634, y: 142, side: 'below', sectorNote: 'Defensives · Bonds' },
];

const currentCode  = egg.phase_code || 'C';
const previousCode = (phases.find(p => p.state === 'previous') || {}).code || 'B';

function cycleNodeSvg(pp, phase) {
  const isCurrent  = pp.code === currentCode;
  const isPrevious = pp.code === previousCode;
  const r = isCurrent ? 16 : 10;
  const fill = isCurrent ? '#A4502F' : isPrevious ? 'rgba(164,80,47,.35)' : 'rgba(201,191,173,.55)';
  const textColor = isCurrent ? '#A4502F' : 'rgba(26,23,20,.55)';
  const labelY = pp.side === 'above' ? pp.y - r - 24 : pp.y + r + 14;
  const noteY  = pp.side === 'above' ? pp.y - r - 8 : pp.y + r + 28;
  const label  = phase ? esc(phase.label || pp.code) : pp.code;

  let markup = `<circle cx="${pp.x}" cy="${pp.y}" r="${r}" fill="${fill}" stroke="${isCurrent ? '#A4502F' : 'rgba(201,191,173,.45)'}" stroke-width="${isCurrent ? 2 : 1}"/>`;
  markup += `<text x="${pp.x}" y="${pp.y+4}" text-anchor="middle" font-size="9" font-weight="600" fill="${isCurrent ? '#fff' : 'rgba(26,23,20,.6)'}" font-family="inherit">${pp.code}</text>`;
  markup += `<text x="${pp.x}" y="${labelY}" text-anchor="middle" font-size="10" font-weight="${isCurrent ? '600' : '500'}" fill="${textColor}" font-family="inherit">${label}</text>`;
  if (isCurrent) {
    markup += `<text x="${pp.x}" y="${noteY}" text-anchor="middle" font-size="9" fill="rgba(164,80,47,.78)" font-family="inherit">${esc(pp.sectorNote)}</text>`;
    markup += `<text x="${pp.x}" y="${pp.y - r - 40}" text-anchor="middle" font-size="9" font-weight="700" fill="#A4502F" letter-spacing=".08em" font-family="inherit">YOU ARE HERE</text>`;
  }
  return markup;
}

const nodeMarkup = PHASE_POS.map(pp => {
  const phase = phases.find(p => p.code === pp.code);
  return cycleNodeSvg(pp, phase);
}).join('');

const cycleSvg = `<svg class="mu-cycle-svg" viewBox="0 0 700 200" aria-label="Economic cycle position">
  <defs>
    <marker id="muArrow" markerWidth="8" markerHeight="8" refX="5" refY="2.5" orient="auto">
      <path d="M0,0 L5,2.5 L0,5 Z" fill="rgba(164,80,47,.6)"/>
    </marker>
  </defs>
  <!-- Cycle path: trough → peak → trough (one full cycle) -->
  <path d="M 20,155 C 55,155 75,115 118,112 S 178,52 228,52 S 308,36 348,36 S 428,52 460,52 S 530,100 560,100 S 618,145 648,148 L 690,155"
        fill="none" stroke="rgba(201,191,173,.55)" stroke-width="2"/>
  <!-- Active segment: B → C (the path we just traveled) -->
  <path d="M 228,52 S 308,36 348,36"
        fill="none" stroke="#A4502F" stroke-width="2.5" stroke-dasharray="0"/>
  <!-- Upcoming segment: C → D (dotted, what comes next) -->
  <path d="M 348,36 S 428,52 460,52"
        fill="none" stroke="rgba(164,80,47,.38)" stroke-width="1.5" stroke-dasharray="4 3"/>
  <!-- Axis labels -->
  <text x="350" y="190" text-anchor="middle" font-size="9" fill="rgba(26,23,20,.4)" font-family="inherit" letter-spacing=".08em">ECONOMIC CYCLE · KOSTOLANY FRAMEWORK</text>
  ${nodeMarkup}
</svg>`;

// ── Zone 3b: Sector heat map ──────────────────────────────────────────────────

// Map from equity_posture to traffic light
function sectorSignal(posture, tilt) {
  const p = String(posture || '').toLowerCase();
  const t = String(tilt || '').toLowerCase();
  if (/avoid|underweight/.test(t) || /avoid add/.test(p)) return 'red';
  if (/wait/.test(p)) return 'red';
  if (/overweight|favor/.test(t) || /add quality/.test(p) || /accumulate/.test(p)) return 'green';
  return 'amber';
}

// 11 equity categories from cycle state
const equityPosture = Array.isArray(cycle.equity_posture) ? cycle.equity_posture : [];
const equityGroups  = cycle.equity_groups || {};

// Canonical display order and display names
const SECTOR_MAP = [
  { bucket: 'Healthcare',        icon: '🏥', short: 'Health' },
  { bucket: 'Defensive sectors', icon: '🛡', short: 'Defensive' },
  { bucket: 'Dividend / income', icon: '💰', short: 'Dividend' },
  { bucket: 'Utilities',         icon: '⚡', short: 'Utilities' },
  { bucket: 'Quality growth',    icon: '📈', short: 'Quality Growth' },
  { bucket: 'AI / semis',        icon: '🤖', short: 'AI / Semis' },
  { bucket: 'Value',             icon: '⚖', short: 'Value' },
  { bucket: 'Financials',        icon: '🏦', short: 'Financials' },
  { bucket: 'Energy equities',   icon: '🔋', short: 'Energy' },
  { bucket: 'Cyclicals',         icon: '🔄', short: 'Cyclicals' },
  { bucket: 'Small caps',        icon: '📉', short: 'Small Caps' },
  { bucket: 'Speculative growth',icon: '⚠', short: 'Speculative' },
];

const sectorHtml = SECTOR_MAP.map(s => {
  const ep    = equityPosture.find(p => p.bucket === s.bucket);
  const color = ep ? sectorSignal(ep.posture, ep.tilt) : 'amber';
  const cond  = ep?.condition ? esc(ep.condition.split('.')[0]) : '';
  return `<div class="mu-sector mu-sector-${color}" title="${cond}">
    <span class="mu-sector-icon">${s.icon}</span>
    <span class="mu-sector-name">${esc(s.short)}</span>
    <span class="mu-sector-sig">${color === 'green' ? 'Favor' : color === 'red' ? 'Reduce' : 'Watch'}</span>
  </div>`;
}).join('');

// ── Tier 2: collapse tier (extract + archive id) ──────────────────────────────

let html = fs.readFileSync(indexPath, 'utf8');

function extractSectionHtml(html, id) {
  let s = 0;
  while (s < html.length) {
    const i = html.indexOf('<section', s);
    if (i < 0) return '';
    const j = html.indexOf('>', i);
    if (html.slice(i, j + 1).includes(`id="${id}"`)) {
      let next = html.length;
      let search = j + 1;
      while (search < html.length) {
        const ni = html.indexOf('<section', search);
        if (ni < 0) break;
        const nj = html.indexOf('>', ni);
        if (html.slice(ni, nj + 1).includes('id=') && ni !== i) { next = ni; break; }
        search = ni + 1;
      }
      const mainClose = html.lastIndexOf('</main>');
      if (mainClose > i && mainClose < next) next = mainClose;
      return html.slice(i, next);
    }
    s = i + 1;
  }
  return '';
}

function archiveId(sectionHtml) {
  return sectionHtml.replace(/(<section[^>]*)\sid="([^"]*)"/, '$1 data-macro-archived="$2"');
}

const dbHtml  = archiveId(extractSectionHtml(html, 'decision-brief-section'));
const cmsHtml = archiveId(extractSectionHtml(html, 'current-market-state'));

const remainingAnalogs = (analogs.analogs || []).slice(1, 4).map(a => `
  <div class="mu-analog-extra">
    <div class="mu-analog-head">
      <div><b class="mu-analog-period">${esc(a.period)}</b><span>${esc(a.label)}</span></div>
      <b class="mu-sim" style="color:${(num(a.similarity)||0)>=85?'#A4502F':'rgba(26,23,20,.5)'}">${esc(a.similarity)}%</b>
    </div>
    <p>${esc(a.portfolioLesson)}</p>
  </div>`).join('');

// ── CSS ───────────────────────────────────────────────────────────────────────

const style = `<style id="macro-unified-style">
/* ── Base ── */
.macro-unified{border-bottom:1px solid var(--macro-rule,rgba(201,191,173,.58));background:linear-gradient(180deg,#F7F3EB 0%,#EEE9DF 100%)}
.mu-wrap{width:min(1280px,calc(100% - 48px));margin:0 auto;padding:0 0 40px}

/* ── Traffic light palette ── */
.mu-green{--mu-c:#2a6b4a;--mu-bg:rgba(42,107,74,.09);--mu-bd:rgba(42,107,74,.25)}
.mu-amber{--mu-c:#8a6a2c;--mu-bg:rgba(138,106,44,.09);--mu-bd:rgba(138,106,44,.25)}
.mu-red{--mu-c:#A4502F;--mu-bg:rgba(164,80,47,.09);--mu-bd:rgba(164,80,47,.25)}

/* ── Zone 1: Regime banner ── */
.mu-regime{display:grid;grid-template-columns:1fr auto;gap:32px;align-items:start;padding:36px 0 28px;border-bottom:1px solid var(--macro-rule,rgba(201,191,173,.58))}
.mu-regime-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:rgba(26,23,20,.45);margin:0 0 10px;font-family:var(--mono,monospace)}
.mu-regime-headline{font-size:clamp(36px,4.5vw,72px);line-height:.9;letter-spacing:-.07em;font-weight:500;margin:0 0 14px;color:#1A1714}
.mu-regime-narrative{font-size:clamp(14px,1.3vw,17px);line-height:1.5;color:rgba(26,23,20,.7);max-width:780px;margin:0 0 18px}
.mu-action-block{border-left:3px solid #A4502F;padding:10px 0 10px 14px;margin-top:4px}
.mu-action-block span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.45);margin-bottom:5px;font-family:var(--mono,monospace)}
.mu-action-block b{display:block;font-size:14px;font-weight:500;color:#1A1714;line-height:1.35}
.mu-action-block em{display:block;font-size:12px;font-style:normal;color:rgba(26,23,20,.55);margin-top:5px}
/* Right side: confidence + pills */
.mu-regime-right{display:flex;flex-direction:column;align-items:flex-end;gap:14px;min-width:220px}
.mu-conf-block{text-align:right}
.mu-conf-block span{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.45);margin-bottom:4px;font-family:var(--mono,monospace)}
.mu-conf-block b{display:block;font-size:52px;line-height:.9;letter-spacing:-.07em;font-weight:500;color:#A4502F}
.mu-conf-block small{font-size:12px;color:rgba(26,23,20,.4)}
.mu-pills{display:flex;flex-direction:column;gap:6px;width:100%}
.mu-pill{display:flex;align-items:center;gap:8px;padding:7px 12px;border:1px solid var(--mu-bd);background:var(--mu-bg);min-width:0}
.mu-pill i{width:8px;height:8px;border-radius:50%;background:var(--mu-c);flex-shrink:0}
.mu-pill span{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:rgba(26,23,20,.5);font-family:var(--mono,monospace)}
.mu-pill b{font-size:12px;font-weight:500;color:var(--mu-c);margin-left:auto}

/* ── Zone 2: Scorecard ── */
.mu-scorecard{padding:28px 0;border-bottom:1px solid var(--macro-rule,rgba(201,191,173,.58))}
.mu-scorecard-header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:16px}
.mu-scorecard-header h3{font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.45);font-weight:500;margin:0;font-family:var(--mono,monospace)}
.mu-scorecard-header span{font-size:12px;color:rgba(26,23,20,.55)}
.mu-sc-grid{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px}
.mu-sc-group{display:flex;flex-direction:column;gap:6px}
.mu-sc-group-label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:rgba(26,23,20,.38);padding-bottom:6px;border-bottom:1px solid rgba(201,191,173,.4);font-family:var(--mono,monospace)}
.mu-sig{border:1px solid var(--mu-bd);background:var(--mu-bg);padding:10px 12px;border-left:3px solid var(--mu-c)}
.mu-sig-top{display:flex;justify-content:space-between;align-items:baseline;gap:6px;margin-bottom:6px}
.mu-sig-name{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:rgba(26,23,20,.5)}
.mu-sig-label{font-size:11px;font-weight:500;color:var(--mu-c)}
.mu-sig-val{font-size:20px;letter-spacing:-.04em;font-weight:500;color:#1A1714;line-height:1}
.mu-scorecard-summary{margin-top:14px;padding:10px 14px;background:rgba(255,255,255,.22);border:1px solid rgba(201,191,173,.4);font-size:13px;color:rgba(26,23,20,.7);text-align:center}

/* ── Zone 3: Cycle + Sectors ── */
.mu-cycle-sector{display:grid;grid-template-columns:1.1fr .9fr;gap:24px;padding:28px 0;border-bottom:1px solid var(--macro-rule,rgba(201,191,173,.58))}
.mu-zone-head{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.4);margin:0 0 16px;font-family:var(--mono,monospace)}
.mu-cycle-svg{width:100%;height:auto}
/* Sector heat map */
.mu-sector-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}
.mu-sector{display:flex;flex-direction:column;gap:3px;padding:10px 10px 8px;border:1px solid var(--mu-bd);background:var(--mu-bg);border-left:3px solid var(--mu-c);cursor:default}
.mu-sector-icon{font-size:16px;line-height:1}
.mu-sector-name{font-size:11px;font-weight:500;color:#1A1714;line-height:1.2}
.mu-sector-sig{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--mu-c);font-weight:600}
.mu-sector-legend{display:flex;gap:16px;margin-top:10px;font-size:11px;color:rgba(26,23,20,.5)}
.mu-sector-legend span{display:flex;align-items:center;gap:5px}
.mu-sector-legend i{width:8px;height:8px;border-radius:50%;display:inline-block}

/* ── Collapsed tier 2 ── */
.mu-details{border-top:none}
.mu-details-toggle{display:flex;align-items:center;gap:10px;cursor:pointer;padding:16px 0 12px;font-size:12px;color:rgba(26,23,20,.45);list-style:none;letter-spacing:.04em;border-top:1px solid rgba(201,191,173,.35)}
.mu-details-toggle::-webkit-details-marker{display:none}
.mu-details-toggle:hover{color:rgba(26,23,20,.7)}
.mu-details-toggle::before{content:'↓';font-size:10px;transition:transform .2s}
details[open] .mu-details-toggle::before{transform:rotate(180deg)}
.mu-details-body{padding-top:24px;border-top:1px solid rgba(201,191,173,.35)}
.mu-detail-group{margin-bottom:28px}
.mu-detail-group h4{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(26,23,20,.38);margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid rgba(201,191,173,.35)}
.mu-analog-extra{border:1px solid rgba(201,191,173,.5);padding:12px 14px;background:rgba(255,255,255,.14);margin-bottom:6px}
.mu-analog-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;margin-bottom:8px}
.mu-analog-period{display:block;font-size:24px;letter-spacing:-.05em;font-weight:500;line-height:.95}
.mu-analog-head span{font-size:12px;color:rgba(26,23,20,.55);display:block;margin-top:4px}
.mu-sim{font-size:28px;letter-spacing:-.05em;font-weight:500;line-height:.9}
.mu-analog-extra p{font-size:12px;line-height:1.4;margin:0;color:rgba(26,23,20,.65)}

/* ── Responsive ── */
@media(max-width:1100px){.mu-regime{grid-template-columns:1fr}.mu-regime-right{flex-direction:row;align-items:center;flex-wrap:wrap;justify-content:flex-start}.mu-conf-block{text-align:left}}
@media(max-width:960px){.mu-sc-grid{grid-template-columns:repeat(3,1fr)}.mu-cycle-sector{grid-template-columns:1fr}}
@media(max-width:640px){.mu-sc-grid{grid-template-columns:repeat(2,1fr)}.mu-sector-grid{grid-template-columns:repeat(2,1fr)}}
</style>`;

// ── Assemble section ──────────────────────────────────────────────────────────

const section = `<section id="macro-unified-section" class="macro-unified">
  ${style}
  <div class="mu-wrap">

    <!-- Zone 1: Regime banner -->
    <div class="mu-regime">
      <div class="mu-regime-left">
        <p class="mu-regime-eyebrow">Macro · Kostolany Phase ${phaseCode} · ${diagLabel}</p>
        <h2 class="mu-regime-headline">${phaseName}</h2>
        <p class="mu-regime-narrative">${esc(narrative) || esc(brief.brief || '')}</p>
        <div class="mu-action-block">
          <span>Portfolio action</span>
          <b>${action}</b>
          <em>${changeRule}</em>
        </div>
      </div>
      <div class="mu-regime-right">
        <div class="mu-conf-block">
          <span>Cycle confidence</span>
          <b>${confidence}%</b>
          <small>${stressType}</small>
        </div>
        <div class="mu-pills">${pills}</div>
      </div>
    </div>

    <!-- Zone 2: Economy scorecard -->
    <div class="mu-scorecard">
      <div class="mu-scorecard-header">
        <h3>Economy scorecard</h3>
        <span>${summaryText}</span>
      </div>
      <div class="mu-sc-grid">${scorecardHtml}</div>
      <div class="mu-scorecard-summary">${esc(riskRule)}</div>
    </div>

    <!-- Zone 3: Cycle + Sector heat map -->
    <div class="mu-cycle-sector">
      <div>
        <p class="mu-zone-head">Where are we in the cycle?</p>
        ${cycleSvg}
      </div>
      <div>
        <p class="mu-zone-head">What to own — Phase ${phaseCode} rotation</p>
        <div class="mu-sector-grid">${sectorHtml}</div>
        <div class="mu-sector-legend">
          <span><i style="background:#2a6b4a"></i>Favor</span>
          <span><i style="background:#8a6a2c"></i>Watch</span>
          <span><i style="background:#A4502F"></i>Reduce</span>
        </div>
      </div>
    </div>

    <!-- Tier 2: Full analysis (collapsed) -->
    <details class="mu-details">
      <summary class="mu-details-toggle">Full macro analysis — analogs, decision brief, market tape</summary>
      <div class="mu-details-body">
        ${remainingAnalogs ? `<div class="mu-detail-group"><h4>Additional historical analogs</h4>${remainingAnalogs}</div>` : ''}
        ${cmsHtml ? `<div class="mu-detail-group">${cmsHtml}</div>` : ''}
        ${dbHtml  ? `<div class="mu-detail-group">${dbHtml}</div>`  : ''}
      </div>
    </details>

  </div>
</section>`;

// ── Injection ─────────────────────────────────────────────────────────────────

// Remove old styles + sections
const OLD_STYLES = ['macro-unified-style','macro-cycle-panel-style','macro-intelligence-panel-style','current-market-state-style'];
const OLD_SECTIONS = ['macro-unified-section','macro-cycle-panel','macro-intelligence-panel'];
const REMOVE_IDS   = ['macro-cycle-panel','decision-brief-section','current-market-state','macro-intelligence-panel','macro-unified-section'];

for (const id of OLD_STYLES) html = html.replace(new RegExp(`<style id="${id}">[\\s\\S]*?<\\/style>`, 'g'), '');
html = html.replace('</head>', style + '</head>');

function findSectionPos(html, id) {
  let s = 0;
  while (s < html.length) {
    const i = html.indexOf('<section', s);
    if (i < 0) return -1;
    const j = html.indexOf('>', i);
    if (html.slice(i, j + 1).includes(`id="${id}"`)) return i;
    s = i + 1;
  }
  return -1;
}

function sectionEnd(html, start) {
  let s = start + 1, end = html.length;
  while (s < html.length) {
    const ni = html.indexOf('<section', s);
    if (ni < 0) break;
    const nj = html.indexOf('>', ni);
    if (html.slice(ni, nj + 1).includes('id=') && ni !== start) { end = ni; break; }
    s = ni + 1;
  }
  const mc = html.lastIndexOf('</main>');
  if (mc > start && mc < end) end = mc;
  return end;
}

// Collect and remove all old sections (back to front)
const toRemove = REMOVE_IDS
  .map(id => { const p = findSectionPos(html, id); return p >= 0 ? { start: p, end: sectionEnd(html, p) } : null; })
  .filter(Boolean)
  .sort((a, b) => b.start - a.start);

for (const { start, end } of toRemove) html = html.slice(0, start) + html.slice(end);

// Insert before operational-chart-section
const insertPos = findSectionPos(html, 'operational-chart-section');
if (insertPos >= 0) {
  html = html.slice(0, insertPos) + section + html.slice(insertPos);
} else {
  const mc = html.lastIndexOf('</main>');
  html = html.slice(0, mc) + section + html.slice(mc);
}

fs.writeFileSync(indexPath, html);
if (!html.includes('id="macro-unified-section"')) throw new Error('macro-unified-section injection failed');
console.log(`injected redesigned macro section into ${path.relative(root, indexPath)}`);
