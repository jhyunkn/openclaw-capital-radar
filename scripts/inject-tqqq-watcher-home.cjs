'use strict';
const fs = require('fs');
const path = require('path');
const {
  renderTqqqWatcherModule,
  renderTqqqWatcherStyle,
} = require('../components/radar/tqqq-watcher/render.cjs');

const root = path.join(__dirname, '..');
const targetArg = process.argv[2];
const indexPath = targetArg ? path.resolve(root, targetArg) : path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'tqqq-watcher-state.json');

function readState() {
  if (!fs.existsSync(statePath)) {
    // No gateway artifact yet: render an explicit stale/awaiting panel rather
    // than skipping it, so the absence is visible instead of silent.
    return { artifact: 'tqqq-watcher-state', observedAt: null, stale: true, maxAgeMinutes: 20 };
  }
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<style id="tqqq-watcher-style">[\s\S]*?<\/style>\s*/g, '');
html = html.replace(/<!-- TQQQ_WATCHER_START -->[\s\S]*?<!-- TQQQ_WATCHER_END -->\s*/g, '');

const moduleHtml = `<!-- TQQQ_WATCHER_START -->\n${renderTqqqWatcherModule(readState())}\n<!-- TQQQ_WATCHER_END -->`;
const style = renderTqqqWatcherStyle();
html = html.includes('</head>') ? html.replace('</head>', `${style}\n</head>`) : `${style}\n${html}`;

// Anchor after the Robinhood execution bridge if present, else before </main>.
const bridgeEnd = html.indexOf('<!-- ROBINHOOD_EXECUTION_BRIDGE_END -->');
if (bridgeEnd >= 0) {
  const after = bridgeEnd + '<!-- ROBINHOOD_EXECUTION_BRIDGE_END -->'.length;
  html = html.slice(0, after) + '\n' + moduleHtml + '\n' + html.slice(after);
} else {
  const mainClose = html.lastIndexOf('</main>');
  const at = mainClose >= 0 ? mainClose : html.length;
  html = html.slice(0, at) + moduleHtml + '\n' + html.slice(at);
}

fs.writeFileSync(indexPath, html);
if (!html.includes('id="tqqq-watcher"')) throw new Error('tqqq-watcher injection failed');
console.log(`injected TQQQ watcher into ${path.relative(root, indexPath)}`);
