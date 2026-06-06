'use strict';

const fs   = require('fs');
const path = require('path');
const { renderConvictionSection, renderConvictionStyle } = require('../components/radar/conviction/render.cjs');

const root        = path.join(__dirname, '..');
const indexPath   = path.join(root, 'index.html');
const statePath   = path.join(root, 'outputs', 'conviction-ranking.json');

function readJson(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }

if (!fs.existsSync(indexPath)) throw new Error('index.html missing — run build-homepage first');
if (!fs.existsSync(statePath)) throw new Error('conviction-ranking.json missing — run generate-conviction-ranking first');

const state   = readJson(statePath);
const section = renderConvictionSection(state);
const style   = renderConvictionStyle();

let html = fs.readFileSync(indexPath, 'utf8');

// Inject style (replace existing conviction style block or append to head)
if (html.includes('.cv-stance{')) {
  html = html.replace(/<style>[^<]*\.cv-stance[\s\S]*?<\/style>/, style);
} else {
  html = html.replace('</he' + 'ad>', style + '</he' + 'ad>');
}

// Inject conviction section — insert before opportunities-section
// If conviction-section already exists, replace it.
const OPEN  = '<sec' + 'tion';
const CLOSE = '</sec' + 'tion>';
const CVS_ID = 'id="conviction-section"';

if (html.includes(CVS_ID)) {
  const idx   = html.indexOf(CVS_ID);
  const start = html.lastIndexOf(OPEN, idx);
  const end   = html.indexOf(CLOSE, idx);
  if (start >= 0 && end > start) {
    html = html.slice(0, start) + section + html.slice(end + CLOSE.length);
  }
} else {
  // Insert before opportunities-section
  const OPP_ID = 'id="opportunities-section"';
  const oppIdx = html.indexOf(OPP_ID);
  if (oppIdx >= 0) {
    const oppStart = html.lastIndexOf(OPEN, oppIdx);
    if (oppStart >= 0) {
      html = html.slice(0, oppStart) + section + '\n' + html.slice(oppStart);
    } else {
      throw new Error('Could not locate opportunities-section boundary');
    }
  } else {
    throw new Error('No injection point found — opportunities-section missing from index.html');
  }
}

fs.writeFileSync(indexPath, html);

const top3 = (state.top10 || []).slice(0, 3).map(t => `${t.ticker}(${t.conviction_score})`).join(', ');
console.log(`injected conviction-section: ${state.summary?.total_universe || '?'} tickers, top3=${top3}`);
