const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const files = [path.join(root, 'index.html')];
if (fs.existsSync(pagesDir)) {
  for (const file of fs.readdirSync(pagesDir)) {
    if (file.endsWith('.html')) files.push(path.join(pagesDir, file));
  }
}
function relativeHref(file) {
  return path.basename(path.dirname(file)) === 'pages' ? '../assets/proportion-tuning.css' : 'assets/proportion-tuning.css';
}
let count = 0;
for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/\s*<link rel="stylesheet" href="(?:\.\.\/)?assets\/proportion-tuning\.css">/g, '');
  const href = relativeHref(file);
  if (html.includes('</head>')) {
    html = html.replace('</head>', `<link rel="stylesheet" href="${href}"></head>`);
    fs.writeFileSync(file, html);
    count += 1;
  }
}
console.log(`injected proportion tuning stylesheet into ${count} html files`);
