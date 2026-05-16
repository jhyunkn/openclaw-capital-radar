const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) {
  throw new Error('index.html not found; cannot strip homepage runtime scripts');
}

let html = fs.readFileSync(indexPath, 'utf8');

html = html
  .replace(/\s*<script\s+src=["']assets\/capital-radar\.js["']\s+defer><\/script>/g, '')
  .replace(/\s*<script\s+src=["']assets\/chart-integration\.js["']\s+defer><\/script>/g, '')
  .replace(/\s*<script\s+src=["']assets\/search-enhancement\.js["']\s+defer><\/script>/g, '')
  .replace(/\s*<script\s+src=["']assets\/market-section-md\.js["']\s+defer><\/script>/g, '');

html = html.replace('</body>', '\n<!-- Static homepage baseline: no runtime dashboard scripts. -->\n</body>');

fs.writeFileSync(indexPath, html);
console.log('Stripped homepage runtime scripts from index.html');
