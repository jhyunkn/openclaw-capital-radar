const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pagesDir = path.join(root, 'pages');
const statePath = fs.existsSync(path.join(root, 'data', 'report-state.live.json')) ? path.join(root, 'data', 'report-state.live.json') : path.join(root, 'data', 'report-state.sample.json');
const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
const holdings = Array.isArray(state.holdings) ? state.holdings : [];

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = value => typeof value === 'number' && Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : 'n/a';
const signalTone = signal => /EXIT|TRIM|SELL/i.test(signal || '') ? 'bad' : /WATCH|VERIFY|INVESTIGATE/i.test(signal || '') ? 'warn' : 'good';

function riskBudgetPanel(h) {
  const signal = h.computedSignal || h.signal || 'Review';
  const ticker = String(h.ticker || '').toUpperCase();
  const role = `${h.exposureBucket || ''} ${h.role || ''}`.toLowerCase();
  const speculative = /lever|spec|crypto|option|synthetic|risk/.test(role) || ['CONL', 'TSLT', 'TSNF'].includes(ticker);
  return `<section class="section"><div class="section-head"><div><p class="eyebrow">Risk budget</p><h2>Portfolio constraint check</h2></div></div><div class="split"><article class="panel"><h3>Current position</h3><div class="smallgrid"><p><b>Weight</b><br>${fmt(h.portfolioWeightPct)}%</p><p><b>Signal</b><br><span class="${signalTone(signal)}">${esc(signal)}</span></p><p><b>Speculative / levered cap</b><br>5%</p><p><b>Single non-index cap</b><br>15%</p></div></article><article class="panel"><h3>Interpretation</h3><p>${speculative ? 'This holding is treated as speculative/levered for risk-budget purposes. Size discipline matters more than thesis confidence.' : 'This holding is reviewed against the single-position concentration budget and its role in the broader portfolio.'}</p><p class="bodyline"><b>Action implication:</b> if signal escalates to TRIM WATCH or EXIT REVIEW, portfolio weight and volatility contribution should be checked before adding exposure.</p></article></div></section>`;
}

function removeExisting(html) {
  const marker = '<p class="eyebrow">Risk budget</p>';
  const markerIndex = html.indexOf(marker);
  if (markerIndex < 0) return html;
  const start = html.lastIndexOf('<section', markerIndex);
  const end = html.indexOf('</section>', markerIndex);
  if (start < 0 || end < 0) return html;
  return html.slice(0, start) + html.slice(end + '</section>'.length);
}

let count = 0;
for (const h of holdings) {
  const file = path.join(pagesDir, `${String(h.ticker || '').toLowerCase()}.html`);
  if (!fs.existsSync(file)) continue;
  let html = removeExisting(fs.readFileSync(file, 'utf8'));
  const block = riskBudgetPanel(h);
  if (html.includes('id="strategy-interpreter"')) html = html.replace(/(<section id="strategy-interpreter"[\s\S]*?<\/section>)/, `$1${block}`);
  else html = html.replace('<section class="section chart-section">', `${block}<section class="section chart-section">`);
  fs.writeFileSync(file, html);
  count += 1;
}

console.log(`injected risk budget into ${count} ticker workspaces`);
