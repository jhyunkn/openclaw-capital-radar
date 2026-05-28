const { spawnSync } = require('child_process');

function run(script, options = {}) {
  const result = spawnSync(process.execPath, [script], {
    stdio: 'inherit',
    env: { ...process.env, ...(options.env || {}) }
  });
  return result.status === 0;
}

const skipLiveRefresh = process.env.MONEY_CASH_SKIP_LIVE_REFRESH === '1';
let cacheReady = false;

if (!skipLiveRefresh) {
  console.log('Money / Cash: attempting live FRED cache refresh before state generation');
  cacheReady = run('scripts/refresh-money-cash-cache.cjs');
  if (!cacheReady) {
    console.warn('Money / Cash: live FRED refresh failed; falling back to compact seed cache for visual build continuity');
  }
}

if (!cacheReady) {
  const seeded = run('scripts/generate-money-cash-seed-cache.cjs');
  if (!seeded) process.exit(1);
}

const generated = run('scripts/generate-money-cash-state-from-cache.cjs');
if (!generated) process.exit(1);
