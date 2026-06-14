const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const mapPath = path.join(root, 'outputs', 'portfolio-thesis-coverage-map.json');
if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
if (!fs.existsSync(mapPath)) throw new Error('portfolio thesis coverage map missing');
const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const summary = data.summary || {};
const holdings = Array.isArray(data.holdings) ? data.holdings : [];
const weakest = holdings.slice().sort((a,b) => {
  const rank = { constrained: 0, thin: 1, partial: 2, underwritten: 3 };
  return (rank[a.coverageState] ?? 9) - (rank[b.coverageState] ?? 9) || a.thesisCoverageScore - b.thesisCoverageScore;
}).slice(0, 6);
const css = `<style>.thesis-coverage{background:#ffffff}.coverage-summary{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:0;border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-bottom:22px}.coverage-summary article{padding:16px;border-right:1px solid var(--rule);border-bottom:1px solid var(--rule)}.coverage-summary span{display:block;color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.12em}.coverage-summary b{display:block;font-size:32px;letter-spacing:-.05em;font-weight:500;margin-top:8px}.coverage-table{width:100%;border-collapse:collapse}.coverage-table th,.coverage-table td{border-top:1px solid var(--rule);padding:12px;text-align:left;vertical-align:top}.coverage-table th{color:var(--muted);font-size:12px;text-transform:uppercase;letter-spacing:.12em}.coverage-pill{display:inline-flex;border:1px solid var(--rule);border-radius:999px;padding:4px 9px;font-size:12px}.coverage-pill.underwritten{color:var(--green)}.coverage-pill.constrained{color:var(--red)}.coverage-pill.partial{color:var(--warn)}.coverage-pill.thin{color:var(--red)}.coverage-score{font-size:24px;letter-spacing:-.04em}.missing-list{color:var(--muted);font-size:13px}</style>`;
const html = `<section id="thesis-coverage" class="panel thesis-coverage"><div class="section-head"><div><p class="eyebrow">Thesis Coverage</p><h2>Underwritten vs constrained holdings</h2></div><a class="button" href="outputs/portfolio-thesis-coverage-map.json">Open coverage JSON</a></div><div class="coverage-summary"><article><span>Average coverage</span><b>${esc(summary.averageCoverageScore ?? '—')}%</b></article><article><span>Underwritten</span><b>${esc(summary.underwritten ?? 0)}</b></article><article><span>Constrained</span><b>${esc(summary.constrained ?? 0)}</b></article><article><span>Partial</span><b>${esc(summary.partial ?? 0)}</b></article><article><span>Human review</span><b>${esc(summary.humanReviewRequired ?? 0)}</b></article><article><span>Blocked for action</span><b>${esc(summary.blockedForAction ?? 0)}</b></article></div><div class="table-wrap"><table class="coverage-table"><thead><tr><th>Ticker</th><th>Score</th><th>State</th><th>Missing / breach</th><th>Next step</th></tr></thead><tbody>${weakest.map(h => `<tr><td><a href="pages/${esc(String(h.ticker).toLowerCase())}.html#strategy-interpreter">${esc(h.ticker)}</a></td><td><span class="coverage-score">${esc(h.thesisCoverageScore)}%</span><br><small>required ${esc(h.minimumRequired)}%</small></td><td><span class="coverage-pill ${esc(h.coverageState)}">${esc(h.coverageState)}</span></td><td class="missing-list">${(h.missingEvidence || []).map(m => esc(m.category)).join(', ') || 'None flagged'}</td><td>${esc(h.nextStep)}</td></tr>`).join('')}</tbody></table></div></section>`;
let index = fs.readFileSync(indexPath, 'utf8');
index = index.replace(/<style>\.thesis-coverage[\s\S]*?<\/style>/, '');
index = index.replace(/<section id="thesis-coverage"[\s\S]*?<section id="strategy-command"/, '<section id="strategy-command"');
index = index.replace('</head>', `${css}</head>`);
if (index.includes('<section id="strategy-command"')) {
  index = index.replace('<section id="strategy-command"', `${html}<section id="strategy-command"`);
} else if (index.includes('<section id="portfolio-exposure"')) {
  index = index.replace('<section id="portfolio-exposure"', `${html}<section id="portfolio-exposure"`);
} else {
  index = index.replace('<section id="holdings-section"', `${html}<section id="holdings-section"`);
}
fs.writeFileSync(indexPath, index);
console.log(`injected thesis coverage home section with ${weakest.length} priority rows`);
