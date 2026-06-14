'use strict';

const fs   = require('fs');
const path = require('path');

const root       = path.join(__dirname, '..');
const indexPath  = process.argv[2] ? path.resolve(root, process.argv[2]) : path.join(root, 'index.html');
const calPath    = path.join(root, 'data', 'market-calendar.json');

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);
if (!fs.existsSync(calPath)) {
  console.log('market-calendar.json missing — skipping');
  process.exit(0);
}

const { events } = JSON.parse(fs.readFileSync(calPath, 'utf8'));
const TODAY = new Date('2026-06-13');

const TYPE_META = {
  fomc:     { label: 'FOMC',     color: '#ba7517', bg: 'rgba(186,117,23,.1)',  border: 'rgba(186,117,23,.3)'  },
  cpi:      { label: 'CPI',      color: '#185fa5', bg: 'rgba(24,95,165,.09)', border: 'rgba(24,95,165,.28)'  },
  pce:      { label: 'PCE',      color: '#2c6a8f', bg: 'rgba(44,106,143,.09)',border: 'rgba(44,106,143,.28)' },
  jobs:     { label: 'JOBS',     color: '#1d9e75', bg: 'rgba(29,158,117,.09)',border: 'rgba(29,158,117,.28)' },
  gdp:      { label: 'GDP',      color: '#6b46c1', bg: 'rgba(107,70,193,.08)',border: 'rgba(107,70,193,.25)' },
  earnings: { label: 'EARNINGS', color: '#c46050', bg: 'rgba(196,96,80,.09)', border: 'rgba(196,96,80,.28)'  },
};

