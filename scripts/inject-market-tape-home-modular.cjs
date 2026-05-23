const fs = require('fs');
const path = require('path');
const { renderMarketTapeSection, renderMarketTapeStyle } = require('../components/radar/market-tape/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'market-tape-state.json');

function replaceSectionBeforeFooter(html, id, section) {
  const open = '<sec' + 'tion id="';
  const start = html.indexOf(open + id + '"');
  const footer = html.indexOf('<foo' + 'ter class="footer"');
  if (start < 0 || footer < 0 || footer <= start) throw new Error('Could not locate Market Tape boundaries');
  return html.slice(0, start) + section + html.slice(footer);
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('market-tape-state.json missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
if (!state.render_permission) throw new Error('market-tape-state render_permission=false');

const section = renderMarketTapeSection(state);
const style = renderMarketTapeStyle();
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('.tape-board{')) html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');
html = replaceSectionBeforeFooter(html, 'market-section', section);

fs.writeFileSync(indexPath, html);
console.log(`injected modular market tape board: ${(state.signals || []).length} signals`);
