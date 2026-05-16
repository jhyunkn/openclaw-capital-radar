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
function tone(value) {
  const n = num(value);
  return !Number.isFinite(n) ? '' : n >= 0 ? 'good' : 'bad';
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
function signalClass(signal) {
  const s = String(signal || '').toUpperCase();
  if (s.includes('EXIT')) return 'bad';
  if (s.includes('TRIM')) return 'bad';
  if (s.includes('INVESTIGATE')) return 'warn';
  if (s.includes('ADD')) return 'blue';
  if (s.includes('WATCH')) return 'warn';
  return 'good';
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
const final = { posture: bulletValue(finalBlock, 'Market Posture'), macro: bulletValue(finalBlock, 'Most Important Macro Signal'), holdingUpdate: bulletValue(finalBlock, 'Most Important Holding Update'), strongest: bulletValue(finalBlock, 'Strongest Current Holding'), weakest: bulletValue(finalBlock, 'Weakest Current Holding'), highestRisk: bulletValue(finalBlock, 'Highest-Risk Position'), topAdd: bulletValue(finalBlock, 'Top Add Watch'), topTrim: bulletValue(finalBlock, 'Top Trim Watch'), judgment: bulletValue(finalBlock, 'Final Judgment') };
const risk = { highestRisk: bulletValue(riskBlock, 'Highest-risk position') || final.highestRisk, weakest: bulletValue(riskBlock, 'Weakest holding') || final.weakest, strongest: bulletValue(riskBlock, 'Strongest holding') || final.strongest, trigger: (riskBlock.match(/^- (.+)$/m) || [null, 'Levered products can decay even if the thesis is directionally right.'])[1] };
const holdingByTicker = Object.fromEntries(holdings.map(h => [h.Ticker, h]));
const tapeBySymbol = Object.fromEntries(tape.map(t => [t.Symbol, t]));
const rateBySeries = Object.fromEntries(rates.map(r => [r.Series, r]));
function signalForTicker(ticker) { return holdingByTicker[ticker]?.Signal || opportunities.find(o => o.ticker === ticker)?.signal || 'WATCH'; }
function spark(values) { const vals = values.map(num).filter(Number.isFinite); if (vals.length < 2) return '<svg class="spark" viewBox="0 0 100 52"><polyline points="0,42 100,42" fill="none" stroke="#d7a84c" stroke-width="2"/></svg>'; const min = Math.min(...vals), max = Math.max(...vals), span = max - min || 1; const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * 100},${46 - ((v - min) / span) * 40 + 3}`).join(' '); return `<svg class="spark" viewBox="0 0 100 52" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="#d7a84c" stroke-width="2" vector-effect="non-scaling-stroke"/><line x1="0" y1="48" x2="100" y2="48" stroke="#312b20" opacity=".18"/></svg>`; }
function hero() { return `<header class="hero"><div><p class="eyebrow">Live investing blueprint · market landscape intelligence</p><h1>Capital Radar</h1><p class="lede">${esc(final.judgment)}</p><div class="lens-strip"><span>Fact</span><span>Inference</span><span>Uncertainty</span><span>Human review</span></div></div><aside class="status"><span>Market Posture</span><strong class="${signalClass(final.posture)}">${esc(final.posture)}</strong><span>${esc(final.macro)}</span><span>Top trim: ${esc(final.topTrim)}<br>Top add: ${esc(final.topAdd)}</span></aside></header>`; }
function decisionBrief() { return `<section id="brief" class="brief-grid"><article class="panel decision-card"><p class="eyebrow">Executive brief</p><h2>Today’s read</h2><p class="judgment">${esc(final.macro)}</p><div class="brief-list"><article class="brief-item"><span>Market posture</span><b>${esc(final.posture)}</b></article><article class="brief-item"><span>Holding update</span><b>${esc(final.holdingUpdate)}</b></article><article class="brief-item"><span>Top trim watch</span><b>${esc(final.topTrim)}</b></article><article class="brief-item"><span>Top add watch</span><b>${esc(final.topAdd)}</b></article></div></article><aside class="panel risk-rail"><div class="section-head compact"><div><p class="eyebrow">Risk officer</p><h2>Review before action</h2></div></div><div class="rows"><div class="row"><span>Strongest</span><b>${esc(risk.strongest)}</b></div><div class="row"><span>Weakest</span><b>${esc(risk.weakest)}</b></div><div class="row"><span>Highest risk</span><b>${esc(risk.highestRisk)}</b></div><div class="row"><span>Watch trigger</span><b>${esc(risk.trigger)}</b></div></div></aside></section>`; }
function metrics() { return `<section class="grid four metrics-row"><article class="metric"><span>Market posture</span><strong>${esc(final.posture)}</strong></article><article class="metric"><span>Strongest</span><strong>${esc(final.strongest)}</strong></article><article class="metric"><span>Weakest</span><strong>${esc(final.weakest)}</strong></article><article class="metric"><span>Highest risk</span><strong>${esc(final.highestRisk)}</strong></article></section>`; }
function holdingsGrid() { return `<section id="holdings-section" class="panel"><div class="section-head"><div><p class="eyebrow">Holdings</p><h2>Position-level map</h2></div><span class="note">All 11 holdings rendered from the live report.</span></div><div class="holdings-grid">${holdings.map(h => `<article class="card"><div class="ticker"><div><b>${esc(h.Ticker)}</b><br><small>${esc(h.Role)}</small></div><div style="text-align:right"><b>$${fmt(h.Price)}</b><br><small class="${tone(h.Day)}">${fmt(h.Day)}%</small></div></div>${spark([h['5D'], h.Day, h['1M']])}<span class="signal ${signalClass(h.Signal)}">${esc(h.Signal)}</span><div class="rows"><div class="row"><span>Weight</span><b>${fmt(h.Weight)}%</b></div><div class="row"><span>5D</span><b class="${tone(h['5D'])}">${fmt(h['5D'])}%</b></div><div class="row"><span>1M</span><b class="${tone(h['1M'])}">${fmt(h['1M'])}%</b></div><div class="row"><span>Health</span><b>${esc(h.Health)}</b></div></div><p style="margin-top:14px">${esc(h.Rationale)}</p></article>`).join('')}</div></section>`; }
function opportunitiesGrid() { return `<section id="opportunities-section" class="panel"><div class="section-head"><div><p class="eyebrow">Opportunity Scout</p><h2>Research candidates</h2></div></div><div class="opportunity-grid">${opportunities.map(o => { const q = tapeBySymbol[o.ticker] || {}; return `<article class="card research-card"><div class="ticker"><div><b>${esc(o.ticker)}</b><br><small>$${fmt(q.Price)} · <span class="${tone(q['Day %'])}">${fmt(q['Day %'])}%</span></small></div><span class="signal ${signalClass(o.signal)}">${esc(o.signal)}</span></div><h3>${esc(o.thesis)}</h3><div class="evidence-box"><span>Confirm before add</span><ul>${o.confirm.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div><div class="evidence-box"><span>Key risks</span><ul>${o.risks.map(x => `<li>${esc(x)}</li>`).join('')}</ul></div></article>`; }).join('')}</div></section>`; }
function macroAndTape() { const dgs = ['DGS2', 'DGS10', 'DGS30'].map(k => rateBySeries[k]?.Value); const board = [['2Y / 10Y / 30Y', dgs.map(v => `${fmt(v)}%`).join(' / '), 'Treasury curve pressure'], ['HY OAS', `${fmt(rateBySeries.BAMLH0A0HYM2?.Value)}%`, 'Credit stress gauge'], ['VIX', fmt(tapeBySymbol['^VIX']?.Price), 'Volatility dial'], ['Breakeven', `${fmt(rateBySeries.T10YIE?.Value)}%`, 'Inflation expectation'], ['Fed Funds', `${fmt(rateBySeries.DFF?.Value)}%`, 'Policy anchor'], ['DXY', fmt(tapeBySymbol['DX-Y.NYB']?.Price), 'Dollar pressure']]; return `<section id="market-section" class="panel"><div class="section-head"><div><p class="eyebrow">Market tape</p><h2>External pressure map</h2></div></div><div class="market-board">${board.map(([label, value, note]) => `<article class="board-card"><span>${esc(label)}</span><strong>${esc(value)}</strong><p>${esc(note)}</p></article>`).join('')}</div><div class="table-wrap" style="margin-top:22px"><table class="table"><thead><tr><th>Symbol</th><th>Price</th><th>Day%</th><th>5D%</th><th>1M%</th><th>3M%</th></tr></thead><tbody>${tape.map(t => `<tr><td>${esc(t.Symbol)}</td><td>$${fmt(t.Price)}</td><td class="${tone(t['Day %'])}">${fmt(t['Day %'])}%</td><td class="${tone(t['5D %'])}">${fmt(t['5D %'])}%</td><td class="${tone(t['1M %'])}">${fmt(t['1M %'])}%</td><td class="${tone(t['3M %'])}">${fmt(t['3M %'])}%</td></tr>`).join('')}</tbody></table></div></section>`; }
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>OpenClaw Capital Radar</title><link rel="stylesheet" href="assets/capital-radar.css"/></head><body><main class="shell"><div class="topbar"><div class="brand"><span class="mark">◇</span><div>OpenClaw Capital Radar</div></div><nav class="nav"><a href="#brief">Brief</a><a href="#holdings-section">Holdings</a><a href="#opportunities-section">Opportunities</a><a href="#market-section">Market tape</a></nav><div id="generated">Static report render</div></div>${hero()}${decisionBrief()}${metrics()}${holdingsGrid()}${opportunitiesGrid()}${macroAndTape()}<footer class="footer"><span>Research and education only. No brokerage connection.</span> <a class="button" href="outputs/live-capital-radar.md">Download archival report (.md)</a></footer></main></body></html>`;
fs.writeFileSync(path.join(root, 'index.html'), html);
console.log('rebuilt homepage with editorial capital-radar visual system');
