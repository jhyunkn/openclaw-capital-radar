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

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

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

const section = renderOpportunitiesSection(state, ranking, conviction, scanner, dynamicForRender);
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
