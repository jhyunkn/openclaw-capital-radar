'use strict';

const fs   = require('fs');
const path = require('path');
const { renderArbDealBoardSection, renderArbDealBoardStyle } = require('../components/radar/arb/render.cjs');

const root       = path.join(__dirname, '..');
const indexPath  = process.argv[2] ? path.resolve(root, process.argv[2]) : path.join(root, 'index.html');
const boardPath  = path.join(root, 'outputs', 'arb', 'arb-deal-board.json');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return fallback; }
}

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

const board = readJson(boardPath, null);
if (!board || !Array.isArray(board.deals)) {
  console.log('arb-deal-board.json missing or invalid — skipping section injection');
  process.exit(0);
}

const section = renderArbDealBoardSection(board, { module: true });
const style   = renderArbDealBoardStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Inject or replace style
const STYLE_ID = 'arb-deal-board-style';
if (html.includes(`id="${STYLE_ID}"`)) {
  html = html.replace(
    new RegExp(`<style[^>]*id="${STYLE_ID}"[^>]*>[\\s\\S]*?<\\/style>`),
    style
  );
} else {
  html = html.replace('</' + 'head>', style + '</' + 'head>');
}

// Inject or replace module — placed inside the Opportunity section, before its close.
const SECTION_ID = 'arb-deal-board-section';
const MODULE_ID  = 'arb-deal-board-module';
const ANCHOR_ID  = 'opportunities-section';

function findMatchingSection(h, openIdx) {
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
  if (idx < 0) throw new Error(`inject-arb-deal-board-home: anchor id="${anchorId}" not found — refusing silent drop`);
  const start = h.lastIndexOf('<section', idx);
  if (start < 0) throw new Error(`inject-arb-deal-board-home: no <section> wraps anchor id="${anchorId}"`);
  const end = findMatchingSection(h, start);
  if (end < 0) throw new Error(`inject-arb-deal-board-home: unmatched <section> at anchor id="${anchorId}"`);
  return h.slice(0, end) + '\n' + newSection + '\n' + h.slice(end);
}

html = removeSection(html, SECTION_ID);
html = removeElementById(html, MODULE_ID);
html = insertInsideSectionEnd(html, ANCHOR_ID, section);

fs.writeFileSync(indexPath, html);
const tradeable = board.deals.filter(d => String(d.verdict || '').startsWith('TRADEABLE')).length;
console.log(`injected arb deal board module: ${board.deals.length} deals (${tradeable} TRADEABLE by verdict), ${board.watchlist.length} watchlist, generated ${board.generatedAt?.slice(0, 10) || '?'}`);
