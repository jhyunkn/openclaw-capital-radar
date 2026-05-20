const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/<div class="mini-row"><span>Role<\/span><b>[\s\S]*?<\/div><\/article>/g, '</article>');
fs.writeFileSync(indexPath, html);
console.log('removed Role/Method row from Holdings cards');
