const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderKostolanyEggSection } = require('../components/radar/kostolany-egg/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'kostolany-egg-state.json');
const mockStatePath = path.join(root, 'data', 'mock', 'kostolany-egg-state.mock.json');

function run(scriptName) {
  return spawnSync(process.execPath, [path.join(__dirname, scriptName)], {
    cwd: root,
    encoding: 'utf8',
    timeout: 60000,
  });
}

function readState() {
  if (!fs.existsSync(statePath)) {
    run('generate-macro-cycle-state.cjs');
    run('generate-kostolany-egg-state.cjs');
  }
  const sourcePath = fs.existsSync(statePath) ? statePath : mockStatePath;
  if (!fs.existsSync(sourcePath)) {
    throw new Error('No Kostolany Egg state found. Expected outputs/kostolany-egg-state.json or data/mock/kostolany-egg-state.mock.json');
  }
  return JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
}

function removeExistingEggSections(source) {
  const startToken = '<section id="kostolany-egg-section"';
  let html = source;
  let start = html.indexOf(startToken);
  while (start >= 0) {
    const nextIds = [
      '<section id="decision-brief-section"',
      '<section id="operational-chart-section"',
      '<section id="market-lens-section"',
      '<section id="strategy-routing-section"',
      '<section id="holdings-section"',
      '<section id="opportunities-section"',
      '<section id="market-section"',
      '<section id="trust-section"',
      '<footer',
      '</main>',
    ];
    const candidates = nextIds
      .map(token => html.indexOf(token, start + startToken.length))
      .filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : html.length;
    html = html.slice(0, start) + html.slice(end);
    start = html.indexOf(startToken);
  }
  return html;
}

function removeLegacyMacroCycleSection(source) {
  const startToken = '<section id="macro-cycle-section"';
  let html = source;
  let start = html.indexOf(startToken);
  while (start >= 0) {
    const next = html.indexOf('<section id="', start + startToken.length);
    const footer = html.indexOf('<footer', start + startToken.length);
    const end = next >= 0 && (footer < 0 || next < footer) ? next : (footer >= 0 ? footer : html.length);
    html = html.slice(0, start) + html.slice(end);
    start = html.indexOf(startToken);
  }
  return html;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

const state = readState();
if (state.render_permission === false) process.exit(0);

const section = renderKostolanyEggSection(state);
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<link rel="stylesheet" href="assets\/kostolany-egg-v3.css">/g, '');
html = html.replace('</head>', '<link rel="stylesheet" href="assets/kostolany-egg-v3.css"></head>');
html = html.replace(/<a href="#kostolany-egg-section">Egg<\/a>/g, '');
html = html.replace(/<nav class="nav">/, '<nav class="nav"><a href="#kostolany-egg-section">Egg</a>');

html = removeExistingEggSections(html);
html = removeLegacyMacroCycleSection(html);

const firstSection = html.search(/<section id="(decision-brief-section|operational-chart-section|market-lens-section|strategy-routing-section|holdings-section|opportunities-section|market-section|trust-section)"/);
if (firstSection >= 0) {
  html = html.slice(0, firstSection) + section + html.slice(firstSection);
} else {
  html = html.replace(/(<\/header>)/, `$1${section}`);
}

html = html.replace(/<style id="kostolany-egg-v3-style">[\s\S]*?<\/style>/g, '');
fs.writeFileSync(indexPath, html);
console.log('injected modular Kostolany Egg renderer idempotently');
