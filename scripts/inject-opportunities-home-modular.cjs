const fs = require('fs');
const path = require('path');
const { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows } = require('../components/radar/opportunities/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'opportunity-asymmetry-state.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function replaceSection(html, id, nextId, section) {
  const open = '<sec' + 'tion id="';
  const start = html.indexOf(open + id + '"');
  const end = html.indexOf(open + nextId + '"');
  if (start < 0 || end < 0 || end <= start) throw new Error('Could not locate ' + id + ' section boundaries');
  return html.slice(0, start) + section + html.slice(end);
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('opportunity-asymmetry-state.json missing');

const state = readJson(statePath);
if (!state.render_permission) throw new Error('opportunity-asymmetry-state render_permission=false');

const section = renderOpportunitiesSection(state);
const style = renderOpportunitiesStyle();
let html = fs.readFileSync(indexPath, 'utf8');

if (html.includes('.empty-op{') || html.includes('.op-board{')) html = html.replace(/<style>[^<]*(?:\.empty-op|\.op-board)[\s\S]*?<\/style>/, style);
else html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');
html = replaceSection(html, 'opportunities-section', 'market-section', section);

fs.writeFileSync(indexPath, html);
const allRows = flattenOpportunityRows(state);
const selected = selectDisplayRows(allRows);
console.log(`injected modular asymmetry diagnostics: qualified=${selected.opportunities.length} near=${selected.near.length} total=${allRows.length}`);
