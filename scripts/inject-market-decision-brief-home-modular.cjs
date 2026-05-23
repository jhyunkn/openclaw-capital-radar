const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderDecisionBriefSection, renderDecisionBriefStyle } = require('../components/radar/decision-brief/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'market-decision-brief-state.json');
const sectionOpen = '<sec' + 'tion id="';
const headClose = '</he' + 'ad>';
const headerClose = '</he' + 'ader>';
const navOpen = '<nav class="nav">';

function runScript(name) {
  return spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, encoding: 'utf8', timeout: 60000 });
}

function replaceSection(html, id, section) {
  const token = sectionOpen + id + '"';
  const start = html.indexOf(token);
  if (start < 0) return html.replace(headerClose, headerClose + section);
  const next = html.indexOf(sectionOpen, start + token.length);
  const footer = html.indexOf('<foo' + 'ter', start + token.length);
  const mainEnd = html.indexOf('</ma' + 'in>', start + token.length);
  const candidates = [next, footer, mainEnd].filter(index => index >= 0);
  const end = candidates.length ? Math.min(...candidates) : html.length;
  return html.slice(0, start) + section + html.slice(end);
}

function ensureNav(html) {
  html = html.split('<a href="#decision-brief-section">Brief</a>').join('');
  return html.replace(navOpen, navOpen + '<a href="#decision-brief-section">Brief</a>');
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) runScript('generate-market-decision-brief-state.cjs');
if (!fs.existsSync(statePath)) throw new Error('market-decision-brief-state missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (state.render_permission === false) {
  console.log('market decision brief not permitted');
  process.exit(0);
}

const section = renderDecisionBriefSection(state);
const style = renderDecisionBriefStyle();
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<style>\.decision-brief-panel\{[\s\S]*?<\/style>/g, '');
html = html.replace(headClose, style + headClose);
html = replaceSection(html, 'decision-brief-section', section);
html = ensureNav(html);

fs.writeFileSync(indexPath, html);
console.log('injected modular macro decision brief');
