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
const decisionMode = (Number(c.capitalAllowed || 0) > 0 && staleCount === 0) ? 'review candidates only' : 'research-only / no capital adds';
const latest = rows.map(r => Date.parse(r.value || '')).filter(Number.isFinite).sort((a, b) => b - a)[0];
const latestLabel = latest ? fmt(new Date(latest).toISOString()) : 'no successful refresh found';

const cards = rows.map(row => {
  const pct = readiness(row);
  return `
        <article class="freshness-card ${tone(row.status)}">
          <div class="freshness-card-top">
            <span>${esc(row.label)}</span>
            <em>${esc(String(row.status || 'unknown').toUpperCase())}${row.ageHours != null ? ` · ${esc(row.ageHours)}h` : ''}</em>
          </div>
          <strong>${esc(fmt(row.value))}</strong>
          <div class="source-meter"><i style="width:${pct}%"></i></div>
          <p>${esc(row.detail)}</p>
          <small>${esc(row.source)}</small>
        </article>`;
}).join('');
const blockers = (state.blockers || []).slice(0, 5).map(x => `<li>${esc(x)}</li>`).join('');
const section = `
    <section id="data-refresh-section" class="panel data-refresh-panel">
      <div class="radar-command-grid">
        <div class="radar-command-main">
          <p class="eyebrow">Data refresh / evidence coverage</p>
          <h2>Can Capital Radar trust itself right now?</h2>
          <p class="data-refresh-read">This is the cockpit layer: it separates refreshed facts from partial sources, missing evidence, and capital-action permission before any strategy prose appears.</p>
          <div class="decision-banner ${Number(c.capitalAllowed || 0) === 0 ? 'blocked' : 'review'}">
            <span>Current decision mode</span>
            <strong>${esc(decisionMode)}</strong>
            <p>${esc(c.capitalAllowed ?? 0)} capital actions allowed · ${esc(c.opportunityBlockedByEvidence ?? '—')} evidence-blocked opportunity packets · latest source update ${esc(latestLabel)}</p>
          </div>
        </div>
        <aside class="radar-readiness-card">
          <span>Source readiness</span>
          <b>${esc(readinessScore)}%</b>
          <div class="readiness-ring" style="--score:${readinessScore}"><i></i></div>
          <p>${freshCount} fresh · ${partialCount} partial/aging · ${staleCount} missing/stale</p>
        </aside>
      </div>
      <div class="coverage-strip evidence-scoreboard">
        <article><span>Holdings covered</span><b>${esc(c.holdings ?? '—')}</b></article>
        <article><span>Thesis underwritten</span><b>${esc(c.thesisUnderwritten ?? '—')}</b></article>
        <article><span>Thesis constrained</span><b>${esc(c.thesisConstrained ?? '—')}</b></article>
        <article><span>Opportunity packets</span><b>${esc(c.opportunityPackets ?? '—')}</b></article>
        <article><span>Evidence-blocked</span><b>${esc(c.opportunityBlockedByEvidence ?? '—')}</b></article>
        <article class="capital-zero"><span>Capital allowed now</span><b>${esc(c.capitalAllowed ?? '—')}</b></article>
      </div>
      <div class="freshness-grid">${cards}
      </div>
      <div class="evidence-blockers"><span>Current evidence blockers</span><ul>${blockers}</ul></div>
    </section>`;

