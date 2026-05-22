const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
const commands = [
  'node scripts/generate-operational-chart-state.cjs',
  'node scripts/generate-confirmation-state.cjs',
  'node scripts/generate-market-lens-state.cjs',
  'node scripts/generate-strategy-routing-state.cjs',
  'node scripts/generate-trust-strip-state.cjs',
  'node scripts/generate-macro-cycle-state.cjs',
  'node scripts/generate-kostolany-egg-state.cjs',
  'node scripts/inject-kostolany-egg-v3-home.cjs',
  'node scripts/link-kostolany-egg-canonical-shell.cjs'
];
for (const command of commands) {
  console.log('$ ' + command);
  const result = spawnSync(command, { cwd: root, shell: true, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status || 1);
}
console.log('canonical Egg homepage rendered');
