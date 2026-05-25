const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const indexPath = path.join(root, 'index.html');
const statePath = path.join(root, 'outputs', 'data-refresh-state.json');

function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function readJson(p, fallback = {}) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}
function fmt(ts) {
  if (!ts || /missing|pending|wired/i.test(String(ts))) return String(ts || 'missing');
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return String(ts);
  return d.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}
function tone(status) {
  const s = String(status || '').toLowerCase();
  if (s.includes('fresh')) return 'fresh';
  if (s.includes('partial') || s.includes('aging')) return 'partial';
  if (s.includes('stale') || s.includes('missing')) return 'stale';
  return 'partial';
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
const state = readJson(statePath, { rows: [], coverage: {}, blockers: [] });
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/\s*<section id="data-refresh-section"[\s\S]*?<\/section>/, '');

const c = state.coverage || {};
const cards = (state.rows || []).map(row => `
      <article class="freshness-card ${tone(row.status)}">
        <div><span>${esc(row.label)}</span><strong>${esc(fmt(row.value))}</strong></div>
        <em>${esc(String(row.status || 'unknown').toUpperCase())}${row.ageHours != null ? ` · ${esc(row.ageHours)}h old` : ''}</em>
        <p>${esc(row.detail)}</p>
        <small>${esc(row.source)}</small>
      </article>`).join('');
const blockers = (state.blockers || []).slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('');
const section = `
    <section id="data-refresh-section" class="panel data-refresh-panel">
      <div class="section-head">
        <div>
          <p class="eyebrow">Data refresh / evidence coverage</p>
          <h2>What data is this page actually using?</h2>
        </div>
        <p class="data-refresh-read">This strip is intentionally factual: before Capital Radar speaks confidently, it shows what was refreshed, what is partial, and what is still missing.</p>
      </div>
      <div class="freshness-grid">${cards}
      </div>
      <div class="coverage-strip">
        <article><span>Holdings covered</span><b>${esc(c.holdings ?? '—')}</b></article>
        <article><span>Thesis underwritten</span><b>${esc(c.thesisUnderwritten ?? '—')}</b></article>
        <article><span>Thesis constrained</span><b>${esc(c.thesisConstrained ?? '—')}</b></article>
        <article><span>Opportunity packets</span><b>${esc(c.opportunityPackets ?? '—')}</b></article>
        <article><span>Evidence-blocked packets</span><b>${esc(c.opportunityBlockedByEvidence ?? '—')}</b></article>
        <article><span>Capital allowed now</span><b>${esc(c.capitalAllowed ?? '—')}</b></article>
      </div>
      <div class="evidence-blockers"><span>Current evidence blockers</span><ul>${blockers}</ul></div>
    </section>`;

if (html.includes('</header>')) html = html.replace('</header>', `</header>${section}`);
else html = html.replace(/(<section\b[^>]*id=["']kostolany-egg-section["'])/, `${section}\n    $1`);

const style = `<style id="data-refresh-style">
.data-refresh-panel{background:linear-gradient(180deg,rgba(251,250,246,.42),rgba(251,250,246,.16));border-top:1px solid var(--rule)}
.data-refresh-read{max-width:720px;color:var(--muted)}
.freshness-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:18px}
.freshness-card{border:1px solid var(--rule);border-radius:18px;background:rgba(251,250,246,.34);padding:15px;min-width:0;box-shadow:0 12px 36px rgba(36,35,31,.035)}
.freshness-card>div{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.freshness-card span,.coverage-strip span,.evidence-blockers span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.09em}.freshness-card strong{display:block;font-size:15px;line-height:1.25;margin-top:8px;overflow-wrap:anywhere}.freshness-card em{display:inline-block;margin-top:12px;font-style:normal;font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--rule);border-radius:999px;padding:4px 7px}.freshness-card p{margin-top:10px;font-size:12px;line-height:1.38;color:rgba(36,35,31,.76)}.freshness-card small{display:block;margin-top:10px;font-size:11px;color:var(--muted);overflow-wrap:anywhere}.freshness-card.fresh{border-color:rgba(47,111,78,.34)}.freshness-card.fresh em{color:var(--green);border-color:rgba(47,111,78,.34)}.freshness-card.partial{border-color:rgba(138,106,44,.38)}.freshness-card.partial em{color:var(--warn);border-color:rgba(138,106,44,.38)}.freshness-card.stale{border-color:rgba(159,63,53,.42)}.freshness-card.stale em{color:var(--red);border-color:rgba(159,63,53,.42)}
.coverage-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:14px}.coverage-strip article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:13px;background:rgba(251,250,246,.22)}.coverage-strip b{display:block;font-size:26px;line-height:1;margin-top:9px;font-weight:500;letter-spacing:-.04em}
.evidence-blockers{margin-top:14px;border:1px solid rgba(159,63,53,.28);border-radius:18px;background:rgba(159,63,53,.055);padding:14px}.evidence-blockers ul{margin:9px 0 0;padding-left:18px;color:rgba(36,35,31,.78);font-size:13px;line-height:1.45}
@media(max-width:1100px){.freshness-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.coverage-strip{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:680px){.freshness-grid,.coverage-strip{grid-template-columns:1fr}.freshness-card>div{display:block}}
</style>`;
if (!html.includes('id="data-refresh-style"')) html = html.replace('</head>', `${style}\n</head>`);
fs.writeFileSync(indexPath, html);
console.log('injected data refresh / evidence coverage strip');
