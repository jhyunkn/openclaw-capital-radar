const fs = require('fs');
const path = require('path');
const { renderOpportunitiesSection, renderOpportunitiesStyle, flattenOpportunityRows, selectDisplayRows } = require('../components/radar/opportunities/render.cjs');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'opportunity-asymmetry-state.json');
const rankingPath = path.join(root, 'outputs', 'candidate-ranking.json');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function replaceSection(html, id, nextId, section) {
  const open = '<sec' + 'tion';
  const close = '</sec' + 'tion>';
  const idDouble = 'id="' + id + '"';
  const idSingle = "id='" + id + "'";
  const idDoubleIndex = html.indexOf(idDouble);
  const idSingleIndex = html.indexOf(idSingle);
  const idIndex = idDoubleIndex >= 0 ? idDoubleIndex : idSingleIndex;

  if (idIndex >= 0) {
    const start = html.lastIndexOf(open, idIndex);
    const endOfSection = html.indexOf(close, idIndex);
    if (start >= 0 && endOfSection > start) return html.slice(0, start) + section + html.slice(endOfSection + close.length);
  }

  const legacyOpen = '<sec' + 'tion id="';
  const legacyStart = html.indexOf(legacyOpen + id + '"');
  const legacyEnd = nextId ? html.indexOf(legacyOpen + nextId + '"') : -1;
  if (legacyStart >= 0 && legacyEnd > legacyStart) return html.slice(0, legacyStart) + section + html.slice(legacyEnd);

  throw new Error('Could not locate ' + id + ' section boundaries');
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(statePath)) throw new Error('opportunity-asymmetry-state.json missing');

const state = readJson(statePath);
if (!state.render_permission) throw new Error('opportunity-asymmetry-state render_permission=false');

const ranking = fs.existsSync(rankingPath) ? readJson(rankingPath) : null;
const section = renderOpportunitiesSection(state, ranking);
const style = renderOpportunitiesStyle();
let html = fs.readFileSync(indexPath, 'utf8');

if (html.includes('.empty-op{') || html.includes('.op-board{')) html = html.replace(/<style>[^<]*(?:\.empty-op|\.op-board)[\s\S]*?<\/style>/, style);
else html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');
html = replaceSection(html, 'opportunities-section', 'market-section', section);

fs.writeFileSync(indexPath, html);
const allRows = flattenOpportunityRows(state);
const selected = selectDisplayRows(allRows);
console.log(`injected modular asymmetry diagnostics: qualified=${selected.opportunities.length} near=${selected.near.length} total=${allRows.length}`);
