'use strict';

/*
 * inject-momentum-home.cjs
 *
 * Injects the Phase 1 momentum engine module into the homepage.
 * Mirrors scripts/inject-narrative-reality-home.cjs exactly:
 * requires components/radar/momentum/render.cjs, builds the section,
 * and injects/replaces it inside the macro section (id="decision-brief-section").
 * Never a standalone section (repo four-section rule).
 */

const fs   = require('fs');
const path = require('path');
const { renderMomentumSection, renderMomentumStyle } = require('../components/radar/momentum/render.cjs');

const root       = path.join(__dirname, '..');
const indexPath  = process.argv[2] ? path.resolve(root, process.argv[2]) : path.join(root, 'index.html');
const dir        = path.join(root, 'outputs', 'momentum');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const topDecile = readJson(path.join(dir, 'momentum-top-decile.json'), null);
const gate      = readJson(path.join(dir, 'momentum-gate.json'), null);
const rebalance = readJson(path.join(dir, 'momentum-rebalance.json'), null);
const state     = readJson(path.join(dir, 'momentum-state.json'), null);

if (!topDecile || !gate || !rebalance) {
  console.log('momentum artifacts missing — skipping section injection');
  process.exit(0);
}

const section = renderMomentumSection(topDecile, gate, rebalance, state, { module: true });
const style   = renderMomentumStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Inject or replace style
const STYLE_ID = 'momentum-style';
if (html.includes(`id="${STYLE_ID}"`)) {
  html = html.replace(
    new RegExp(`<style[^>]*id="${STYLE_ID}"[^>]*>[\\s\\S]*?<\\/style>`),
    style
  );
} else {
  html = html.replace('</' + 'head>', style + '</' + 'head>');
}

// Inject or replace section — place it after the macro section and before holdings
const SECTION_ID = 'momentum-section';
const MODULE_ID  = 'momentum-module';
const MACRO_ID   = 'decision-brief-section';

function findMatchingSection(h, openIdx) {
  // Walk forward from the <section at openIdx, tracking depth to find the matching </section>
  let depth = 0;
  let pos   = openIdx;
  while (pos < h.length) {
    const nextOpen  = h.indexOf('<section', pos);
    const nextClose = h.indexOf('</section>', pos);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + '<section'.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + '</section>'.length;
    }
  }
  return -1;
}

function removeSection(h, id) {
  const token = `id="${id}"`;
  const idx   = h.indexOf(token);
  if (idx < 0) return h;
  const start = h.lastIndexOf('<section', idx);
  if (start < 0) return h;
  const end = findMatchingSection(h, start);
  if (end < 0) return h;
  return h.slice(0, start) + h.slice(end + '</section>'.length);
}

function removeElementById(h, id) {
  const token = `id="${id}"`;
  const idx = h.indexOf(token);
  if (idx < 0) return h;
  const start = h.lastIndexOf('<', idx);
  if (start < 0) return h;
  const match = h.slice(start).match(/^<([a-z0-9-]+)/i);
  if (!match) return h;
  const tag = match[1];
  const closeToken = `</${tag}>`;
  let depth = 0;
  let pos = start;
  while (pos < h.length) {
    const nextOpen = h.indexOf(`<${tag}`, pos);
    const nextClose = h.indexOf(closeToken, pos);
    if (nextClose < 0) return h;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + tag.length + 1;
    } else {
      depth--;
      if (depth === 0) return h.slice(0, start) + h.slice(nextClose + closeToken.length);
      pos = nextClose + closeToken.length;
    }
  }
  return h;
}

function insertInsideSectionEnd(h, anchorId, newSection) {
  const token = `id="${anchorId}"`;
  const idx   = h.indexOf(token);
  if (idx < 0) return h;
  const start = h.lastIndexOf('<section', idx);
  if (start < 0) return h;
  const end = findMatchingSection(h, start);
  if (end < 0) return h;
  return h.slice(0, end) + '\n' + newSection + '\n' + h.slice(end);
}

html = removeSection(html, SECTION_ID);
html = removeElementById(html, MODULE_ID);
html = insertInsideSectionEnd(html, MACRO_ID, section);

fs.writeFileSync(indexPath, html);
console.log(`injected momentum macro module: v2 score=${gate.score} tier=${gate.tierLabel} exposure=${Math.round((gate.exposure ?? 1) * 100)}%, active=${topDecile.activeCount}, generated ${gate.generatedAt?.slice(0, 10) || '?'}`);
