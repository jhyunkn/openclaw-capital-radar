'use strict';

/*
 * Injects the engine-fed Opportunity decision surface into the homepage.
 *
 * Reads outputs/opportunity/opportunity-state.json (fail-closed: a missing or
 * invalid state renders an honest "unavailable" block, never stale cards).
 * Also maintains the "today strip" (portfolio posture + alerts) after </header>.
 */

const fs = require('fs');
const path = require('path');
const { renderOpportunitiesSection, renderOpportunitiesStyle } = require('../components/radar/opportunities/render.cjs');

const root           = path.join(__dirname, '..');
const indexPath      = path.join(root, 'index.html');
const statePath      = path.join(root, 'outputs', 'opportunity', 'opportunity-state.json');
const scoreboardPath = path.join(root, 'outputs', 'portfolio-scoreboard.json');
const annotationPath = path.join(root, 'outputs', 'decision-chart-annotation-state.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

function buildTodayStrip() {
  const sb  = fs.existsSync(scoreboardPath)  ? (() => { try { return JSON.parse(fs.readFileSync(scoreboardPath, 'utf8')); } catch { return null; } })() : null;
  const ann = fs.existsSync(annotationPath)  ? (() => { try { return JSON.parse(fs.readFileSync(annotationPath,  'utf8')); } catch { return null; } })() : null;

  const ACTION_SIGNALS = new Set(['EXIT REVIEW', 'INVESTIGATE', 'TRIM WATCH']);
  const alerts = [];
  const queue = Array.isArray(sb) ? sb : (sb?.reviewQueue || []);
  for (const item of queue.slice(0, 6)) {
    if (!ACTION_SIGNALS.has(item.signal)) continue;
    const cls = item.authority?.uiClass === 'bad' ? 'ts-bad' : 'ts-warn';
    alerts.push(`<span class="ts-alert ${cls}"><b>${item.ticker}</b>&thinsp;${item.signal}</span>`);
  }

  const addPerm = ann?.add_permission || '';
  const route   = ann?.active_route   || '';
  const score   = ann?.confirmation_score;
  const permLabel = addPerm === 'pullback_only' ? 'Pullback only' : addPerm === 'add' ? 'Add permitted' : addPerm.replace(/_/g, ' ');
  const posture = [route, permLabel].filter(Boolean).join(' · ');

  if (!posture && alerts.length === 0) return '';

  const css = `<style id="today-strip-style">.today-strip{display:flex;align-items:center;gap:10px;padding:9px 24px;background:rgba(26,23,20,.025);border-bottom:1px solid rgba(201,191,173,.28);flex-wrap:wrap}.ts-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:rgba(44,42,37,.38);font-family:var(--mono,monospace);flex-shrink:0}.ts-posture{font-size:11px;color:rgba(44,42,37,.55);font-family:var(--mono,monospace)}.ts-alert{font-family:var(--mono,monospace);font-size:10px;padding:2px 8px;border-radius:2px;white-space:nowrap}.ts-bad{background:rgba(220,38,38,.07);color:#c62828;border:1px solid rgba(220,38,38,.18)}.ts-warn{background:rgba(217,119,6,.07);color:#92400e;border:1px solid rgba(217,119,6,.18)}</style>`;

  const html = `<div class="today-strip"><span class="ts-label">Today</span>${posture ? `<span class="ts-posture">${posture}${score != null ? ` &middot; conf ${score}` : ''}</span>` : ''}${alerts.join('')}</div>`;
  return { css, html };
}

function replaceSection(html, id, section) {
  const OPEN  = '<sec' + 'tion';
  const CLOSE = '</sec' + 'tion>';
  const idStr = `id="${id}"`;
  const idx   = html.indexOf(idStr);
  if (idx >= 0) {
    const start = html.lastIndexOf(OPEN, idx);
    const end   = html.indexOf(CLOSE, idx);
    if (start >= 0 && end > start) {
      return html.slice(0, start) + section + html.slice(end + CLOSE.length);
    }
  }
  throw new Error(`Could not locate #${id} section boundaries`);
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('outputs/opportunity/opportunity-state.json missing — run generate-opportunity-state.cjs first');

const state   = readJson(statePath);
const section = renderOpportunitiesSection(state);
const style   = renderOpportunitiesStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Inject CSS — dedicated style tag by ID so the replace always matches.
const OPP_STYLE_ID = 'opportunity-radar-style';
if (html.includes(`id="${OPP_STYLE_ID}"`)) {
  html = html.replace(
    new RegExp(`<style[^>]*id="${OPP_STYLE_ID}"[^>]*>[\\s\\S]*?<\\/style>`),
    style.replace('<style>', `<style id="${OPP_STYLE_ID}">`)
  );
} else {
  html = html.replace(
    '</' + 'head>',
    style.replace('<style>', `<style id="${OPP_STYLE_ID}">`) + '</' + 'head>'
  );
}

// Replace opportunities-section
html = replaceSection(html, 'opportunities-section', section);

// Inject today strip (market posture + portfolio alerts) after </header>
const todayStrip = buildTodayStrip();
if (todayStrip) {
  html = html.replace(/<style id="today-strip-style">[\s\S]*?<\/style>\s*/g, '');
  html = html.replace(/<div class="today-strip">[\s\S]*?<\/div>\s*/g, '');
  html = html.replace('</' + 'head>', todayStrip.css + '</' + 'head>');
  html = html.replace(/(<\/header>)/, `$1${todayStrip.html}`);
}

fs.writeFileSync(indexPath, html);

const mom = state.board.filter(c => c.strategy === 'momentum-fit').length;
const arb = state.board.filter(c => c.strategy === 'arb-fit').length;
console.log(`injected opportunity decision surface: board=${state.board.length} (momentum-fit=${mom}, arb-fit=${arb}) watchlist=${state.watchlist.length} alerts=${JSON.stringify(state.alerts)}`);
