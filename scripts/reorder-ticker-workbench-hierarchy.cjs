const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];

function findSection(html, marker) {
  const start = html.indexOf(marker);
  if (start < 0) return null;
  const sectionStart = html.lastIndexOf('<section', start);
  if (sectionStart < 0) return null;
  const end = html.indexOf('</section>', start);
  if (end < 0) return null;
  return { start: sectionStart, end: end + '</section>'.length, block: html.slice(sectionStart, end + '</section>'.length) };
}
function removeBlock(html, block) {
  return html.replace(block, '');
}
function extract(html, marker) {
  const found = findSection(html, marker);
  if (!found) return { html, block: '' };
  return { html: removeBlock(html, found.block), block: found.block };
}
function insertAfter(html, marker, block) {
  if (!block) return html;
  const index = html.indexOf(marker);
  if (index < 0) return html.replace('</main>', `${block}</main>`);
  return html.slice(0, index + marker.length) + block + html.slice(index + marker.length);
}
function insertBefore(html, marker, block) {
  if (!block) return html;
  const index = html.indexOf(marker);
  if (index < 0) return html.replace('</main>', `${block}</main>`);
  return html.slice(0, index) + block + html.slice(index);
}
function removeDuplicateStyles(html) {
  // Keep style duplication under control after repeated hierarchy passes.
  const seen = new Set();
  return html.replace(/<style>([\s\S]*?)<\/style>/g, (match, content) => {
    const key = content.slice(0, 80).replace(/\s+/g, ' ');
    if (seen.has(key)) return '';
    seen.add(key);
    return match;
  });
}
function memoIntro(ticker) {
  return `<section id="investment-committee-memo" class="section memo-section"><div class="section-head"><div><p class="eyebrow">Investment Committee Memo</p><h2>${ticker} decision stack</h2></div><a class="coverage-json-link" href="/outputs/portfolio-thesis-coverage-map.json">Coverage map</a></div><p class="bodyline">Read this page top-down: underwriting status first, action permission second, risk budget third, chart only after the decision context is clear. The chart should test the strategy, not create it.</p></section>`;
}
function ensureMemoStyles(html) {
  if (html.includes('.memo-section')) return html;
  const css = `<style>.memo-section{background:rgba(251,250,246,.18);padding-top:34px!important;padding-bottom:34px!important}.memo-section .bodyline{font-size:16px;max-width:1040px}</style>`;
  return html.replace('</head>', `${css}</head>`);
}
function reorderPage(html, ticker) {
  let working = html;
  const markers = {
    nav: 'class="section nav-section"',
    dataQuality: '<p class="eyebrow">Data quality</p>',
    riskBudget: '<p class="eyebrow">Risk budget</p>',
    scorecard: 'class="section scorecard-section"',
    actionBands: '<p class="eyebrow">Action bands</p>',
    thesis: '<p class="eyebrow">Thesis / invalidation</p>',
    chart: 'class="section chart-section"',
    agent: 'id="agent-intelligence"',
    cognition: 'id="chart-cognition"',
    coverage: 'id="thesis-coverage-workbench"',
    flow: '<p class="eyebrow">Evidence</p><h2>Flow / technical read</h2>',
    context: '<p class="eyebrow">Context</p><h2>Forces / evidence</h2>',
    interpreter: 'id="strategy-interpreter"'
  };
  const extracted = {};
  for (const [key, marker] of Object.entries(markers)) {
    const result = extract(working, marker);
    working = result.html;
    extracted[key] = result.block;
  }
  working = working.replace(/<section id="investment-committee-memo"[\s\S]*?<\/section>/, '');
  const metricsEnd = '</section>';
  const firstMetricsStart = working.indexOf('<section class="grid metrics">');
  if (firstMetricsStart >= 0) {
    const metricsClose = working.indexOf(metricsEnd, firstMetricsStart);
    const insertPoint = metricsClose + metricsEnd.length;
    const ordered = [
      memoIntro(ticker),
      extracted.coverage,
      extracted.interpreter,
      extracted.riskBudget,
      extracted.cognition,
      extracted.chart,
      extracted.actionBands,
      extracted.dataQuality,
      extracted.thesis,
      extracted.scorecard,
      extracted.agent,
      extracted.flow,
      extracted.context,
      extracted.nav
    ].filter(Boolean).join('');
    working = working.slice(0, insertPoint) + ordered + working.slice(insertPoint);
  } else {
    const ordered = [memoIntro(ticker), extracted.coverage, extracted.interpreter, extracted.riskBudget, extracted.cognition, extracted.chart, extracted.actionBands, extracted.dataQuality, extracted.thesis, extracted.scorecard, extracted.agent, extracted.flow, extracted.context, extracted.nav].filter(Boolean).join('');
    working = working.replace('</main>', `${ordered}</main>`);
  }
  working = ensureMemoStyles(working);
  working = removeDuplicateStyles(working);
  return working;
}
let count = 0;
for (const h of holdings) {
  const ticker = String(h.ticker || '').toUpperCase();
  const file = path.join(pagesDir, `${ticker.toLowerCase()}.html`);
  if (!fs.existsSync(file)) continue;
  const html = fs.readFileSync(file, 'utf8');
  fs.writeFileSync(file, reorderPage(html, ticker));
  count += 1;
}
console.log(`reordered ticker workbench hierarchy for ${count} pages`);
