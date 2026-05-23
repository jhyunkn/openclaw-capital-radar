const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderDecisionBriefSection, renderDecisionBriefStyle } = require('../components/radar/decision-brief/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'market-decision-brief-state.json');

function runScript(name) {
  return spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, encoding: 'utf8', timeout: 60000 });
}

function replaceSection(html, id, section) {
  const re = new RegExp('<sec' + 'tion\\s+id=["\\']' + id + '["\\'][\\s\\S]*?<\\/sec' + 'tion>', 'i');
  if (re.test(html)) return html.replace(re, section);
  return html.replace('</he' + 'ader>', '</he' + 'ader>' + section);
}

function ensureNav(html) {
  html = html.split('<a href="#decision-brief-section">Brief</a>').join('');
  return html.replace('<nav class="nav">', '<nav class="nav"><a href="#decision-brief-section">Brief</a>');
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
html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');
html = replaceSection(html, 'decision-brief-section', section);
html = ensureNav(html);

fs.writeFileSync(indexPath, html);
console.log('injected modular macro decision brief');