function daysFrom(dateStr) {
  const d = new Date(dateStr);
  const ms = d - TODAY;
  return Math.round(ms / 86400000);
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatMonth(dateStr) {
  const d = new Date(dateStr + 'T12:00:00Z');
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

// Group events by month, sorted chronologically
const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
const byMonth = {};
for (const ev of sorted) {
  const monthKey = ev.date.slice(0, 7);
  if (!byMonth[monthKey]) byMonth[monthKey] = [];
  byMonth[monthKey].push(ev);
}

function renderEventRow(ev) {
  const days = daysFrom(ev.date);
  const meta = TYPE_META[ev.type] || TYPE_META.cpi;
  const isPast = days < 0;
  const isToday = days === 0;
  const daysLabel = isPast
    ? `<span class="mc-days mc-past">${Math.abs(days)}d ago</span>`
    : isToday
    ? `<span class="mc-days mc-today">today</span>`
    : days === 1
    ? `<span class="mc-days">tomorrow</span>`
    : `<span class="mc-days">in ${days}d</span>`;

  const rowCls = isPast ? ' mc-row-past' : '';
  const badge = `<span class="mc-badge" style="color:${meta.color};background:${meta.bg};border-color:${meta.border};">${meta.label}</span>`;

  return `<div class="mc-row${rowCls}">
  <span class="mc-date">${formatDate(ev.date)}</span>
  ${badge}
  <span class="mc-label">${ev.label}</span>
  <span class="mc-detail">${ev.detail}</span>
  ${daysLabel}
</div>`;
}

function renderSection() {
  const monthBlocks = Object.entries(byMonth).map(([monthKey, evs]) => {
    const monthLabel = formatMonth(evs[0].date);
    const rows = evs.map(renderEventRow).join('\n');
    return `<div class="mc-month">
  <div class="mc-month-head">${monthLabel}</div>
  <div class="mc-month-rows">${rows}</div>
</div>`;
  }).join('\n');

  return `<!-- MC_CALENDAR_START -->
<section id="market-calendar-section" class="mc-section">
<div class="mc-inner">
  <div class="mc-head">
    <div>
      <p class="mc-eyebrow">Market Calendar</p>
      <h2 class="mc-title">Upcoming Events</h2>
      <p class="mc-subtitle">FOMC · CPI · PCE · NFP · GDP · Major earnings — events that move the market.</p>
    </div>
  </div>
  <div class="mc-body">
    ${monthBlocks}
  </div>
  <p class="mc-source">Sources: Federal Reserve (fomc.org) · BLS · BEA · Earnings estimated from historical reporting patterns.</p>
</div>
</section>
<!-- MC_CALENDAR_END -->`;
}

function renderStyle() {
  return `<style id="market-calendar-style">
.mc-section{background:var(--cream,#f6f4ee);border-top:1px solid var(--rule,#dedbd2);padding:48px 0}
.mc-inner{width:min(1240px,calc(100% - 48px));margin:0 auto}
.mc-head{margin-bottom:28px}
.mc-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted,#747168);margin:0 0 6px;font-family:var(--mono,monospace)}
.mc-title{font-size:24px;font-weight:400;letter-spacing:-.025em;color:#1A1714;margin:0 0 6px;line-height:1.2}
.mc-subtitle{font-size:13px;color:var(--muted,#747168);margin:0;line-height:1.5}
.mc-body{display:flex;flex-direction:column;gap:28px}
.mc-month{display:flex;flex-direction:column;gap:0}
.mc-month-head{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted,#747168);font-family:var(--mono,monospace);font-weight:600;padding:0 0 10px;border-bottom:1px solid var(--rule,#dedbd2);margin-bottom:2px}
.mc-month-rows{display:flex;flex-direction:column}
.mc-row{display:grid;grid-template-columns:52px 72px 1fr auto auto;gap:12px;align-items:baseline;padding:9px 0;border-bottom:1px solid rgba(201,191,173,.25);transition:background .15s}
.mc-row:last-child{border-bottom:none}
.mc-row-past{opacity:.45}
.mc-date{font-size:11px;font-family:var(--mono,monospace);color:var(--muted,#747168);white-space:nowrap}
.mc-badge{font-size:9px;font-weight:700;letter-spacing:.07em;padding:2px 7px;border:1px solid;white-space:nowrap;font-family:var(--mono,monospace);border-radius:2px}
.mc-label{font-size:13px;font-weight:500;color:#1A1714;letter-spacing:-.01em}
.mc-detail{font-size:11.5px;color:var(--muted,#747168);line-height:1.4;min-width:0}
.mc-days{font-size:10px;font-family:var(--mono,monospace);color:var(--muted,#747168);white-space:nowrap;text-align:right}
.mc-days.mc-past{color:rgba(36,35,31,.3)}
.mc-days.mc-today{color:#1d9e75;font-weight:600}
.mc-source{font-size:10px;color:rgba(36,35,31,.35);margin:24px 0 0;font-family:var(--mono,monospace);line-height:1.6}
@media(max-width:760px){.mc-row{grid-template-columns:48px 64px 1fr auto}.mc-detail{display:none}}
@media(max-width:520px){.mc-row{grid-template-columns:48px 60px 1fr}.mc-days{display:none}}
</style>`;
}

const SECTION_ID = 'market-calendar-section';
const STYLE_ID   = 'market-calendar-style';
const section    = renderSection();
const style      = renderStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Style: replace existing or inject into head
if (html.includes(`id="${STYLE_ID}"`)) {
  html = html.replace(new RegExp(`<style[^>]*id="${STYLE_ID}"[^>]*>[\\s\\S]*?<\\/style>`), style);
} else {
  html = html.replace('</' + 'head>', style + '</' + 'head>');
}

// Section: replace existing block if present
if (html.includes(`id="${SECTION_ID}"`)) {
  html = html.replace(/<!-- MC_CALENDAR_START -->[\s\S]*?<!-- MC_CALENDAR_END -->/, section);
} else {
  // Insert after KP_PROJECTION_END if present, else before operational chart section
  if (html.includes('<!-- KP_PROJECTION_END -->')) {
    html = html.replace('<!-- KP_PROJECTION_END -->', '<!-- KP_PROJECTION_END -->\n' + section);
  } else {
    html = html.replace(/<section id="operational-chart-section"/, section + '\n<section id="operational-chart-section"');
  }
}

fs.writeFileSync(indexPath, html);
const upcoming = events.filter(e => daysFrom(e.date) >= 0).length;
console.log(`injected market-calendar-section: ${events.length} events, ${upcoming} upcoming`);
