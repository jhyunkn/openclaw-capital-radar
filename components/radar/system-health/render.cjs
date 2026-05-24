const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function statusClass(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'OK') return 'good';
  if (s === 'BLOCKED' || s === 'FAILED') return 'bad';
  return 'warn';
}

function renderMetric(label, value, detail = '') {
  return `<article><span>${esc(label)}</span><b>${esc(value)}</b>${detail ? `<small>${esc(detail)}</small>` : ''}</article>`;
}

function renderSystemHealthSection(state = {}) {
  const status = state.status || 'UNKNOWN';
  const registry = state.registryPreview?.status || 'UNKNOWN';
  const deploy = state.production?.buildCommit ? String(state.production.buildCommit).slice(0, 7) : 'unknown';
  const checks = state.checks || {};
  const counts = state.counts || {};
  return `<section id="system-health-section" class="panel system-health-panel">
    <div class="section-head"><div><p class="eyebrow">System / Data Health</p><h2>Is the radar trustworthy today?</h2></div><a class="button" href="outputs/capital-radar-health-report.json">Open health report</a></div>
    <div class="health-verdict ${statusClass(status)}"><span>Radar status</span><strong>${esc(status)}</strong><small>${esc(state.verdict || 'Health report generated from current artifacts.')}</small></div>
    <div class="health-grid">
      ${renderMetric('Registry preview', registry, state.registryPreview?.report || '')}
      ${renderMetric('Build commit', deploy, state.production?.source || '')}
      ${renderMetric('Missing data', counts.missingDataCount ?? 0, 'must not render as zero')}
      ${renderMetric('Stale data', counts.staleDataCount ?? 0, 'time-sensitive source age')}
      ${renderMetric('Suspicious zeroes', counts.zeroValueSuspicionCount ?? 0, 'macro zero guard')}
      ${renderMetric('Legacy cleanup', checks.legacyCleanupActive ? 'ACTIVE' : 'RETIRED', checks.legacyCleanupActive ? 'migration not closed' : 'safe visual edit lane')}
    </div>
  </section>`;
}

function renderSystemHealthStyle() {
  return `<style>.system-health-panel{margin-top:18px;border-color:rgba(251,250,246,.18)}.health-verdict{display:grid;grid-template-columns:auto auto 1fr;gap:10px;align-items:center;border:1px solid var(--rule);border-radius:16px;padding:12px 14px;margin:10px 0 12px;background:rgba(251,250,246,.08)}.health-verdict span{font-size:10px;text-transform:uppercase;letter-spacing:.09em;color:var(--muted)}.health-verdict strong{font-size:18px}.health-verdict small{color:var(--muted);font-size:12px;line-height:1.3}.health-verdict.good strong{color:var(--green)}.health-verdict.warn strong{color:var(--warn)}.health-verdict.bad strong{color:var(--red)}.health-grid{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px}.health-grid article{border:1px solid var(--rule);border-radius:14px;background:rgba(251,250,246,.10);padding:10px;min-width:0}.health-grid span{display:block;color:var(--muted);font-size:9px;text-transform:uppercase;letter-spacing:.08em}.health-grid b{display:block;font-size:18px;margin-top:4px;overflow:hidden;text-overflow:ellipsis}.health-grid small{display:block;color:var(--muted);font-size:10px;margin-top:3px;line-height:1.25}@media(max-width:1000px){.health-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.health-verdict{grid-template-columns:1fr}.health-verdict strong{font-size:22px}}</style>`;
}

module.exports = { renderSystemHealthSection, renderSystemHealthStyle, statusClass };
