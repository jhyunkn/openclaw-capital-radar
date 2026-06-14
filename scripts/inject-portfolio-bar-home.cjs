'use strict';

const fs   = require('fs');
const path = require('path');
const { renderPortfolioBar, renderPortfolioBarStyle } = require('../components/radar/portfolio-bar/render.cjs');

const root      = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'portfolio-live-state.json');

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) {
  console.log('inject-portfolio-bar: no portfolio-live-state.json — skipping');
  process.exit(0);
}

const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));

const bar   = renderPortfolioBar(state);
const style = renderPortfolioBarStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Replace existing style tag if present, else inject into <head>
html = html.includes('id="portfolio-bar-style"')
  ? html.replace(/<style[^>]*id="portfolio-bar-style"[^>]*>[\s\S]*?<\/style>/, style)
  : html.replace('</' + 'head>', style + '</' + 'head>');

// Remove any existing portfolio bar
html = html.replace(/<div id="portfolio-bar"[\s\S]*?<\/div>\s*<\/div>\s*/, '');

// Insert right after </header>
html = html.replace(/(<\/header>)/, (_, h) => h + '\n' + bar);

fs.writeFileSync(indexPath, html);

console.log(`injected portfolio bar: $${Math.round(state.portfolio?.totalValue).toLocaleString()} total`);
