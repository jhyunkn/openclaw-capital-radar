'use strict';

const fs = require('fs');
const path = require('path');
const { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows } = require('../components/radar/opportunities/render.cjs');

const root           = path.join(__dirname, '..');
const indexPath      = path.join(root, 'index.html');
const statePath      = path.join(root, 'outputs', 'opportunity-asymmetry-state.json');
const rankingPath    = path.join(root, 'outputs', 'candidate-ranking.json');
const convictionPath = path.join(root, 'outputs', 'conviction-ranking.json');
const scannerPath    = path.join(root, 'outputs', 'universe-scanner.json');
const dynamicPath    = path.join(root, 'outputs', 'dynamic-universe.json');
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

function removeSection(html, id) {
  // Remove a section entirely (used to delete the now-merged conviction section)
  const OPEN  = '<sec' + 'tion';
  const CLOSE = '</sec' + 'tion>';
  const idStr = `id="${id}"`;
  const idx   = html.indexOf(idStr);
  if (idx < 0) return html; // already gone
  const start = html.lastIndexOf(OPEN, idx);
  const end   = html.indexOf(CLOSE, idx);
  if (start >= 0 && end > start) {
    return html.slice(0, start) + html.slice(end + CLOSE.length);
  }
  return html;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('opportunity-asymmetry-state.json missing');

const state      = readJson(statePath);
const ranking    = fs.existsSync(rankingPath)    ? readJson(rankingPath)    : null;
const conviction = fs.existsSync(convictionPath) ? readJson(convictionPath) : null;
const scanner    = fs.existsSync(scannerPath)    ? readJson(scannerPath)    : null;
const dynamic    = fs.existsSync(dynamicPath)    ? readJson(dynamicPath)    : null;

if (!state.render_permission) throw new Error('opportunity-asymmetry-state render_permission=false');

// Build dynamic universe summary for render (available flag + promotions)
const dynamicForRender = dynamic ? {
  available:              true,
  conviction_promotions:  dynamic.conviction_promotions    || [],
  watchlist_promotions:   dynamic.watchlist_promotions     || [],
  event_driven_candidates: dynamic.event_driven_candidates || [],
} : null;

// Strip manual pipeline: pass empty clusters so only AI-screened results display.
// The hardcoded opportunity-asymmetry-state pipeline is retired — dynamic universe drives everything.
const stateForRender = { ...state, opportunity_clusters: [] };

const section = renderOpportunitiesSection(stateForRender, null, conviction, scanner, dynamicForRender);
const style   = renderOpportunitiesStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Inject CSS — use a dedicated style tag by ID so the regex always matches reliably.
// The old approach matched <style> (no attrs) but the style tag has id="operational-chart-style".
const OPP_STYLE_ID = 'opportunity-radar-style';
if (html.includes(`id="${OPP_STYLE_ID}"`)) {
  // Replace the existing dedicated opportunity style tag
  html = html.replace(
    new RegExp(`<style[^>]*id="${OPP_STYLE_ID}"[^>]*>[\\s\\S]*?<\\/style>`),
    style.replace('<style>', `<style id="${OPP_STYLE_ID}">`)
  );
} else {
  // First run: inject before </head>
  html = html.replace(
    '</' + 'head>',
    style.replace('<style>', `<style id="${OPP_STYLE_ID}">`) + '</' + 'head>'
  );
}

// Remove separately-injected conviction-section if it exists (now merged)
html = removeSection(html, 'conviction-section');

// Replace opportunities-section
html = replaceSection(html, 'opportunities-section', section);

// Inject today strip (market posture + portfolio alerts) after </header>
const todayStrip = buildTodayStrip();
if (todayStrip) {
  // Remove any previous today strip
  html = html.replace(/<style id="today-strip-style">[\s\S]*?<\/style>\s*/g, '');
  html = html.replace(/<div class="today-strip">[\s\S]*?<\/div>\s*/g, '');
  html = html.replace('</' + 'head>', todayStrip.css + '</' + 'head>');
  html = html.replace(/(<\/header>)/, `$1${todayStrip.html}`);
}

fs.writeFileSync(indexPath, html);

const allRows = flattenOpportunityRows(state);
const { opportunities, selected } = selectDisplayRows(allRows);
const convTop3 = conviction ? (conviction.top10 || []).slice(0,3).map(t=>`${t.ticker}(${t.conviction_score})`).join(', ') : 'none';
const fullSignalCount   = scanner?.summary?.full_signal ?? 0;
const partialCount      = scanner?.summary?.partial_signal ?? 0;
const dynConvCount      = dynamic?.summary?.conviction_promotions ?? 0;
const dynWatchCount     = dynamic?.summary?.watchlist_promotions ?? 0;
const dynEventCount     = dynamic?.summary?.event_driven_candidates ?? 0;
console.log(`injected unified opportunity section: conviction_top3=${convTop3}  scanner_full=${fullSignalCount}  scanner_partial=${partialCount}  dynamic_conv=${dynConvCount}  dynamic_watch=${dynWatchCount}  event_driven=${dynEventCount}  pipeline_qualified=${opportunities.length}  pipeline_shown=${selected.length}`);
