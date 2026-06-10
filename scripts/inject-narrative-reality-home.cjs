'use strict';

const fs   = require('fs');
const path = require('path');
const { renderNarrativeRealitySection, renderNarrativeRealityStyle } = require('../components/radar/narrative-reality/render.cjs');

const root       = path.join(__dirname, '..');
const indexPath  = process.argv[2] ? path.resolve(root, process.argv[2]) : path.join(root, 'index.html');
const briefPath  = path.join(root, 'outputs', 'narrative-reality-brief.json');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const brief = readJson(briefPath, null);
if (!brief || !Array.isArray(brief.themes) || !brief.themes.length) {
  console.log('narrative-reality-brief.json missing or empty — skipping section injection');
  process.exit(0);
}

const section = renderNarrativeRealitySection(brief);
const style   = renderNarrativeRealityStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Inject or replace style
const STYLE_ID = 'narrative-reality-style';
if (html.includes(`id="${STYLE_ID}"`)) {
  html = html.replace(
    new RegExp(`<style[^>]*id="${STYLE_ID}"[^>]*>[\\s\\S]*?<\\/style>`),
    style
  );
} else {
  html = html.replace('</' + 'head>', style + '</' + 'head>');
}

// Inject or replace section — place it after the macro section and before holdings
const SECTION_ID = 'narrative-reality-section';
const MACRO_ID   = 'macro-unified-section';

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

function insertAfterSection(h, anchorId, newSection) {
  const token = `id="${anchorId}"`;
  const idx   = h.indexOf(token);
  if (idx < 0) return h;
  const start = h.lastIndexOf('<section', idx);
  if (start < 0) return h;
  const end = findMatchingSection(h, start);
  if (end < 0) return h;
  const pos = end + '</section>'.length;
  return h.slice(0, pos) + '\n' + newSection + h.slice(pos);
}

html = removeSection(html, SECTION_ID);
html = insertAfterSection(html, MACRO_ID, section);

fs.writeFileSync(indexPath, html);
console.log(`injected narrative-reality section: ${brief.themes.length} themes, generated ${brief.generatedAt?.slice(0, 10) || '?'}`);
