const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const paths = [path.join(root, 'data', 'report-state.live.json'), path.join(root, 'public', 'data', 'report-state.live.json')];
for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  const state = JSON.parse(fs.readFileSync(p, 'utf8'));
  const candidates = Array.isArray(state.strategy?.opportunityScout) ? state.strategy.opportunityScout : [];
  if (candidates.length) {
    state.opportunityScout = {
      method: 'Generated from active market force fields and local public-data snapshot; candidates remain research-only until evidence gates pass.',
      candidates,
      requiredScreens: [
        'quality compounders after valuation reset',
        'AI infrastructure picks-and-shovels',
        'cash-flow durable cyclicals',
        'revision inflections',
        'special situations with clear downside'
      ],
      promotionRule: 'Promote only with source evidence, add zone, invalidation, portfolio role, and risk budget.',
      runMode: 'DEGRADED_LOCAL_AUDIT_NO_WEB_SEARCH'
    };
  }
  state.meta = state.meta || {};
  state.meta.operationalAuditMode = 'DEGRADED_LOCAL_AUDIT_NO_WEB_SEARCH';
  state.meta.operationalAuditNote = 'web_search unavailable for this run; dashboard was audited from local/public-data snapshot and must not claim fresh external/news research.';
  fs.writeFileSync(p, JSON.stringify(state, null, 2));
}
console.log('normalized operational state opportunity scout + degraded audit note');
