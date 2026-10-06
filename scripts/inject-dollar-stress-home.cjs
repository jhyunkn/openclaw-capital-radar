const fs = require('fs');
const path = require('path');
const { renderDollarStress, renderDollarStressStyle } = require('../components/radar/dollar-stress/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = process.argv[2] ? path.resolve(root, process.argv[2]) : path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'dollar-stress-state.json');
const headClose = '</he' + 'ad>';
const sourceLedgerOpen = '<details class="macro-source-ledger">';

function readJson(file, fallback = null) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (_) { return fallback; }
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

const state = readJson(statePath, null);
const block = renderDollarStress(state);
const style = renderDollarStressStyle();
let html = fs.readFileSync(indexPath, 'utf8');

// Idempotent: strip any prior injection first.
html = html.replace(/<style>\.dollar-stress-check\{[\s\S]*?<\/style>/g, '');
html = html.replace(/<section class="macro-operating-block dollar-stress-check"[\s\S]*?<\/section>\s*/g, '');
html = html.replace(headClose, style + headClose);

if (html.includes(sourceLedgerOpen)) {
  html = html.replace(sourceLedgerOpen, block + sourceLedgerOpen);
} else {
  const macroClose = '</sec' + 'tion>';
  const macroStart = html.indexOf('<sec' + 'tion id="decision-brief-section"');
  const macroEnd = macroStart >= 0 ? html.indexOf(macroClose, macroStart) : -1;
  if (macroEnd < 0) throw new Error('decision-brief-section not found for Dollar Stress injection');
  html = html.slice(0, macroEnd) + block + html.slice(macroEnd);
}

fs.writeFileSync(indexPath, html);
console.log(`injected Dollar Stress check into Macro section (verdict: ${state?.verdict || 'UNKNOWN'})`);
