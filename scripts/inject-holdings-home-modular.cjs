const fs = require('fs');
const path = require('path');
const { renderHoldingsSection, renderHoldingsStyle } = require('../components/radar/holdings/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const zonePath = path.join(root, 'outputs', 'holding-zone-state.json');
const translationPath = path.join(root, 'outputs', 'portfolio-translation-state.json');
const decisionPath = path.join(root, 'outputs', 'portfolio-decision-state.json');

function readJson(filePath, fallback = null) {
  try { return JSON.parse(fs.readFileSync(filePath, 'utf8')); }
  catch { return fallback; }
}

function removeSection(html, id) {
  const sectionOpen = '<sec' + 'tion id="';
  const token = sectionOpen + id + '"';
  let start = html.indexOf(token);
  while (start >= 0) {
    const next = html.indexOf(sectionOpen, start + token.length);
    const footer = html.indexOf('<foo' + 'ter', start + token.length);
    const mainEnd = html.indexOf('</ma' + 'in>', start + token.length);
    const candidates = [next, footer, mainEnd].filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : html.length;
    html = html.slice(0, start) + html.slice(end);
    start = html.indexOf(token);
  }
  return html;
}

function insertBeforeSection(html, anchorId, section) {
  const token = '<sec' + 'tion id="' + anchorId + '"';
  const start = html.indexOf(token);
  if (start < 0) return html.replace('</he' + 'ader>', '</he' + 'ader>' + section);
  return html.slice(0, start) + section + html.slice(start);
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(zonePath)) throw new Error('holding-zone-state.json missing');

const zoneState = readJson(zonePath);
if (!zoneState?.render_permission) throw new Error('holding-zone-state render_permission=false');
const translation = readJson(translationPath, { holdings: [] });
const decision = readJson(decisionPath, []);

const section = renderHoldingsSection({ zoneState, translation, decision });
const style = renderHoldingsStyle();
let html = fs.readFileSync(indexPath, 'utf8');

html = removeSection(html, 'holdings-section');
html = html.replace(/<style id="holdings-compact-style">[\s\S]*?<\/style>/g, '');
html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');
html = insertBeforeSection(html, 'opportunities-section', section);

fs.writeFileSync(indexPath, html);
console.log(`rendered modular Holdings price-zone radar: ${(zoneState.zones || []).length} zones`);
