const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const reportPath = path.join(root, 'outputs', 'live-capital-radar.md');
const report = fs.existsSync(reportPath) ? fs.readFileSync(reportPath, 'utf8') : '';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function num(value) {
  const parsed = Number(String(value ?? '').replace(/[$,%]/g, '').replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function fmt(value, digits = 2) {
  const n = num(value);
  return Number.isFinite(n) ? n.toLocaleString(undefined, { maximumFractionDigits: digits }) : esc(value || '—');
}

function pctClass(value) {
  const n = num(value);
  return !Number.isFinite(n) ? '' : n >= 0 ? 'positive' : 'negative';
}

function section(level, title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^#{${level}}\\s+${escaped}\\s*$`, 'mi');
  const match = report.match(pattern);
  if (!match || match.index == null) return '';
  const rest = report.slice(match.index + match[0].length);
  const next = rest.search(new RegExp(`^#{1,${level}}\\s+`, 'm'));
  return next >= 0 ? rest.slice(0, next).trim() : rest.trim();
}

function subsection(title) {
  const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`^###\\s+${escaped}\\s*$`, 'mi');
  const match = report.match(pattern);
  if (!match || match.index == null) return '';
  const rest = report.slice(match.index + match[0].length);
  const next = rest.search(/^###\s+|^##\s+/m);
  return next >= 0 ? rest.slice(0, next).trim() : rest.trim();
}

function parseMarkdownTable(block) {
  const lines = block.split('\n').map(line => line.trim()).filter(line => line.startsWith('|'));
  if (lines.length < 2) return [];
  const header = lines[0].split('|').slice(1, -1).map(cell => cell.trim());
  return lines.slice(2).map(line => {
    const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  }).filter(row => Object.values(row).some(Boolean));
}

function bulletValue(block, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = block.match(new RegExp(`^- \\*\\*${escaped}:\\*\\*\\s*(.+)$`, 'mi'));
  return match ? match[1].trim() : '';
}

function normalizeSignal(signal) {
  return String(signal || '—').trim();
}

function signalClass(signal) {
  const s = String(signal || '').toUpperCase();
  if (s.includes('EXIT')) return 'signal-exit';
  if (s.includes('TRIM')) return 'signal-trim';
  if (s.includes('INVESTIGATE')) return 'signal-investigate';
  if (s.includes('ADD')) return 'signal-add';
  if (s.includes('WATCH')) return 'signal-watch';
  return 'signal-hold';
}

function parseOpportunities() {
  const block = section(2, 'Opportunity Scout');
  const lines = block.split('\n');
  const items = [];
  let current = null;
  for (const line of lines) {
    const main = line.match(/^- \*\*(.+?) - (.+?):\*\*\s*(.+)$/);
    if (main) {
      if (current) items.push(current);
      current = { ticker: main[1], signal: main[2], thesis: main[3], data: '', confirm: [], risks: [] };
      continue;
    }
    if (!current) continue;
    const data = line.match(/^\s+- Data support:\s*(.+)$/);
    if (data) { current.data = data[1]; continue; }
    const confirm = line.match(/^\s+- Confirm before add:\s*(.+)$/);
    if (confirm) { current.confirm = confirm[1].split(';').map(x => x.trim()).filter(Boolean).slice(0, 3); continue; }
    const risks = line.match(/^\s+- Key risks:\s*(.+)$/);
    if (risks) { current.risks = risks[1].split(';').map(x => x.trim()).filter(Boolean).slice(0, 3); continue; }
  }
  if (current) items.push(current);
  return items.slice(0, 5);
}

const finalBlock = section(2, 'Final Output');
const riskBlock = section(2, 'Risk Officer Review');
const holdings = parseMarkdownTable(section(2, 'Existing Holdings Review'));
const tape = parseMarkdownTable(subsection('Market tape'));
const rates = parseMarkdownTable(subsection('Rates / credit / liquidity'));
const opportunities = parseOpportunities();

const final = {
  posture: bulletValue(finalBlock, 'Market Posture'),
  macro: bulletValue(finalBlock, 'Most Important Macro Signal'),
  holdingUpdate: bulletValue(finalBlock, 'Most Important Holding Update'),
  strongest: bulletValue(finalBlock, 'Strongest Current Holding'),
  weakest: bulletValue(finalBlock, 'Weakest Current Holding'),
  highestRisk: bulletValue(finalBlock, 'Highest-Risk Position'),
  topAdd: bulletValue(finalBlock, 'Top Add Watch'),
  topTrim: bulletValue(finalBlock, 'Top Trim Watch'),
  judgment: bulletValue(finalBlock, 'Final Judgment')
};

const risk = {
  highestRisk: bulletValue(riskBlock, 'Highest-risk position') || final.highestRisk,
  weakest: bulletValue(riskBlock, 'Weakest holding') || final.weakest,
  strongest: bulletValue(riskBlock, 'Strongest holding') || final.strongest,
  trigger: (riskBlock.match(/^- (.+)$/m) || [null, 'Levered products can decay even if the thesis is directionally right.'])[1]
};

const holdingByTicker = Object.fromEntries(holdings.map(h => [h.Ticker, h]));
const tapeBySymbol = Object.fromEntries(tape.map(t => [t.Symbol, t]));
const rateBySeries = Object.fromEntries(rates.map(r => [r.Series, r]));

function signalForTicker(ticker) {
  return holdingByTicker[ticker]?.Signal || opportunities.find(o => o.ticker === ticker)?.signal || 'WATCH';
}

function rationaleForTicker(ticker, fallback) {
  return holdingByTicker[ticker]?.Rationale || fallback || final.macro || 'Review required.';
}

function weightBar(weight) {
  const value = Math.max(0, Math.min(100, num(weight) || 0));
  return `<div class="weight-wrap"><span>${fmt(weight, 2)}%</span><i style="width:${value}%"></i></div>`;
}

function miniLine(points, cls = '') {
  const vals = points.map(num).filter(Number.isFinite);
  if (vals.length < 2) return '<svg class="mini-line" viewBox="0 0 100 28"><path d="M0 20 L100 20"/></svg>';
  const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1;
  const d = vals.map((v, i) => `${i ? 'L' : 'M'}${(i / (vals.length - 1)) * 100} ${24 - ((v - min) / span) * 20}`).join(' ');
  return `<svg class="mini-line ${cls}" viewBox="0 0 100 28" preserveAspectRatio="none"><path d="${d}"/></svg>`;
}

function heroDecisionPanel() {
  return `<section id="brief" class="hero-decision module">
    <div class="decision-main">
      <p class="caption">Hero Decision Panel</p>
      <div class="posture ${signalClass(final.posture)}">${esc(final.posture)}</div>
      <p class="macro-sentence">${esc(final.macro)}</p>
      <p class="final-judgment">${esc(final.judgment)}</p>
    </div>
    <div class="decision-side">
      <article><span>Top Trim Watch</span><b>${esc(final.topTrim)}</b></article>
      <article><span>Top Add Watch</span><b>${esc(final.topAdd)}</b></article>
      <article><span>Holding Update</span><b>${esc(final.holdingUpdate)}</b></article>
    </div>
  </section>`;
}

function riskOfficerStrip() {
  const tiles = [
    ['Strongest', risk.strongest, rationaleForTicker(String(risk.strongest).split(/[\/\s]/)[0], 'Verify live strength before adding concentration.')],
    ['Weakest', risk.weakest, rationaleForTicker(String(risk.weakest).split(/[\/\s]/)[0], 'Weakness requires source validation.')],
    ['Highest Risk', risk.highestRisk, rationaleForTicker(risk.highestRisk, 'Risk-control priority.')],
    ['Watch Trigger', 'Macro / Risk', risk.trigger]
  ];
  return `<section class="module"><div class="module-head"><p class="caption">Risk Officer</p><h1>Review before action</h1></div><div class="risk-strip">${tiles.map(([label, ticker, rationale]) => `<article class="risk-tile"><span>${esc(label)}</span><div><b>${esc(ticker)}</b><em class="pill ${signalClass(signalForTicker(String(ticker).split(/[\/\s]/)[0]))}">${esc(signalForTicker(String(ticker).split(/[\/\s]/)[0]))}</em></div><p>${esc(rationale)}</p></article>`).join('')}</div></section>`;
}

function holdingsMatrix() {
  return `<section id="holdings-section" class="module"><div class="module-head"><p class="caption">Holdings Matrix</p><h1>All current holdings</h1></div><div class="holdings-table-wrap"><table class="holdings-matrix"><thead><tr><th>Ticker</th><th>Weight</th><th>Price</th><th>Day%</th><th>5D%</th><th>1M%</th><th>Signal</th><th>Rationale</th></tr></thead><tbody>${holdings.map(h => `<tr><td><b>${esc(h.Ticker)}</b><small>${esc(h.Role)}</small></td><td>${weightBar(h.Weight)}</td><td class="num">$${fmt(h.Price)}</td><td class="num ${pctClass(h.Day)}">${fmt(h.Day)}%</td><td class="num ${pctClass(h['5D'])}">${fmt(h['5D'])}%</td><td class="num ${pctClass(h['1M'])}">${fmt(h['1M'])}%</td><td><span class="pill ${signalClass(h.Signal)}">${esc(normalizeSignal(h.Signal))}</span></td><td class="rationale">${esc(h.Rationale)}</td></tr>`).join('')}</tbody></table></div></section>`;
}

function opportunityCards() {
  return `<section id="opportunities-section" class="module"><div class="module-head"><p class="caption">Opportunity Scout</p><h1>Five candidates for deeper research</h1></div><div class="opportunity-cards">${opportunities.map(o => {
    const quote = tapeBySymbol[o.ticker] || {};
    return `<article class="op-card"><div class="op-top"><div><b>${esc(o.ticker)}</b><small>$${fmt(quote.Price)} · <span class="${pctClass(quote['Day %'])}">${fmt(quote['Day %'])}%</span></small></div><span class="pill ${signalClass(o.signal)}">${esc(o.signal)}</span></div><p class="op-thesis">${esc(o.thesis)}</p><div class="op-lists"><div><span>Confirm before add</span><ul>${o.confirm.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div><span>Key risks</span><ul>${o.risks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></div></article>`;
  }).join('')}</div></section>`;
}

function macroStrip() {
  const dgs = ['DGS2', 'DGS10', 'DGS30'].map(k => rateBySeries[k]?.Value);
  const vix = tapeBySymbol['^VIX']?.Price;
  const hy = rateBySeries.BAMLH0A0HYM2?.Value;
  const breakeven = rateBySeries.T10YIE?.Value;
  const fed = rateBySeries.DFF?.Value;
  const dxy = tapeBySymbol['DX-Y.NYB'];
  return `<section id="market-section" class="module"><div class="module-head"><p class="caption">Macro Strip</p><h1>Rates, credit, volatility, liquidity</h1></div><div class="macro-strip"><article><span>2Y / 10Y / 30Y</span>${miniLine(dgs, 'rate-line')}<b>${dgs.map(v => `${fmt(v)}%`).join(' / ')}</b></article><article><span>HY OAS</span><div class="gauge"><i style="width:${Math.min(100, (num(hy) || 0) * 16)}%"></i></div><b>${fmt(hy)}%</b></article><article><span>VIX Dial</span><div class="dial" style="--dial:${Math.min(100, (num(vix) || 0) * 3)}"><b>${fmt(vix)}</b></div></article><article><span>Breakeven</span>${miniLine([2.1, 2.3, breakeven], 'breakeven-line')}<b>${fmt(breakeven)}%</b></article><article><span>Fed Funds</span><b class="big-number">${fmt(fed)}%</b></article><article><span>DXY</span>${miniLine([num(dxy?.['3M %']) || 0, num(dxy?.['1M %']) || 0, num(dxy?.['5D %']) || 0, num(dxy?.['Day %']) || 0], 'dxy-line')}<b>${fmt(dxy?.Price)}</b></article></div></section>`;
}

function marketTape() {
  return `<section class="module market-tape-module"><div class="module-head"><p class="caption">Market Tape</p><h1>Cross-asset tape</h1></div><div class="market-tape">${tape.map(t => `<article><span>${esc(t.Symbol)}</span><b>$${fmt(t.Price)}</b><em class="${pctClass(t['Day %'])}">${fmt(t['Day %'])}%</em></article>`).join('')}</div></section>`;
}

function sourcesFooter() {
  return `<footer class="footer"><span>Research and education only. No brokerage connection.</span><a class="footer-button" href="outputs/live-capital-radar.md">Download archival report (.md)</a></footer>`;
}

const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>OpenClaw Capital Radar</title><link rel="stylesheet" href="assets/capital-radar.css"/><link rel="stylesheet" href="assets/phase-c-dashboard.css"/></head><body><main class="dashboard"><header class="site-header"><div class="brand">OpenClaw Capital Radar</div><nav><a href="#brief">Brief</a><a href="#holdings-section">Holdings</a><a href="#opportunities-section">Opportunities</a><a href="#market-section">Macro</a></nav></header>${heroDecisionPanel()}${riskOfficerStrip()}${holdingsMatrix()}${opportunityCards()}${macroStrip()}${marketTape()}${sourcesFooter()}</main></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log(`built phase-c dashboard from ${path.relative(root, reportPath)}`);
