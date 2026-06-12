const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const {
  renderRobinhoodExecutionBridgeModule,
  renderRobinhoodExecutionBridgeStyle,
} = require('../components/radar/execution-bridge/render.cjs');

const root = path.join(__dirname, '..');
const targetArg = process.argv[2];
const indexPath = targetArg ? path.resolve(root, targetArg) : path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'robinhood-execution-bridge-state.json');

function runGenerator() {
  const result = spawnSync(process.execPath, [path.join(__dirname, 'generate-robinhood-execution-bridge-state.cjs')], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) throw new Error('Robinhood execution bridge state generation failed');
}

function readState() {
  if (!fs.existsSync(statePath)) runGenerator();
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

function findMatchingSection(html, openIdx) {
  let depth = 0;
  let pos = openIdx;
  while (pos < html.length) {
    const nextOpen = html.indexOf('<section', pos);
    const nextClose = html.indexOf('</section>', pos);
    if (nextClose < 0) return -1;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth++;
      pos = nextOpen + '<section'.length;
    } else {
      depth--;
      if (depth === 0) return nextClose;
      pos = nextClose + '</section>'.length;
    }
  }
  return -1;
}

function insertInsideSectionEnd(html, id, content) {
  const token = `id="${id}"`;
  const idx = html.indexOf(token);
  if (idx < 0) throw new Error(`${id} not found for Robinhood execution bridge injection`);
  const start = html.lastIndexOf('<section', idx);
  const end = findMatchingSection(html, start);
  if (start < 0 || end < 0) throw new Error(`${id} section boundary not found`);
  return html.slice(0, end) + '\n' + content + '\n' + html.slice(end);
}

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="robinhood-execution-bridge-style">[\s\S]*?<\/style>\s*/g, '');
html = html.replace(/<!-- ROBINHOOD_EXECUTION_BRIDGE_START -->[\s\S]*?<!-- ROBINHOOD_EXECUTION_BRIDGE_END -->\s*/g, '');

const moduleHtml = `<!-- ROBINHOOD_EXECUTION_BRIDGE_START -->\n${renderRobinhoodExecutionBridgeModule(readState())}\n<!-- ROBINHOOD_EXECUTION_BRIDGE_END -->`;
const style = renderRobinhoodExecutionBridgeStyle();
html = html.includes('</head>') ? html.replace('</head>', `${style}\n</head>`) : `${style}\n${html}`;
html = insertInsideSectionEnd(html, 'holdings-section', moduleHtml);

fs.writeFileSync(indexPath, html);
console.log(`injected Robinhood execution bridge into ${path.relative(root, indexPath)}`);
