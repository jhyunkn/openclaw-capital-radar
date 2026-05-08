const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const out = path.join(root, 'public');
const copyEntries = ['index.html', 'assets', 'data', 'outputs', 'pages'];

function rm(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}
function copy(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const child of fs.readdirSync(src)) copy(path.join(src, child), path.join(dest, child));
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

rm(out);
fs.mkdirSync(out, { recursive: true });
for (const entry of copyEntries) {
  const src = path.join(root, entry);
  if (fs.existsSync(src)) copy(src, path.join(out, entry));
}
fs.writeFileSync(path.join(out, 'health.json'), JSON.stringify({ ok: true, builtAt: new Date().toISOString() }, null, 2));
console.log(`Prepared Vercel static output at ${out}`);
