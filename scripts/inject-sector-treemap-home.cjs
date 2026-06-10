// Sector treemap removed — static approximate treemap without live market data is not useful.
// This script runs idempotently to strip any existing sector-treemap-section from index.html.
const fs   = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

// Remove any existing sector-treemap-section including inline style blocks
html = html.replace(/<style id="sector-treemap-style">[\s\S]*?<\/style>\s*/g, '');

const token = '<section id="sector-treemap-section"';
let start = html.indexOf(token);
while (start >= 0) {
  let depth = 0, i = start;
  while (i < html.length) {
    if (html.startsWith('<section', i))  { depth++; i += 8; continue; }
    if (html.startsWith('</section>', i)) {
      depth--;
      if (depth === 0) { i += 10; break; }
      i += 10; continue;
    }
    i++;
  }
  html = html.slice(0, start) + html.slice(i);
  start = html.indexOf(token);
}

fs.writeFileSync(indexPath, html);
console.log('sector-treemap-section removed');
