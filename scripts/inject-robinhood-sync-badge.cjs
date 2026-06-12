'use strict';
const fs   = require('fs');
const path = require('path');

const root      = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const rhPath    = path.join(root, 'outputs', 'robinhood-positions.json');

if (!fs.existsSync(indexPath)) { console.log('inject-robinhood-sync-badge: index.html missing — skipping'); process.exit(0); }
if (!fs.existsSync(rhPath))    { console.log('inject-robinhood-sync-badge: robinhood-positions.json missing — skipping'); process.exit(0); }

const rh        = JSON.parse(fs.readFileSync(rhPath, 'utf8'));
const syncedAt  = new Date(rh.syncedAt);
const ageHours  = (Date.now() - syncedAt.getTime()) / 3_600_000;
const syncLabel = syncedAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const isStale   = ageHours > 48;
const dotColor  = isStale ? '#f59e0b' : '#22c55e';
const statusLabel = isStale ? `Stale (${Math.round(ageHours)}h ago)` : `Live · ${syncLabel}`;

const p   = rh.portfolio || {};
const fmt = (v) => v != null ? '$' + Number(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) : '—';
const posCount = (rh.positions || []).length;

const style = `<style id="rh-sync-style">
.rh-sync-strip{display:flex;align-items:center;gap:16px;padding:12px 0 14px;border-bottom:1px solid var(--rule);margin-bottom:24px;flex-wrap:wrap}
.rh-sync-pill{display:flex;align-items:center;gap:6px;padding:3px 10px 4px;border:1px solid var(--rule);border-radius:20px;white-space:nowrap;flex-shrink:0}
.rh-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.rh-pill-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:rgba(36,35,31,.65);font-weight:500}
.rh-sync-stats{display:flex;gap:20px;flex-wrap:wrap}
.rh-stat{display:flex;flex-direction:column;min-width:52px}
.rh-stat b{font-size:14px;font-weight:500;letter-spacing:-.025em;color:rgba(36,35,31,.9)}
.rh-stat small{font-size:9px;text-transform:uppercase;letter-spacing:.09em;color:rgba(36,35,31,.45);margin-top:1px}
.rh-sync-time{margin-left:auto;font-size:11px;color:rgba(36,35,31,.4);white-space:nowrap}
</style>`;

const strip = `<div class="rh-sync-strip">
  <div class="rh-sync-pill">
    <span class="rh-dot" style="background:${dotColor}"></span>
    <span class="rh-pill-label">Robinhood · ${statusLabel}</span>
  </div>
  <div class="rh-sync-stats">
    <span class="rh-stat"><b>${fmt(p.totalValue)}</b><small>Portfolio</small></span>
    <span class="rh-stat"><b>${fmt(p.equityValue)}</b><small>Equity</small></span>
    <span class="rh-stat"><b>${fmt(p.cash)}</b><small>Cash</small></span>
    <span class="rh-stat"><b>${posCount}</b><small>Positions</small></span>
  </div>
  <span class="rh-sync-time">Synced ${syncLabel}</span>
</div>`;

let html = fs.readFileSync(indexPath, 'utf8');

// Remove any prior injection
html = html.replace(/<style id="rh-sync-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<div class="rh-sync-strip">[\s\S]*?<\/div>\n?/g, '');

// Inject style into <head>
html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');

// Inject strip after the opening of holdings-section
const token = '<sec' + 'tion id="holdings-section"';
const sectionStart = html.indexOf(token);
if (sectionStart >= 0) {
  const tagClose = html.indexOf('>', sectionStart);
  if (tagClose >= 0) {
    html = html.slice(0, tagClose + 1) + '\n' + strip + html.slice(tagClose + 1);
  }
}

fs.writeFileSync(indexPath, html);
console.log(`inject-robinhood-sync-badge: injected Robinhood sync strip (${posCount} positions, ${ageHours.toFixed(1)}h old, ${isStale ? 'STALE' : 'live'})`);
