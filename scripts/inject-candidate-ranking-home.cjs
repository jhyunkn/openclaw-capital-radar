'use strict';
const fs   = require('fs');
const path = require('path');

const root      = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');

function read(rel, fb = null) {
  try { return JSON.parse(fs.readFileSync(path.join(root, rel), 'utf8')); } catch { return fb; }
}
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const ranking = read('outputs/candidate-ranking.json');
if (!ranking) { console.log('candidate-ranking.json missing — skipping inject'); process.exit(0); }

const { top3, tier_a, tier_b, tier_c, tier_d, summary } = ranking;
const topCandidates = (tier_a.length >= 3 ? tier_a : [...tier_a, ...tier_b]).slice(0, 3);

function tierBadge(tier) {
  const colors = { A: 'good', B: 'warn', C: '', D: 'bad' };
  return `<span class="crank-tier crank-tier-${tier} ${colors[tier] || ''}">${esc(tier)}</span>`;
}

function newsAlert(c) {
  if (!c.high_materiality_news) return '';
  return `<div class="crank-news-alert"><b>NEWS</b> ${esc(c.high_materiality_news.latest?.slice(0, 70))}…</div>`;
}

function topCard(c) {
  return `<article class="crank-top-card">
    <div class="crank-top-head">
      ${tierBadge(c.tier)}
      <h3>${esc(c.ticker)}</h3>
      <div class="crank-score-wrap"><span>Score</span><b>${c.adjusted_score}</b></div>
    </div>
    <p class="crank-name">${esc(c.name)}</p>
    <div class="crank-signals">${c.fundamental_signals.map(s => `<span>${esc(s)}</span>`).join('')}</div>
    ${newsAlert(c)}
    <div class="crank-gate"><span>Next gate</span><b>${esc(c.next_gate)}</b></div>
    <p class="crank-why">${esc((c.why_this_ticker || '').slice(0, 120))}${c.why_this_ticker?.length > 120 ? '…' : ''}</p>
  </article>`;
}

function rankRow(c, rank) {
  const news = c.high_materiality_news ? `<span class="crank-news-pill">NEWS</span>` : '';
  return `<tr class="crank-row crank-tier-${c.tier}">
    <td class="crank-rank">${rank}</td>
    <td class="crank-ticker"><b>${esc(c.ticker)}</b>${news}</td>
    <td>${tierBadge(c.tier)}</td>
    <td class="crank-adj"><b>${c.adjusted_score}</b></td>
    <td class="crank-base muted">${c.opportunity_score}</td>
    <td class="crank-bonus">${c.fundamental_bonus >= 0 ? '+' : ''}${c.fundamental_bonus}</td>
    <td class="crank-signals-cell">${c.fundamental_signals.slice(0, 3).join(' · ')}</td>
    <td class="crank-gate muted">${esc(c.next_gate)}</td>
  </tr>`;
}

