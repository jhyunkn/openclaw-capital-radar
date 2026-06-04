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
// Fetch fresh market data, then fast-build from committed artifacts.
// Full pipeline (npm run build) requires accumulated state not present in a
// fresh clone; fast build renders from committed outputs + refreshed live data.
run('npm', ['run', 'generate:live:partial']);
run('npm', ['run', 'build:fast']);
