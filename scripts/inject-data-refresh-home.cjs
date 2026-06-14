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
function readiness(row) {
  const s = tone(row.status);
  if (s === 'fresh') return 100;
  if (s === 'partial') return 56;
  return 18;
}

if (!fs.existsSync(indexPath)) throw new Error('index.html missing');
const state = readJson(statePath, { rows: [], coverage: {}, blockers: [] });
let html = fs.readFileSync(indexPath, 'utf8');
html = html.replace(/\s*<section id="data-refresh-section"[\s\S]*?<\/section>/, '');

const rows = state.rows || [];
const c = state.coverage || {};
const freshCount = rows.filter(row => tone(row.status) === 'fresh').length;
const partialCount = rows.filter(row => tone(row.status) === 'partial').length;
const staleCount = rows.filter(row => tone(row.status) === 'stale').length;
const readinessScore = rows.length ? Math.round(rows.reduce((sum, row) => sum + readiness(row), 0) / rows.length) : 0;
const decisionMode = (Number(c.capitalAllowed || 0) > 0 && staleCount === 0) ? 'Review candidates only' : 'Research-only / no capital adds';
const latest = rows.map(r => Date.parse(r.value || '')).filter(Number.isFinite).sort((a, b) => b - a)[0];
const latestLabel = latest ? fmt(new Date(latest).toISOString()) : 'no successful refresh found';

const sourceRows = rows.map(row => `
        <tr class="source-row ${tone(row.status)}">
          <th scope="row">${esc(row.label)}</th>
          <td><strong>${esc(String(row.status || 'unknown').toUpperCase())}</strong>${row.ageHours != null ? ` <span>${esc(row.ageHours)}h old</span>` : ''}</td>
          <td>${esc(fmt(row.value))}</td>
          <td>${esc(row.detail)}</td>
          <td>${esc(row.source)}</td>
        </tr>`).join('');
const blockers = (state.blockers || []).slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('');
const section = `
    <section id="data-refresh-section" class="panel data-refresh-panel">
      <div class="section-head data-refresh-head">
        <div>
          <p class="eyebrow">Data refresh / evidence coverage</p>
          <h2>Can Capital Radar trust itself right now?</h2>
        </div>
        <p class="data-refresh-read">Before any strategy read, this section shows the sources, freshness, missing evidence, and permission state currently constraining the dashboard.</p>
      </div>
      <div class="decision-summary-grid">
        <article>
          <span>Current decision mode</span>
          <strong>${esc(decisionMode)}</strong>
          <p>${esc(c.capitalAllowed ?? 0)} capital actions allowed · latest source update ${esc(latestLabel)}</p>
        </article>
        <article>
          <span>Source readiness</span>
          <strong>${esc(readinessScore)}%</strong>
          <p>${freshCount} fresh · ${partialCount} partial/aging · ${staleCount} missing/stale</p>
        </article>
        <article>
          <span>Evidence blocked</span>
          <strong>${esc(c.opportunityBlockedByEvidence ?? '—')} / ${esc(c.opportunityPackets ?? '—')}</strong>
          <p>Packets remain research-only until source coverage and field-level evidence improve.</p>
        </article>
      </div>
      <div class="coverage-strip evidence-scoreboard">
        <article><span>Holdings covered</span><b>${esc(c.holdings ?? '—')}</b></article>
        <article><span>Thesis underwritten</span><b>${esc(c.thesisUnderwritten ?? '—')}</b></article>
        <article><span>Thesis constrained</span><b>${esc(c.thesisConstrained ?? '—')}</b></article>
        <article><span>Opportunity packets</span><b>${esc(c.opportunityPackets ?? '—')}</b></article>
        <article><span>Evidence-blocked</span><b>${esc(c.opportunityBlockedByEvidence ?? '—')}</b></article>
        <article><span>Capital allowed now</span><b>${esc(c.capitalAllowed ?? '—')}</b></article>
      </div>
      <div class="source-ledger-table-wrap">
        <table class="source-ledger-table">
          <thead><tr><th>Source layer</th><th>Status</th><th>Last refreshed</th><th>What it covers</th><th>Source</th></tr></thead>
          <tbody>${sourceRows}
          </tbody>
        </table>
      </div>
      <div class="evidence-blockers"><span>Current evidence blockers</span><ul>${blockers}</ul></div>
    </section>`;

if (html.includes('</header>')) html = html.replace('</header>', `</header>${section}`);
else html = html.replace(/(<section\b[^>]*id=["']kostolany-egg-section["'])/, `${section}\n    $1`);

const style = `<style id="data-refresh-style">
.data-refresh-panel{border-top:1px solid var(--rule);background:#ffffff}
.data-refresh-head{border-bottom:1px solid var(--rule);padding-bottom:24px;margin-bottom:0}.data-refresh-read{max-width:690px;color:var(--muted);line-height:1.45}
.decision-summary-grid{display:grid;grid-template-columns:1.25fr .8fr .95fr;border-left:1px solid var(--rule);border-top:1px solid var(--rule);margin-top:24px}.decision-summary-grid article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:18px 18px 20px;background:#ffffff}.decision-summary-grid span,.coverage-strip span,.evidence-blockers span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.10em}.decision-summary-grid strong{display:block;margin-top:12px;font-size:clamp(24px,2.3vw,38px);line-height:1;letter-spacing:-.05em;font-weight:500}.decision-summary-grid p{margin-top:12px;color:rgba(36,35,31,.66);font-size:13px;line-height:1.45;max-width:520px}
.coverage-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.coverage-strip article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:14px;background:#ffffff}.coverage-strip b{display:block;font-size:28px;line-height:1;margin-top:10px;font-weight:500;letter-spacing:-.04em}
.source-ledger-table-wrap{margin-top:18px;border:1px solid var(--rule);overflow:auto;background:#ffffff}.source-ledger-table{width:100%;border-collapse:collapse;min-width:980px}.source-ledger-table th,.source-ledger-table td{padding:13px 14px;border-bottom:1px solid var(--rule);text-align:left;vertical-align:top;font-size:12px;line-height:1.35}.source-ledger-table thead th{color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.10em;font-weight:500;background:#ffffff}.source-ledger-table tbody th{font-size:13px;font-weight:500}.source-ledger-table td{color:rgba(36,35,31,.70)}.source-ledger-table td strong{font-size:10px;letter-spacing:.08em;font-weight:600}.source-ledger-table td span{color:var(--muted);font-size:11px}.source-row.fresh td strong{color:var(--green)}.source-row.partial td strong{color:var(--warn)}.source-row.stale td strong{color:var(--red)}
.evidence-blockers{margin-top:18px;border:1px solid var(--rule);background:#ffffff;padding:16px}.evidence-blockers ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 28px;margin:10px 0 0;padding-left:18px;color:rgba(36,35,31,.74);font-size:13px;line-height:1.45}
@media(max-width:1100px){.decision-summary-grid{grid-template-columns:1fr}.coverage-strip{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media(max-width:680px){.coverage-strip,.evidence-blockers ul{grid-template-columns:1fr}.decision-summary-grid strong{font-size:26px}}
</style>`;
if (!html.includes('id="data-refresh-style"')) html = html.replace('</head>', `${style}\n</head>`);
fs.writeFileSync(indexPath, html);
console.log('injected evidence freshness table without new graphic language');
