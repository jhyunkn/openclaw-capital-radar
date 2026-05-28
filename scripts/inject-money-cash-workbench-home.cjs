const fs = require('fs');
const path = require('path');
const { renderMoneyCashWorkbench, renderMoneyCashWorkbenchStyle } = require('../components/radar/money-cash-workbench/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'money-cash-state.json');
const headClose = '</he' + 'ad>';
const sourceLedgerOpen = '<details class="macro-source-ledger">';

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

const state = readJson(statePath, null);
const workbench = renderMoneyCashWorkbench(state);
const style = renderMoneyCashWorkbenchStyle();
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<style>\.money-cash-workbench\{[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-operating-block money-cash-workbench">[\s\S]*?<\/section>\s*(?=<details class="macro-source-ledger">)/g, '');
html = html.replace(headClose, style + headClose);

if (html.includes(sourceLedgerOpen)) {
  html = html.replace(sourceLedgerOpen, workbench + sourceLedgerOpen);
} else {
  const macroClose = '</sec' + 'tion>';
  const macroStart = html.indexOf('<sec' + 'tion id="decision-brief-section"');
  const macroEnd = macroStart >= 0 ? html.indexOf(macroClose, macroStart) : -1;
  if (macroEnd < 0) throw new Error('decision-brief-section not found for Money / Cash injection');
  html = html.slice(0, macroEnd) + workbench + html.slice(macroEnd);
}

fs.writeFileSync(indexPath, html);
console.log('injected Money / Cash workbench into Macro section');