const css = `<style id="candidate-ranking-style">
.candidate-ranking{margin-bottom:0}.crank-head-row{display:flex;justify-content:space-between;align-items:end;flex-wrap:wrap;gap:14px;margin-bottom:18px}
.crank-tier-summary{display:flex;gap:8px;flex-wrap:wrap}.crank-tier-chip{font-size:11px;border:1px solid var(--rule);border-radius:999px;padding:5px 9px;display:flex;gap:5px;align-items:center}
.crank-tier-chip b{font-weight:700}.crank-tier-A b{color:var(--green)}.crank-tier-B b{color:var(--warn)}.crank-tier-D b{color:var(--red)}
.crank-top-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:10px;margin-bottom:20px}
.crank-top-card{border:1px solid var(--rule);border-radius:16px;background:rgba(251,250,246,.16);padding:14px}
.crank-top-head{display:flex;align-items:center;gap:8px;margin-bottom:6px}.crank-top-head h3{font-size:26px;margin:0;flex:1;letter-spacing:-.04em}
.crank-score-wrap{text-align:right}.crank-score-wrap span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}
.crank-score-wrap b{display:block;font-size:24px;letter-spacing:-.04em;font-weight:500}
.crank-name{font-size:11px;color:var(--muted);margin:0 0 8px}.crank-signals{display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px}
.crank-signals span{font-size:10px;border:1px solid var(--rule);border-radius:999px;padding:3px 7px;color:var(--muted);background:rgba(251,250,246,.10)}
.crank-gate{display:flex;gap:6px;align-items:center;margin-bottom:6px}.crank-gate span{color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}
.crank-gate b{font-size:12px}.crank-why{font-size:11px;color:var(--muted);line-height:1.4;margin:0}
.crank-news-alert{font-size:10px;border:1px solid rgba(159,63,53,.38);border-radius:8px;background:rgba(159,63,53,.06);padding:5px 8px;margin-bottom:8px;color:rgba(36,35,31,.80)}
.crank-news-alert b{color:var(--red);margin-right:4px}
.crank-tier{display:inline-flex;font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;border:1px solid var(--rule);letter-spacing:.06em;margin-right:4px}
.crank-tier-A{border-color:rgba(47,111,78,.4);background:rgba(47,111,78,.08);color:var(--green)}
.crank-tier-B{border-color:rgba(174,124,44,.4);background:rgba(174,124,44,.08);color:var(--warn)}
.crank-tier-C{border-color:var(--rule);color:var(--muted)}
.crank-tier-D{border-color:rgba(159,63,53,.4);background:rgba(159,63,53,.06);color:var(--red)}
.crank-table-wrap{border:1px solid var(--rule);border-radius:12px;overflow:auto;margin-top:14px}
.crank-table{width:100%;border-collapse:collapse;font-size:12px}
.crank-table th{padding:9px 12px;border-bottom:1px solid var(--rule);text-align:left;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em;background:rgba(251,250,246,.18)}
.crank-table td{padding:9px 12px;border-bottom:1px solid var(--rule);vertical-align:middle}
.crank-table tr:last-child td{border-bottom:0}.crank-rank{color:var(--muted)}.crank-ticker b{font-size:14px}
.crank-adj b{font-size:15px;font-weight:500}.crank-base,.crank-gate{color:var(--muted)!important}
.crank-bonus{color:var(--green);font-weight:600}.crank-signals-cell{color:var(--muted);font-size:11px}
.crank-news-pill{display:inline-block;font-size:8px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(159,63,53,.12);color:var(--red);border:1px solid rgba(159,63,53,.32);margin-left:4px;vertical-align:middle}
@media(max-width:760px){.crank-top-cards{grid-template-columns:1fr}.crank-table th:nth-child(n+5),.crank-table td:nth-child(n+5){display:none}}
</style>`;

const html = `<div class="candidate-ranking" data-artifact="candidate-ranking">
  <div class="crank-head-row">
    <div>
      <p class="eyebrow">Ranked by fundamental quality</p>
      <h2>Candidate funnel</h2>
      <p class="op-stance">Adjusted score = opportunity score + XBRL fundamental bonus. Tier A requires positive FCF and score ≥80. Promotion still requires risk budget, evidence gates, and human review.</p>
    </div>
    <div class="crank-tier-summary">
      <div class="crank-tier-chip crank-tier-A"><b>${summary.tier_a}</b><span>Tier A</span></div>
      <div class="crank-tier-chip crank-tier-B"><b>${summary.tier_b}</b><span>Tier B</span></div>
      <div class="crank-tier-chip crank-tier-C"><b>${summary.tier_c}</b><span>Tier C</span></div>
      <div class="crank-tier-chip crank-tier-D"><b>${summary.tier_d}</b><span>Tier D</span></div>
    </div>
  </div>
  <div class="crank-top-cards">${topCandidates.map(topCard).join('')}</div>
  <div class="crank-table-wrap"><table class="crank-table">
    <thead><tr><th>#</th><th>Ticker</th><th>Tier</th><th>Adj</th><th>Base</th><th>Bonus</th><th>Fundamental signals</th><th>Next gate</th></tr></thead>
    <tbody>${ranking.ranked.map((c, i) => rankRow(c, i + 1)).join('')}</tbody>
  </table></div>
</div>`;

let index = fs.readFileSync(indexPath, 'utf8');
// Clean previous injection
index = index.replace(/<style id="candidate-ranking-style">[\s\S]*?<\/style>/, '');
index = index.replace(/<div class="candidate-ranking"[\s\S]*?<\/div>\s*(?=<section|<div class="section-head"|<\/section)/, '');
index = index.replace('</head>', `${css}</head>`);

// Insert inside the opportunities section, right after its opening section-head
const anchor = '<section id="opportunities-section"';
if (index.includes(anchor)) {
  // Find the section and insert after the section-head div
  const idx = index.indexOf(anchor);
  const headEnd = index.indexOf('</div>', index.indexOf('<div class="section-head"', idx)) + 6;
  index = index.slice(0, headEnd) + '\n' + html + '\n' + index.slice(headEnd);
} else {
  console.warn('opportunities-section not found — appending before </main>');
  index = index.replace('</main>', `${html}</main>`);
}

fs.writeFileSync(indexPath, index);
console.log(`injected candidate ranking: ${summary.tier_a} tier-A, ${summary.tier_b} tier-B, ${summary.tier_c} tier-C, ${summary.tier_d} tier-D`);
