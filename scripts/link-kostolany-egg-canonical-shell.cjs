const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');
const href = 'assets/kostolany-egg-canonical-shell.css';
const link = '<link rel="stylesheet" href="' + href + '">';
if (!html.includes(href)) {
  html = html.replace('</head>', link + '</head>');
}
fs.writeFileSync(file, html);
console.log('canonical egg shell css linked');
