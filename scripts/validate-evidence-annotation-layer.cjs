const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error('Evidence annotation validation failed: index.html missing');
  process.exit(1);
}

const html = fs.readFileSync(indexPath, 'utf8');
const heroEnd = html.indexOf('</section>');
const evidence = html.indexOf('id="evidence-annotation-layer"');

if (evidence < 0) {
  console.error('Evidence annotation validation failed: layer missing');
  process.exit(1);
}

if (heroEnd < 0 || evidence < heroEnd) {
  console.error('Evidence annotation validation failed: layer must appear after hero');
  process.exit(1);
}

if (!html.includes('Raw data first. Annotation second. Configuration third.')) {
  console.error('Evidence annotation validation failed: required heading missing');
  process.exit(1);
}

console.log('Evidence annotation layer validated');
