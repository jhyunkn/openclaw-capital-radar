const fs = require('fs');
const path = require('path');
const { renderDurationWorkbench, renderDurationWorkbenchStyle } = require('../components/radar/duration-workbench/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'duration-state.json');
const headClose = '</he' + 'ad>';
const moneyCashOpen = '<section class="macro-operating-block money-cash-workbench">';
const sourceLedgerOpen = '<details class="macro-source-ledger">';

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}
function findSectionEnd(html, start) {
  const close = '</sec' + 'tion>';
  return start >= 0 ? html.indexOf(close, start) : -1;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
const state = readJson(statePath, null);
const workbench = renderDurationWorkbench(state);
const style = renderDurationWorkbenchStyle();
let html = fs.readFileSync(indexPath, 'utf8');

html = html.replace(/<style>\.duration-workbench\{[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-operating-block duration-workbench">[\s\S]*?<\/section>\s*/g, '');
html = html.replace(headClose, style + headClose);

const moneyStart = html.indexOf(moneyCashOpen);
const moneyEnd = findSectionEnd(html, moneyStart);
if (moneyEnd >= 0) {
  html = html.slice(0, moneyEnd + '</section>'.length) + workbench + html.slice(moneyEnd + '</section>'.length);
} else if (html.includes(sourceLedgerOpen)) {
  html = html.replace(sourceLedgerOpen, workbench + sourceLedgerOpen);
} else {
  const macroClose = '</sec' + 'tion>';
  const macroStart = html.indexOf('<sec' + 'tion id="decision-brief-section"');
  const macroEnd = macroStart >= 0 ? html.indexOf(macroClose, macroStart) : -1;
  if (macroEnd < 0) throw new Error('decision-brief-section not found for Duration injection');
  html = html.slice(0, macroEnd) + workbench + html.slice(macroEnd);
}

fs.writeFileSync(indexPath, html);
console.log('injected Duration workbench into Macro section');
