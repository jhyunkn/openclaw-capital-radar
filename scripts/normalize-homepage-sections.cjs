const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');

const visibleIds = ['decision-brief-section', 'operational-chart-section', 'holdings-section', 'opportunities-section'];
const removeIds = [
  'data-refresh-section',
  'kostolany-egg-section',
  'market-lens-section',
  'strategy-routing-section',
  'market-section',
  'system-health-section',
  'macro-cycle-section',
  'today-market-brain-section',
  'trust-section',
  'artifact-status-section',
  'decision-tabs-section',
  'brief',
  'strategy-section',
  'chart-wall-section',
  'spx-cycle-map-section',
  'cycle-scenario-section',
  'visual-regime-section',
  'regime-section',
  // Replaced by macro-unified-section
  'evidence-annotation-layer',
  'relationship-intelligence',
  'market-diagnosis-board',
  'macro-configuration-board',
  'macro-historical-board',
  'macro-portfolio-board',
  'macro-cycle-panel',
  'macro-intelligence-panel',
];

function findSections(source, id) {
  const token = `<section id="${id}"`;
  const found = [];
  let start = source.indexOf(token);
  while (start >= 0) {
    const next = source.indexOf('<section id="', start + token.length);
    const footer = source.indexOf('<footer', start + token.length);
    const mainEnd = source.indexOf('</main>', start + token.length);
    const candidates = [next, footer, mainEnd].filter(i => i >= 0);
    const end = candidates.length ? Math.min(...candidates) : source.length;
    found.push({ start, end, text: source.slice(start, end) });
    start = source.indexOf(token, end);
  }
  return found;
}

function removeSection(source, id) {
  let out = source;
  let start = out.indexOf(`<section id="${id}"`);
  while (start >= 0) {
    const next = out.indexOf('<section id="', start + 1);
    const footer = out.indexOf('<footer', start + 1);
    const mainEnd = out.indexOf('</main>', start + 1);
    const candidates = [next, footer, mainEnd].filter(i => i >= 0);
    const end = candidates.length ? Math.min(...candidates) : out.length;
    out = out.slice(0, start) + out.slice(end);
    start = out.indexOf(`<section id="${id}"`);
  }
  return out;
}

function rebuildNav(source) {
  const labels = {
    'decision-brief-section': 'Macro',
    'operational-chart-section': 'Decision chart',
    'holdings-section': 'Holdings',
    'opportunities-section': 'Opportunity',
  };
  const navHtml = visibleIds
    .filter(id => source.includes(`id="${id}"`))
    .map(id => `<a href="#${id}">${labels[id]}</a>`)
    .join('');
  return source.replace(/<nav class="nav">[\s\S]*?<\/nav>/, `<nav class="nav">${navHtml}</nav>`);
}

function reorderSections(source) {
  const collected = [];
  let out = source;
  for (const id of visibleIds) {
    const found = findSections(out, id);
    if (!found.length) continue;
    collected.push({ id, text: found[0].text });
    out = removeSection(out, id);
  }
  const ordered = visibleIds.map(id => collected.find(item => item.id === id)).filter(Boolean).map(item => item.text).join('\n    ');
  const footer = out.indexOf('<footer');
  const mainEnd = out.indexOf('</main>');
  const insertAt = footer >= 0 ? footer : (mainEnd >= 0 ? mainEnd : out.length);
  return out.slice(0, insertAt) + ordered + '\n    ' + out.slice(insertAt);
}

for (const id of removeIds) html = removeSection(html, id);
for (const id of visibleIds) {
  const found = findSections(html, id);
  if (found.length <= 1) continue;
  const keep = found[0].text;
  let rebuilt = '';
  let cursor = 0;
  for (let i = 0; i < found.length; i++) {
    rebuilt += html.slice(cursor, found[i].start);
    if (i === 0) rebuilt += keep;
    cursor = found[i].end;
  }
  rebuilt += html.slice(cursor);
  html = rebuilt;
  console.log(`normalized duplicate section ${id}: ${found.length}->1`);
}

html = reorderSections(html);
html = rebuildNav(html);
fs.writeFileSync(indexPath, html);

const durationBanner = path.join(root, 'scripts', 'inject-duration-evidence-banner.cjs');
if (fs.existsSync(durationBanner)) {
  const result = spawnSync('node scripts/inject-duration-evidence-banner.cjs', { cwd: root, shell: true, stdio: 'inherit' });
  if (result.status !== 0) throw new Error('duration evidence banner injection failed after normalization');
}

console.log('homepage section normalization complete: Macro / Decision chart / Holdings / Opportunity');
