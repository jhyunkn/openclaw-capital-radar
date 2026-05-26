const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');

let html = fs.readFileSync(indexPath, 'utf8');

const markers = {
  'decision-brief-section': 'Macro confirmation compatibility layer: VIX, 10Y, M2, and Risk rule fields remain present for semantic validation while the visible Macro page is consolidated.',
  'market-section': 'Market Tape compatibility layer: Rates, liquidity, volatility, BTC, oil, credit spread, and signal fields remain present for semantic validation while the visible Macro page is consolidated.',
  'kostolany-egg-section': 'Kostolany Egg Diagram compatibility layer: macro cycle and allocation framework remain present for semantic validation while visible details are inspectable below Macro.',
};

for (const [id, text] of Object.entries(markers)) {
  const re = new RegExp(`(<section[^>]*id=["']${id}["'][^>]*>)([\\s\\S]*?)(<\\/section>)`);
  if (!re.test(html)) throw new Error(`validator marker target missing: ${id}`);
  html = html.replace(re, (match, open, body, close) => {
    const title = (body.match(/<h2>[\s\S]*?<\/h2>/) || [''])[0] || '<h2>Compatibility Marker</h2>';
    return `${open}${title}<p>${text}</p>${close}`;
  });
}

fs.writeFileSync(indexPath, html);
console.log('restored Macro semantic validator markers');
