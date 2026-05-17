const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
let html = fs.readFileSync(indexPath, 'utf8');
function extractById(doc, id) {
  const pattern = new RegExp(`<section id="${id}"[\\s\\S]*?(?=<section id="|<footer|<\\/main>)`);
  const match = doc.match(pattern);
  return match ? match[0] : '';
}
function removeById(doc, id) {
  return doc.replace(new RegExp(`<section id="${id}"[\\s\\S]*?(?=<section id="|<footer|<\\/main>)`), '');
}
const hierarchy = [
  'strategy-command',
  'portfolio-exposure',
  'brief',
  'holdings-section',
  'portfolio-scoreboard',
  'action-proximity',
  'market-section',
  'opportunity-section',
  'research-candidate-map'
];
const extracted = Object.fromEntries(hierarchy.map(id => [id, extractById(html, id)]));
for (const id of hierarchy) html = removeById(html, id);
const present = hierarchy.map(id => extracted[id]).filter(Boolean).join('\n');
const hierarchyNote = `<section id="information-hierarchy" class="panel information-hierarchy"><div class="section-head"><div><p class="eyebrow">Operating Sequence</p><h2>How to read this board</h2></div></div><div class="hierarchy-steps"><article><span>01</span><b>Can I act?</b><p>Start with Strategy Command: action permission, urgency, blocked adds, weak data, and high-confidence decisions.</p></article><article><span>02</span><b>Why does today matter?</b><p>Read Portfolio Pressure Map: concentration, weak data, liquidity beta, levered exposure, and macro portfolio pressure.</p></article><article><span>03</span><b>What do I do with holdings?</b><p>Use Strategic Holdings: role, thesis status, constraints, new information, and signal-change conditions.</p></article><article><span>04</span><b>Where is the evidence?</b><p>Open ticker workbenches for chart-first strategy, thesis dossier, and interpretation layers.</p></article><article><span>05</span><b>What should enter research?</b><p>Use Opportunity Scout later, after current portfolio pressure is understood.</p></article></div></section>`;
const hierarchyCss = `<style>.information-hierarchy{background:rgba(251,250,246,.09)}.hierarchy-steps{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule)}.hierarchy-steps article{padding:16px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);background:rgba(251,250,246,.15);min-height:168px}.hierarchy-steps span{display:block;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;margin-bottom:14px}.hierarchy-steps b{display:block;font-size:20px;line-height:1.05;letter-spacing:-.035em}.hierarchy-steps p{font-size:13px;line-height:1.42;margin-top:10px;color:rgba(36,35,31,.78)}@media(max-width:1000px){.hierarchy-steps{grid-template-columns:1fr 1fr}}@media(max-width:640px){.hierarchy-steps{grid-template-columns:1fr}}</style>`;
html = html.replace(/<style>\.information-hierarchy[\s\S]*?<\/style>/, '');
html = html.replace(/<section id="information-hierarchy"[\s\S]*?(?=<section id="|<footer|<\/main>)/, '');
html = html.replace('</head>', `${hierarchyCss}</head>`);
if (html.includes('<footer')) html = html.replace('<footer', `${hierarchyNote}\n${present}\n<footer`);
else html = html.replace('</main>', `${hierarchyNote}\n${present}\n</main>`);
fs.writeFileSync(indexPath, html);
console.log('applied homepage information hierarchy and moved research pipeline below portfolio strategy sections');
