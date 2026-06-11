const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderOperationalChartSection, renderOperationalChartStyle } = require('../components/radar/operational-chart/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'operational-chart-state.json');
const annotationPath = path.join(root, 'outputs', 'decision-chart-annotation-state.json');

function runScript(name) {
  return spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, encoding: 'utf8', timeout: 60000 });
}

function removeSection(html, id) {
  const token = `<section id="${id}"`;
  let start = html.indexOf(token);
  while (start >= 0) {
    const next = html.indexOf('<section id="', start + token.length);
    const footer = html.indexOf('<footer', start + token.length);
    const mainEnd = html.indexOf('</main>', start + token.length);
    const candidates = [next, footer, mainEnd].filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : html.length;
    html = html.slice(0, start) + html.slice(end);
    start = html.indexOf(token);
  }
  return html;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) runScript('generate-operational-chart-state.cjs');
if (!fs.existsSync(statePath)) throw new Error('operational-chart-state missing');
if (!fs.existsSync(annotationPath)) runScript('generate-decision-chart-annotation-state.cjs');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const annotationState = fs.existsSync(annotationPath) ? JSON.parse(fs.readFileSync(annotationPath, 'utf8')) : null;
if (state.render_permission === false) process.exit(0);

const allowedAnnotationState = annotationState && annotationState.render_permission !== false ? annotationState : null;
const section = renderOperationalChartSection(state, allowedAnnotationState);
const style = renderOperationalChartStyle();

let html = fs.readFileSync(indexPath, 'utf8');
for (const id of ['chart-wall-section', 'spx-cycle-map-section', 'cycle-scenario-section', 'operational-chart-section']) html = removeSection(html, id);
html = html.replace(/<style id="operational-chart-style">[\s\S]*?<\/style>/g, '');
html = html.replace(/<style>\.operational-chart\{[\s\S]*?<\/style>/, '');
html = html.replace('</head>', `${style}</head>`);
html = html.replace(/(<\/header>)/, `$1${section}`);
fs.writeFileSync(indexPath, html);
console.log(`injected modular SPX decision map: ${state.symbol || 'SPX'}${allowedAnnotationState ? ' with annotation layer' : ''}`);
