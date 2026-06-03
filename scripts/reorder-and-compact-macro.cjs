'use strict';
// Compacts current-market-state: first 6 tape rows visible, rest hidden behind toggle.
// Section ordering is handled by inject scripts — this script no longer reorders.

const fs   = require('fs');
const path = require('path');

const root        = path.join(__dirname, '..');
const requestedPath = process.env.CAPITAL_RADAR_INDEX_PATH || process.argv[2] || 'index.html';
const indexPath   = path.isAbsolute(requestedPath) ? requestedPath : path.join(root, requestedPath);

if (!fs.existsSync(indexPath)) throw new Error(`index.html missing at ${indexPath}`);

function findSectionTagIdx(html, id) {
  let search = 0;
  while (search < html.length) {
    const s = html.indexOf('<section', search);
    if (s < 0) return -1;
    const e = html.indexOf('>', s);
    if (html.slice(s, e + 1).includes(`id="${id}"`)) return s;
    search = s + 1;
  }
  return -1;
}

function compactMarketState(html) {
  const rows = html.split(/<details class="cms-row">/);
  if (rows.length <= 7) return html;

  const visible    = rows.slice(0, 7).join('<details class="cms-row">');
  const hiddenRows = rows.slice(7).map(r => `<details class="cms-row cms-row-hidden">${r}`).join('');
  const count      = rows.length - 7;

  const toggle = `<div class="cms-show-more" id="cms-show-more-wrap">
<button class="cms-show-more-btn" onclick="var r=document.querySelectorAll('.cms-row-hidden'),b=this,s=r[0]&&r[0].style.display!=='none';r.forEach(function(x){x.style.display=s?'none':'block'});b.textContent=s?'Show ${count} more metrics ↓':'Show less ↑';">Show ${count} more metrics ↓</button>
</div>
<style>.cms-row-hidden{display:none}.cms-show-more{text-align:center;padding:14px 0;border-top:1px solid var(--rule)}.cms-show-more-btn{background:none;border:1px solid var(--rule);padding:8px 20px;font-size:13px;cursor:pointer;color:var(--ink)}.cms-show-more-btn:hover{background:rgba(36,35,31,.06)}</style>`;

  const tapeClose = visible.lastIndexOf('</div>');
  return visible.slice(0, tapeClose) + hiddenRows + toggle + visible.slice(tapeClose);
}

let html = fs.readFileSync(indexPath, 'utf8');
html = compactMarketState(html);
fs.writeFileSync(indexPath, html);

const sections = ['macro-cycle-panel','decision-brief-section','current-market-state',
                  'macro-intelligence-panel','operational-chart-section','holdings-section',
                  'opportunities-section'];
const present = sections.filter(id => findSectionTagIdx(html, id) >= 0);
console.log(`compact-macro: ${present.join(' → ')}`);
console.log(`compact-macro: market-state first 6 rows visible, rest hidden behind toggle`);
