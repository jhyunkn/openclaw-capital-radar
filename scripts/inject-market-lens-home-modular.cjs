const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { renderMarketLensSection, renderMarketLensStyle } = require('../components/radar/market-lens/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'market-lens-state.json');
const sectionOpen = '<sec' + 'tion id="';
const headClose = '</he' + 'ad>';
const headerClose = '</he' + 'ader>';
const navOpen = '<nav class="nav">';

function runScript(name) {
  return spawnSync(process.execPath, [path.join(__dirname, name)], { cwd: root, encoding: 'utf8', timeout: 60000 });
}

function replaceOrInsertSection(html, id, section) {
  const token = sectionOpen + id + '"';
  const start = html.indexOf(token);
  if (start >= 0) {
    const next = html.indexOf(sectionOpen, start + token.length);
    const footer = html.indexOf('<foo' + 'ter', start + token.length);
    const mainEnd = html.indexOf('</ma' + 'in>', start + token.length);
    const candidates = [next, footer, mainEnd].filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : html.length;
    return html.slice(0, start) + section + html.slice(end);
  }

  const opToken = sectionOpen + 'operational-chart-section"';
  const opStart = html.indexOf(opToken);
  if (opStart >= 0) {
    const next = html.indexOf(sectionOpen, opStart + opToken.length);
    const footer = html.indexOf('<foo' + 'ter', opStart + opToken.length);
    const mainEnd = html.indexOf('</ma' + 'in>', opStart + opToken.length);
    const candidates = [next, footer, mainEnd].filter(index => index >= 0);
    const end = candidates.length ? Math.min(...candidates) : html.length;
    return html.slice(0, end) + section + html.slice(end);
  }

  return html.replace(headerClose, headerClose + section);
}

function ensureNav(html) {
  html = html.split('<a href="#market-lens-section">Lens</a>').join('');
  return html.replace(navOpen, navOpen + '<a href="#market-lens-section">Lens</a>');
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) runScript('generate-market-lens-state.cjs');
if (!fs.existsSync(statePath)) throw new Error('market-lens-state missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (state.render_permission === false) {
  console.log('market lens not permitted');
  process.exit(0);
}

const section = renderMarketLensSection(state);
const style = renderMarketLensStyle();
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<style>\.market-lens\{[\s\S]*?<\/style>/g, '');
html = html.replace(headClose, style + headClose);
html = replaceOrInsertSection(html, 'market-lens-section', section);
html = ensureNav(html);

fs.writeFileSync(indexPath, html);
console.log('injected modular cross-asset market lens');
