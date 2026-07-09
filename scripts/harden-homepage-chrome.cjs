const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const files = process.argv.slice(2).length ? process.argv.slice(2) : ['index.html', 'public/index.html'];

const requiredStylesheet = 'assets/capital-radar-unified-visuals.css';
const calendarLink = '<a href="#market-calendar-section">Calendar</a>';

function relHrefFor(file) {
  const normalized = file.replace(/\\/g, '/');
  return normalized.startsWith('public/') ? requiredStylesheet : requiredStylesheet;
}

function ensureStylesheet(html, href) {
  if (html.includes(href)) return html;
  const visualPass = '<link rel="stylesheet" href="assets/capital-radar-visual-pass.css"/>';
  const link = `  <link rel="stylesheet" href="${href}"/>`;
  if (html.includes(visualPass)) return html.replace(visualPass, `${visualPass}\n${link}`);
  return html.replace('</head>', `${link}\n</head>`);
}

function ensureCalendarNav(html) {
  if (!html.includes('id="market-calendar-section"') || html.includes('href="#market-calendar-section"')) return html;
  return html.replace(
    /(<a href="#decision-brief-section">Macro<\/a>)/,
    `$1${calendarLink}`
  );
}

function harden(relFile) {
  const file = path.join(root, relFile);
  if (!fs.existsSync(file)) return;
  let html = fs.readFileSync(file, 'utf8');
  html = ensureStylesheet(html, relHrefFor(relFile));
  html = ensureCalendarNav(html);
  if (!html.includes(requiredStylesheet)) throw new Error(`${relFile} missing unified visuals stylesheet after hardening`);
  if (html.includes('id="market-calendar-section"') && !html.includes('href="#market-calendar-section"')) {
    throw new Error(`${relFile} missing market calendar nav anchor after hardening`);
  }
  fs.writeFileSync(file, html);
  console.log(`hardened homepage chrome: ${relFile}`);
}

for (const file of files) harden(file);
