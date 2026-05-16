const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

function shortHash(value) {
  const raw = String(value || '').trim();
  return raw ? raw.slice(0, 7) : 'unknown';
}

function resolveBuildVersion() {
  if (process.env.BUILD_VERSION) return shortHash(process.env.BUILD_VERSION);
  if (process.env.VERCEL_GIT_COMMIT_SHA) return shortHash(process.env.VERCEL_GIT_COMMIT_SHA);
  try {
    return shortHash(execSync('git rev-parse HEAD', { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] }).toString());
  } catch (_) {
    return 'unknown';
  }
}

if (!fs.existsSync(indexPath)) {
  throw new Error('index.html not found; cannot inject build version');
}

const buildVersion = resolveBuildVersion();
let html = fs.readFileSync(indexPath, 'utf8');

const marker = `<span class="build-version">build: ${buildVersion}</span>`;
if (html.includes('class="build-version"')) {
  html = html.replace(/<span class="build-version">build: .*?<\/span>/, marker);
} else if (html.includes('</footer>')) {
  html = html.replace('</footer>', ` <span class="footer-sep">·</span> ${marker}</footer>`);
} else {
  html = html.replace('</main>', `<footer class="footer">${marker}</footer></main>`);
}

fs.writeFileSync(indexPath, html);
console.log(`Injected build version: ${buildVersion}`);
