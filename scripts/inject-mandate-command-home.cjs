'use strict';

const fs = require('fs');
const path = require('path');
const { renderMandateCommand } = require('../components/radar/mandate-command/render.cjs');

const root = path.join(__dirname, '..');
const target = process.argv[2] ? path.join(root, process.argv[2]) : path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'mandate-state.json');
if (!fs.existsSync(target)) throw new Error(`homepage missing: ${path.relative(root, target)}`);
if (!fs.existsSync(statePath)) throw new Error('outputs/mandate-state.json missing');

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
let html = fs.readFileSync(target, 'utf8');
html = html.replace(/\s*<div id="mandate-command"[\s\S]*?<\/div>\s*(?=<section|<footer)/, '');
html = html.replace(/\s*<link[^>]+mandate-command\.css[^>]*>/g, '').replace(/\s*<script[^>]+mandate-command\.js[^>]*><\/script>/g, '');
html = html.replace('</head>', '  <link rel="stylesheet" href="assets/mandate-command.css"/>\n</head>');
html = html.replace('</body>', '  <script src="assets/mandate-command.js" defer></script>\n</body>');
const block = renderMandateCommand(state);
const portfolioEnd = html.indexOf('</div>\n</div>', html.indexOf('id="portfolio-bar"'));
if (portfolioEnd >= 0) {
  const insertAt = portfolioEnd + '</div>\n</div>'.length;
  html = html.slice(0, insertAt) + '\n' + block + html.slice(insertAt);
} else {
  html = html.replace('</header>', `</header>\n${block}`);
}
fs.writeFileSync(target, html);
console.log(`injected mandate command: ${path.relative(root, target)}`);
