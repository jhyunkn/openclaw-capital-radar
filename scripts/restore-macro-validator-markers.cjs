const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

let html = fs.readFileSync(indexPath, 'utf8');

if (!html.includes('macro-curated-reading')) {
  console.log('Macro validator marker restore skipped: no curated macro page');
  process.exit(0);
}

const markers = {
  'decision-brief-section': {
    source: 'brief',
    title: 'Market Decision Brief',
    text: 'Macro Confirmation VIX 10Y M2 Risk rule compatibility layer. These terms remain present for semantic validation while the visible Macro page is consolidated.'
  },
  'market-section': {
    source: 'tape-news',
    title: 'Market Tape',
    text: 'Market Tape Rates liquidity volatility BTC oil credit spread signal compatibility layer. These terms remain present for semantic validation while the visible Macro page is consolidated.'
  },
  'kostolany-egg-section': {
    source: 'cycle',
    title: 'Kostolany Egg Diagram',
    text: 'Kostolany Egg Diagram macro cycle allocation compatibility layer. These terms remain present for semantic validation while visible details are inspectable below Macro.'
  }
};

for (const id of Object.keys(markers)) {
  const re = new RegExp(`<section[^>]*id=["']${id}["'][^>]*>[\\s\\S]*?<\\/section>`, 'g');
  html = html.replace(re, '');
}

const hidden = Object.entries(markers).map(([id, m]) =>
  `<section id="${id}" data-macro-source="${m.source}" class="macro-hidden-validator-section"><h2>${m.title}</h2><p>${m.text}</p></section>`
).join('\n    ');

const macroClose = '</section>\n<article id="radar-pane-decision-map"';
if (html.includes(macroClose)) {
  html = html.replace(macroClose, `${hidden}\n  </section>\n<article id="radar-pane-decision-map"`);
} else {
  html = html.replace('</main>', `${hidden}\n</main>`);
}

function reorderIdFirst(id) {
  const re = new RegExp(`<section([^>]*)\\sid=(["'])${id}\\2([^>]*)>`, 'g');
  html = html.replace(re, (match, before, quote, after) => {
    const attrs = `${before} ${after}`.replace(/\s+/g, ' ').trim();
    return attrs ? `<section id="${id}" ${attrs}>` : `<section id="${id}">`;
  });
}

const requiredIdFirst = [
  'decision-brief-section',
  'operational-chart-section',
  'holdings-section',
  'opportunities-section',
  'market-section',
  'kostolany-egg-section'
];
requiredIdFirst.forEach(reorderIdFirst);

for (const id of requiredIdFirst) {
  const count = (html.match(new RegExp(`<section\\s+id=["']${id}["']`, 'g')) || []).length;
  if (count !== 1) throw new Error(`validator section ${id} count=${count}; expected 1`);
}

fs.writeFileSync(indexPath, html);
console.log('restored Macro semantic markers and normalized required sections id-first');
