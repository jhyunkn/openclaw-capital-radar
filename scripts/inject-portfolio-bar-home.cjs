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

// Remove ALL existing portfolio bars (handles accumulated duplicates)
while (html.includes('<div id="portfolio-bar"')) {
  const start = html.indexOf('<div id="portfolio-bar"');
  let i = start, depth = 0;
  while (i < html.length) {
    if (html.startsWith('<div', i) && (html[i + 4] === ' ' || html[i + 4] === '>')) { depth++; i += 4; }
    else if (html.startsWith('</div>', i)) { depth--; i += 6; if (depth === 0) break; }
    else i++;
  }
  while (i < html.length && '\n\r '.includes(html[i])) i++;
  html = html.slice(0, start) + html.slice(i);
}

// Insert right after </header>
html = html.replace(/(<\/header>)/, (_, h) => h + '\n' + bar);

fs.writeFileSync(indexPath, html);

console.log(`injected portfolio bar: $${Math.round(state.portfolio?.totalValue).toLocaleString()} total`);
