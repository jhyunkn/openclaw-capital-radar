const fs = require('fs');
const path = require('path');
const {
  renderKostolanyEggModule,
  renderKostolanyEggModuleStyle,
} = require('../components/radar/kostolany-egg/render.cjs');

const root = path.join(__dirname, '..');
const targetArg = process.argv[2];
const indexPath = targetArg ? path.join(root, targetArg) : path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'kostolany-egg-state.json');

if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

// Keep the old standalone section retired. The visible diagram now lives as a
// compact module inside decision-brief-section so the homepage stays four-part.
html = html.replace(/<link rel="stylesheet" href="assets\/kostolany-egg-v3\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/kostolany-egg-v4\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/page-tight-overflow\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/egg-board-final\.css">/g, '');
html = html.replace(/<link rel="stylesheet" href="assets\/egg-svg-refine\.css">/g, '');
html = html.replace(/<style id="kostolany-egg-v3-style">[\s\S]*?<\/style>\s*/g, '');
html = html.replace(/<style id="kostolany-egg-module-style">[\s\S]*?<\/style>\s*/g, '');
html = html.replace(/<!-- KOSTOLANY_EGG_MODULE_START -->[\s\S]*?<!-- KOSTOLANY_EGG_MODULE_END -->\s*/g, '');

function removeSectionById(source, id) {
  const token = `<section id="${id}"`;
  let output = source;
  let start = output.indexOf(token);
  while (start >= 0) {
    let depth = 0;
    let i = start;
    while (i < output.length) {
      if (output.startsWith('<section', i)) {
        depth++;
        i += 8;
        continue;
      }
      if (output.startsWith('</section>', i)) {
        depth--;
        i += 10;
        if (depth === 0) break;
        continue;
      }
      i++;
    }
    output = output.slice(0, start) + output.slice(i);
    start = output.indexOf(token);
  }
  return output;
}

function findSectionEnd(source, id) {
  const token = `<section id="${id}"`;
  const start = source.indexOf(token);
  if (start < 0) return -1;
  let depth = 0;
  let i = start;
  while (i < source.length) {
    if (source.startsWith('<section', i)) {
      depth++;
      i += 8;
      continue;
    }
    if (source.startsWith('</section>', i)) {
      depth--;
      if (depth === 0) return i;
      i += 10;
      continue;
    }
    i++;
  }
  return -1;
}

function readState() {
  if (!fs.existsSync(statePath)) return {};
  return JSON.parse(fs.readFileSync(statePath, 'utf8'));
}

html = removeSectionById(html, 'kostolany-egg-section');
html = removeSectionById(html, 'macro-cycle-section');

const sectionEnd = findSectionEnd(html, 'decision-brief-section');
if (sectionEnd < 0) throw new Error('decision-brief-section not found for Kostolany Egg module injection');

const moduleHtml = `<!-- KOSTOLANY_EGG_MODULE_START -->\n${renderKostolanyEggModule(readState())}\n<!-- KOSTOLANY_EGG_MODULE_END -->\n`;
html = html.slice(0, sectionEnd) + moduleHtml + html.slice(sectionEnd);

const style = renderKostolanyEggModuleStyle();
html = html.includes('</head>')
  ? html.replace('</head>', `${style}\n</head>`)
  : `${style}\n${html}`;

fs.writeFileSync(indexPath, html);
console.log(`Kostolany Egg embedded in decision-brief-section: ${path.relative(root, indexPath)}`);
