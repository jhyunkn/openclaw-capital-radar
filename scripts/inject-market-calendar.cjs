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
const todayKey = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const TODAY = new Date(`${todayKey}T00:00:00Z`);

const TYPE_META = {
  fomc:     { label: 'FOMC',     color: '#8a6a2c', bg: 'rgba(138,106,44,.10)', border: 'rgba(138,106,44,.32)' },
  cpi:      { label: 'CPI',      color: '#405f9f', bg: 'rgba(64,95,159,.09)',  border: 'rgba(64,95,159,.30)'  },
  pce:      { label: 'PCE',      color: '#4d6f91', bg: 'rgba(77,111,145,.09)', border: 'rgba(77,111,145,.28)' },
  jobs:     { label: 'JOBS',     color: '#2f6f4e', bg: 'rgba(47,111,78,.09)',  border: 'rgba(47,111,78,.28)'  },
  gdp:      { label: 'GDP',      color: '#747168', bg: 'rgba(116,113,104,.07)',border: 'rgba(116,113,104,.25)' },
  earnings: { label: 'EARNINGS', color: '#9f3f35', bg: 'rgba(159,63,53,.08)',  border: 'rgba(159,63,53,.28)'  },
  election: { label: 'VOTE',     color: '#6b4d9f', bg: 'rgba(107,77,159,.09)', border: 'rgba(107,77,159,.30)' },
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

// Group events by month, sorted chronologically.
// An event with an `outcome` is decided → rendered in the "What happened"
// group; everything else is upcoming.
const sorted  = [...events].sort((a, b) => a.date.localeCompare(b.date));
const decided = sorted.filter(ev => ev.outcome && (ev.outcome.decision || ev.outcome.reaction));
const upcoming = sorted.filter(ev => !(ev.outcome && (ev.outcome.decision || ev.outcome.reaction)));
const byMonth = {};
for (const ev of upcoming) {
  const monthKey = ev.date.slice(0, 7);
  if (!byMonth[monthKey]) byMonth[monthKey] = [];
  byMonth[monthKey].push(ev);
}

const esc = v => String(v ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function renderEventRow(ev) {
  const days = daysFrom(ev.date);
  const meta = TYPE_META[ev.type] || TYPE_META.cpi;
  const isToday = days === 0;
  const daysLabel = days < 0
    ? `<span class="mc-days mc-past">${Math.abs(days)}d ago</span>`
    : isToday
    ? `<span class="mc-days mc-today">today</span>`
    : days === 1
    ? `<span class="mc-days">tomorrow</span>`
    : `<span class="mc-days">in ${days}d</span>`;

  const badge = `<span class="mc-badge" style="color:${meta.color};background:${meta.bg};border-color:${meta.border};">${meta.label}</span>`;

  return `<div class="mc-event">
  <div class="mc-row">
    <span class="mc-date">${formatDate(ev.date)}</span>
    ${badge}
    <span class="mc-label">${esc(ev.label)}</span>
    ${daysLabel}
  </div>
  ${ev.detail ? `<p class="mc-detail">${esc(ev.detail)}</p>` : ''}
  ${ev.watch_out_for ? `<p class="mc-watchfor"><span>Watch for</span> ${esc(ev.watch_out_for)}</p>` : ''}
</div>`;
}

function renderDecidedEvent(ev) {
  const meta = TYPE_META[ev.type] || TYPE_META.cpi;
  const badge = `<span class="mc-badge" style="color:${meta.color};background:${meta.bg};border-color:${meta.border};">${meta.label}</span>`;
  const decision = esc(ev.outcome.decision);
  const reaction = esc(ev.outcome.reaction);

  return `<div class="mc-past-event">
  <div class="mc-row">
    <span class="mc-date">${formatDate(ev.date)}</span>
    ${badge}
    <span class="mc-label">${esc(ev.label)}</span>
    <span class="mc-decided">decided</span>
  </div>
  ${decision ? `<p class="mc-outcome"><span>Outcome</span> ${decision}</p>` : ''}
  ${reaction ? `<p class="mc-reaction"><span>Market reaction</span> ${reaction}</p>` : ''}
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

  const pastBlock = decided.length ? `<div class="mc-past">
  <div class="mc-past-head">What happened</div>
  <div class="mc-past-events">${decided.map(renderDecidedEvent).join('\n')}</div>
</div>` : '';

  return `<!-- MC_CALENDAR_START -->
<section id="market-calendar-section" class="mc-section">
<div class="mc-inner">
  <div class="mc-head">
    <div>
      <p class="mc-eyebrow">Market Calendar</p>
      <h2 class="mc-title">Upcoming Events</h2>
      <p class="mc-subtitle">FOMC · CPI · PCE · NFP · GDP · Major earnings — what to watch next, plus what already happened.</p>
    </div>
  </div>
  <div class="mc-body">
    ${monthBlocks}
    ${pastBlock}
  </div>
  <p class="mc-source">Sources: Federal Reserve (fomc.org) · BLS · BEA · Earnings estimated from historical reporting patterns. Outcomes recorded from public post-decision reporting; reactions are short-term price repricing, not forecasts.</p>
</div>
</section>
<!-- MC_CALENDAR_END -->`;
}

function renderStyle() {
  return `<style id="market-calendar-style">
.mc-section{background:#ffffff;border-top:1px solid var(--rule,#dedbd2);padding:56px 0}
.mc-inner{width:min(1240px,calc(100% - 48px));margin:0 auto}
.mc-head{margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid var(--rule,#dedbd2)}
.mc-eyebrow{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted,#747168);margin:0 0 8px;font-family:var(--mono,monospace);display:block}
.mc-title{font-size:clamp(22px,2.8vw,38px);font-weight:500;letter-spacing:-.05em;color:var(--ink,#24231f);margin:0 0 6px;line-height:.96}
.mc-subtitle{font-size:14px;color:var(--muted,#747168);margin:0;line-height:1.45}
.mc-body{display:flex;flex-direction:column;gap:28px}
.mc-month{display:flex;flex-direction:column;gap:0}
.mc-month-head{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted,#747168);font-family:var(--mono,monospace);font-weight:600;padding:0 0 10px;border-bottom:1px solid var(--rule,#dedbd2);margin-bottom:2px}
.mc-month-rows{display:flex;flex-direction:column}
.mc-event{padding:12px 0;border-bottom:1px solid rgba(201,191,173,.35)}
.mc-event:last-child{border-bottom:none}
.mc-row{display:grid;grid-template-columns:52px 72px 1fr auto;gap:12px;align-items:baseline}
.mc-date{font-size:11px;font-family:var(--mono,monospace);color:var(--muted,#747168);white-space:nowrap}
.mc-badge{font-size:9px;font-weight:700;letter-spacing:.07em;padding:2px 7px;border:1px solid;white-space:nowrap;font-family:var(--mono,monospace);border-radius:0}
.mc-label{font-size:13px;font-weight:500;color:var(--ink,#24231f);letter-spacing:-.01em}
.mc-detail{font-size:11.5px;color:var(--muted,#747168);line-height:1.5;margin:6px 0 0;padding-left:64px}
.mc-watchfor{font-size:12px;color:rgba(36,35,31,.85);line-height:1.55;margin:8px 0 0;padding:9px 12px 9px 12px;background:rgba(64,95,159,.05);border-left:3px solid rgba(64,95,159,.45)}
.mc-watchfor span{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:rgba(64,95,159,.85);margin-right:7px}
.mc-days{font-size:10px;font-family:var(--mono,monospace);color:var(--muted,#747168);white-space:nowrap;text-align:right}
.mc-days.mc-past{color:rgba(36,35,31,.3)}
.mc-days.mc-today{color:var(--green,#2f6f4e);font-weight:600}
.mc-past{margin-top:4px;border:1px solid rgba(201,191,173,.4);background:rgba(116,113,104,.04);padding:20px 22px}
.mc-past-head{font-size:10px;text-transform:uppercase;letter-spacing:.14em;color:var(--muted,#747168);font-family:var(--mono,monospace);font-weight:600;margin-bottom:14px}
.mc-past-events{display:flex;flex-direction:column;gap:18px}
.mc-past-event{opacity:.92}
.mc-past-event:last-child .mc-row{margin-bottom:0}
.mc-decided{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;font-family:var(--mono,monospace);color:rgba(36,35,31,.45);border:1px solid rgba(201,191,173,.5);padding:2px 7px;white-space:nowrap}
.mc-outcome,.mc-reaction{font-size:12px;line-height:1.55;color:rgba(36,35,31,.75);margin:7px 0 0;padding-left:64px}
.mc-reaction{margin-top:5px}
.mc-outcome span,.mc-reaction span{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.09em;color:rgba(36,35,31,.45);margin-right:7px}
.mc-source{font-size:10px;color:rgba(36,35,31,.35);margin:24px 0 0;font-family:var(--mono,monospace);line-height:1.6}
@media(max-width:760px){.mc-row{grid-template-columns:48px 64px 1fr auto}.mc-detail,.mc-outcome,.mc-reaction{padding-left:0}}
@media(max-width:520px){.mc-row{grid-template-columns:48px 60px 1fr}.mc-days,.mc-decided{display:none}.mc-past{padding:16px 14px}}
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

// Section: replace existing block if present.
// Matches with or without the START marker (a previous injection left the
// section without MC_CALENDAR_START, which froze all later updates).
const sectionRe = new RegExp(
  `(?:<!-- MC_CALENDAR_START -->\\s*)?<section[^>]*id="${SECTION_ID}"[^>]*>[\\s\\S]*?<!-- MC_CALENDAR_END -->`
);
if (sectionRe.test(html)) {
  html = html.replace(sectionRe, section);
} else {
  // Insert after KP_PROJECTION_END if present, else before operational chart section
  if (html.includes('<!-- KP_PROJECTION_END -->')) {
    html = html.replace('<!-- KP_PROJECTION_END -->', '<!-- KP_PROJECTION_END -->\n' + section);
  } else {
    html = html.replace(/<section id="operational-chart-section"/, section + '\n<section id="operational-chart-section"');
  }
}

fs.writeFileSync(indexPath, html);
const upcomingCount = events.filter(e => daysFrom(e.date) >= 0).length;
console.log(`injected market-calendar-section: ${events.length} events, ${upcomingCount} upcoming, ${decided.length} decided`);
