const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const targetArg = process.argv[2];
const indexPath = targetArg ? path.join(root, targetArg) : path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) process.exit(0);

let html = fs.readFileSync(indexPath, 'utf8');

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

html = removeSectionById(html, 'kostolany-egg-section');
html = removeSectionById(html, 'macro-cycle-section');

fs.writeFileSync(indexPath, html);
console.log(`Kostolany Egg sections stripped: ${path.relative(root, indexPath)}`);
