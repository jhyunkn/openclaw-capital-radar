const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const currentPath = path.join(root, 'outputs', 'live-reaction-state.json');
const previousPath = path.join(root, 'outputs', 'live-reaction-state.previous.json');
const outPath = path.join(root, 'outputs', 'reaction-state-delta.json');
const publicOutPath = path.join(root, 'public', 'outputs', 'reaction-state-delta.json');

if (!fs.existsSync(currentPath)) throw new Error('outputs/live-reaction-state.json missing; run evaluate-live-reactions first');
const current = JSON.parse(fs.readFileSync(currentPath, 'utf8'));
const previous = fs.existsSync(previousPath) ? JSON.parse(fs.readFileSync(previousPath, 'utf8')) : null;
const list = v => Array.isArray(v) ? v : [];
const byTicker = rows => Object.fromEntries(list(rows).map(r => [r.ticker, r]));
const curr = byTicker(current.all);
const prev = previous ? byTicker(previous.all) : {};
const changes = [];

for (const [ticker, row] of Object.entries(curr)) {
  const old = prev[ticker];
  if (!old) {
    changes.push({
      ticker,
      kind: 'NEW_BASELINE',
      severity: 'info',
      previous: null,
      current: { price: row.price, state: row.reaction?.state || row.state, permission: row.reaction?.permission || row.permission, freshness: row.freshness?.status },
      alert: false,
      read: 'No prior snapshot; establish baseline.'
    });
    continue;
  }
  const oldState = old.reaction?.state || old.state;
  const newState = row.reaction?.state || row.state;
  const oldPermission = old.reaction?.permission || old.permission;
  const newPermission = row.reaction?.permission || row.permission;
  const oldFresh = old.freshness?.status;
  const newFresh = row.freshness?.status;
  const priceMovePct = typeof row.price === 'number' && typeof old.price === 'number' && old.price !== 0 ? ((row.price - old.price) / old.price) * 100 : null;
  const stateChanged = oldState !== newState;
  const permissionChanged = oldPermission !== newPermission;
  const freshnessChanged = oldFresh !== newFresh;
  const largeMove = priceMovePct != null && Math.abs(priceMovePct) >= 3;
  if (stateChanged || permissionChanged || freshnessChanged || largeMove) {
    const severity = /EXIT|STOP|BLOCK|NO ADD|STALE/i.test(`${newState} ${newPermission} ${newFresh}`) ? 'warning' : stateChanged || permissionChanged ? 'notice' : 'info';
    changes.push({
      ticker,
      kind: stateChanged ? 'STATE_CHANGE' : permissionChanged ? 'PERMISSION_CHANGE' : freshnessChanged ? 'FRESHNESS_CHANGE' : 'PRICE_MOVE',
      severity,
      previous: { price: old.price, state: oldState, permission: oldPermission, freshness: oldFresh },
      current: { price: row.price, state: newState, permission: newPermission, freshness: newFresh },
      priceMovePct: priceMovePct == null ? null : Number(priceMovePct.toFixed(2)),
      alert: severity !== 'info',
      read: stateChanged || permissionChanged
        ? `${ticker} changed from ${oldState || oldPermission} to ${newState || newPermission}.`
        : freshnessChanged
          ? `${ticker} freshness changed from ${oldFresh || 'unknown'} to ${newFresh || 'unknown'}.`
          : `${ticker} moved ${priceMovePct.toFixed(2)}% since prior snapshot.`
    });
  }
}

const alertQueue = changes.filter(c => c.alert);
const output = {
  generatedAt: new Date().toISOString(),
  currentGeneratedAt: current.generatedAt,
  previousGeneratedAt: previous?.generatedAt || null,
  baselineOnly: !previous,
  posture: current.posture,
  summary: !previous
    ? 'Baseline established; future runs will show state, permission, freshness, and large price changes.'
    : alertQueue.length
      ? `${alertQueue.length} alert-worthy reaction changes detected.`
      : changes.length
        ? `${changes.length} non-critical reaction changes detected; no alert required.`
        : 'No reaction-state changes detected; no alert required.',
  alertPolicy: 'Alert only on permission/state/freshness changes or large moves; suppress repeated no-action states.',
  counts: { totalChanges: changes.length, alertQueue: alertQueue.length, tracked: Object.keys(curr).length },
  alertQueue,
  changes
};

for (const p of [outPath, publicOutPath]) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(output, null, 2));
}
fs.writeFileSync(previousPath, JSON.stringify(current, null, 2));
console.log(JSON.stringify({ wrote: 'outputs/reaction-state-delta.json', baselineOnly: output.baselineOnly, changes: changes.length, alerts: alertQueue.length }, null, 2));
