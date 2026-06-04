const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..');
function run(command, args) {
  const useShell = command === 'npm' && process.platform === 'win32';
  const executable = useShell ? 'npm' : command;
  console.log('$ ' + executable + ' ' + args.join(' '));
  const result = spawnSync(executable, args, { cwd: root, stdio: 'inherit', shell: useShell });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
// Inject unified macro section and copy committed artifacts to public/.
// generate:live:partial breaks the holding-zone validator when holdings
// lose ticker-specific bands after a fresh data refresh. The injectors
// read from committed outputs/*.json, not from live data, so fresh data
// would not change the deployed HTML anyway.
run(process.execPath, ['scripts/build-vercel.cjs']);