if (html.includes('</header>')) html = html.replace('</header>', `</header>${section}`);
else html = html.replace(/(<section\b[^>]*id=["']kostolany-egg-section["'])/, `${section}\n    $1`);

const style = `<style id="data-refresh-style">
body{background:radial-gradient(circle at 18% 0%,rgba(159,63,53,.08),transparent 31%),radial-gradient(circle at 92% 12%,rgba(47,111,78,.10),transparent 29%),#f8f7f4}
.topbar{position:sticky;top:0;z-index:40;backdrop-filter:blur(18px);background:rgba(248,247,244,.82);border-bottom:1px solid rgba(36,35,31,.12)}
.hero{position:relative;overflow:hidden;border:1px solid rgba(36,35,31,.14);background:linear-gradient(135deg,#24231f 0%,#343026 58%,#514631 100%)!important;color:#fbfaf6;border-radius:30px;margin-top:18px;box-shadow:0 28px 80px rgba(36,35,31,.18)}
.hero:after{content:"";position:absolute;right:-120px;top:-150px;width:420px;height:420px;border-radius:50%;border:1px solid rgba(251,250,246,.16);box-shadow:0 0 0 60px rgba(251,250,246,.035),0 0 0 128px rgba(251,250,246,.025)}
.hero .eyebrow,.hero .lede,.hero .lens-strip span{color:rgba(251,250,246,.72)}.hero h1{color:#fbfaf6}.hero .status{background:rgba(251,250,246,.09);border-color:rgba(251,250,246,.18);color:#fbfaf6}.hero .status span{color:rgba(251,250,246,.70)}
.data-refresh-panel{margin-top:16px;background:linear-gradient(180deg,rgba(251,250,246,.96),rgba(244,239,226,.74));border:1px solid rgba(36,35,31,.14);box-shadow:0 26px 80px rgba(36,35,31,.10);position:relative;overflow:hidden}.data-refresh-panel:before{content:"";position:absolute;inset:0 0 auto 0;height:7px;background:linear-gradient(90deg,var(--green),#b69348,var(--red));opacity:.85}.radar-command-grid{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:22px;align-items:stretch}.radar-command-main h2{font-size:clamp(34px,5.4vw,72px);line-height:.9;letter-spacing:-.07em;max-width:900px;margin:8px 0 14px}.data-refresh-read{max-width:760px;color:rgba(36,35,31,.68);font-size:16px;line-height:1.45}.decision-banner{margin-top:24px;border-radius:24px;padding:18px 20px;border:1px solid rgba(36,35,31,.14);background:rgba(255,255,255,.42);display:grid;grid-template-columns:170px 1fr;gap:10px 18px;align-items:center}.decision-banner span,.radar-readiness-card span,.freshness-card span,.coverage-strip span,.evidence-blockers span{display:block;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.10em}.decision-banner strong{font-size:25px;letter-spacing:-.04em;text-transform:uppercase}.decision-banner p{grid-column:2;margin:0;color:rgba(36,35,31,.67);font-size:13px}.decision-banner.blocked{border-color:rgba(159,63,53,.30);background:rgba(159,63,53,.07)}.decision-banner.blocked strong{color:var(--red)}.decision-banner.review strong{color:var(--green)}
.radar-readiness-card{border-radius:28px;background:#24231f;color:#fbfaf6;padding:22px;display:grid;align-content:space-between;min-height:250px;box-shadow:inset 0 0 0 1px rgba(251,250,246,.10)}.radar-readiness-card span{color:rgba(251,250,246,.62)}.radar-readiness-card b{font-size:68px;line-height:.9;letter-spacing:-.08em;font-weight:500}.radar-readiness-card p{margin:0;color:rgba(251,250,246,.70);font-size:13px;line-height:1.4}.readiness-ring{height:10px;border-radius:999px;background:rgba(251,250,246,.14);overflow:hidden}.readiness-ring i{display:block;height:100%;width:calc(var(--score)*1%);background:linear-gradient(90deg,var(--red),#b69348,var(--green));border-radius:inherit}
.coverage-strip{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));border-top:1px solid var(--rule);border-left:1px solid var(--rule);margin-top:18px}.coverage-strip article{border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);padding:16px;background:rgba(251,250,246,.50)}.coverage-strip b{display:block;font-size:34px;line-height:.9;margin-top:12px;font-weight:500;letter-spacing:-.06em}.coverage-strip .capital-zero{background:rgba(159,63,53,.08)}.coverage-strip .capital-zero b{color:var(--red)}
.freshness-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:18px}.freshness-card{border:1px solid var(--rule);border-radius:22px;background:rgba(251,250,246,.55);padding:16px;min-width:0;box-shadow:0 12px 36px rgba(36,35,31,.04)}.freshness-card-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.freshness-card strong{display:block;font-size:16px;line-height:1.25;margin-top:14px;overflow-wrap:anywhere}.freshness-card em{font-style:normal;font-size:10px;letter-spacing:.08em;text-transform:uppercase;border:1px solid var(--rule);border-radius:999px;padding:4px 7px;white-space:nowrap}.freshness-card p{margin-top:12px;font-size:12px;line-height:1.38;color:rgba(36,35,31,.76)}.freshness-card small{display:block;margin-top:10px;font-size:11px;color:var(--muted);overflow-wrap:anywhere}.source-meter{height:6px;border-radius:999px;background:rgba(36,35,31,.09);margin-top:13px;overflow:hidden}.source-meter i{display:block;height:100%;border-radius:inherit}.freshness-card.fresh{border-color:rgba(47,111,78,.34)}.freshness-card.fresh em,.freshness-card.fresh span{color:var(--green)}.freshness-card.fresh .source-meter i{background:var(--green)}.freshness-card.partial{border-color:rgba(138,106,44,.38)}.freshness-card.partial em,.freshness-card.partial span{color:var(--warn)}.freshness-card.partial .source-meter i{background:#b69348}.freshness-card.stale{border-color:rgba(159,63,53,.42);background:rgba(159,63,53,.045)}.freshness-card.stale em,.freshness-card.stale span{color:var(--red)}.freshness-card.stale .source-meter i{background:var(--red)}
.evidence-blockers{margin-top:16px;border:1px solid rgba(159,63,53,.28);border-radius:22px;background:rgba(159,63,53,.055);padding:16px}.evidence-blockers ul{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:7px 24px;margin:10px 0 0;padding-left:18px;color:rgba(36,35,31,.78);font-size:13px;line-height:1.45}
@media(max-width:1100px){.radar-command-grid{grid-template-columns:1fr}.freshness-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.coverage-strip{grid-template-columns:repeat(3,minmax(0,1fr))}.radar-readiness-card{min-height:180px}}
@media(max-width:680px){.freshness-grid,.coverage-strip,.evidence-blockers ul{grid-template-columns:1fr}.freshness-card-top,.decision-banner{display:block}.decision-banner p{margin-top:8px}.radar-command-main h2{font-size:42px}}
</style>`;
if (!html.includes('id="data-refresh-style"')) html = html.replace('</head>', `${style}\n</head>`);
fs.writeFileSync(indexPath, html);
console.log('injected evidence cockpit / data refresh command surface');
