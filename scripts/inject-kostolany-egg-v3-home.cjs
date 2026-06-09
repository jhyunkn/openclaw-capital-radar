// Kostolany Egg standalone section retired — the arc diagram lives inside
// the macro-unified section (inject-macro-unified.cjs) via cycleSvg.
// This script runs idempotently to strip any residual egg section from index.html.
const fs   = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

// Strip legacy CSS links
html = html.replace(/<link rel="stylesheet" href="assets\/kostolany-egg-v3\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/kostolany-egg-v4\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/page-tight-overflow\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/egg-board-final\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/egg-svg-refine\.css">/g, '');
html = html.replace(/<style id="kostolany-egg-v3-style">[\s\S]*?<\/style>\s*/g, '');

// Remove kostolany-egg-section (depth-counting to find true outer close)
const token = '<section id="kostolany-egg-section"';
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

// Remove legacy macro-cycle-section if present
const legacyToken = '<section id="macro-cycle-section"';
let ls = html.indexOf(legacyToken);
while (ls >= 0) {
  const next = html.indexOf('<section id="', ls + legacyToken.length);
  const footer = html.indexOf('<footer', ls + legacyToken.length);
  const end = next >= 0 && (footer < 0 || next < footer) ? next : (footer >= 0 ? footer : html.length);
  html = html.slice(0, ls) + html.slice(end);
  ls = html.indexOf(legacyToken);
}

fs.writeFileSync(indexPath, html);
console.log('kostolany-egg-section removed (arc lives in macro-unified)');
