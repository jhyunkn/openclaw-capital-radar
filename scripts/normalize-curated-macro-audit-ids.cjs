const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('macro-curated-reading')) {
  console.log('curated macro audit id normalization skipped: no curated macro reading');
  process.exit(0);
}

let stripped = 0;
const protectedIds = [
  'data-refresh-section',
  'kostolany-egg-section',
  'market-lens-section',
  'strategy-routing-section',
  'decision-brief-section',
  'market-section',
];
const protectedIdPattern = new RegExp(`\\s+id=(["'])(${protectedIds.join('|')})\\1`, 'g');

html = html.replace(/<details class="macro-evidence-detail"[\s\S]*?<\/details>/g, block =>
  block.replace(protectedIdPattern, () => {
    stripped += 1;
    return '';
  })
);

function countId(id) {
  return (html.match(new RegExp(`id=["']${id}["']`, 'g')) || []).length;
}

const marketHidden = '<section data-macro-source="tape-news" id="market-section" class="macro-hidden-validator-section"><h2>Market Tape</h2></section>';
const eggHidden = '<section data-macro-source="cycle" id="kostolany-egg-section" class="macro-hidden-validator-section"><h2>Kostolany Egg Diagram</h2></section>';

if (countId('kostolany-egg-section') === 0) {
  if (!html.includes(marketHidden)) {
    throw new Error('curated macro hidden market validator missing; cannot place hidden Kostolany validator');
  }
  html = html.replace(marketHidden, `${marketHidden}\n    ${eggHidden}`);
}

const requiredIds = ['decision-brief-section', 'market-section', 'kostolany-egg-section'];
const badCounts = requiredIds
  .map(id => [id, countId(id)])
  .filter(([, count]) => count !== 1);

if (badCounts.length) {
  throw new Error(`curated macro validator id normalization failed: ${badCounts.map(([id, count]) => `${id}=${count}`).join(', ')}`);
}

const dataRefreshCount = countId('data-refresh-section');
if (dataRefreshCount !== 1) {
  throw new Error(`data-refresh-section=${dataRefreshCount}, expected 1`);
}

fs.writeFileSync(indexPath, html);
console.log(`normalized curated macro audit ids; stripped ${stripped} evidence-layer ids`);
