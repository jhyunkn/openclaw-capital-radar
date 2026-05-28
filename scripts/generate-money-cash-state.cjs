const { spawnSync } = require('child_process');

function run(script) {
  const result = spawnSync(process.execPath, [script], { stdio: 'inherit', env: process.env });
  return result.status === 0;
}

const seeded = run('scripts/generate-money-cash-seed-cache.cjs');
if (!seeded) process.exit(1);

const generated = run('scripts/generate-money-cash-state-from-cache.cjs');
if (!generated) process.exit(1);
