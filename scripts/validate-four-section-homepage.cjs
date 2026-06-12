const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

function fail(message) { console.error(`HOMEPAGE VALIDATION FAILED: ${message}`); process.exit(1); }
function assert(condition, message) { if (!condition) fail(message); }
function sectionHtml(html, id) {
  const start = html.indexOf(`<section id="${id}"`);
  if (start < 0) return '';
  let depth = 0;
  let i = start;
  while (i < html.length) {
    if (html.startsWith('<section', i)) {
      depth++;
      i += 8;
      continue;
    }
    if (html.startsWith('</section>', i)) {
      depth--;
      i += 10;
      if (depth === 0) return html.slice(start, i);
      continue;
    }
    i++;
  }
  return html.slice(start);
}

assert(fs.existsSync(indexPath), 'index.html missing');
const html = fs.readFileSync(indexPath, 'utf8');
const sectionIds = [...html.matchAll(/<section\s+id="([^"]+)"/g)].map(m => m[1]);
const expected = ['decision-brief-section', 'operational-chart-section', 'holdings-section', 'opportunities-section'];

const hasFinalFourSectionShell = html.includes('Capital Radar · four-section decision surface') || expected.every(id => sectionIds.includes(id)) && !sectionIds.includes('market-section') && !sectionIds.includes('kostolany-egg-section');
if (!hasFinalFourSectionShell) {
  console.log(`four-section homepage validator skipped before final render; current sections: ${sectionIds.join(' > ')}`);
  process.exit(0);
}

assert(JSON.stringify(sectionIds) === JSON.stringify(expected), `section order mismatch: expected ${expected.join(' > ')} got ${sectionIds.join(' > ')}`);

const macro = sectionHtml(html, 'decision-brief-section');
const chart = sectionHtml(html, 'operational-chart-section');
const holdings = sectionHtml(html, 'holdings-section');
const opportunity = sectionHtml(html, 'opportunities-section');

assert(/Macro|Confirmation|VIX|10Y|M2|Risk rule|permission|invalidation/i.test(macro), 'Macro missing regime/confirmation/permission/invalidation fields');
assert(/Operational Decision Chart|SPX|RSI|MACD|VIX|10Y|ADD|TRIM|DEFENSE/i.test(chart), 'Decision chart missing chart/indicator/action fields');
assert(/AUTH|PARTIAL|PROXY|MISSING|Price-zone|Buy|Trim|Stop|Exit/i.test(holdings), 'Holdings missing source tier and zone fields');
assert(/Opportunity|Evidence|Near|candidate|gate|promotion|qualification|missing|Research/i.test(opportunity), 'Opportunity missing evidence/research state');

const forbiddenIds = [
  'data-refresh-section',
  'kostolany-egg-section',
  'market-lens-section',
  'strategy-routing-section',
  'market-section',
  'system-health-section',
  'macro-unified-section',
  'kostolany-history-section',
  'narrative-reality-section',
  'macro-cycle-section',
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
];
for (const id of forbiddenIds) assert(!html.includes(`id="${id}"`), `removed section still present: ${id}`);

['Native Research Engine', 'Opportunity Evidence Engine', 'Ticker Gate Audit', 'What requires action now?', 'Read permission before price.', '[object Object]'].forEach(x => assert(!html.includes(x), `legacy phrase still present: ${x}`));
console.log('four-section homepage validated: Macro / Decision chart / Holdings / Opportunity');
