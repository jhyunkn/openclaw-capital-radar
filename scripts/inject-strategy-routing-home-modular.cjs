const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderStrategyRoutingSection, renderStrategyRoutingStyle } = require('../components/radar/strategy-routing/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'strategy-routing-state.json');
const sectionOpen = '<sec' + 'tion id="';
const navOpen = '<nav class="nav">';
const headClose = '</he' + 'ad>';
const headerClose = '</he' + 'ader>';

function runScript(name) {
  return spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, encoding: 'utf8', timeout: 60000 });
}

function removeSection(html, id) {
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

function insertAfterSection(html, anchorId, section) {
  const token = sectionOpen + anchorId + '"';
  const start = html.indexOf(token);
  if (start < 0) return html;
  const next = html.indexOf(sectionOpen, start + token.length);
  const footer = html.indexOf('<foo' + 'ter', start + token.length);
  const mainEnd = html.indexOf('</ma' + 'in>', start + token.length);
  const candidates = [next, footer, mainEnd].filter(index => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : html.length;
  return html.slice(0, end) + section + html.slice(end);
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) runScript('generate-strategy-routing-state.cjs');
if (!fs.existsSync(statePath)) throw new Error('strategy-routing-state missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (state.render_permission === false) {
  console.log('strategy routing not permitted');
  process.exit(0);
}

const section = renderStrategyRoutingSection(state);
const style = renderStrategyRoutingStyle();
let html = fs.readFileSync(indexPath, 'utf8');

html = removeSection(html, 'strategy-routing-section');
html = html.split('<a href="#strategy-routing-section">Route</a>').join('');
html = html.split(navOpen).join(navOpen + '<a href="#strategy-routing-section">Route</a>');
html = html.replace(headClose, style + headClose);

if (html.includes(sectionOpen + 'market-lens-section"')) html = insertAfterSection(html, 'market-lens-section', section);
else if (html.includes(sectionOpen + 'operational-chart-section"')) html = insertAfterSection(html, 'operational-chart-section', section);
else html = html.replace(headerClose, headerClose + section);

fs.writeFileSync(indexPath, html);
console.log('injected modular strategy routing strip');
